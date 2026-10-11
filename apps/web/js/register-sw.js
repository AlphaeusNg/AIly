if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        // Warm the deferred focus controls after the page has loaded, without
        // importing or executing them on the first-paint path.
        const warmFocus = () => registration.active?.postMessage({ type: "CACHE_FOCUS_CONTROLS" });
        if ("requestIdleCallback" in window) window.requestIdleCallback(warmFocus, { timeout: 2000 });
        else window.setTimeout(warmFocus, 0);
      })
      .catch((err) => {
        console.warn("AIly SW register failed", err);
      });
  });
}
