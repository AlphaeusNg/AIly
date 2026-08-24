/* AIly service worker — offline shell for PWA install on Windows/Android */
const CACHE_PREFIX = "aily-";
const CACHE = "aily-2026.08.25.2";
const SCOPE_URL = new URL(self.registration.scope);
const ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./css/app.css",
  "./js/app.js",
  "./js/store.js",
  "./js/capacity.js",
  "./js/target.js",
  "./js/tutorial.js",
  "./js/usage.js",
  "./js/block.js",
  "./js/ally.js",
  "./js/journey.js",
  "./js/platform-usage.js",
  "./js/version.js",
  "./manifest.webmanifest",
  "./assets/logo.svg",
  "./assets/splash-mark.svg",
  "./icons/icon-48.png",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-192.png",
  "./icons/icon-256.png",
  "./icons/icon-384.png",
  "./icons/icon-512.png",
  "./favicon.png",
  "./favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        // Prefer partial cache over failing entire install if one asset 404s.
        Promise.all(
          ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn("AIly SW skip asset", url, err);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // The GitHub Pages origin hosts several projects. Do not intercept or cache
  // requests outside this installed AIly scope, even when they share an origin.
  if (
    url.origin !== SCOPE_URL.origin ||
    !url.pathname.startsWith(SCOPE_URL.pathname)
  ) {
    return;
  }

  const accept = req.headers.get("accept") || "";
  const navigate = req.mode === "navigate" || accept.includes("text/html");
  const cachePromise = caches.open(CACHE);
  const cachedPromise = cachePromise.then((cache) => cache.match(req));
  const networkPromise = Promise.all([cachePromise, cachedPromise]).then(
    ([cache, cached]) => fetch(req)
      .then(async (response) => {
        if (response?.ok) {
          try {
            await cache.put(req, response.clone());
          } catch {
            // A quota/policy failure must not discard a valid network response.
          }
        }
        return response;
      })
      .catch(() => cached || (navigate ? cache.match("./offline.html") : undefined))
  );
  event.respondWith(cachedPromise.then((cached) => cached || networkPromise));
  event.waitUntil(networkPromise.then(() => undefined));
});
