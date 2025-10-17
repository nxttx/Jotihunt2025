const CACHE_NAME = 'jotihunt-shell-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/map.js',
  '/js/name.js',
  '/js/socket.js',
  '/js/areas.js'
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => { if(k !== CACHE_NAME) return caches.delete(k); }))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  // navigation request -> try network first then cache fallback
  if(req.mode === 'navigate'){
    ev.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // for assets use cache-first
  ev.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      // populate cache for future
      const copy = resp.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, copy));
      return resp;
    }).catch(() => {}) )
  );
});
