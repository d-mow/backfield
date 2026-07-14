/* Fore — service worker.
 * Fore is used on a golf course: exactly where there is no signal.
 * BUMP CACHE_VERSION ON EVERY DEPLOY or returning visitors keep the old shell.
 */
const CACHE_VERSION = 'fore-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isFont = url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com');
  if (url.origin !== self.location.origin && !isFont) return;
  e.respondWith(caches.match(request).then((cached) => {
    const net = fetch(request).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => null);
    if (cached) return cached;
    return net.then((res) => res || (request.mode === 'navigate'
      ? caches.match('./index.html') : new Response('', { status: 504 })));
  }));
});
