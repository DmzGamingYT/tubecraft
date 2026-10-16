import type { SearchResult, Video } from '../types';
import { videos, shorts, channels } from '../data/catalog';
import { rememberVideo } from '../data/dynamic';
import { parseViews } from '../lib/format';

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
}

function toVideo(r: SearchResult): Video {
  const video: Video = {
    id: r.videoId,
    title: r.title,
    channelId: r.channelId || 'UC_live',
    channelName: r.channelName || 'YouTube',
    duration: r.duration,
    views: r.views,
    viewsCount: parseViews(r.views),
    publishedAt: r.publishedAt,
    description: '',
    category: 'Recherche',
    tags: [],
    likes: Math.max(12, Math.round(parseViews(r.views) * 0.02)),
    isShort: r.isShort,
  };
  rememberVideo(video);
  return video;
}

/** Recherche LIVE via le proxy InnerTube ; fallback sur le catalogue local si le proxy tombe. */
export async function searchYouTube(query: string): Promise<SearchResponse> {
  try {
    const res = await fetch(`/yt/api/search?q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const dataResults = data.results ?? [];
    const channelResults: SearchChannel[] = dataResults
      .filter((r: any) => r.kind === 'channel' && r.channelId)
      .map((r: any) => ({
        id: r.channelId,
        name: r.channelName || 'Chaîne',
        avatar: r.channelAvatar || '',
        subscribers: (r.handle || r.subscriberCountText || '').trim(),
      }));
    const results: SearchResult[] = dataResults
      .filter((r: SearchResult & { kind?: string }) => r.kind !== 'channel' && r.videoId)
      .map((r: SearchResult) => ({ ...r, thumbnail: thumbnailOf(r) }));
    if (results.length > 0 || channelResults.length > 0) {
      results.forEach((r) => toVideo(r));
      return { query, results, channels: channelResults, live: true };
    }
    throw new Error('aucun résultat');
  } catch {
    const results = localSearch(query);
    results.forEach((r) => toVideo(r));
    const needle = query.trim().toLowerCase();
    const channelResults = channels
      .filter((c) => c.name.toLowerCase().includes(needle) || String(c.handle ?? '').toLowerCase().includes(needle))
      .slice(0, 5)
      .map((c) => ({ id: c.id, name: c.name, avatar: c.avatar, subscribers: c.subscribers }));
    return { query, results, channels: channelResults, live: false };
  }
}

function thumbnailOf(r: SearchResult): string {
  if (r.thumbnail && r.thumbnail.startsWith('http')) {
    const m = r.thumbnail.match(/\/vi\/([^/]+)\//);
    if (m) return `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`;
  }
  return `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`;
}

const STOP = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'pour', 'dans', 'que', 'qui',
  'the', 'a', 'of', 'and', 'in', 'to', 'for', 'on', 'with',
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** Fallback hors-ligne : classement par recouvrement de mots-clés sur le catalogue. */
function localSearch(query: string): SearchResult[] {
  const terms = tokenize(query);
  const pool = [...videos, ...shorts];
  const scored = pool
    .map((v) => {
      const hay = tokenize(`${v.title} ${v.channelName} ${v.category} ${v.tags.join(' ')}`);
      let score = 0;
      for (const t of terms) {
        if (hay.includes(t)) score += 3;
        else if (hay.some((h) => h.startsWith(t) || t.startsWith(h))) score += 1;
      }
      return { v, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.v.viewsCount - a.v.viewsCount);

  return scored.map(({ v }) => ({
    videoId: v.id,
    title: v.title,
    channelId: v.channelId,
    channelName: v.channelName,
    channelAvatar: '',
    duration: v.duration,
    views: v.views,
    publishedAt: v.publishedAt,
    thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
    isShort: !!v.isShort,
  }));
}
