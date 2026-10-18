import type { Channel, Video } from '../types';

/**
 * Vidéos et chaînes découvertes via YouTube en direct (absentes du catalogue).
 *
 * Persistées dans `localStorage` (et non `sessionStorage`) pour qu'un lien
 * ouvert depuis l'historique, une playlist ou « Regarder plus tard » fonctionne
 * encore après un redémarrage du navigateur. Taille plafonnée pour ne pas
 * saturer le quota.
 */
const VIDEO_KEY = 'tubecraft-dynamic-videos';
const CHANNEL_KEY = 'tubecraft-dynamic-channels';
const LEGACY_VIDEO_KEY = 'tubecraft-dynamic-videos-session';
const MAX_VIDEOS = 500;
const MAX_CHANNELS = 120;

let videoCache: Map<string, Video> | null = null;
let channelCache: Map<string, Channel> | null = null;

function readMap<T>(key: string): Map<string, T> {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = window.localStorage.getItem(key);
    const object = raw ? JSON.parse(raw) : {};
    return new Map(Object.entries(object ?? {}));
  } catch {
    return new Map();
  }
}

function persistMap<T>(key: string, map: Map<string, T>, max: number) {
  if (typeof window === 'undefined') return;
  try {
    const entries = [...map.entries()].slice(-max);
    window.localStorage.setItem(key, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* quota / navigation privée : on garde la mémoire seulement */
  }
}

function loadVideos(): Map<string, Video> {
  if (videoCache) return videoCache;
  if (typeof window === 'undefined') {
    videoCache = new Map();
    return videoCache;
  }
  const map = readMap<Video>(VIDEO_KEY);

  // migration douce depuis l'ancienne clé de session
  try {
    const legacy = window.sessionStorage.getItem(LEGACY_VIDEO_KEY);
    if (legacy) {
      for (const [id, video] of Object.entries(JSON.parse(legacy) ?? {})) {
        if (!map.has(id)) map.set(id, video as Video);
      }
      window.sessionStorage.removeItem(LEGACY_VIDEO_KEY);
      persistMap(VIDEO_KEY, map, MAX_VIDEOS);
    }
  } catch {
    /* ignore */
  }

  videoCache = map;
  return map;
}

function loadChannels(): Map<string, Channel> {
  if (channelCache) return channelCache;
  channelCache = readMap<Channel>(CHANNEL_KEY);
  return channelCache;
}

/** Fusionne : une fiche complète ne doit jamais être écrasée par une fiche vide. */
function mergeVideo(previous: Video | undefined, next: Video): Video {
  if (!previous) return next;
  const merged: Video = { ...previous };
  for (const [key, value] of Object.entries(next) as Array<[keyof Video, unknown]>) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '' && previous[key]) continue;
    if (Array.isArray(value) && value.length === 0 && Array.isArray(previous[key])) continue;
    if (key === 'likes' && value === 0 && previous.likes > 0) continue;
    (merged as unknown as Record<string, unknown>)[key] = value;
  }
  return merged;
}

export function rememberVideo(video: Video): void {
  const map = loadVideos();
  const merged = mergeVideo(map.get(video.id), video);
  map.delete(video.id);
  map.set(video.id, merged);
  persistMap(VIDEO_KEY, map, MAX_VIDEOS);
}

export function rememberVideos(videos: Video[]): void {
  for (const video of videos) rememberVideo(video);
}

export function rememberChannel(channel: Channel): void {
  if (!channel.id) return;
  const map = loadChannels();
  map.delete(channel.id);
  map.set(channel.id, { ...map.get(channel.id), ...channel });
  persistMap(CHANNEL_KEY, map, MAX_CHANNELS);
  channelCache = map;
}

export function getDynamicVideo(id: string): Video | undefined {
  return loadVideos().get(id);
}

export function getAllDynamicVideos(): Video[] {
  return [...loadVideos().values()];
}

export function getDynamicChannel(id: string): Channel | undefined {
  return loadChannels().get(id);
}

export function forgetDynamicVideo(id: string): void {
  const map = loadVideos();
  map.delete(id);
  persistMap(VIDEO_KEY, map, MAX_VIDEOS);
}
