import { describe, expect, it } from 'vitest';
import { hasSeenTour, rememberTour, TOUR_STORAGE_KEY, type TourStorage } from './tourMemory';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const storage: TourStorage & { entries: () => Record<string, string> } = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    entries: () => Object.fromEntries(map),
  };
  return storage;
}

/** Stockage qui refuse tout, comme en navigation privée verrouillée. */
const blockedStorage: TourStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('mémoire de la visite guidée', () => {
  it('propose la visite sur un appareil neuf', () => {
    expect(hasSeenTour(fakeStorage())).toBe(false);
  });

  it('retient la visite dès son lancement', () => {
    const storage = fakeStorage();
    rememberTour(storage);
    expect(storage.entries()).toEqual({ [TOUR_STORAGE_KEY]: 'seen' });
    expect(hasSeenTour(storage)).toBe(true);
  });

  it('répond « pas encore vue » si le stockage est vide ou illisible', () => {
    expect(hasSeenTour(fakeStorage({ [TOUR_STORAGE_KEY]: 'autre' }))).toBe(false);
    expect(hasSeenTour(blockedStorage)).toBe(false);
    expect(hasSeenTour(null)).toBe(false);
  });

  it('ne casse pas quand le stockage refuse l’écriture', () => {
    expect(() => rememberTour(blockedStorage)).not.toThrow();
    expect(() => rememberTour(null)).not.toThrow();
  });
});
