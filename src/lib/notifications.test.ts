import { describe, expect, it } from 'vitest';
import type { Video } from '../types';
import { mergeChannelVideos, notificationCacheKey } from './notifications';

function video(id: string): Video {
  return {
    id,
    title: id,
    channelId: 'c',
    channelName: 'Chaîne',
    duration: 60,
    views: '1 vue',
    viewsCount: 1,
    publishedAt: 'hier',
    description: '',
    category: 'Test',
    tags: [],
    likes: 0,
  };
}

describe('mergeChannelVideos', () => {
  it('alterne les chaînes et conserve leur ordre', () => {
    const merged = mergeChannelVideos([
      [video('a1'), video('a2')],
      [video('b1'), video('b2')],
    ]);
    expect(merged.map((item) => item.id)).toEqual(['a1', 'b1', 'a2', 'b2']);
  });

  it('retire les doublons et respecte la limite', () => {
    const merged = mergeChannelVideos(
      [[video('a'), video('b')], [video('a'), video('c')]],
      2
    );
    expect(merged.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('accepte des groupes vides', () => {
    expect(mergeChannelVideos([[], []])).toEqual([]);
    expect(mergeChannelVideos([])).toEqual([]);
  });
});

describe('notificationCacheKey', () => {
  it('est stable quel que soit l’ordre et déduplique', () => {
    expect(notificationCacheKey(['b', 'a', 'b'])).toBe('a|b');
    expect(notificationCacheKey([])).toBe('');
  });
});
