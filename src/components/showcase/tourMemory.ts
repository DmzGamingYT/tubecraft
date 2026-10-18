/**
 * Mémoire de la visite guidée.
 *
 * La vitrine propose la visite en évidence tant qu'elle n'a pas été lancée.
 * Une fois lancée (même abandonnée en cours de route), l'offre disparaît au
 * profit d'un lien discret : le navigateur se souvient de la visite.
 */

const TOUR_KEY = 'atelier.tour';

/** Sous-ensemble du stockage local utilisé ici, pour tester sans navigateur. */
export interface TourStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): TourStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** La visite a-t-elle déjà été lancée sur cet appareil ? */
export function hasSeenTour(storage: TourStorage | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(TOUR_KEY) === 'seen';
  } catch {
    return false;
  }
}

/** Retient que la visite a été lancée. Un stockage bloqué ne doit rien casser. */
export function rememberTour(storage: TourStorage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(TOUR_KEY, 'seen');
  } catch {
    /* navigation privée ou quota plein : la visite reste simplement proposée */
  }
}

export const TOUR_STORAGE_KEY = TOUR_KEY;
