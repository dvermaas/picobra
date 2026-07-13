// Picobra service worker — offline app shell + on-demand language caching.
const VERSION = "picobra-v1";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./css/styles.css",
  "./js/app.js", "./js/ui.js", "./js/engine.js", "./js/store.js", "./js/data.js",
  "./data/index.json",
  "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/apple-touch-icon.png", "./icons/favicon-32.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // App shell for navigations (works offline / on refresh).
  if (request.mode === "navigate") {
    e.respondWith(caches.match("./index.html").then((r) => r || fetch(request)));
    return;
  }

  // Language banks: stale-while-revalidate so first play caches them for offline.
  if (url.pathname.includes("/data/") && url.pathname.endsWith(".json")) {
    e.respondWith(
      caches.open(VERSION).then((cache) =>
        cache.match(request).then((cached) => {
          const net = fetch(request).then((res) => { cache.put(request, res.clone()); return res; }).catch(() => cached);
          return cached || net;
        })
      )
    );
    return;
  }

  // Everything else: cache-first.
  e.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(request, copy));
        return res;
      })
    )
  );
});
