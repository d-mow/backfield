/* Field Camera service worker — offline shell.
   Bump CACHE on any shipped change so clients pick up the new build.
   HTML is served network-first, so app updates land even without a bump. */
const CACHE = 'fieldcam-v2';
const SHELL = [
  '/field-camera/',
  '/field-camera/index.html',
  '/field-camera/about/',
  '/field-camera/manifest.json',
  '/field-camera/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll is atomic — a single 404 aborts. Cache best-effort instead.
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const isDoc = req.mode === 'navigate' ||
                  (req.headers.get('accept') || '').includes('text/html');

    // HTML: NETWORK-FIRST. Cache-first here means a shipped update never reaches
    // anyone who already has the app cached — fall back to cache only when offline.
    if (isDoc) {
      e.respondWith(
        fetch(req).then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        }).catch(() => caches.match(req).then(hit => hit || caches.match('/field-camera/')))
      );
      return;
    }

    // Static assets (icons, manifest): cache-first is fine, they're versioned by name.
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // Cross-origin (map tiles, fonts): network-first, cache opportunistically for offline reuse.
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req))
  );
});
