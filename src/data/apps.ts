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
    // Serveur de développement local de SpotifyCraft (`npm run dev`, port 5184).
    url: 'http://127.0.0.1:5184/',
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
    // Serveur de développement local de PulseCraft (`npm run dev`, port 5186).
    url: 'http://127.0.0.1:5186/',
    source: 'https://github.com/DmzGamingYT/pulsecraft',
  },
];
