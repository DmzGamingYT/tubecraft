import { describe, expect, it } from 'vitest';
import {
  exportUserData,
  formatBytes,
  importUserData,
  localDataSize,
  MANAGED_KEYS,
  parseUserData,
  STORAGE_KEYS,
} from './userData';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    entries: () => Object.fromEntries(map),
  };
}

const storeValue = JSON.stringify({ state: { theme: 'dark' }, version: 4 });
const profilesValue = JSON.stringify({ version: 1, profiles: { guest: { liked: ['v1'] } } });
const videosValue = JSON.stringify({ abcdefghijk: { id: 'abcdefghijk' } });

describe('exportUserData', () => {
  it('n’exporte que les clés TubeCraft connues', () => {
    const storage = fakeStorage({
      [STORAGE_KEYS.store]: storeValue,
      [STORAGE_KEYS.profiles]: profilesValue,
      [STORAGE_KEYS.videos]: videosValue,
      'autre-cle': 'secrète',
    });

    const bundle = exportUserData(storage);

    expect(bundle.app).toBe('tubecraft');
    expect(Object.keys(bundle.data)).toEqual([
      STORAGE_KEYS.store,
      STORAGE_KEYS.profiles,
      STORAGE_KEYS.videos,
    ]);
    expect(bundle.data[STORAGE_KEYS.store]).toBe(storeValue);
    expect(bundle.data[STORAGE_KEYS.profiles]).toBe(profilesValue);
    expect(bundle.data['autre-cle']).toBeUndefined();
  });
});

describe('parseUserData', () => {
  it('accepte le format exporté', () => {
    const text = JSON.stringify({
      app: 'tubecraft',
      version: 1,
      data: { [STORAGE_KEYS.store]: storeValue },
    });
    const result = parseUserData(text);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data[STORAGE_KEYS.store]).toBe(storeValue);
  });

  it('accepte les instantanés de profils', () => {
    const result = parseUserData(JSON.stringify({ [STORAGE_KEYS.profiles]: profilesValue }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data[STORAGE_KEYS.profiles]).toBe(profilesValue);
  });

  it('accepte un objet de clés brut et ignore les clés inconnues', () => {
    const text = JSON.stringify({
      [STORAGE_KEYS.videos]: videosValue,
      malware: 'alert(1)',
    });
    const result = parseUserData(text);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.data)).toEqual([STORAGE_KEYS.videos]);
    }
  });

  it('refuse un JSON invalide', () => {
    expect(parseUserData('{oops')).toMatchObject({ ok: false });
  });

  it('refuse un état de store incomplet', () => {
    const result = parseUserData(
      JSON.stringify({ [STORAGE_KEYS.store]: JSON.stringify({ theme: 'dark' }) })
    );
    expect(result).toMatchObject({ ok: false });
  });

  it('refuse un fichier sans donnée reconnue', () => {
    expect(parseUserData(JSON.stringify({ autre: 1 }))).toMatchObject({ ok: false });
  });

  it('refuse une valeur non textuelle', () => {
    expect(parseUserData(JSON.stringify({ [STORAGE_KEYS.videos]: 42 }))).toMatchObject({
      ok: false,
    });
  });
});

describe('importUserData', () => {
  it('écrit uniquement les clés gérées', () => {
    const storage = fakeStorage();
    importUserData(storage, {
      [STORAGE_KEYS.store]: storeValue,
      'autre-cle': 'x',
    });

    expect(storage.entries()).toEqual({ [STORAGE_KEYS.store]: storeValue });
    expect(MANAGED_KEYS).toContain(STORAGE_KEYS.store);
  });
});

describe('localDataSize / formatBytes', () => {
  it('mesure les données et formate la taille', () => {
    const storage = fakeStorage({ [STORAGE_KEYS.store]: storeValue });
    const size = localDataSize(storage);
    expect(size).toBeGreaterThan(0);
    expect(formatBytes(size)).toMatch(/o$|ko$|Mo$/);
    expect(formatBytes(2048)).toBe('2,0 ko');
  });
});
