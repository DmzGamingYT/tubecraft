/*
 * Service worker de TubeCraft — volontairement minimal.
 *
 * - navigations : réseau d’abord, cache de secours (l’app reste ouvrable hors
 *   ligne une fois visitée) ;
 * - assets statiques same-origin : cache d’abord, puis réseau et mise en cache ;
 * - /yt/api et les domaines tiers : jamais interceptés, pour ne pas servir de
 *   données YouTube périmées ni casser les vignettes et le lecteur.
 *
 * Le nom de cache change avec la version : les anciens caches sont supprimés
 * à l’activation.
 */

const CACHE = 'tubecraft-shell-v1';
const SHELL = ['./', './manifest.webmanifest', './favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/yt/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit || caches.match('./'))
            .then((hit) => hit || new Response('Hors ligne', { status: 503 }))
        )
    );
    return;
  }

  if (/\.(?:js|css|mjs|svg|png|webp|avif|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request)
            .then((response) => {
              if (response.ok) {
                const copy = response.clone();
                caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
              }
              return response;
            })
            .catch(() => new Response('', { status: 504 }))
      )
    );
  }
});
