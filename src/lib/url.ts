/**
 * URLs absolues respectant la base Vite (`--base=/repo/` sur GitHub Pages).
 * Sans cela, les liens de partage pointent toujours vers la racine du domaine.
 */
const BASE = import.meta.env.BASE_URL || '/';

export const APP_BASE = BASE === '/' ? '/' : BASE.replace(/\/$/, '');

export function appUrl(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return `${window.location.origin}${BASE.endsWith('/') ? BASE : `${BASE}/`}${clean}`;
}

export function watchUrl(videoId: string): string {
  return appUrl(`watch?v=${encodeURIComponent(videoId)}`);
}
