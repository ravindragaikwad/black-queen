'use strict';
// Offline support. Bump CACHE's version when changing the file list so old caches are dropped.
const CACHE = 'blackqueen-v1';
const FILES = [
  './',
  './index.html',
  './styles.css',
  './blackqueen.js',
  './bot.js',
  './scoreboard.js',
  './session.js',
  './render.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache first so it works offline; refresh the cached copy in the background so updates arrive next visit.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(event.request).then((hit) => {
        const refresh = fetch(event.request).then((res) => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        });
        return hit || refresh;
      }).catch(() => cache.match(event.request)),
    ),
  );
});
