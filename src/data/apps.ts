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
  /**
   * Une phrase, deux tout au plus.
   *
   * La fiche catalogue ne doit pas se lire comme un mode d'emploi : le détail
   * long vit dans la galerie. Au-delà de ~25 mots, la ligne casse et la
   * fiche cesse d'être une fiche.
   */
  description: string;
  /** trois points forts, une ligne chacun, affichés en puces */
  highlights: string[];
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
 * Adresse de la vitrine de la collection.
 *
 * La vitrine est une page statique à part entière (`/collection/`), servie à
 * côté de l'application : elle a son propre `<title>`, sa propre image de
 * partage et son propre poids en JavaScript. L'application garde la route
 * `/apps` en redirection, pour que les liens déjà partagés marchent encore.
 */
export const collectionUrl =
  (import.meta.env.VITE_COLLECTION_URL ?? '').trim() || '/collection/';

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
      'Un client YouTube complet — recherche, lecteur, Shorts, abonnements, commentaires — sans clé API, avec vos données dans le navigateur.',
    highlights: [
      'Reprise de lecture et mini-lecteur',
      'Shorts verticaux et abonnements',
      'Recherche Instantanée, sans quota',
    ],
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
      'Lecteur façon Spotify : catalogue iTunes, extraits de 30 s, paroles synchronisées, égaliseur — et la lecture de vos propres fichiers importés.',
    highlights: [
      'Daily Mix et égaliseur 10 bandes',
      'Vos MP3, FLAC et M4A importés',
      'Extraits officiels et paroles',
    ],
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
      'Suivi sportif et santé local-first : anneaux d’objectifs, sommeil, corps, nutrition et coach IA — avec import Apple Health et calculs Rust/WASM.',
    highlights: [
      'Import Apple Health et Samsung Health',
      'Anneaux d’objectifs, sommeil, nutrition',
      'Coach IA, calculs Rust/WASM',
    ],
    accent: '#c9ff3d',
    stack: ['React', 'Vite', 'TypeScript', 'Rust → WASM', 'Tauri 2'],
    license: 'MIT',
    // Instance publique via `VITE_PULSECRAFT_URL`, sinon serveur local (5186).
    ...(pulsecraftUrl ? { url: pulsecraftUrl } : {}),
    source: 'https://github.com/DmzGamingYT/pulsecraft',
  },
];
