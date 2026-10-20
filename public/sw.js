/*
 * Service worker de Séquence — coquille + mode avion.
 *
 * - navigations : réseau d’abord, cache de secours (l’app reste ouvrable hors
 *   ligne une fois visitée) ;
 * - assets statiques same-origin : cache d’abord, puis réseau et mise en cache ;
 * - /yt/api (GET publiques) : réseau d’abord, puis dernière réponse connue.
 *   On ne met jamais en cache les requêtes d’écriture, les réponses d’erreur
 *   ni la route de débogage `/yt/api/raw`. Les données restent des copies
 *   locales de réponses YouTube publiques ;
 * - vignettes et avatars (i.ytimg.com, yt3.ggpht.com) : cache d’abord avec
 *   revalidation en arrière-plan, pour que les cartes restent lisibles hors
 *   ligne.
 *
 * Le nom des caches change avec la version : les anciens caches sont supprimés
 * à l’activation.
 */

const CACHE = 'tubecraft-shell-v2';
const API_CACHE = 'tubecraft-api-v1';
const IMAGE_CACHE = 'tubecraft-images-v1';
const SHELL = ['./', './manifest.webmanifest', './favicon.svg'];
const API_MAX = 80;
const IMAGE_MAX = 120;

/** Garde les `max` entrées les plus récentes d’un cache. */
async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((key) => cache.delete(key)));
}

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      await trimCache(API_CACHE, API_MAX);
    }
    return response;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    return new Response(
      JSON.stringify({
        error: 'Hors ligne : cette requête n’est pas encore dans le cache local.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const hit = await cache.match(request);
  if (hit) {
    // revalidation silencieuse : l’image reste disponible hors ligne
    fetch(request)
      .then((response) => {
        if (response.ok || response.type === 'opaque') {
          return cache.put(request, response);
        }
      })
      .catch(() => {});
    return hit;
  }

  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      await cache.put(request, response.clone());
      await trimCache(IMAGE_CACHE, IMAGE_MAX);
    }
    return response;
  } catch {
    return new Response('', { status: 504 });
  }
}

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
  const keep = new Set([CACHE, API_CACHE, IMAGE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    if (
      request.destination === 'image' &&
      (url.hostname === 'i.ytimg.com' || url.hostname === 'yt3.ggpht.com')
    ) {
      event.respondWith(cacheFirstImage(request));
    }
    return;
  }

  if (url.pathname.includes('/yt/api/')) {
    if (url.pathname === '/yt/api/raw') return;
    event.respondWith(networkFirstApi(request));
    return;
  }

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
