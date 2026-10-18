/**
 * Export / import / mesure des données locales de TubeCraft.
 *
 * On ne touche qu'à une liste blanche de clés : un fichier importé ne peut pas
 * écrire n'importe quoi dans le `localStorage` de l'utilisateur.
 */

export const STORAGE_KEYS = {
  store: 'tubecraft-store',
  /** instantanés des autres profils : ils font partie de la sauvegarde */
  profiles: 'tubecraft-profiles',
  videos: 'tubecraft-dynamic-videos',
  channels: 'tubecraft-dynamic-channels',
} as const;

export const MANAGED_KEYS: string[] = Object.values(STORAGE_KEYS);

export interface ExportBundle {
  app: 'tubecraft';
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
}

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

export function exportUserData(storage: StorageReader): ExportBundle {
  const data: Record<string, string> = {};
  for (const key of MANAGED_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return {
    app: 'tubecraft',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function exportFileName(date = new Date()): string {
  return `tubecraft-${date.toISOString().slice(0, 10)}.json`;
}

export type ParseResult =
  | { ok: true; data: Record<string, string> }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Accepte le format exporté (`{ app, data }`) ou un simple objet de clés.
 * Chaque valeur doit être du JSON valide ; les clés inconnues sont ignorées.
 */
export function parseUserData(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Ce fichier n’est pas du JSON valide.' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'Format de sauvegarde non reconnu.' };
  }

  const candidate = isRecord(parsed.data) ? parsed.data : parsed;
  const data: Record<string, string> = {};

  for (const key of MANAGED_KEYS) {
    const raw = candidate[key];
    if (raw === undefined) continue;
    if (typeof raw !== 'string') {
      return { ok: false, error: `La valeur de « ${key} » doit être une chaîne JSON.` };
    }

    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, error: `La valeur de « ${key} » n’est pas du JSON valide.` };
    }

    if (key === STORAGE_KEYS.store) {
      if (!isRecord(value) || !isRecord((value as { state?: unknown }).state)) {
        return { ok: false, error: 'La sauvegarde du compte et des réglages est incomplète.' };
      }
    } else if (!isRecord(value)) {
      return { ok: false, error: `La valeur de « ${key} » n’est pas un objet.` };
    }

    // on réécrit une version propre, sans espaces ni contenu parasite
    data[key] = JSON.stringify(value);
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: 'Aucune donnée TubeCraft reconnue dans ce fichier.' };
  }
  return { ok: true, data };
}

export function importUserData(storage: StorageWriter, data: Record<string, string>): void {
  for (const key of MANAGED_KEYS) {
    const value = data[key];
    if (typeof value === 'string') storage.setItem(key, value);
  }
}

/** Taille approximative (octets UTF-8) des données TubeCraft. */
export function localDataSize(storage: StorageReader): number {
  let bytes = 0;
  for (const key of MANAGED_KEYS) {
    const value = storage.getItem(key);
    if (value) bytes += new TextEncoder().encode(key + value).length;
  }
  return bytes;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2).replace('.', ',')} Mo`;
}

/** Supprime toutes les clés TubeCraft (y compris les caches de session). */
export function clearAllLocalData(): void {
  const removable: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith('tubecraft-')) removable.push(key);
  }
  removable.forEach((key) => window.localStorage.removeItem(key));

  try {
    const sessionKeys: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key && key.startsWith('tubecraft-')) sessionKeys.push(key);
    }
    sessionKeys.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    /* navigation privée : ignore */
  }
}
