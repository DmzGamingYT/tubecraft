import type { Video } from '../types';

/**
 * Vidéos découvertes via la recherche LIVE (absentes du catalogue embarqué).
 * Permet d'ouvrir /watch?v=<id> juste après une recherche, y compris après
 * un rechargement de page (persistance sessionStorage).
 */
const STORAGE_KEY = 'tubecraft-dynamic-videos';

let cached: Map<string, Video> | null = null;

function loadMap(): Map<string, Video> {
  if (cached) return cached;
  if (typeof window === 'undefined') {
    cached = new Map();
    return cached;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    cached = new Map(Object.entries(obj || {}));
  } catch {
    cached = new Map();
  }
  return cached;
}

function persist(map: Map<string, Video>) {
  cached = map;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch {
    /* quota / navigation privée : on garde la mémoire seulement */
  }
}

export function rememberVideo(video: Video): void {
  const map = new Map(loadMap());
  map.set(video.id, video);
  persist(map);
}

export function getDynamicVideo(id: string): Video | undefined {
  return loadMap().get(id);
}

export function getAllDynamicVideos(): Video[] {
  return [...loadMap().values()];
}