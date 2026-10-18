import { describe, expect, it } from 'vitest';
import { compactNumber, formatDuration, parseViews, translateRelative } from './format';

describe('compactNumber', () => {
  it('garde les petits nombres tels quels', () => {
    expect(compactNumber(0)).toBe('0');
    expect(compactNumber(999)).toBe('999');
  });

  it('utilise la virgule décimale française', () => {
    expect(compactNumber(1_234)).toBe('1,2 k');
    expect(compactNumber(12_500)).toBe('13 k');
    expect(compactNumber(1_500_000)).toBe('1,5 M');
    expect(compactNumber(2_000_000)).toBe('2 M');
    expect(compactNumber(2_400_000_000)).toBe('2,4 G');
  });
});

describe('parseViews', () => {
  it('lit les grands nombres séparés par des espaces', () => {
    expect(parseViews('1 827 523 566 vues')).toBe(1_827_523_566);
    expect(parseViews('1\u202f234\u202f567 vues')).toBe(1_234_567);
  });

  it('lit les suffixes compacts', () => {
    expect(parseViews('2,3 M vues')).toBe(2_300_000);
    expect(parseViews('15 k vues')).toBe(15_000);
    expect(parseViews('1.2K')).toBe(1_200);
    expect(parseViews('')).toBe(0);
  });
});

describe('formatDuration', () => {
  it('formate les durées courtes et longues', () => {
    expect(formatDuration(205)).toBe('3:25');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(null)).toBe('');
  });
});

describe('translateRelative', () => {
  it('accorde correctement le singulier et le pluriel', () => {
    expect(translateRelative('1 day ago')).toBe('il y a 1 jour');
    expect(translateRelative('3 days ago')).toBe('il y a 3 jours');
    expect(translateRelative('1 year ago')).toBe('il y a 1 an');
    expect(translateRelative('2 years ago')).toBe('il y a 2 ans');
    expect(translateRelative('1 minute ago')).toBe('il y a 1 minute');
    expect(translateRelative('1 month ago')).toBe('il y a 1 mois');
  });

  it('laisse le français déjà localisé intact', () => {
    expect(translateRelative('il y a 2 ans')).toBe('il y a 2 ans');
    expect(translateRelative('')).toBe('');
  });

  it('met en forme les dates ISO du catalogue', () => {
    expect(translateRelative('2019-04-04')).toBe('4 avr. 2019');
    expect(translateRelative('2026-10-16')).toBe('16 oct. 2026');
  });
});
