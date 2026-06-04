/* 필드로그 service worker */
const VERSION = 'fieldlog-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).catch(()=>{}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache Google Sheets / Drive / Apps Script / geocoding — always go to network
  if (/docs\.google\.com|script\.google\.com|drive\.google\.com|googleusercontent\.com|nominatim/.test(url.host + url.pathname)) {
    return; // default browser handling (network)
  }

  // Same-origin app shell: cache-first, then update in background
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put(req, copy)).catch(()=>{});
          }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // Cross-origin (Leaflet CDN, fonts, OSM tiles): stale-while-revalidate
  e.respondWith(
    caches.open(VERSION).then(c =>
      c.match(req).then(cached => {
        const net = fetch(req).then(res => { if (res && res.status === 200) c.put(req, res.clone()); return res; }).catch(() => cached);
        return cached || net;
      })
    )
  );
});
