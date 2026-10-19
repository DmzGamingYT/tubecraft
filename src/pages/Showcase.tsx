import { useEffect } from 'react';
import { collectionUrl } from '../data/apps';

/**
 * La vitrine a quitté l'application : elle est servie en page statique.
 *
 * L'ancienne route `/apps` reste une redirection. Les liens déjà partagés
 * (messages, discussions, README) continuent de tomber sur la bonne page, et
 * il n'y a qu'une seule adresse canonique pour la collection — celle qui a un
 * vrai `<title>`, une image de partage et un poids en JavaScript réduit.
 */
export function Showcase() {
  useEffect(() => {
    window.location.replace(collectionUrl);
  }, []);

  return <p className="redirect-note">Redirection vers la collection…</p>;
}
