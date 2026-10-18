import { describe, expect, it } from 'vitest';
import { parseChapters, parseTimestamp } from './chapters';

describe('parseChapters', () => {
  it('détecte les chapitres d’une description', () => {
    const description = `Dans cette vidéo :
00:00 Introduction
01:30 Le matériel
05:12 Modélisation
12:45 Conclusion`;

    expect(parseChapters(description)).toEqual([
      { sec: 0, title: 'Introduction' },
      { sec: 90, title: 'Le matériel' },
      { sec: 312, title: 'Modélisation' },
      { sec: 765, title: 'Conclusion' },
    ]);
  });

  it('accepte les heures et ignore les suites incohérentes', () => {
    const chapters = parseChapters('0:00 Début\n5:00 Suite\n1:00:00 Fin\n2:00 Trop tard');
    expect(chapters.map((chapter) => chapter.sec)).toEqual([0, 300, 3600]);
  });

  it('ne considère pas un horodatage isolé comme un sommaire', () => {
    expect(parseChapters('Rendez-vous à 01:30 pour la démo.')).toEqual([]);
    expect(parseChapters('')).toEqual([]);
  });
});

describe('parseTimestamp', () => {
  it('gère les formats YouTube et les secondes brutes', () => {
    expect(parseTimestamp('90')).toBe(90);
    expect(parseTimestamp('1:30')).toBe(90);
    expect(parseTimestamp('1:02:03')).toBe(3723);
    expect(parseTimestamp('1h2m3s')).toBe(3723);
    expect(parseTimestamp('2m')).toBe(120);
    expect(parseTimestamp(null)).toBe(0);
  });
});
