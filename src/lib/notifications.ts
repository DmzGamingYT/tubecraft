import type { Video } from '../types';

/**
 * Fusionne les dernières vidéos de plusieurs chaînes en alternant les chaînes,
 * pour qu'une chaîne très active ne monopole pas la cloche. L'ordre de chaque
 * chaîne (du plus récent au plus ancien) est conservé et les doublons retirés.
 */
export function mergeChannelVideos(groups: Video[][], limit = 24): Video[] {
  const result: Video[] = [];
  const seen = new Set<string>();
  const depth = groups.reduce((max, group) => Math.max(max, group.length), 0);

  for (let index = 0; index < depth && result.length < limit; index += 1) {
    for (const group of groups) {
      const video = group[index];
      if (!video || seen.has(video.id)) continue;
      seen.add(video.id);
      result.push(video);
      if (result.length >= limit) break;
    }
  }
  return result;
}

/** Clé de cache stable, indépendante de l'ordre des abonnements. */
export function notificationCacheKey(channelIds: string[]): string {
  return [...new Set(channelIds)].sort().join('|');
}
