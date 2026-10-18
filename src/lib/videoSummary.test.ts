import { describe, expect, it } from 'vitest';
import {
  autoSummary,
  buildSummaryPrompt,
  normalizeChapters,
  parseSummaryPayload,
  summaryInput,
} from './videoSummary';
import type { Video } from '../types';

function video(overrides: Partial<Video> = {}): Video {
  return {
    id: 'WhWc3b3KhnY',
    title: 'Spring - Blender Open Movie',
    channelId: 'UCz75RVbH8q2jdBJ4SnwuZZQ',
    channelName: 'Blender Studio',
    duration: 464,
    views: '10 M de vues',
    viewsCount: 10_000_000,
    publishedAt: '2019-04-04',
    description: '',
    category: 'Animation',
    tags: ['Blender', 'Court métrage'],
    likes: 1000,
    ...overrides,
  };
}

describe('buildSummaryPrompt', () => {
  it('transmet titre, chaîne, durée, catégorie, tags et description', () => {
    const { system, user } = buildSummaryPrompt(
      summaryInput(
        video({
          duration: 3_930,
          description: '00:00 Introduction\n01:30 Le making-of',
        })
      )
    );

    expect(system).toContain('JSON');
    expect(system).toContain('chapitres');
    expect(user).toContain('Titre : Spring - Blender Open Movie');
    expect(user).toContain('Chaîne : Blender Studio');
    expect(user).toContain('Durée : 1 h 05 min');
    expect(user).toContain('Catégorie : Animation');
    expect(user).toContain('Tags : Blender, Court métrage');
    expect(user).toContain('00:00 Introduction');
  });

  it('tronque les descriptions très longues', () => {
    const { user } = buildSummaryPrompt(
      summaryInput(video({ description: 'a'.repeat(10_000) }))
    );
    expect(user.length).toBeLessThan(4_000);
  });

  it('signale une description vide', () => {
    const { user } = buildSummaryPrompt(summaryInput(video()));
    expect(user).toContain('(vide)');
  });
});

describe('normalizeChapters', () => {
  it('trie, déduplique, borne à la durée et nettoie les titres', () => {
    const chapters = normalizeChapters(
      [
        { time: '3:20', title: '3. Le final' },
        { time: '0:00', title: 'Introduction' },
        { time: '1:30', title: 'Le making-of' },
        { time: '1:30', title: 'Doublon' },
        { time: '99:00', title: 'Hors durée' },
        { time: '2:00', title: '   ' },
      ],
      600
    );

    expect(chapters).toEqual([
      { sec: 0, title: 'Introduction' },
      { sec: 90, title: 'Le making-of' },
      { sec: 200, title: 'Le final' },
    ]);
  });

  it('conserve un titre qui commence par un nombre légitime', () => {
    expect(
      normalizeChapters(
        [
          { time: '0:00', title: '2001, l’odyssée de l’espace' },
          { time: '1:00', title: '2. Le making-of' },
        ],
        600
      )
    ).toEqual([
      { sec: 0, title: '2001, l’odyssée de l’espace' },
      { sec: 60, title: 'Le making-of' },
    ]);
  });

  it('accepte les secondes numériques et `start`', () => {
    expect(
      normalizeChapters(
        [
          { sec: 0, title: 'Début' },
          { start: 75, title: 'Milieu' },
        ],
        300
      )
    ).toEqual([
      { sec: 0, title: 'Début' },
      { sec: 75, title: 'Milieu' },
    ]);
  });

  it('refuse un chapitre unique ou un tableau invalide', () => {
    expect(normalizeChapters([{ time: '0:00', title: 'Seul' }], 300)).toEqual([]);
    expect(normalizeChapters(null, 300)).toEqual([]);
    expect(normalizeChapters([], 300)).toEqual([]);
  });
});

describe('parseSummaryPayload', () => {
  const summary =
    'Cette vidéo présente un court métrage d’animation réalisé avec Blender. Elle détaille ensuite les coulisses de la production.';

  it('valide un résumé et ses chapitres', () => {
    const parsed = parseSummaryPayload(
      {
        summary,
        chapters: [
          { time: '0:00', title: 'Introduction' },
          { time: '1:30', title: 'Making-of' },
        ],
      },
      600
    );

    expect(parsed?.summary).toBe(summary);
    expect(parsed?.chapters).toHaveLength(2);
  });

  it('supprime le préfixe « Résumé : » et compacte les espaces', () => {
    const parsed = parseSummaryPayload({ summary: `Résumé :   ${summary}` }, 600);
    expect(parsed?.summary).toBe(summary);
  });

  it('refuse un résumé trop court, vide ou mal typé', () => {
    expect(parseSummaryPayload({ summary: 'Trop court.' }, 600)).toBeNull();
    expect(parseSummaryPayload({ summary: 42 }, 600)).toBeNull();
    expect(parseSummaryPayload(null, 600)).toBeNull();
  });

  it('accepte un résumé sans chapitres (repli sur la description)', () => {
    const parsed = parseSummaryPayload({ summary, chapters: 'aucun' }, 600);
    expect(parsed?.chapters).toEqual([]);
  });
});

describe('autoSummary', () => {
  it('extrait les premières phrases utiles de la description', () => {
    const summary = autoSummary(
      summaryInput(
        video({
          description: [
            '00:00 Introduction',
            'Spring raconte l’histoire d’une bergère et de son chien face aux esprits de la nature.',
            'Le film a été réalisé par Andy Goralczyk avec Blender 2.8.',
            'https://studio.blender.org/films/spring',
          ].join('\n'),
        })
      )
    );

    expect(summary.source).toBe('auto');
    expect(summary.summary).toContain('Spring - Blender Open Movie');
    expect(summary.summary).toContain('bergère');
    expect(summary.summary).not.toContain('https://');
    expect(summary.summary).not.toContain('00:00');
    // les lignes de sommaire ne doivent pas se retrouver dans la prose
    expect(summary.summary).not.toContain('Introduction');
    expect(summary.chapters).toEqual([]);
  });

  it('réutilise les chapitres horodatés de la description', () => {
    const summary = autoSummary(
      summaryInput(
        video({
          description: [
            'Une présentation du film.',
            '00:00 Introduction',
            '01:30 Making-of',
            '05:00 Conclusion',
          ].join('\n'),
        })
      )
    );

    expect(summary.chapters).toEqual([
      { sec: 0, title: 'Introduction' },
      { sec: 90, title: 'Making-of' },
      { sec: 300, title: 'Conclusion' },
    ]);
  });

  it('se rabat sur les métadonnées quand la description est vide', () => {
    const summary = autoSummary(summaryInput(video()));
    expect(summary.summary).toContain('Blender Studio');
    expect(summary.summary).toContain('2019-04-04');
    expect(summary.summary).toContain('métadonnées');
    expect(summary.chapters).toEqual([]);
  });

  it('borne la longueur du résumé', () => {
    const long = Array.from(
      { length: 40 },
      (_, index) => `Phrase numéro ${index} avec suffisamment de contenu pour être conservée.`
    ).join(' ');
    const summary = autoSummary(summaryInput(video({ description: long })));
    expect(summary.summary.length).toBeLessThan(600);
  });
});
