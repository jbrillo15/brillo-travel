/* Phase 0 spike service worker. Cache-first for the spike shell only.
   Never touches API calls (they're cross-origin POSTs). A new version waits;
   no skipWaiting (HANDOFF §7). */
var CACHE = 'brillo-spike-1';
var SHELL = ['./', './index.html', './spike.js', './manifest.webmanifest',
  './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) {
      return k.indexOf('brillo-spike-') === 0 && k !== CACHE;
    }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    if (hit) return hit;
    return fetch(req).catch(function () {
      return req.mode === 'navigate' ? caches.match('./index.html') : Response.error();
    });
  }));
});

self.addEventListener('message', function (e) {
  if (e.data === 'version') e.source.postMessage({ type: 'version', cache: CACHE });
});
