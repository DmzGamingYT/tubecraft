import {
  aiSearchPlan,
  aiVideoSummary,
  continuationTokens,
  dislikeData,
  findFirst,
  innerTubeComments,
  innerTubePlayer,
  innerTubePost,
  innerTubeSearch,
  innerTubeSuggest,
  parseChannelPage,
  parseSearchResults,
  parseSummaryInput,
  parseVideoPage,
  sponsorSegments,
  type SummaryInput,
} from '../server/ytProxy';

/**
 * TubeCraft sur Cloudflare Workers (Freebuff Sites).
 *
 * - `/yt/api/*` : même contrat que le proxy Vite de développement, avec cache
 *   mémoire par isolate et limite de requêtes ;
 * - tout le reste : assets statiques du build Vite, avec repli SPA.
 *
 * Aucun secret : InnerTube, SponsorBlock, Return YouTube Dislike et
 * Pollinations sont publics et sans clé.
 */

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetsBinding;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const RATE_WINDOW = 60_000;
const RATE_MAX = 240;
const MAX_CACHE_ENTRIES = 300;

interface CacheEntry {
  expires: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();
const rates = new Map<string, { count: number; reset: number }>();

function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T);
  if (hit) cache.delete(key);

  return load().then((value) => {
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { expires: Date.now() + ttl, value });
    return value;
  });
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rates.get(ip);
  if (!entry || entry.reset < now) {
    rates.set(ip, { count: 1, reset: now + RATE_WINDOW });
    if (rates.size > 5_000) rates.clear();
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function fail(error: unknown, fallback = 'Service YouTube indisponible'): Response {
  console.error('[yt-proxy-worker]', error);
  return json(502, { error: fallback });
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

async function readSummaryBody(request: Request): Promise<
  { ok: true; input: SummaryInput } | { ok: false; response: Response }
> {
  const text = await request.text();
  if (text.length > 16_000) {
    return { ok: false, response: json(413, { error: 'Métadonnées trop volumineuses' }) };
  }
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    return { ok: false, response: json(400, { error: 'Corps JSON invalide' }) };
  }
  const input = parseSummaryInput(body);
  if (!input) {
    return { ok: false, response: json(400, { error: 'Métadonnées de vidéo invalides' }) };
  }
  return { ok: true, input };
}

async function handleApi(request: Request, url: URL): Promise<Response> {
  const isSummaryPost = request.method === 'POST' && url.pathname === '/yt/api/summary';
  if (request.method !== 'GET' && request.method !== 'HEAD' && !isSummaryPost) {
    return json(405, { error: 'Méthode non autorisée' });
  }
  if (rateLimited(clientIp(request))) {
    return new Response(JSON.stringify({ error: 'Trop de requêtes, réessayez dans une minute' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Retry-After': '60',
        'Cache-Control': 'no-store',
      },
    });
  }

  const path = url.pathname;

  try {
    if (isSummaryPost) {
      const result = await readSummaryBody(request);
      if (!result.ok) return result.response;
      const fingerprint = hashText(JSON.stringify(result.input));
      const data = await cached(`summary:${fingerprint}`, 1000 * 60 * 60 * 6, () =>
        aiVideoSummary(result.input)
      ).catch((error) => {
        console.error('[yt-proxy-worker] résumé IA', error);
        return null;
      });
      if (!data) return json(502, { error: 'Résumé IA indisponible' });
      return json(200, data);
    }

    if (path === '/yt/api/search') {
      const q = (url.searchParams.get('q') ?? '').trim();
      const continuation = url.searchParams.get('continuation') ?? undefined;
      if (!q && !continuation) return json(400, { error: 'Paramètre q manquant' });
      if (q.length > 200) return json(400, { error: 'Requête trop longue' });

      const sort = url.searchParams.get('sort') ?? 'relevance';
      const type = url.searchParams.get('type') ?? 'all';
      const data = await cached(
        `search:${q}:${sort}:${type}:${continuation ?? ''}`,
        1000 * 60 * 5,
        () => innerTubeSearch(q, { continuation, sort, type })
      );
      return json(200, {
        query: q,
        results: parseSearchResults(data),
        continuation: continuationTokens(data)[0] ?? null,
        estimated: data?.estimatedResults ? Number(data.estimatedResults) : null,
      });
    }

    if (path === '/yt/api/video') {
      const id = url.searchParams.get('v') ?? '';
      if (!VIDEO_ID.test(id)) return json(400, { error: 'Identifiant vidéo invalide' });

      const data = await cached(`video:${id}`, 1000 * 60 * 10, async () => {
        const [next, player, ryd] = await Promise.allSettled([
          innerTubePost('next', { videoId: id }),
          innerTubePlayer(id),
          dislikeData(id),
        ]);
        if (next.status === 'rejected') throw next.reason;
        const page = parseVideoPage(
          next.value,
          player.status === 'fulfilled' ? player.value : null,
          id
        );
        if (ryd.status === 'fulfilled' && ryd.value) {
          page.video.likes = ryd.value.likes;
          page.video.dislikes = ryd.value.dislikes;
          page.video.viewsCount = ryd.value.viewCount || page.video.viewsCount;
        }
        return page;
      });
      return json(200, data);
    }

    if (path === '/yt/api/player') {
      const id = url.searchParams.get('v') ?? '';
      if (!VIDEO_ID.test(id)) return json(400, { error: 'Identifiant vidéo invalide' });
      const data = await cached(`player:${id}`, 1000 * 60 * 10, () => innerTubePlayer(id));
      return json(200, data);
    }

    if (path === '/yt/api/channel') {
      const id = url.searchParams.get('id') ?? '';
      if (!CHANNEL_ID.test(id)) return json(400, { error: 'Identifiant de chaîne invalide' });

      const tab = url.searchParams.get('tab') === 'shorts' ? 'shorts' : 'videos';
      const continuation = url.searchParams.get('continuation') ?? undefined;
      const params =
        tab === 'shorts' ? 'EgZzaG9ydHPyBgUKA5oBAA%3D%3D' : 'EgZ2aWRlb3PyBgQKAjoA';

      const data = await cached(
        `channel:${id}:${tab}:${continuation ?? ''}`,
        1000 * 60 * 5,
        () =>
          continuation
            ? innerTubePost('browse', { continuation })
            : innerTubePost('browse', { browseId: id, params })
      );

      if (continuation) {
        return json(200, {
          channel: null,
          videos: parseSearchResults(data).filter((video) => video.kind === 'video'),
          continuation: findFirst(data, 'continuationItemRenderer')
            ? continuationTokens(findFirst(data, 'continuationItemRenderer'))[0] ?? null
            : null,
        });
      }
      return json(200, parseChannelPage(data, id));
    }

    if (path === '/yt/api/comments') {
      const id = url.searchParams.get('v') ?? '';
      const continuation = url.searchParams.get('continuation') ?? undefined;
      if (!continuation && !VIDEO_ID.test(id)) {
        return json(400, { error: 'Identifiant vidéo invalide' });
      }
      const data = await cached(`comments:${id}:${continuation ?? ''}`, 1000 * 60 * 3, () =>
        innerTubeComments(continuation ? undefined : id, continuation)
      );
      return json(200, data);
    }

    if (path === '/yt/api/suggest') {
      const q = (url.searchParams.get('q') ?? '').trim();
      if (!q) return json(200, { suggestions: [] });
      return json(200, { suggestions: await innerTubeSuggest(q.slice(0, 100)) });
    }

    if (path === '/yt/api/sponsorblock') {
      const id = url.searchParams.get('v') ?? '';
      if (!VIDEO_ID.test(id)) return json(400, { error: 'Identifiant vidéo invalide' });
      const segments = await cached(`sponsor:${id}`, 1000 * 60 * 60, () => sponsorSegments(id));
      return json(200, { segments });
    }

    if (path === '/yt/api/ai') {
      const q = (url.searchParams.get('q') ?? '').trim();
      if (!q) return json(400, { error: 'Paramètre q manquant' });
      const plan = await cached(`ai:${q.toLowerCase()}`, 1000 * 60 * 30, () => aiSearchPlan(q));
      return json(200, plan);
    }

    return json(404, { error: 'Route inconnue' });
  } catch (error) {
    return fail(error);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/yt/api/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: { Allow: 'GET, HEAD, POST, OPTIONS' },
        });
      }
      return handleApi(request, url);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    /**
     * La vitrine de la collection est un site statique à part entière, servi
     * dans le sous-dossier `/collection/`.
     *
     * Ses assets sont relatifs (`base: './'`), donc le dossier doit se terminer
     * par une barre oblique : sans elle, `collection/assets/…` se résout en
     * `/assets/…` et la page arrive sans styles.
     */
    if (url.pathname === '/collection' || url.pathname === '/collection/') {
      if (url.pathname === '/collection') {
        return Response.redirect(new URL('/collection/', url), 301);
      }
      return env.ASSETS.fetch(
        new Request(new URL('/collection/index.html', url), {
          method: 'GET',
          headers: request.headers,
        })
      );
    }

    const response = await env.ASSETS.fetch(request);
    if (
      response.status === 404 &&
      (request.headers.get('accept') ?? '').includes('text/html')
    ) {
      return env.ASSETS.fetch(
        new Request(new URL('/index.html', url), {
          method: 'GET',
          headers: request.headers,
        })
      );
    }
    return response;
  },
} satisfies { fetch(request: Request, env: Env): Promise<Response> };
