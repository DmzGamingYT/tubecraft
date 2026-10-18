import type { Video } from '../types';
import { videos, shorts, channels } from './catalog';
import { getDynamicChannel, getDynamicVideo, getAllDynamicVideos } from './dynamic';

export { videos, shorts, categories, channels, thumbFor, thumbLargeFor, generatedAt } from './catalog';

export const allVideos: Video[] = [...videos, ...shorts];

const videoIndex = new Map<string, Video>(allVideos.map((v) => [v.id, v]));
const channelIndex = new Map(channels.map((c) => [c.id, c]));

export function getVideo(id: string | null | undefined): Video | undefined {
  if (!id) return undefined;
  return videoIndex.get(id) ?? getDynamicVideo(id);
}

export function getChannel(id: string | null | undefined) {
  if (!id) return undefined;
  const known = channelIndex.get(id) ?? getDynamicChannel(id);
  if (known) return known;
  // chaîne découverte via la recherche LIVE : on la reconnaît par ses vidéos
  const sample = getAllDynamicVideos().find((v) => v.channelId === id);
  if (!sample) return undefined;
  return {
    id,
    name: sample.channelName,
    handle: '',
    avatar: sample.channelAvatar ?? '',
    subscribers: '',
    banner: undefined,
  };
}

export function videosByCategory(category: string): Video[] {
  if (category === 'Toutes') return videos;
  return videos.filter((v) => v.category === category);
}

export function videosFromChannel(channelId: string): Video[] {
  const catalog = allVideos.filter((v) => v.channelId === channelId);
  const seen = new Set(catalog.map((v) => v.id));
  const dynamic = getAllDynamicVideos().filter(
    (v) => v.channelId === channelId && !seen.has(v.id)
  );
  return [...catalog, ...dynamic];
}

export function subscribedVideos(subscribedIds: string[]): Video[] {
  return allVideos.filter((v) => subscribedIds.includes(v.channelId));
}

/** Suggestions : même catégorie d'abord, puis le reste, jamais la vidéo en cours */
export function relatedVideos(video: Video, limit = 14): Video[] {
  const sameCat = videos.filter((v) => v.id !== video.id && v.category === video.category);
  const others = videos.filter((v) => v.id !== video.id && v.category !== video.category);
  const rest = others.filter(
    (v) => v.channelId !== video.channelId && !sameCat.some((s) => s.channelId === v.channelId)
  );
  const sameChannel = videos.filter(
    (v) => v.id !== video.id && v.channelId === video.channelId && !sameCat.includes(v)
  );
  return [...sameCat, ...sameChannel, ...rest, ...others].slice(0, limit);
}

export interface Recommendation {
  video: Video;
  /** explication courte, affichée sous la carte */
  reason: string;
  score: number;
}

export interface RecommendOptions {
  limit?: number;
  /** vidéos déjà écartées via « Pas intéressé » */
  dismissed?: string[];
  /** vidéos explicitement dislikées */
  disliked?: string[];
  /** chaînes dont on ne veut plus voir les suggestions */
  mutedChannels?: string[];
}

/**
 * Recommandations personnalisées, avec la raison du classement. Le score
 * dépend des catégories déjà regardées, des chaînes abonnées et de la
 * popularité ; les signaux négatifs (pas intéressé, dislike, chaîne mise de
 * côté) retirent la vidéo au lieu de la pénaliser.
 */
export function recommendWithReasons(
  historyIds: string[],
  subscribedIds: string[],
  options: RecommendOptions = {}
): Recommendation[] {
  const { limit = 8, dismissed = [], disliked = [], mutedChannels = [] } = options;
  if (historyIds.length === 0 && subscribedIds.length === 0) return [];

  const seen = new Set(historyIds);
  const hidden = new Set([...dismissed, ...disliked]);
  const muted = new Set(mutedChannels);
  const catScore = new Map<string, number>();
  const channelScore = new Map<string, number>();

  for (const id of historyIds.slice(0, 30)) {
    const v = videoIndex.get(id);
    if (!v) continue;
    catScore.set(v.category, (catScore.get(v.category) ?? 0) + 1);
    channelScore.set(v.channelId, (channelScore.get(v.channelId) ?? 0) + 1);
  }

  const score = (v: Video) =>
    (catScore.get(v.category) ?? 0) * 3 +
    (subscribedIds.includes(v.channelId) ? 2 : 0) +
    (channelScore.get(v.channelId) ?? 0) * 2 +
    Math.min(v.viewsCount / 50_000_000, 2);

  const reasonFor = (v: Video): string => {
    if (subscribedIds.includes(v.channelId)) return `Chaîne abonnée · ${v.channelName}`;
    const category = v.category;
    if ((catScore.get(category) ?? 0) > 0) return `Parce que vous regardez ${category}`;
    if ((channelScore.get(v.channelId) ?? 0) > 0) return `Dans la lignée de ${v.channelName}`;
    return 'Populaire en ce moment';
  };

  return [...videos]
    .filter(
      (v) => !seen.has(v.id) && !hidden.has(v.id) && !muted.has(v.channelId)
    )
    .map((video) => ({ video, reason: reasonFor(video), score: score(video) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Compatibilité : mêmes recommandations, sans les explications. */
export function recommendFor(
  historyIds: string[],
  subscribedIds: string[],
  limit = 8,
  options: Omit<RecommendOptions, 'limit'> = {}
): Video[] {
  return recommendWithReasons(historyIds, subscribedIds, { ...options, limit }).map(
    (item) => item.video
  );
}
