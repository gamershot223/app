// WorkAI PWA scaffold — minimal offline app-shell service worker.
//
// Scope on purpose: this caches ONLY the static shell (the HTML entry,
// hashed JS/CSS bundles, icons, the manifest). It NEVER caches API or data
// responses — the site is generated and republished, and its data changes
// live (PostgREST reads, leads, orders, auth). An aggressive cache here
// would show stale content after a republish or break checkout/lead forms
// offline-looking-online. Do not add caching for /api/, /auth/, /_workai/
// or any *.json data file (demo catalogs, feeds, etc).
//
// Strategy:
//  - navigations: network-first, falling back to the cached shell only when
//    the network is unavailable (so a republish is visible immediately);
//  - shell assets (script/style/image/font): stale-while-revalidate, so a
//    repeat visit is instant and still picks up the next build in the
//    background.

const SHELL_CACHE = 'workai-shell-v1';
// Относительные, а не '/' и '/manifest.webmanifest': пути в addAll резолвятся
// относительно URL самого sw.js, то есть его scope. Под префиксом превью
// абсолютный '/' указывал на корень чужого домена — addAll падал целиком,
// install ловил ошибку в .catch и прекэш МОЛЧА не работал. Относительная
// форма верна и в превью, и на опубликованном сайте в корне.
const PRECACHE_URLS = ['./', './manifest.webmanifest'];

// Platform/API traffic proxied by this site's own nginx — must always hit
// the network, never the cache.
const NEVER_CACHE_RE = /^\/(api|auth|_workai)\//;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {
        // Offline-at-install or a flaky network: not fatal, the shell just
        // fills in on the first successful navigation instead.
      }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableShellRequest(url) {
  if (url.origin !== self.location.origin) return false;
  if (NEVER_CACHE_RE.test(url.pathname)) return false;
  // Demo/data JSON (products.json, reviews.json, future feeds) is content,
  // not shell — never cache it here.
  if (url.pathname.endsWith('.json')) return false;
  return true;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isCacheableShellRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(SHELL_CACHE)
            .then((cache) => cache.put('/', copy))
            .catch(() => {});
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached || caches.match(request))),
    );
    return;
  }

  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              cache.put(request, response.clone()).catch(() => {});
              return response;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        }),
      ),
    );
  }
});
