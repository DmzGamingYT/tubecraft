import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Video } from '../types';

/**
 * Le registre local est écrit à chaque vidéo ou chaîne découverte. Sérialiser
 * la carte entière à chaque appel coûtait cher (une passe de recherche = une
 * vingtaine d'écritures de ~220 Ko) : ces tests verrouillent le regroupement,
 * et vérifient que la lecture reste immédiate, avant même la sauvegarde.
 */

class MemoryStorage {
  private data = new Map<string, string>();
  writes: string[] = [];

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes.push(key);
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  get(key: string): string | undefined {
    return this.data.get(key);
  }
}

const VIDEO_KEY = 'tubecraft-dynamic-videos';
const CHANNEL_KEY = 'tubecraft-dynamic-channels';

let storage: MemoryStorage;
let session: MemoryStorage;

function makeVideo(id: string): Video {
  return {
    id,
    title: `Vidéo ${id}`,
    channelId: 'UCabc',
    channelName: 'Chaîne',
    duration: 120,
    views: '1 000 vues',
    viewsCount: 1000,
    publishedAt: '2026-01-01',
    description: '',
    category: 'Recherche',
    tags: [],
    likes: 0,
  };
}

/** Importe un module neuf avec le faux `window` en place. */
async function loadModule() {
  vi.resetModules();
  return import('./dynamic');
}

/** Laisse passer la micro-tâche de sauvegarde. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  storage = new MemoryStorage();
  session = new MemoryStorage();
  vi.stubGlobal('window', {
    localStorage: storage,
    sessionStorage: session,
    addEventListener: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('registre local (vidéos et chaînes découvertes)', () => {
  it('ne sérialise la carte qu’une fois pour une passe de résultats', async () => {
    const registry = await loadModule();

    for (let i = 0; i < 20; i += 1) registry.rememberVideo(makeVideo(`vid${i}`));

    expect(storage.writes).toHaveLength(0);
    await flush();
    expect(storage.writes).toEqual([VIDEO_KEY]);

    const stored = JSON.parse(storage.get(VIDEO_KEY) ?? '{}');
    expect(Object.keys(stored)).toHaveLength(20);
  });

  it('sert la vidéo immédiatement, avant la sauvegarde', async () => {
    const registry = await loadModule();
    registry.rememberVideo(makeVideo('vid1'));

    expect(registry.getDynamicVideo('vid1')?.title).toBe('Vidéo vid1');
    expect(storage.writes).toHaveLength(0);
  });

  it('regroupe vidéos et chaînes, puis oublie sur demande', async () => {
    const registry = await loadModule();
    registry.rememberVideo(makeVideo('vid1'));
    registry.rememberChannel({
      id: 'UCabc',
      name: 'Chaîne',
      handle: '@chaine',
      avatar: '',
      subscribers: '10 abonnés',
    });
    await flush();
    expect(storage.writes.sort()).toEqual([CHANNEL_KEY, VIDEO_KEY]);

    storage.writes.length = 0;
    registry.forgetDynamicVideo('vid1');
    await flush();
    expect(storage.writes).toEqual([VIDEO_KEY]);
    expect(JSON.parse(storage.get(VIDEO_KEY) ?? '{}')).toEqual({});
  });

  it('fusionne sans écraser une fiche déjà complète', async () => {
    const registry = await loadModule();
    registry.rememberVideo({
      ...makeVideo('vid1'),
      description: 'description complète',
      views: '9 000 vues',
    });
    registry.rememberVideo({ ...makeVideo('vid1'), description: '', views: '' });

    await flush();
    const stored = JSON.parse(storage.get(VIDEO_KEY) ?? '{}');
    expect(stored.vid1.description).toBe('description complète');
    expect(stored.vid1.views).toBe('9 000 vues');
  });
});
