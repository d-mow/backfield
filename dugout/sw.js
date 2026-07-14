/* Dugout — service worker
 *
 * Network-first: always try for a fresh build when there's signal, fall back to
 * the cache when there isn't. That means a coach in a dugout with no bars still
 * gets the app, and a coach at home always gets the latest version.
 *
 * Bump CACHE_VERSION on every deploy so old shells are evicted.
 */

const CACHE_VERSION = "dugout-v1";

// The app is a single self-contained HTML file (fonts, React, XLSX all inlined),
// so the shell is genuinely just these few entries.
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      // Take over immediately rather than waiting for all tabs to close.
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
            .filter((k) => k !== CACHE_VERSION)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GETs from our own origin. Never touch POSTs or cross-origin.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Good response → refresh the cache copy for next time.
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        // Offline (or the fetch failed) → serve from cache.
        caches.match(req).then((cached) => {
          if (cached) return cached;
          // Navigation with nothing cached for this exact URL: fall back to the
          // app shell so a deep link / refresh still boots the app offline.
          if (req.mode === "navigate") {
            return caches.match("./index.html");
          }
          return Response.error();
        })
      )
  );
});
