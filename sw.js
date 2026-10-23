// Offline support: app files are served from cache; fonts are cached as they load.
// Bump VERSION whenever any app file changes so phones pick up the update.
const VERSION = "rukkilill-v6";
const APP_FILES = [
  "./", "index.html", "manifest.webmanifest", "vendor/anthropic.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  // cache: "reload" skips the browser's HTTP cache, so a new version never stores stale files.
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.all(APP_FILES.map(f => fetch(f, {cache: "reload"}).then(res => {
      if (!res.ok) throw new Error(f + " " + res.status);
      return c.put(f, res);
    }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com";
  if (url.origin !== location.origin && !isFont) return; // Claude API calls go straight to the network

  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, {ignoreSearch: !isFont});
    const fresh = fetch(req, isFont ? {} : {cache: "no-cache"}).then(res => {
      if (res.ok || res.type === "opaque") cache.put(req, res.clone());
      return res;
    });
    if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
    return fresh.catch(() => req.mode === "navigate" ? cache.match("index.html") : Response.error());
  }));
});
