/* Читальня — service worker (offline shell). Bump CACHE to force an update. */
var CACHE = 'chitalnya-v1';
var CORE = [
  './',
  './index.html',
  './config.js',
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return Promise.allSettled(CORE.map(function (u) { return c.add(u); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Supabase API + realtime must always hit the network — never cache data.
  if (url.hostname.indexOf('.supabase.co') !== -1 || url.hostname.indexOf('.supabase.in') !== -1) return;

  var accept = req.headers.get('accept') || '';

  // HTML / navigations: network-first (always fresh online), cached shell as offline fallback.
  if (req.mode === 'navigate' || accept.indexOf('text/html') !== -1) {
    e.respondWith(
      fetch(req).then(function (res) {
        try { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('./index.html', copy); }); } catch (_) {}
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  // Everything else (config.js, icons, CDN libs, Google Fonts): cache-first, refresh in background.
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) {
          try { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); } catch (_) {}
        }
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});
