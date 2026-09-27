// Offline: najpierw sieć (zawsze świeża wersja), bez zasięgu na siłowni — pamięć podręczna.
const CACHE = 'silownia-v3';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/util.js', 'js/db.js', 'js/state.js', 'js/xlsx.js', 'js/importer.js', 'js/stats.js',
  'js/game.js', 'js/quotes.js', 'js/charts.js', 'js/icons.js',
  'js/views/today.js', 'js/views/workout.js', 'js/views/calendar.js', 'js/views/stats.js',
  'js/views/body.js', 'js/views/profile.js', 'js/views/session.js', 'js/views/exercise.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    try {
      const res = await fetch(e.request, { cache: 'no-cache' });
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch {
      return (await cache.match(e.request, { ignoreSearch: true })) ?? Response.error();
    }
  }));
});
