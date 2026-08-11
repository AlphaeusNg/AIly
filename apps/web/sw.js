/* AIly service worker — offline shell for PWA install on Windows/Android */
const CACHE = "aily-2026.08.11.103";
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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
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
  const accept = req.headers.get("accept") || "";
  const navigate = req.mode === "navigate" || accept.includes("text/html");
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res.ok && new URL(req.url).origin === self.location.origin) {
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (hit) return hit;
          if (navigate) return caches.match("./offline.html");
          return hit;
        });
      return hit || net;
    })
  );
});
