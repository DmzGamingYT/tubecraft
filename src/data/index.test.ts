import { describe, expect, it } from 'vitest';
import { getVideo, recommendFor, relatedVideos, videosByCategory } from './index';
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
});
