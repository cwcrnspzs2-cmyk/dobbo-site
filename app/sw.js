// Dobbo HQ service worker: app-schil offline, data altijd live van Supabase.
const CACHE = 'dobbo-hq-v18';
const SHELL = ['./', 'index.html', 'app.js?v=18', 'config.js?v=18', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase en fonts: netwerk
  const fallback = () => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'));
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) return fallback().then((c) => c || r); // bv. 503 tijdens publiceren: laatst bewaarde versie
      const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r;
    }).catch(fallback)
  );
});
