import { describe, expect, it } from 'vitest';
import type { StorageLike } from './profiles';
import {
  archiveLegacyState,
  emptyProfile,
  GUEST_PROFILE_ID,
  listProfileIds,
  normalizeProfile,
  profileCount,
  profileIdFor,
  readProfile,
  saveProfile,
  snapshotOf,
  PROFILE_STORAGE_KEY,
} from './profiles';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const storage: StorageLike & { entries: () => Record<string, string> } = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    entries: () => Object.fromEntries(map),
  };
  return storage;
}

const comment = {
  id: 'c1',
  author: 'Vous',
  text: 'Super vidéo',
  createdAt: 1_700_000_000_000,
  likes: 2,
};

function legacyState() {
  return {
    user: { email: ' Alice@Example.com ' },
    liked: ['v1', 'v2'],
    disliked: ['v3'],
    subscribed: ['UC1'],
    history: ['v1', 'v4'],
    historyDates: { v1: 1, v4: 2 },
    comments: { v1: [comment] },
    playlists: [{ id: 'p1', name: 'À voir', videoIds: ['v1'], createdAt: 3 }],
    watchLater: ['v2'],
    dismissed: ['v5'],
    progress: { v1: 42 },
    notifLevels: { UC1: 'all' as const },
    notificationsSeen: ['v2'],
  };
}

describe('profileIdFor', () => {
  it('normalise l’adresse et distingue le profil invité', () => {
    expect(profileIdFor(' Alice@Example.com ')).toBe('email:alice@example.com');
    expect(profileIdFor('ALICE@example.COM')).toBe('email:alice@example.com');
    expect(profileIdFor(undefined)).toBe(GUEST_PROFILE_ID);
    expect(profileIdFor('   ')).toBe(GUEST_PROFILE_ID);
  });
});

describe('saveProfile / readProfile', () => {
  it('relit un instantané complet à l’identique', () => {
    const storage = fakeStorage();
    const data = snapshotOf(legacyState());

    expect(saveProfile('email:alice@example.com', data, storage)).toBe(true);

    expect(readProfile('email:alice@example.com', storage)).toEqual(data);
    expect(readProfile('email:bob@example.com', storage)).toBeNull();
    expect(listProfileIds(storage)).toEqual(['email:alice@example.com']);
    expect(profileCount(storage)).toBe(1);
  });

  it('ne mélange pas deux profils', () => {
    const storage = fakeStorage();
    saveProfile('email:alice@example.com', { liked: ['a'], history: ['a'] }, storage);
    saveProfile('email:bob@example.com', { liked: ['b'] }, storage);

    expect(readProfile('email:alice@example.com', storage)?.liked).toEqual(['a']);
    expect(readProfile('email:bob@example.com', storage)?.liked).toEqual(['b']);
    expect(readProfile('email:bob@example.com', storage)?.history).toEqual([]);
  });

  it('complète les champs manquants', () => {
    const storage = fakeStorage();
    saveProfile(GUEST_PROFILE_ID, { liked: ['v1'] }, storage);

    const guest = readProfile(GUEST_PROFILE_ID, storage);
    expect(guest).toMatchObject({ liked: ['v1'], history: [], playlists: [], progress: {} });
  });

  it('ne lève pas quand le stockage est saturé', () => {
    const storage = fakeStorage();
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(saveProfile(GUEST_PROFILE_ID, { liked: ['a'] }, storage)).toBe(false);
  });

  it('ignore un fichier de profils corrompu', () => {
    const storage = fakeStorage({ [PROFILE_STORAGE_KEY]: '{oops' });
    expect(readProfile(GUEST_PROFILE_ID, storage)).toBeNull();
    expect(profileCount(storage)).toBe(0);
  });
});

describe('archiveLegacyState (migration v4 -> v5)', () => {
  it('rattache les données existantes au profil actif sans rien perdre', () => {
    const storage = fakeStorage();
    const state = legacyState();

    const archived = archiveLegacyState(state, storage);

    expect(archived).not.toBeNull();
    expect(readProfile('email:alice@example.com', storage)).toEqual(snapshotOf(state));
    const stored = readProfile('email:alice@example.com', storage);
    expect(stored?.liked).toEqual(['v1', 'v2']);
    expect(stored?.disliked).toEqual(['v3']);
    expect(stored?.history).toEqual(['v1', 'v4']);
    expect(stored?.comments.v1[0]).toMatchObject({ text: 'Super vidéo', likes: 2 });
    expect(stored?.playlists[0]).toEqual({
      id: 'p1',
      name: 'À voir',
      videoIds: ['v1'],
      createdAt: 3,
    });
    expect(stored?.watchLater).toEqual(['v2']);
    expect(stored?.dismissed).toEqual(['v5']);
    expect(stored?.progress).toEqual({ v1: 42 });
    expect(stored?.notifLevels).toEqual({ UC1: 'all' });
    expect(stored?.notificationsSeen).toEqual(['v2']);
  });

  it('rattache au profil invité quand aucun compte n’était connecté', () => {
    const storage = fakeStorage();
    archiveLegacyState({ ...legacyState(), user: null }, storage);

    expect(readProfile(GUEST_PROFILE_ID, storage)?.liked).toEqual(['v1', 'v2']);
    expect(readProfile('email:alice@example.com', storage)).toBeNull();
  });

  it('n’écrase jamais un profil déjà enregistré', () => {
    const storage = fakeStorage();
    saveProfile('email:alice@example.com', { liked: ['nouveau'] }, storage);

    expect(archiveLegacyState(legacyState(), storage)).toBeNull();
    expect(readProfile('email:alice@example.com', storage)?.liked).toEqual(['nouveau']);
  });

  it('ne signale aucun archivage si l’écriture échoue', () => {
    const storage = fakeStorage();
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(archiveLegacyState(legacyState(), storage)).toBeNull();
  });
});

describe('normalizeProfile', () => {
  it('filtre les entrées malformées', () => {
    const data = normalizeProfile({
      liked: ['v1', 42, null],
      historyDates: { v1: 10, v2: 'x' },
      comments: { v1: [comment, { id: 3 }], v2: 'nope' },
      notifLevels: { UC1: 'all', UC2: 'parfois' },
      playlists: [{ id: 'p1', name: 'ok', videoIds: ['v1', 2] }, { id: 'sans-nom' }],
    });

    expect(data.liked).toEqual(['v1']);
    expect(data.historyDates).toEqual({ v1: 10 });
    expect(data.comments).toEqual({ v1: [comment] });
    expect(data.notifLevels).toEqual({ UC1: 'all' });
    expect(data.playlists).toEqual([{ id: 'p1', name: 'ok', videoIds: ['v1'], createdAt: expect.any(Number) }]);
  });

  it('accepte une valeur absente', () => {
    expect(normalizeProfile(null)).toEqual(emptyProfile());
  });
});
