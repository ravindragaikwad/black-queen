'use strict';
// Offline support. Bump CACHE's version when changing the file list so old caches are dropped.
const CACHE = 'blackqueen-v4';
const FILES = [
  './',
  './index.html',
  './styles.css',
  './blackqueen.js',
  './bot.js',
  './smart.js',
  './scoreboard.js',
  './session.js',
  './cards.js',
  './render.js',
  './sound.js',
  './fx.js',
  './vendor/gsap.min.js',
  './vendor/confetti.browser.js',
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

// Network first (skipping the browser's HTTP cache) so updates show up straight away;
// the saved copy is only used when the network is unavailable, which keeps the app working offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
        }
        return res;
      })
      .catch(() => caches.match(event.request)),
  );
});
