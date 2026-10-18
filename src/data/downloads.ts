/**
 * Contenu de la section « Télécharger ».
 *
 * Deux apps, deux façons d’installer :
 *
 * - **TubeCraft** n’a pas encore de paquets natifs signés : la voie officielle
 *   est la web app (PWA). Un shell Tauri 2 est prêt dans le dépôt et se
 *   compile localement, mais aucun .dmg / .exe / .apk public n’est proposé
 *   tant qu’il n’est pas signé — donc pas de faux bouton de téléchargement.
 * - **SpotifyCraft** est distribué en binaires natifs (DMG, MSI, AppImage)
 *   construits et signés par le workflow de release de son dépôt. La page
 *   renvoie vers la page des versions plutôt que d’inventer une URL de
 *   fichier : c’est le seul lien qui reste vrai à chaque version.
 *
 * Pour ajouter une app, dupliquez une entrée de `downloadApps` : la section
 * s’adapte au nombre de plateformes déclarées.
 */

import spotifycraftIcon from '../assets/apps/spotifycraft.png';
import tubecraftIcon from '../assets/apps/tubecraft.png';

export type DownloadPlatformId = 'macos' | 'windows' | 'linux' | 'android' | 'ios';
export type DownloadAppId = 'tubecraft' | 'spotifycraft';
/** `web` : installation PWA depuis le navigateur ; `native` : binaire publié. */
export type InstallMode = 'web' | 'native';

export interface DownloadStep {
  /** verbe court affiché en gras */
  title: string;
  /** précision utile, sans jargon */
  text: string;
}

export interface DownloadPlatform {
  id: DownloadPlatformId;
  name: string;
  /** nom compact pour les onglets et les mesures */
  short: string;
  family: 'desktop' | 'mobile';
  /** ligne technique du panneau : navigateur conseillé ou paquet attendu */
  detail: string;
  /** phrase d’accroche du panneau */
  tagline: string;
  /** une phrase d’introduction */
  intro: string;
  steps: DownloadStep[];
  /** configuration minimale */
  requirement: string;
  /** particularité de la plateforme */
  note: string;
  /** fichier publié, pour les apps natives (DMG, MSI…) */
  file?: string;
  /** ce qui protège le binaire sur cette plateforme */
  trust?: string;
}

export interface DownloadFact {
  value: string;
  label: string;
  text: string;
}

export interface DownloadApp {
  id: DownloadAppId;
  name: string;
  /** fin de la phrase de titre, mise en italique : « TubeCraft, *partout* » */
  emphasis: string;
  /** sous-titre de l’onglet d’app */
  summary: string;
  /** icône de l’app (importée par Vite, donc résolue dans les deux builds) */
  icon: string;
  accent: string;
  mode: InstallMode;
  lede: string;
  badges: string[];
  platforms: DownloadPlatform[];
  facts: DownloadFact[];
  /** note en bas de section */
  note: string;
  version?: string;
  /** page des versions : cible du bouton de téléchargement natif */
  releasesHref?: string;
  /** dépôt public */
  sourceHref?: string;
  /** formats publiés, affichés dans l’aperçu natif */
  formats?: string[];
}

/* ------------------------------------------------------------------ TubeCraft */

const tubecraftPlatforms: DownloadPlatform[] = [
  {
    id: 'macos',
    name: 'macOS',
    short: 'macOS',
    family: 'desktop',
    detail: 'Chrome, Edge ou Safari 17+',
    tagline: 'Dans le Dock, comme une vraie app.',
    intro:
      'TubeCraft s’ajoute au Launchpad et au Dock, avec sa propre fenêtre. Aucun DMG à monter, aucune archive à décompresser.',
    steps: [
      {
        title: 'Ouvrez TubeCraft',
        text: 'Dans Chrome, Edge ou Safari 17+, depuis ce bouton ou votre navigateur habituel.',
      },
      {
        title: 'Installez l’app',
        text: 'Chrome / Edge : cliquez sur l’icône d’installation dans la barre d’adresse. Safari : menu Fichier → Ajouter au Dock.',
      },
      {
        title: 'Lancez depuis le Dock',
        text: 'La fenêtre s’ouvre sans barre d’adresse, conserve votre session et se met à jour toute seule.',
      },
    ],
    requirement: 'macOS 12 ou plus récent · navigateur à jour · aucune dépendance',
    note: 'Safari 17+ propose « Ajouter au Dock » ; sur les versions antérieures, utilisez Chrome ou Edge.',
  },
  {
    id: 'windows',
    name: 'Windows',
    short: 'Windows',
    family: 'desktop',
    detail: 'Chrome ou Edge',
    tagline: 'Une tuile dans le menu Démarrer.',
    intro:
      'L’installation crée un raccourci propre dans le menu Démarrer, la barre des tâches et le bureau — sans installeur MSI.',
    steps: [
      {
        title: 'Ouvrez TubeCraft',
        text: 'Dans Chrome ou Edge, sur ce PC. Le moteur Edge est déjà présent sur Windows 10 et 11.',
      },
      {
        title: 'Choisissez « Installer »',
        text: 'Cliquez sur l’icône d’installation dans la barre d’adresse, ou menu ⋮ → Applications → Installer ce site.',
      },
      {
        title: 'Épinglez-la',
        text: 'Clic droit sur l’icône → Épingler à la barre des tâches. TubeCraft démarre alors comme n’importe quelle app.',
      },
    ],
    requirement: 'Windows 10 ou 11 · Chrome, Edge ou Brave · aucune dépendance',
    note: 'La désinstallation se fait depuis Windows → Paramètres → Applications, comme une application classique.',
  },
  {
    id: 'linux',
    name: 'Linux',
    short: 'Linux',
    family: 'desktop',
    detail: 'Chrome, Chromium ou Brave',
    tagline: 'Une entrée dans votre lanceur.',
    intro:
      'Le navigateur crée une entrée de bureau standard. TubeCraft apparaît dans GNOME, KDE ou XFCE, sans paquet système ni droits root.',
    steps: [
      {
        title: 'Ouvrez TubeCraft',
        text: 'Dans Chrome, Chromium ou Brave. Firefox sur Linux ne propose pas encore l’installation PWA.',
      },
      {
        title: 'Installez depuis la barre d’adresse',
        text: 'Cliquez sur l’icône d’installation (écran avec une flèche), ou menu ⋮ → Installer TubeCraft.',
      },
      {
        title: 'Retrouvez-la dans le lanceur',
        text: 'Une entrée .desktop est créée automatiquement ; épinglez-la à votre dock ou ajoutez-la aux favoris.',
      },
    ],
    requirement: 'Distribution récente · Chrome, Chromium ou Brave · aucune dépendance',
    note: 'Aucun droit administrateur n’est nécessaire : tout reste dans votre profil utilisateur.',
  },
  {
    id: 'android',
    name: 'Android',
    short: 'Android',
    family: 'mobile',
    detail: 'Chrome ou Samsung Internet',
    tagline: 'Une icône sur l’écran d’accueil.',
    intro:
      'TubeCraft s’installe en quelques gestes, s’ouvre en plein écran et garde vos données sur l’appareil.',
    steps: [
      {
        title: 'Ouvrez TubeCraft',
        text: 'Dans Chrome ou Samsung Internet, sur votre téléphone ou tablette.',
      },
      {
        title: 'Ajoutez à l’écran d’accueil',
        text: 'Menu ⋮ → « Installer l’application » (ou « Ajouter à l’écran d’accueil » selon la version).',
      },
      {
        title: 'Lancez l’icône',
        text: 'L’app s’ouvre sans barre d’adresse, en plein écran, et se souvient de votre dernier écran.',
      },
    ],
    requirement: 'Android 9 ou plus récent · Chrome 90+ ou Samsung Internet · ~4 Mo',
    note: 'Sur Android, l’installation peut aussi être proposée automatiquement après quelques visites.',
  },
  {
    id: 'ios',
    name: 'iPhone',
    short: 'iOS',
    family: 'mobile',
    detail: 'Safari (obligatoire)',
    tagline: 'Sur l’écran d’accueil, plein écran.',
    intro:
      'Sur iPhone et iPad, l’ajout à l’écran d’accueil se fait depuis Safari. TubeCraft s’ouvre alors comme une app, sans interface de navigateur.',
    steps: [
      {
        title: 'Ouvrez TubeCraft dans Safari',
        text: 'Sur iPhone ou iPad. Chrome et Firefox sur iOS ne peuvent pas installer de web app.',
      },
      {
        title: 'Touchez Partager',
        text: 'Le bouton carré avec une flèche, en bas de l’écran (en haut sur iPad).',
      },
      {
        title: 'Choisissez « Sur l’écran d’accueil »',
        text: 'Puis « Ajouter ». L’icône TubeCraft rejoint votre écran d’accueil et s’ouvre en plein écran.',
      },
    ],
    requirement: 'iOS ou iPadOS 15+ · Safari · ~4 Mo',
    note: 'Sur iOS, l’installation passe toujours par le menu Partager de Safari : c’est une règle d’Apple.',
  },
];

/* --------------------------------------------------------------- SpotifyCraft */

const spotifycraftPlatforms: DownloadPlatform[] = [
  {
    id: 'macos',
    name: 'macOS',
    short: 'macOS',
    family: 'desktop',
    detail: 'DMG universel · Apple silicon & Intel',
    tagline: 'Un vrai binaire, dans le Dock.',
    intro:
      'SpotifyCraft est une application native : elle démarre sans navigateur, garde sa fenêtre et ses raccourcis, et lit vos fichiers locaux directement.',
    steps: [
      {
        title: 'Téléchargez le DMG',
        text: 'Sur la page des versions, prenez le fichier macOS de la dernière publication.',
      },
      {
        title: 'Glissez dans Applications',
        text: 'Ouvrez l’image disque, puis déposez SpotifyCraft à côté de vos autres applications.',
      },
      {
        title: 'Lancez l’app',
        text: 'La fenêtre de lecture s’ouvre ; l’icône reste dans le Dock pour les fois suivantes.',
      },
    ],
    requirement: 'macOS 12 ou plus récent · 25 Mo · aucune dépendance',
    note: 'Les binaires publiés sont signés Developer ID et notariés par Apple : Gatekeeper les ouvre sans avertissement.',
    file: 'DMG universel',
    trust: 'Signé Developer ID · notarié Apple',
  },
  {
    id: 'windows',
    name: 'Windows',
    short: 'Windows',
    family: 'desktop',
    detail: 'MSI ou .exe · Windows 10/11 64 bits',
    tagline: 'Une application, pas un onglet.',
    intro:
      'L’installeur pose SpotifyCraft dans Programmes, crée un raccourci dans le menu Démarrer et associe les formats audio pris en charge.',
    steps: [
      {
        title: 'Téléchargez l’installeur',
        text: 'Sur la page des versions, prenez le MSI (ou le .exe) de la dernière publication.',
      },
      {
        title: 'Exécutez-le',
        text: 'Windows installe l’app dans votre profil ; aucun droit administrateur n’est demandé.',
      },
      {
        title: 'Lancez depuis le menu Démarrer',
        text: 'SpotifyCraft s’ouvre dans sa propre fenêtre, avec ses raccourcis et sa file d’attente.',
      },
    ],
    requirement: 'Windows 10 ou 11 · 64 bits · 30 Mo',
    note: 'L’installeur publié est signé par certificat de signature de code : SmartScreen ne doit plus signaler d’éditeur inconnu.',
    file: 'MSI 64 bits',
    trust: 'Signature Authenticode · horodatée',
  },
  {
    id: 'linux',
    name: 'Linux',
    short: 'Linux',
    family: 'desktop',
    detail: 'AppImage · x86_64',
    tagline: 'Un exécutable, pas un dépôt.',
    intro:
      'L’AppImage embarque tout ce qu’il faut : aucune dépendance à installer, aucun droit root, aucune entrée système imposée.',
    steps: [
      {
        title: 'Téléchargez l’AppImage',
        text: 'Sur la page des versions, prenez le fichier .AppImage de la dernière publication.',
      },
      {
        title: 'Rendez-le exécutable',
        text: 'Clic droit → Propriétés → « Exécuter comme un programme », ou `chmod +x SpotifyCraft.AppImage`.',
      },
      {
        title: 'Lancez-le',
        text: 'Double-cliquez sur le fichier : l’app démarre directement, sans terminal ni installation.',
      },
    ],
    requirement: 'Distribution récente · x86_64 · glibc 2.31+',
    note: 'Un paquet .deb est publié en parallèle pour Debian, Ubuntu et leurs dérivés.',
    file: 'AppImage x86_64',
    trust: 'Binaire reproductible · SHA-256 publié',
  },
];

/* --------------------------------------------------------------------- apps */

export const downloadApps: DownloadApp[] = [
  {
    id: 'tubecraft',
    name: 'TubeCraft',
    emphasis: 'partout',
    summary: 'Web app · 5 plateformes',
    icon: tubecraftIcon,
    accent: '#ff2d46',
    mode: 'web',
    lede:
      'Une seule app, cinq plateformes. Pas d’installeur à décompresser : le navigateur crée une icône, une fenêtre et un raccourci — puis TubeCraft se met à jour toute seule.',
    badges: ['Sans magasin', 'Sans compte', 'Mise à jour automatique', 'Données locales'],
    platforms: tubecraftPlatforms,
    facts: [
      { value: '0', label: 'magasin', text: 'Aucun App Store, Play Store ou compte à créer.' },
      { value: '5', label: 'plateformes', text: 'macOS, Windows, Linux, Android et iPhone.' },
      { value: '↻', label: 'à jour', text: 'La dernière version se charge à chaque ouverture.' },
      { value: '∞', label: 'gratuit', text: 'Open source, sans abonnement ni essai qui expire.' },
    ],
    note:
      'La web app reste la voie d’installation officielle. Un shell desktop Tauri 2 (fenêtre native, icône liquid glass, DMG/APP à compiler soi-même) est inclus dans le dépôt ; les paquets signés — DMG, MSI, AppImage et APK — seront annoncés sur GitHub après la première version stable.',
    sourceHref: 'https://github.com/DmzGamingYT/tubecraft',
  },
  {
    id: 'spotifycraft',
    name: 'SpotifyCraft',
    emphasis: 'sur le bureau',
    summary: 'Native · 3 systèmes',
    icon: spotifycraftIcon,
    accent: '#0f9d4f',
    mode: 'native',
    version: '0.2.0',
    formats: ['DMG', 'MSI', 'AppImage'],
    lede:
      'Cette fois, une vraie application : un binaire signé, une fenêtre native, et votre musique qui reste sur la machine. macOS, Windows et Linux, sans magasin ni compte.',
    badges: ['Signé', 'Hors magasin', 'Données locales', 'Open source'],
    platforms: spotifycraftPlatforms,
    facts: [
      { value: '3', label: 'systèmes', text: 'macOS, Windows et Linux, un binaire pour chacun.' },
      { value: '↧', label: 'natif', text: 'DMG, MSI et AppImage : l’app démarre sans navigateur.' },
      { value: '✓', label: 'signé', text: 'Signature de code et notarisation à chaque publication.' },
      { value: '∞', label: 'gratuit', text: 'Code MIT sur GitHub, sans compte ni abonnement.' },
    ],
    note:
      'Les installeurs sont publiés sur GitHub à chaque version. Aucun magasin, aucun compte : le DMG, le MSI et l’AppImage sont les seuls fichiers à récupérer.',
    releasesHref: 'https://github.com/DmzGamingYT/spotifycraft/releases/latest',
    sourceHref: 'https://github.com/DmzGamingYT/spotifycraft',
  },
];

export function findDownloadApp(id: DownloadAppId): DownloadApp {
  return downloadApps.find((app) => app.id === id) ?? downloadApps[0];
}
