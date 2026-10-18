import type { Channel, SearchResult, SponsorSegment, Video, VideoPage } from '../types';
import { parseViews } from '../lib/format';
import { mergeChannelVideos } from '../lib/notifications';
import { rememberChannel, rememberVideo } from '../data/dynamic';
import { videos, shorts, channels } from '../data/catalog';

/**
 * Couche d'accès aux données YouTube (via le proxy InnerTube du serveur).
 *
 * - cache mémoire court pour éviter les allers-retours lors d'une navigation ;
 * - repli sur le catalogue embarqué si le proxy est indisponible ;
 * - les vidéos découvertes sont mémorisées pour que leurs liens restent valides.
 */

export interface SearchChannel {
  id: string;
  name: string;
  avatar: string;
  subscribers: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  channels: SearchChannel[];
  live: boolean;
  continuation: string | null;
  estimated: number | null;
}

export type SortOrder = 'relevance' | 'date' | 'views';
export type ResultType = 'all' | 'video';

interface RawSearchResult extends SearchResult {
  kind?: 'video' | 'channel';
  /** renseigné pour les résultats de type chaîne */
  handle?: string;
}

interface RawChannel {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  banner: string;
  subscribers: string;
  description?: string;
  videoCount?: string;
}

interface RawVideoPage {
  video: Omit<Video, 'channelId' | 'channelName'> & { likes: number | null };
  channel: RawChannel | null;
  related: RawSearchResult[];
}

/* ------------------------------------------------------------------ cache */

interface CacheEntry {
  at: number;
  data: unknown;
}

const memory = new Map<string, CacheEntry>();

async function apiGet<T>(
  path: string,
  options: { signal?: AbortSignal; ttl?: number } = {}
): Promise<T> {
  const { signal, ttl = 30_000 } = options;
  const hit = memory.get(path);
  if (hit && Date.now() - hit.at < ttl) return hit.data as T;

  const res = await fetch(`/yt/api/${path}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = String(body.error);
    } catch {
      /* réponse non JSON */
    }
    throw new Error(message);
  }
  const data = (await res.json()) as T;
  memory.set(path, { at: Date.now(), data });
  return data;
}

/** Vide le cache mémoire (utile quand on veut forcer un rafraîchissement). */
export function clearApiCache(): void {
  memory.clear();
}

/* ------------------------------------------------------------- conversion */

/** Convertit un résultat de recherche en `Video` exploitable par l'UI. */
export function resultToVideo(result: SearchResult, overrides: Partial<Video> = {}): Video {
  const video: Video = {
    id: result.videoId,
    title: result.title || 'Vidéo sans titre',
    channelId: result.channelId || overrides.channelId || '',
    channelName: result.channelName || overrides.channelName || 'YouTube',
    duration: result.duration,
    views: result.views,
    viewsCount: parseViews(result.views),
    publishedAt: result.publishedAt,
    description: '',
    category: 'Recherche',
    tags: [],
    likes: 0,
    isShort: result.isShort,
    statusText: result.statusText,
    channelAvatar: result.channelAvatar ?? '',
    ...overrides,
  };
  rememberVideo(video);
  if (video.channelId && video.channelName) {
    rememberChannel({
      id: video.channelId,
      name: video.channelName,
      handle: '',
      avatar: video.channelAvatar ?? '',
      subscribers: '',
    });
  }
  return video;
}

function toChannel(raw: RawChannel): Channel {
  const channel: Channel = {
    id: raw.id,
    name: raw.name,
    handle: raw.handle ?? '',
    avatar: raw.avatar ?? '',
    subscribers: raw.subscribers ?? '',
    banner: raw.banner || undefined,
    description: raw.description,
    videoCount: raw.videoCount,
  };
  rememberChannel(channel);
  return channel;
}

/* --------------------------------------------------------------- recherche */

export interface SearchOptions {
  sort?: SortOrder;
  type?: ResultType;
  signal?: AbortSignal;
}

/** Recherche LIVE via le proxy InnerTube ; repli sur le catalogue local. */
export async function searchYouTube(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const { sort = 'relevance', type = 'all', signal } = options;
  const q = query.trim();
  if (!q) return { query: q, results: [], channels: [], live: false, continuation: null, estimated: null };

  try {
    const data = await apiGet<{
      results: RawSearchResult[];
      continuation: string | null;
      estimated: number | null;
    }>(
      `search?q=${encodeURIComponent(q)}&sort=${sort}&type=${type}`,
      { signal, ttl: 60_000 }
    );

    const rawResults = data.results ?? [];
    const channelResults: SearchChannel[] = rawResults
      .filter((r) => r.kind === 'channel' && r.channelId)
      .map((r) => ({
        id: r.channelId,
        name: r.channelName || 'Chaîne',
        avatar: r.channelAvatar || '',
        subscribers: (r.handle || r.views || '').trim(),
      }));

    const results = rawResults.filter(
      (r): r is RawSearchResult => r.kind !== 'channel' && Boolean(r.videoId)
    );
    if (results.length === 0 && channelResults.length === 0) {
      throw new Error('Aucun résultat');
    }

    results.forEach((r) => resultToVideo(r));
    channelResults.forEach((c) =>
      rememberChannel({ id: c.id, name: c.name, handle: '', avatar: c.avatar, subscribers: c.subscribers })
    );

    return {
      query: q,
      results,
      channels: channelResults,
      live: true,
      continuation: data.continuation ?? null,
      estimated: data.estimated ?? null,
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    const results = localSearch(q);
    results.forEach((r) => resultToVideo(r));
    const needle = q.toLowerCase();
    const channelResults = channels
      .filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          String(c.handle ?? '').toLowerCase().includes(needle)
      )
      .slice(0, 5)
      .map((c) => ({ id: c.id, name: c.name, avatar: c.avatar, subscribers: c.subscribers }));
    return { query: q, results, channels: channelResults, live: false, continuation: null, estimated: null };
  }
}

/** Page suivante de résultats (continuation InnerTube). */
export async function searchMore(
  continuation: string,
  signal?: AbortSignal
): Promise<{ results: SearchResult[]; channels: SearchChannel[]; continuation: string | null }> {
  const data = await apiGet<{
    results: RawSearchResult[];
    continuation: string | null;
  }>(`search?q=&continuation=${encodeURIComponent(continuation)}`, { signal, ttl: 60_000 });

  const raw = data.results ?? [];
  const results = raw.filter((r) => r.kind !== 'channel' && Boolean(r.videoId));
  const channelResults = raw
    .filter((r) => r.kind === 'channel' && r.channelId)
    .map((r) => ({
      id: r.channelId,
      name: r.channelName,
      avatar: r.channelAvatar,
      subscribers: r.handle || r.views || '',
    }));
  results.forEach((r) => resultToVideo(r));
  return { results, channels: channelResults, continuation: data.continuation ?? null };
}

const STOP_WORDS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'pour', 'dans', 'que', 'qui',
  'the', 'a', 'of', 'and', 'in', 'to', 'for', 'on', 'with',
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

/** Repli hors-ligne : classement par recouvrement de mots-clés sur le catalogue. */
function localSearch(query: string): SearchResult[] {
  const terms = tokenize(query);
  const pool = [...videos, ...shorts];
  const scored = pool
    .map((video) => {
      const haystack = tokenize(
        `${video.title} ${video.channelName} ${video.category} ${video.tags.join(' ')}`
      );
      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) score += 3;
        else if (haystack.some((h) => h.startsWith(term) || term.startsWith(h))) score += 1;
      }
      return { video, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.video.viewsCount - a.video.viewsCount);

  return scored.map(({ video }) => ({
    videoId: video.id,
    title: video.title,
    channelId: video.channelId,
    channelName: video.channelName,
    channelAvatar: video.channelAvatar ?? '',
    duration: video.duration,
    views: video.views,
    publishedAt: video.publishedAt,
    thumbnail: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    isShort: !!video.isShort,
  }));
}

/* ------------------------------------------------------------ page vidéo */

/** Métadonnées réelles + suggestions YouTube pour la page de lecture. */
export async function fetchVideoPage(videoId: string, signal?: AbortSignal): Promise<VideoPage> {
  const raw = await apiGet<RawVideoPage>(`video?v=${encodeURIComponent(videoId)}`, {
    signal,
    ttl: 5 * 60_000,
  });

  const channel = raw.channel ? toChannel(raw.channel) : null;
  const video: Video = {
    ...raw.video,
    likes: raw.video.likes ?? 0,
    channelId: channel?.id ?? '',
    channelName: channel?.name ?? 'YouTube',
    channelAvatar: channel?.avatar ?? '',
  };
  rememberVideo(video);

  const related = (raw.related ?? [])
    .filter((r) => r.videoId && r.videoId !== videoId)
    .map((r) =>
      resultToVideo(r, {
        channelId: r.channelId || video.channelId,
        channelName: r.channelName || video.channelName,
      })
    );

  return { video, channel, related };
}

/* --------------------------------------------------------------- chaîne */

export interface ChannelPage {
  channel: Channel;
  videos: Video[];
  continuation: string | null;
}

export async function fetchChannelPage(
  channelId: string,
  tab: 'videos' | 'shorts',
  signal?: AbortSignal
): Promise<ChannelPage> {
  const data = await apiGet<{
    channel: RawChannel;
    videos: RawSearchResult[];
    continuation: string | null;
  }>(`channel?id=${encodeURIComponent(channelId)}&tab=${tab}`, { signal, ttl: 5 * 60_000 });

  const channel = toChannel(data.channel);
  // sur un onglet de chaîne, le parseur peut décaler les métadonnées : la
  // chaîne est connue, on l'impose plutôt que de faire confiance à `r.channelName`.
  const videos = (data.videos ?? []).map((r) =>
    resultToVideo(r, {
      channelId: channel.id,
      channelName: channel.name,
      channelAvatar: channel.avatar,
    })
  );
  return { channel, videos, continuation: data.continuation };
}

export async function fetchChannelMore(
  channelId: string,
  tab: 'videos' | 'shorts',
  continuation: string,
  signal?: AbortSignal
): Promise<{ videos: Video[]; continuation: string | null }> {
  const data = await apiGet<{ videos: RawSearchResult[]; continuation: string | null }>(
    `channel?id=${encodeURIComponent(channelId)}&tab=${tab}&continuation=${encodeURIComponent(continuation)}`,
    { signal, ttl: 5 * 60_000 }
  );
  const known = channels.find((c) => c.id === channelId);
  const videos = (data.videos ?? []).map((r) =>
    resultToVideo(r, {
      channelId,
      channelName: known?.name || r.channelName || '',
    })
  );
  return { videos, continuation: data.continuation };
}

/* -------------------------------------------------- nouveautés abonnements */

export interface SubscriptionFeed {
  videos: Video[];
  /** au moins une chaîne a répondu via le proxy (sinon repli catalogue) */
  live: boolean;
  /** nombre de chaînes interrogées */
  channels: number;
}

/**
 * Dernières vidéos des chaînes abonnées, par petits lots pour ne pas saturer
 * le proxy. Une chaîne en échec n'empêche pas les autres de répondre.
 */
export async function fetchSubscriptionFeed(
  channelIds: string[],
  signal?: AbortSignal
): Promise<SubscriptionFeed> {
  const ids = [...new Set(channelIds.filter(Boolean))].slice(0, 12);
  if (ids.length === 0) return { videos: [], live: false, channels: 0 };

  const groups: Video[][] = ids.map(() => []);
  let live = false;
  let cursor = 0;

  const worker = async () => {
    while (cursor < ids.length) {
      const index = cursor;
      cursor += 1;
      try {
        const page = await fetchChannelPage(ids[index], 'videos', signal);
        if (page.videos.length > 0) {
          groups[index] = page.videos.slice(0, 6);
          live = true;
        }
      } catch {
        // chaîne indisponible : on garde les autres résultats
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(4, ids.length) }, worker));
  return { videos: mergeChannelVideos(groups), live, channels: ids.length };
}

/* ---------------------------------------------------------- commentaires */

export interface LiveComment {
  id: string;
  author: string;
  avatar: string;
  channelId: string;
  text: string;
  publishedAt: string;
  likes: string;
  replies: string;
}

export interface CommentPage {
  count: string;
  comments: LiveComment[];
  continuation: string | null;
}

export async function fetchComments(
  options: { videoId?: string; continuation?: string },
  signal?: AbortSignal
): Promise<CommentPage> {
  const query = options.continuation
    ? `continuation=${encodeURIComponent(options.continuation)}`
    : `v=${encodeURIComponent(options.videoId ?? '')}`;
  return apiGet<CommentPage>(`comments?${query}`, { signal, ttl: 3 * 60_000 });
}

/* ------------------------------------------------------- SponsorBlock etc. */

export async function fetchSponsorSegments(
  videoId: string,
  signal?: AbortSignal
): Promise<SponsorSegment[]> {
  try {
    const data = await apiGet<{ segments: SponsorSegment[] }>(
      `sponsorblock?v=${encodeURIComponent(videoId)}`,
      { signal, ttl: 60 * 60_000 }
    );
    return data.segments ?? [];
  } catch {
    return [];
  }
}
