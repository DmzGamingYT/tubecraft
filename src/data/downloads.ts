/**
 * Contenu de la section « Télécharger ».
 *
 * Deux apps, deux façons d’installer :
 *
 * - **Séquence** n’a pas encore de paquets natifs signés : la voie officielle
 *   est la web app (PWA). Un shell Tauri 2 est prêt dans le dépôt et se
 *   compile localement, mais aucun .dmg / .exe / .apk public n’est proposé
 *   tant qu’il n’est pas signé — donc pas de faux bouton de téléchargement.
 * - **Portée** n’a pas encore de binaires natifs publiés : son dépôt ne
 *   contient aucune release. Les plateformes décrivent donc ce qui sera
 *   proposé (`releaseState: 'pending'`), la page ne montre ni version ni
 *   signature, et le bouton renvoie vers le suivi des versions au lieu de
 *   promettre un fichier qui n’existe pas.
 * - **Battement** est une web app comme Séquence : elle s’installe depuis le
 *   navigateur sur les cinq plateformes, depuis son URL publique.
 *
 * Pour ajouter une app, dupliquez une entrée de `downloadApps` : la section
 * s’adapte au nombre de plateformes déclarées.
 */

import pulsecraftIcon from '../assets/apps/pulsecraft.svg';
import spotifycraftIcon from '../assets/apps/spotifycraft.svg';
import tubecraftIcon from '../assets/apps/tubecraft.svg';
import { pulsecraftWebUrl } from './apps';
import { remoteAppUrl } from '../lib/url';

export type DownloadPlatformId = 'macos' | 'windows' | 'linux' | 'android' | 'ios';
export type DownloadAppId = 'tubecraft' | 'spotifycraft' | 'pulsecraft';
/** `web` : installation PWA depuis le navigateur ; `native` : binaire publié. */
export type InstallMode = 'web' | 'native';
/**
 * État de la distribution native : `published` = des fichiers existent sur la
 * page des versions ; `pending` = rien n’est encore téléchargeable.
 */
export type ReleaseState = 'published' | 'pending';

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
  /**
   * Canal de distribution d’une app native. `installer` : un fichier se
   * télécharge (DMG, MSI, APK…) ; `testflight` : iOS, où Apple n’autorise que
   * les apps signées via TestFlight ou l’App Store — aucun fichier à récupérer.
   */
  delivery?: 'installer' | 'testflight';
}

export type DownloadFactGlyph =
  | 'store'
  | 'devices'
  | 'refresh'
  | 'infinity'
  | 'download'
  | 'shield';

export interface DownloadFact {
  value: string;
  label: string;
  text: string;
  /** pictogramme de la carte, choisi par la donnée pour rester lisible */
  glyph?: DownloadFactGlyph;
}

export interface DownloadApp {
  id: DownloadAppId;
  name: string;
  /** fin de la phrase de titre, mise en italique : « Séquence, *partout* » */
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
  /** version publiée, affichée seulement quand des binaires existent */
  version?: string;
  /** état de la distribution native (`native` uniquement) */
  releaseState?: ReleaseState;
  /** page des versions : cible du bouton quand des binaires sont publiés */
  releasesHref?: string;
  /** dépôt public */
  sourceHref?: string;
  /** formats prévus à la publication, pour l’aperçu natif */
  formats?: string[];
  /** l’app de ce dépôt : son URL de lancement est fournie par la page */
  self?: boolean;
  /**
   * URL de la web app quand elle est servie ailleurs que dans ce dépôt.
   * `null` = pas d’adresse connue, la section renvoie alors vers le code.
   */
  launchHref?: string | null;
}

/* ------------------------------------------------------------------ Séquence */

const tubecraftPlatforms: DownloadPlatform[] = [
  {
    id: 'macos',
    name: 'macOS',
    short: 'macOS',
    family: 'desktop',
    detail: 'Chrome, Edge ou Safari 17+',
    tagline: 'Dans le Dock, comme une vraie app.',
    intro:
      'Séquence s’ajoute au Launchpad et au Dock, avec sa propre fenêtre. Aucun DMG à monter, aucune archive à décompresser.',
    steps: [
      {
        title: 'Ouvrez Séquence',
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
        title: 'Ouvrez Séquence',
        text: 'Dans Chrome ou Edge, sur ce PC. Le moteur Edge est déjà présent sur Windows 10 et 11.',
      },
      {
        title: 'Choisissez « Installer »',
        text: 'Cliquez sur l’icône d’installation dans la barre d’adresse, ou menu ⋮ → Applications → Installer ce site.',
      },
      {
        title: 'Épinglez-la',
        text: 'Clic droit sur l’icône → Épingler à la barre des tâches. Séquence démarre alors comme n’importe quelle app.',
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
      'Le navigateur crée une entrée de bureau standard. Séquence apparaît dans GNOME, KDE ou XFCE, sans paquet système ni droits root.',
    steps: [
      {
        title: 'Ouvrez Séquence',
        text: 'Dans Chrome, Chromium ou Brave. Firefox sur Linux ne propose pas encore l’installation PWA.',
      },
      {
        title: 'Installez depuis la barre d’adresse',
        text: 'Cliquez sur l’icône d’installation (écran avec une flèche), ou menu ⋮ → Installer Séquence.',
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
      'Séquence s’installe en quelques gestes, s’ouvre en plein écran et garde vos données sur l’appareil.',
    steps: [
      {
        title: 'Ouvrez Séquence',
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
      'Sur iPhone et iPad, l’ajout à l’écran d’accueil se fait depuis Safari. Séquence s’ouvre alors comme une app, sans interface de navigateur.',
    steps: [
      {
        title: 'Ouvrez Séquence dans Safari',
        text: 'Sur iPhone ou iPad. Chrome et Firefox sur iOS ne peuvent pas installer de web app.',
      },
      {
        title: 'Touchez Partager',
        text: 'Le bouton carré avec une flèche, en bas de l’écran (en haut sur iPad).',
      },
      {
        title: 'Choisissez « Sur l’écran d’accueil »',
        text: 'Puis « Ajouter ». L’icône Séquence rejoint votre écran d’accueil et s’ouvre en plein écran.',
      },
    ],
    requirement: 'iOS ou iPadOS 15+ · Safari · ~4 Mo',
    note: 'Sur iOS, l’installation passe toujours par le menu Partager de Safari : c’est une règle d’Apple.',
  },
];

/* --------------------------------------------------------------- Portée */

const spotifycraftPlatforms: DownloadPlatform[] = [
  {
    id: 'macos',
    name: 'macOS',
    short: 'macOS',
    family: 'desktop',
    detail: 'DMG universel · Apple silicon & Intel',
    tagline: 'Un vrai binaire, dans le Dock.',
    intro:
      'Portée est une application native : elle démarre sans navigateur, garde sa fenêtre et ses raccourcis, et lit vos fichiers locaux directement.',
    steps: [
      {
        title: 'Téléchargez le DMG',
        text: 'Sur la page des versions, prenez le fichier macOS de la dernière publication.',
      },
      {
        title: 'Glissez dans Applications',
        text: 'Ouvrez l’image disque, puis déposez Portée à côté de vos autres applications.',
      },
      {
        title: 'Lancez l’app',
        text: 'La fenêtre de lecture s’ouvre ; l’icône reste dans le Dock pour les fois suivantes.',
      },
    ],
    requirement: 'macOS 12 ou plus récent · aucune dépendance',
    note: 'À la publication, le DMG sera signé Developer ID et notarié par Apple : Gatekeeper l’ouvrira sans avertissement.',
    file: 'DMG universel',
    trust: 'Signature Developer ID et notarisation prévues',
  },
  {
    id: 'windows',
    name: 'Windows',
    short: 'Windows',
    family: 'desktop',
    detail: 'MSI ou .exe · Windows 10/11 64 bits',
    tagline: 'Une application, pas un onglet.',
    intro:
      'L’installeur pose Portée dans Programmes, crée un raccourci dans le menu Démarrer et associe les formats audio pris en charge.',
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
        text: 'Portée s’ouvre dans sa propre fenêtre, avec ses raccourcis et sa file d’attente.',
      },
    ],
    requirement: 'Windows 10 ou 11 · 64 bits · aucune dépendance',
    note: 'À la publication, l’installeur sera signé par certificat de signature de code : SmartScreen ne signalera pas d’éditeur inconnu.',
    file: 'MSI 64 bits',
    trust: 'Signature Authenticode prévue, horodatée',
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
        text: 'Clic droit → Propriétés → « Exécuter comme un programme », ou `chmod +x Portée.AppImage`.',
      },
      {
        title: 'Lancez-le',
        text: 'Double-cliquez sur le fichier : l’app démarre directement, sans terminal ni installation.',
      },
    ],
    requirement: 'Distribution récente · x86_64 · glibc 2.31+',
    note: 'Un paquet .deb accompagnera l’AppImage à la publication, pour Debian, Ubuntu et leurs dérivés.',
    file: 'AppImage x86_64',
    trust: 'Binaire reproductible · empreinte SHA-256 publiée',
  },
  {
    id: 'android',
    name: 'Android',
    short: 'Android',
    family: 'mobile',
    detail: 'APK signé · Android 9+',
    tagline: 'Votre musique en poche, hors ligne.',
    intro:
      'La même app native que sur le bureau, compilée pour Android : lecture en arrière-plan, commandes sur l’écran verrouillé et fichiers importés qui restent sur l’appareil.',
    steps: [
      {
        title: 'Téléchargez l’APK',
        text: 'Sur la page des versions, prenez le fichier .apk de la dernière publication.',
      },
      {
        title: 'Autorisez l’installation',
        text: 'Android demande de confirmer une installation hors magasin : acceptez pour ce fichier, puis installez.',
      },
      {
        title: 'Ouvrez Portée',
        text: 'La bibliothèque se charge sur l’appareil, et la lecture continue quand vous verrouillez l’écran.',
      },
    ],
    requirement: 'Android 9 ou plus récent · arm64 et armv7 · ~30 Mo',
    note: 'Aucun Play Store : l’APK sera signé, publié sur GitHub, et accompagné de son empreinte SHA-256 pour vérifier le fichier.',
    file: 'APK signé',
    trust: 'Signature de release prévue · empreinte SHA-256 publiée',
    delivery: 'installer',
  },
  {
    id: 'ios',
    name: 'iPhone',
    short: 'iOS',
    family: 'mobile',
    detail: 'TestFlight · iOS 16+',
    tagline: 'Sur iPhone, par TestFlight.',
    intro:
      'Apple n’autorise pas l’installation d’une app hors magasin : sur iPhone et iPad, la version native passera donc par TestFlight, qui installe l’app signée sur l’appareil.',
    steps: [
      {
        title: 'Installez TestFlight',
        text: 'Depuis l’App Store : c’est l’app gratuite d’Apple qui reçoit les bêtas signées.',
      },
      {
        title: 'Rejoignez la bêta',
        text: 'Le lien TestFlight sera publié avec la première version ; il s’ouvre directement dans l’app.',
      },
      {
        title: 'Lancez Portée',
        text: 'L’app rejoint l’écran d’accueil et lit la musique stockée sur l’iPhone.',
      },
    ],
    requirement: 'iOS ou iPadOS 16+ · TestFlight · ~40 Mo',
    note: 'Aucun fichier .ipa à télécharger : iOS n’installe que des apps signées, via TestFlight ou l’App Store.',
    file: 'TestFlight',
    trust: 'Signée et distribuée par Apple via TestFlight',
    delivery: 'testflight',
  },
];

/* ------------------------------------------------------------------ Battement */

/**
 * Battement suit la même voie que Séquence : une web app installable sur les
 * cinq plateformes, servie dans un sous-dossier du même hébergement. Les
 * étapes sont donc volontairement proches — c’est le navigateur qui installe,
 * pas un paquet signé.
 */
const pulsecraftPlatforms: DownloadPlatform[] = [
  {
    id: 'macos',
    name: 'macOS',
    short: 'macOS',
    family: 'desktop',
    detail: 'Chrome, Edge ou Safari 17+',
    tagline: 'Votre suivi dans le Dock, vos données sur la machine.',
    intro:
      'Battement s’installe depuis le navigateur : une icône dans le Launchpad, sa propre fenêtre, et votre suivi déjà chargé — il reste dans le navigateur, pas dans un cloud.',
    steps: [
      {
        title: 'Ouvrez Battement',
        text: 'Dans Chrome, Edge ou Safari 17+, depuis ce bouton ou votre navigateur habituel.',
      },
      {
        title: 'Installez l’app',
        text: 'Chrome / Edge : icône d’installation dans la barre d’adresse. Safari : menu Fichier → Ajouter au Dock.',
      },
      {
        title: 'Reprenez votre suivi',
        text: 'L’app retrouve les séances, le plan et le sommeil déjà enregistrés, hors ligne compris.',
      },
    ],
    requirement: 'macOS 12 ou plus récent · navigateur à jour · aucune dépendance',
    note: 'Le coach IA est facultatif : sans fournisseur configuré, les calculs de charge, de sommeil et de plan tournent en local.',
  },
  {
    id: 'windows',
    name: 'Windows',
    short: 'Windows',
    family: 'desktop',
    detail: 'Chrome ou Edge',
    tagline: 'Une tuile dans le menu Démarrer.',
    intro:
      'L’installation crée un raccourci dans le menu Démarrer et la barre des tâches. Rien n’est écrit ailleurs que dans le profil du navigateur.',
    steps: [
      {
        title: 'Ouvrez Battement',
        text: 'Dans Chrome ou Edge, sur ce PC. Le moteur Edge est déjà présent sur Windows 10 et 11.',
      },
      {
        title: 'Choisissez « Installer »',
        text: 'Cliquez sur l’icône d’installation dans la barre d’adresse, ou menu ⋮ → Applications → Installer ce site.',
      },
      {
        title: 'Épinglez-la',
        text: 'Clic droit sur l’icône → Épingler à la barre des tâches, comme n’importe quelle app.',
      },
    ],
    requirement: 'Windows 10 ou 11 · Chrome, Edge ou Brave · aucune dépendance',
    note: 'Les imports Apple Health, Samsung Health, GPX et TCX sont lus dans le navigateur : aucun fichier n’est téléversé.',
  },
  {
    id: 'linux',
    name: 'Linux',
    short: 'Linux',
    family: 'desktop',
    detail: 'Chrome, Chromium ou Brave',
    tagline: 'Une entrée dans votre lanceur.',
    intro:
      'Le navigateur crée une entrée de bureau standard : Battement apparaît dans GNOME, KDE ou XFCE, sans paquet système ni droits root.',
    steps: [
      {
        title: 'Ouvrez Battement',
        text: 'Dans Chrome, Chromium ou Brave. Firefox sur Linux ne propose pas encore l’installation PWA.',
      },
      {
        title: 'Installez depuis la barre d’adresse',
        text: 'Cliquez sur l’icône d’installation (écran avec une flèche), ou menu ⋮ → Installer Battement.',
      },
      {
        title: 'Retrouvez-la dans le lanceur',
        text: 'Une entrée .desktop est créée automatiquement ; épinglez-la à votre dock si vous le souhaitez.',
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
      'Battement s’installe en quelques gestes, s’ouvre en plein écran et garde votre suivi sur l’appareil — pratique pour noter une séance à la sortie de la salle.',
    steps: [
      {
        title: 'Ouvrez Battement',
        text: 'Dans Chrome ou Samsung Internet, sur votre téléphone ou tablette.',
      },
      {
        title: 'Ajoutez à l’écran d’accueil',
        text: 'Menu ⋮ → « Installer l’application » (ou « Ajouter à l’écran d’accueil » selon la version).',
      },
      {
        title: 'Lancez l’icône',
        text: 'L’app s’ouvre en plein écran, sans barre d’adresse, et reprend le dernier écran consulté.',
      },
    ],
    requirement: 'Android 9 ou plus récent · Chrome 90+ ou Samsung Internet',
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
      'Sur iPhone et iPad, l’ajout à l’écran d’accueil passe par Safari. Battement s’ouvre alors comme une app, sans interface de navigateur.',
    steps: [
      {
        title: 'Ouvrez Battement dans Safari',
        text: 'Sur iPhone ou iPad. Chrome et Firefox sur iOS ne peuvent pas installer de web app.',
      },
      {
        title: 'Touchez Partager',
        text: 'Le bouton carré avec une flèche, en bas de l’écran (en haut sur iPad).',
      },
      {
        title: 'Choisissez « Sur l’écran d’accueil »',
        text: 'Puis « Ajouter ». L’icône Battement rejoint votre écran d’accueil et s’ouvre en plein écran.',
      },
    ],
    requirement: 'iOS ou iPadOS 15+ · Safari',
    note: 'Sur iOS, l’installation passe toujours par le menu Partager de Safari : c’est une règle d’Apple.',
  },
];

/* --------------------------------------------------------------------- apps */

export const downloadApps: DownloadApp[] = [
  {
    id: 'tubecraft',
    name: 'Séquence',
    emphasis: 'partout',
    summary: 'Web app · 5 plateformes',
    icon: tubecraftIcon,
    accent: '#ff2d46',
    mode: 'web',
    self: true,
    lede:
      'Une seule app, cinq plateformes. Pas d’installeur à décompresser : le navigateur crée une icône, une fenêtre et un raccourci — puis Séquence se met à jour toute seule.',
    badges: ['Sans magasin', 'Sans compte', 'Mise à jour automatique', 'Données locales'],
    platforms: tubecraftPlatforms,
    facts: [
      {
        value: '0',
        label: 'magasin',
        glyph: 'store',
        text: 'Aucun App Store, Play Store ou compte à créer.',
      },
      {
        value: '5',
        label: 'plateformes',
        glyph: 'devices',
        text: 'macOS, Windows, Linux, Android et iPhone.',
      },
      {
        value: '↻',
        label: 'à jour',
        glyph: 'refresh',
        text: 'La dernière version se charge à chaque ouverture.',
      },
      {
        value: '∞',
        label: 'gratuit',
        glyph: 'infinity',
        text: 'Open source, sans abonnement ni essai qui expire.',
      },
    ],
    note:
      'La web app reste la voie d’installation officielle. Un shell desktop Tauri 2 (fenêtre native, icône liquid glass, DMG/APP à compiler soi-même) est inclus dans le dépôt ; les paquets signés — DMG, MSI, AppImage et APK — seront annoncés sur GitHub après la première version stable.',
    sourceHref: 'https://github.com/DmzGamingYT/tubecraft',
  },
  {
    id: 'spotifycraft',
    name: 'Portée',
    emphasis: 'sur le bureau et en poche',
    summary: 'Native · 5 systèmes',
    icon: spotifycraftIcon,
    accent: '#0f9d4f',
    mode: 'native',
    // aucune release sur le dépôt : rien n’est encore téléchargeable
    releaseState: 'pending',
    formats: ['DMG', 'MSI', 'AppImage', 'APK', 'TestFlight'],
    lede:
      'Prévue comme une vraie application : un binaire signé, une fenêtre native, et votre musique qui reste sur la machine. macOS, Windows, Linux, Android — et sur iPhone par TestFlight — sans magasin ni compte : les installeurs ne sont pas encore publiés.',
    badges: ['Hors magasin', 'Données locales', 'Open source', 'Installeurs à venir'],
    platforms: spotifycraftPlatforms,
    facts: [
      {
        value: '5',
        label: 'systèmes',
        glyph: 'devices',
        text: 'Un binaire pour macOS, Windows, Linux et Android ; TestFlight sur iPhone.',
      },
      {
        value: '↧',
        label: 'natif',
        glyph: 'download',
        text: 'DMG, MSI, AppImage et APK prévus : l’app démarre sans navigateur.',
      },
      {
        value: '✓',
        label: 'signé',
        glyph: 'shield',
        text: 'Signature de code et notarisation prévues à chaque publication.',
      },
      {
        value: '∞',
        label: 'gratuit',
        glyph: 'infinity',
        text: 'Code MIT sur GitHub, sans compte ni abonnement.',
      },
    ],
    note:
      'Les installeurs ne sont pas encore publiés : le dépôt et le suivi des versions sont ouverts, et cette page sera mise à jour au premier binaire signé. Sur iPhone, la version native arrivera par TestFlight : iOS n’installe aucune app hors magasin.',
    // la liste des versions existe déjà ; /latest renverrait sur une page vide
    releasesHref: 'https://github.com/DmzGamingYT/spotifycraft/releases',
    sourceHref: 'https://github.com/DmzGamingYT/spotifycraft',
  },
  {
    id: 'pulsecraft',
    name: 'Battement',
    emphasis: 'sur cinq plateformes',
    summary: 'Web app · 5 plateformes',
    icon: pulsecraftIcon,
    accent: '#5f8b00',
    mode: 'web',
    launchHref: remoteAppUrl(import.meta.env.VITE_PULSECRAFT_URL, 5186, pulsecraftWebUrl),
    lede:
      'Même installation que Séquence, pour un usage tout autre : anneaux, séances, sommeil et nutrition, avec un coach qui ne lit que des données agrégées. Cinq plateformes, aucune donnée envoyée.',
    badges: ['Sans magasin', 'Sans compte', 'Données locales', 'Imports Apple Health'],
    platforms: pulsecraftPlatforms,
    facts: [
      {
        value: '0',
        label: 'compte',
        glyph: 'store',
        text: 'Aucun compte à créer, ni pour suivre, ni pour importer.',
      },
      {
        value: '5',
        label: 'plateformes',
        glyph: 'devices',
        text: 'macOS, Windows, Linux, Android et iPhone.',
      },
      {
        value: '100 %',
        label: 'local',
        glyph: 'refresh',
        text: 'Séances, sommeil et nutrition restent dans le navigateur.',
      },
      {
        value: '∞',
        label: 'gratuit',
        glyph: 'infinity',
        text: 'Open source, sans abonnement ni télémétrie.',
      },
    ],
    note:
      'Battement est servi comme web app : l’installation crée une icône et une fenêtre, sans magasin ni compte. Le noyau de calcul (Rust/WASM) et les imports de fichiers restent sur l’appareil.',
    sourceHref: 'https://github.com/DmzGamingYT/pulsecraft',
  },
];

export function findDownloadApp(id: DownloadAppId): DownloadApp {
  return downloadApps.find((app) => app.id === id) ?? downloadApps[0];
}
