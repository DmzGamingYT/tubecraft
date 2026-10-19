/**
 * Les apps présentées sur la vitrine (`/apps` dans l'app, `showcase/` en site
 * autonome).
 *
 * La première entrée est mise en avant : c'est TubeCraft, l'app de ce dépôt.
 * Pour ajouter une app, dupliquez une entrée et renseignez `source` avec
 * l'URL du dépôt public. `self: true` = l'application de ce dépôt, dont
 * l'URL est fournie par la page (route SPA ou site déployé).
 *
 * La vitrine ne présente que des apps réellement utilisables : rien n'y figure
 * avant d'être en ligne. Aujourd'hui : TubeCraft, SpotifyCraft et PulseCraft.
 */

import { remoteAppUrl } from '../lib/url';

export interface OpenSourceApp {
  id: string;
  /** nom affiché, en gros sur la carte */
  name: string;
  /** monogramme de la pastille colorée */
  mark: string;
  /** une phrase, l'accroche */
  tagline: string;
  /** deux ou trois phrases de description */
  description: string;
  /** couleur d'accent de la carte */
  accent: string;
  stack: string[];
  license: string;
  /** l'app de ce dépôt (TubeCraft) : URL fournie par le contexte */
  self?: boolean;
  /**
   * URL de lancement d'une app qui n'est pas celle de ce dépôt (autre origine,
   * port local de développement…). Sans elle, la carte ne propose que le code.
   */
  url?: string;
  /** dépôt GitHub public */
  source?: string;
  /** l'app affichée en grand */
  featured?: boolean;
}

/** Profil GitHub de l'auteur, utilisé comme lien de repli et dans le pied de page. */
export const githubProfile = 'https://github.com/DmzGamingYT';

/**
 * Adresse publique de la web app PulseCraft.
 *
 * Elle est servie à côté de TubeCraft, dans un sous-dossier (`/pulsecraft/`) du
 * même hébergement. `VITE_PULSECRAFT_URL` la remplace au build si l’app part
 * ailleurs. Elle est préférée à un lien mort : l’app est réellement en ligne,
 * donc la carte et la section « Télécharger » peuvent y renvoyer.
 */
export const pulsecraftWebUrl =
  'https://site-837caca50a67485a994f4549b9ef7404.freebuff.page/pulsecraft/';

/**
 * Adresse de lancement d’une app servie hors de ce dépôt.
 *
 * Au build, `VITE_PULSECRAFT_URL` / `VITE_SPOTIFYCRAFT_URL` permettent de
 * pointer une autre instance ; sinon on retombe sur l’URL publique connue
 * (`pulsecraftWebUrl`) en production, et sur le serveur local en développement
 * pour que « Lancer » marche vraiment. Une app sans URL connue ne propose que
 * son code (c’est le cas de SpotifyCraft aujourd’hui).
 */
const pulsecraftUrl = remoteAppUrl(
  import.meta.env.VITE_PULSECRAFT_URL,
  5186,
  pulsecraftWebUrl
);
const spotifycraftUrl = remoteAppUrl(import.meta.env.VITE_SPOTIFYCRAFT_URL, 5184);

export const apps: OpenSourceApp[] = [
  {
    id: 'tubecraft',
    name: 'TubeCraft',
    mark: 'TC',
    tagline: 'YouTube, en open source.',
    description:
      'Un client YouTube complet : recherche, lecteur, Shorts, abonnements, commentaires, mini-lecteur persistant et reprise de lecture. Il parle directement à YouTube, sans clé API, et garde vos données dans le navigateur.',
    accent: '#ff2d46',
    stack: ['React', 'Vite', 'TypeScript', 'InnerTube'],
    license: 'MIT',
    self: true,
    source: 'https://github.com/DmzGamingYT/tubecraft',
    featured: true,
  },
  {
    id: 'spotifycraft',
    name: 'SpotifyCraft',
    mark: 'SP',
    tagline: 'La musique, sans le nuage.',
    description:
      'Lecteur musical façon Spotify : catalogue iTunes (métadonnées Spotify si vous connectez votre compte), extraits officiels de 30 s, paroles synchronisées, égaliseur 10 bandes, Daily Mix calculés en local — et lecture complète de vos propres MP3, FLAC ou M4A importés dans le navigateur.',
    accent: '#1ed760',
    stack: ['React', 'Vite', 'TypeScript', 'Rust → WASM'],
    license: 'MIT',
    // Instance publique via `VITE_SPOTIFYCRAFT_URL`, sinon serveur local (5184).
    ...(spotifycraftUrl ? { url: spotifycraftUrl } : {}),
    source: 'https://github.com/DmzGamingYT/spotifycraft',
  },
  {
    id: 'pulsecraft',
    name: 'PulseCraft',
    mark: 'PC',
    tagline: 'Vos données de santé restent chez vous.',
    description:
      'Un suivi sportif et santé local-first : anneaux d’objectifs, journal d’entraînement, sommeil, corps, nutrition et coach IA. Import Apple Health, Samsung Health, GPX et TCX, calculs en Rust/WASM, app native Tauri — et aucune donnée envoyée sans votre accord.',
    accent: '#c9ff3d',
    stack: ['React', 'Vite', 'TypeScript', 'Rust → WASM', 'Tauri 2'],
    license: 'MIT',
    // Instance publique via `VITE_PULSECRAFT_URL`, sinon serveur local (5186).
    ...(pulsecraftUrl ? { url: pulsecraftUrl } : {}),
    source: 'https://github.com/DmzGamingYT/pulsecraft',
  },
];
