'use strict';

const CACHE = 'breath-v1';
const ASSETS = [
  './',
  'index.html',
  'app.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache opportunistico solo per same-origin GET con risposta ok
        if (res && res.ok && new URL(req.url).origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
