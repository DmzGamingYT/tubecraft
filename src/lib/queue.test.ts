import { describe, expect, it } from 'vitest';
import { addToQueue, moveInQueue, normalizeQueue, removeFromQueue, toggleInQueue } from './queue';

describe('file « Lire ensuite »', () => {
  it('ajoute en fin de file sans doublon', () => {
    expect(addToQueue([], 'a')).toEqual(['a']);
    expect(addToQueue(['a'], 'b')).toEqual(['a', 'b']);
    expect(addToQueue(['a', 'b'], 'a')).toEqual(['a', 'b']);
    expect(addToQueue(['a'], '')).toEqual(['a']);
  });

  it('retire une vidéo, même absente', () => {
    expect(removeFromQueue(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
    expect(removeFromQueue(['a'], 'z')).toEqual(['a']);
  });

  it('déplace une vidéo en respectant les bornes', () => {
    expect(moveInQueue(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveInQueue(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(moveInQueue(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveInQueue(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
    expect(moveInQueue(['a', 'b', 'c'], 'inconnue', 1)).toEqual(['a', 'b', 'c']);
    expect(moveInQueue(['a', 'b'], 'a', 0)).toEqual(['a', 'b']);
  });

  it('alterne l’appartenance', () => {
    expect(toggleInQueue([], 'a')).toEqual(['a']);
    expect(toggleInQueue(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('normalise une valeur persistée corrompue', () => {
    expect(normalizeQueue(['a', 42, '', 'a', 'b'])).toEqual(['a', 'b']);
    expect(normalizeQueue(null)).toEqual([]);
    expect(normalizeQueue({ 0: 'a' })).toEqual([]);
  });
});
