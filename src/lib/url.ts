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

/**
 * URL publique d’une app servie hors de ce dépôt (SpotifyCraft, PulseCraft…).
 *
 * Une variable `VITE_…` a toujours la priorité ; en développement on vise le
 * serveur local pour que le bouton lance vraiment quelque chose, et en
 * production on retombe sur `publicUrl` quand elle est connue. Sans l’un ni
 * l’autre, on renvoie `null` : l’appelant affiche alors le dépôt plutôt qu’un
 * lien mort.
 */
export function remoteAppUrl(
  envValue: string | undefined,
  localPort: number,
  publicUrl?: string
): string | null {
  const configured = envValue?.trim();
  if (configured) return configured;
  if (import.meta.env.DEV) return `http://127.0.0.1:${localPort}/`;
  return publicUrl ?? null;
}
