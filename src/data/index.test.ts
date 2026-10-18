import { describe, expect, it } from 'vitest';
import {
  getVideo,
  recommendFor,
  recommendWithReasons,
  relatedVideos,
  videosByCategory,
} from './index';
import { videos } from './catalog';

describe('catalogue', () => {
  it('retrouve une vidéo par identifiant', () => {
    const reference = videos[0];
    expect(getVideo(reference.id)).toMatchObject({ id: reference.id, title: reference.title });
    expect(getVideo('identifiant-inconnu')).toBeUndefined();
    expect(getVideo(null)).toBeUndefined();
  });

  it('filtre par catégorie sans perdre la catégorie « Toutes »', () => {
    expect(videosByCategory('Toutes')).toHaveLength(videos.length);
    const category = videos[0].category;
    expect(videosByCategory(category).every((video) => video.category === category)).toBe(true);
  });
});

describe('relatedVideos', () => {
  it('exclut la vidéo courante et respecte la limite', () => {
    const current = videos[0];
    const related = relatedVideos(current, 6);

    expect(related).toHaveLength(6);
    expect(related.some((video) => video.id === current.id)).toBe(false);
    expect(new Set(related.map((video) => video.id)).size).toBe(related.length);
  });
});

describe('recommendFor', () => {
  it('ne recommande rien sans historique ni abonnement', () => {
    expect(recommendFor([], [])).toEqual([]);
  });

  it('écarte les vidéos déjà vues et priorise les chaînes abonnées', () => {
    const watched = videos[0];
    const channel = videos[1];
    const recommendations = recommendFor([watched.id], [channel.channelId], 5);

    expect(recommendations).toHaveLength(5);
    expect(recommendations.some((video) => video.id === watched.id)).toBe(false);
    expect(recommendations[0].channelId).toBe(channel.channelId);
  });

  it('explique chaque recommandation', () => {
    const watched = videos[0];
    const subscribed = videos.find((video) => video.channelId !== watched.channelId)!;
    const items = recommendWithReasons([watched.id], [subscribed.channelId], { limit: 5 });

    expect(items).toHaveLength(5);
    expect(items.every((item) => item.reason.length > 0)).toBe(true);
    expect(
      items.find((item) => item.video.channelId === subscribed.channelId)?.reason
    ).toContain('Chaîne abonnée');
    expect(items.every((item) => Number.isFinite(item.score))).toBe(true);
  });

  it('retire les signaux négatifs', () => {
    const watched = videos[0];
    const pool = recommendWithReasons([watched.id], [], { limit: 20 });
    const disliked = pool[0].video;
    const dismissed = pool[1].video;
    const muted = pool[2].video;

    const filtered = recommendWithReasons([watched.id], [], {
      limit: 20,
      disliked: [disliked.id],
      dismissed: [dismissed.id],
      mutedChannels: [muted.channelId],
    });

    expect(filtered.some((item) => item.video.id === disliked.id)).toBe(false);
    expect(filtered.some((item) => item.video.id === dismissed.id)).toBe(false);
    expect(filtered.some((item) => item.video.channelId === muted.channelId)).toBe(false);
  });
});
