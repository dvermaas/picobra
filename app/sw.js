// Picobra service worker — offline app shell + resilient language caching.
// Bump VERSION on every release: it forces an update and purges old caches.
const VERSION = "picobra-v5";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./css/styles.css",
  "./js/app.js", "./js/ui.js", "./js/engine.js", "./js/store.js", "./js/data.js",
  "./data/index.json",
  "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/apple-touch-icon.png", "./icons/favicon-32.png",
];

self.addEventListener("install", (e) => {
  // allSettled so one missing shell file can't brick the whole install.
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only ever cache successful responses — never store a 404/opaque error.
function cachePut(request, res) {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(request, copy));
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Navigations -> cached app shell (offline / refresh), else network.
  if (request.mode === "navigate") {
    e.respondWith(caches.match("./index.html").then((r) => r || fetch(request)));
    return;
  }

  // Language banks -> network-first: always fresh after a deploy, only OK
  // responses are cached, and it falls back to cache when offline. A transient
  // 404 can no longer get stuck in the cache.
  if (url.pathname.includes("/data/") && url.pathname.endsWith(".json")) {
    e.respondWith(
      fetch(request).then((res) => cachePut(request, res)).catch(() => caches.match(request))
    );
    return;
  }

  // Everything else (js/css/icons) -> stale-while-revalidate: serve from cache
  // instantly, then refresh in the background so code edits show up on the next
  // reload even without a VERSION bump. Only OK responses are cached.
  e.respondWith(
    caches.match(request).then((cached) => {
      const net = fetch(request).then((res) => cachePut(request, res)).catch(() => cached);
      return cached || net;
    })
  );
});
