import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { OpenSourceApp } from '../data/apps';
import { DemoFrame, HealthDemo, MusicDemo, NotesDemo, VideoDemo } from './showcase/AppDemo';
import { AppGallery } from './showcase/AppGallery';
import { GuidedTour, type TourStep } from './showcase/GuidedTour';
import { hasSeenTour, rememberTour } from './showcase/tourMemory';
import { DownloadShowcase } from './download/DownloadShowcase';
import { CraftlineMark } from './CraftlineMark';

/**
 * Contenu de la vitrine, partagé par deux entrées :
 * - l'app (`/apps`, via `src/pages/Showcase.tsx`) ;
 * - le site autonome (`showcase/`, build séparé dans `dist-showcase/`).
 *
 * Aucun import du routeur ici : la navigation est injectée via `Link`, et les
 * liens externes sont de simples `<a>`.
 *
 * Direction artistique : page éditoriale claire, typographie XXL, filets fins,
 * micro-labels monospace et animations au défilement. Les seules images sont
 * les vraies vignettes et pochettes des apps, dans les démos et leur galerie.
 */

export interface ShowcasePreviewItem {
  id: string;
  title: string;
  channelName: string;
  views: string;
  duration: number | null;
}

export interface ShowcaseLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
}

export interface ShowcaseSiteProps {
  apps: OpenSourceApp[];
  preview: ShowcasePreviewItem[];
  /** URL de l'app Séquence. `null` hors SPA tant que l'app n'est pas déployée. */
  appHref: string | null;
  /** profil GitHub de l'auteur */
  githubHref: string;
  /** rendu des liens internes (routeur dans l'app, ancre simple ailleurs) */
  Link: (props: ShowcaseLinkProps) => JSX.Element;
  /** formate une durée en mm:ss */
  formatDuration: (seconds: number) => string;
}

const THEME_KEY = 'atelier.theme';

/** Sommaire unique : la barre desktop et le menu mobile restent synchronisés. */
const SECTIONS = [
  { id: 'collection', num: '01', label: 'Collection' },
  { id: 'preuve', num: '02', label: 'La preuve' },
  { id: 'fabrique', num: '03', label: 'La fabrique' },
  { id: 'telecharger', num: '04', label: 'Télécharger' },
  { id: 'atelier', num: '05', label: 'L’atelier' },
] as const;
const SECTION_IDS = SECTIONS.map((section) => section.id);

/**
 * Fiche d’identité de chaque app : les mêmes cinq lignes pour toutes, mais des
 * réponses différentes. C’est ce qui rend la section vérifiable plutôt que
 * déclarative — le réseau et le stockage ne sont pas les mêmes partout.
 */
const APP_PROOF: Record<string, { data: string; network: string; account: string }> = {
  tubecraft: {
    data: 'Navigateur · IndexedDB + localStorage',
    network: 'InnerTube, via un proxy same-origin',
    account: 'Aucun',
  },
  spotifycraft: {
    data: 'Navigateur + fichiers audio importés',
    network: 'Catalogue iTunes · Spotify si vous connectez un compte',
    account: 'Facultatif (OAuth PKCE)',
  },
  pulsecraft: {
    data: 'Navigateur + exports Santé importés',
    network: 'Aucun service Craftline · coach IA sur accord',
    account: 'Aucun',
  },
};

/** Les quatre étapes communes à toutes les apps de la collection. */
const WORKSHOP_STEPS = [
  {
    num: '01',
    title: 'Écrire',
    text: 'React 18, TypeScript et Vite pour les apps. Un même socle de conventions, un dépôt autonome par app.',
    chip: 'Socle commun',
  },
  {
    num: '02',
    title: 'Calculer',
    text: 'Ce qui coûte cher passe en Rust et devient du WebAssembly : import audio d’un côté, calculs de santé de l’autre.',
    chip: '2 noyaux WASM',
  },
  {
    num: '03',
    title: 'Distribuer',
    text: 'La même base devient site web, PWA installable et coque Tauri 2 — sans fork ni réécriture.',
    chip: 'Web · PWA · Tauri',
  },
  {
    num: '04',
    title: 'Vérifier',
    text: 'Typecheck, tests Vitest et CI à chaque commit. Une app ne rejoint la collection qu’une fois utilisable.',
    chip: 'À chaque commit',
  },
] as const;

/** Ce que chaque app apporte au socle commun. */
const WORKSHOP_ROLES: Record<string, { role: string; text: string }> = {
  tubecraft: {
    role: 'Le réseau',
    text: 'Un proxy same-origin vers InnerTube, avec cache mémoire, timeout et limite par IP. Aucun secret dans le navigateur.',
  },
  spotifycraft: {
    role: 'Le son',
    text: 'Un noyau Rust/WASM pour l’import audio, le catalogue iTunes et Spotify en OAuth PKCE quand vous le souhaitez.',
  },
  pulsecraft: {
    role: 'Le calcul',
    text: 'pulse-core en Rust/WASM, imports Apple Health et Samsung Health, et une coque Tauri 2 pour le natif.',
  },
};

/** Trois gestes concrets pour participer, sans formulaire ni compte. */
const OPEN_DOORS = [
  {
    num: '01',
    title: 'Signaler',
    text: 'Un bug, une régression, une installation qui échoue. Une issue avec la version, le navigateur et les étapes de reproduction vaut mieux qu’un paragraphe.',
  },
  {
    num: '02',
    title: 'Proposer',
    text: 'Une fonction qui manque, une piste d’accessibilité, une traduction. Les idées sont priorisées à la main, jamais vendues.',
  },
  {
    num: '03',
    title: 'Forker',
    text: 'Tout est sous MIT. Reprenez une app, changez la direction artistique, publiez votre version : le code est fait pour ça.',
  },
] as const;

/** Soleil / lune du bouton de thème, dessiné au trait pour rester net. */
function ThemeGlyph({ night }: { night: boolean }) {
  return night ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M20 14.6A8.6 8.6 0 0 1 9.4 4a8.6 8.6 0 1 0 10.6 10.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Les animations d'apparition ne s'appliquent qu'aux éléments encore sous le pli. */
function useReveal(root: React.RefObject<HTMLDivElement>) {
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const targets = Array.from(host.querySelectorAll<HTMLElement>('[data-reveal]'));
    /**
     * L'état est porté par un attribut `data-in` et non par une classe :
     * React réécrit `className` à chaque rendu (thème, survol d'une idée…),
     * ce qui effacerait une classe ajoutée à la main et ferait disparaître
     * les blocs déjà révélés.
     */
    const reveal = (el: HTMLElement) => {
      el.dataset.in = 'true';
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      targets.forEach(reveal);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach(reveal);
      return;
    }

    /**
     * Un observateur remplace la mesure au défilement.
     *
     * Le navigateur signale l'entrée dans le cadre sans recalculer la mise en
     * page : sur une page de neuf mille pixels, la version précédente
     * demandait la position de cinquante blocs à chaque image.
     *
     * La marge basse de 8 % reproduit l'ancien déclenchement (révélation
     * quand le bloc atteint 92 % de la hauteur de fenêtre), et un bloc déjà
     * dépassé — ancre, rechargement au milieu de la page — est révélé d'office,
     * sinon il resterait invisible en remontant.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (!entry.isIntersecting && entry.boundingClientRect.top > 0) continue;
          reveal(el);
          observer.unobserve(el);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [root]);
}

/** Barre de progression + ombre de navigation, pilotées par le défilement. */
function useScrollChrome(root: React.RefObject<HTMLDivElement>) {
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      host.style.setProperty('--sc-progress', progress.toFixed(4));
      host.classList.toggle('sc--stuck', window.scrollY > 16);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [root]);
}

/** Parallaxe très légère du hero : les cercles suivent à peine le pointeur. */
function useHeroParallax(root: React.RefObject<HTMLDivElement>) {
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none)').matches) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const x = (event.clientX / window.innerWidth - 0.5) * 2;
        const y = (event.clientY / window.innerHeight - 0.5) * 2;
        host.style.setProperty('--sc-mx', x.toFixed(3));
        host.style.setProperty('--sc-my', y.toFixed(3));
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [root]);
}

/** Sommaire : surligne la section actuellement au centre de l’écran. */
function useScrollSpy(root: React.RefObject<HTMLDivElement>, ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '');

  useEffect(() => {
    const host = root.current;
    if (!host) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = ids[0] ?? '';
      for (const id of ids) {
        const section = host.querySelector<HTMLElement>(`#${id}`);
        if (section && section.getBoundingClientRect().top <= window.innerHeight * 0.34) {
          current = id;
        }
      }
      setActive((value) => (value === current ? value : current));
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ids, root]);

  return active;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="hero"]',
    title: 'Des outils qu’on possède vraiment.',
    text: 'Bienvenue dans Craftline. La visite dure une minute : elle va vous montrer la collection, les démos, la fabrique et l’installation — sans rien télécharger.',
    duration: 5600,
  },
  {
    target: '[data-tour="tubecraft-demo"]',
    title: 'Chercher dans Séquence.',
    text: 'La démo passe en scène de recherche : requête tapée, filtres, résultats YouTube et assistance IA. Tout est une vraie maquette animée, pas une capture.',
    demo: { app: 'tubecraft', scene: 'search', hold: true },
    duration: 5200,
  },
  {
    target: '[data-tour="tubecraft-demo"]',
    title: 'Lire, sans quitter la page.',
    text: 'Deuxième scène : le lecteur officiel, les chapitres, le résumé IA, les likes réels et les suggestions. Le mini-lecteur arrive juste après.',
    demo: { app: 'tubecraft', scene: 'playback', hold: true },
    duration: 5200,
  },
  {
    target: '[data-tour="tubecraft-demo"]',
    title: 'Continuer à regarder.',
    text: 'Troisième scène : vous naviguez ailleurs, la vidéo reste dans le mini-lecteur persistant. La lecture survit aux changements de page.',
    demo: { app: 'tubecraft', scene: 'mini', hold: true },
    duration: 5600,
  },
  {
    target: '[data-tour="spotifycraft-demo"]',
    title: 'Portée, la musique en local.',
    text: 'Même philosophie : extraits officiels, pochettes réelles, Daily Mix calculés sur l’appareil et import de vos propres fichiers.',
    demo: { app: 'spotifycraft', scene: 'home', hold: true },
    duration: 5000,
  },
  {
    target: '[data-tour="pulsecraft-demo"]',
    title: 'Battement, la santé qui reste chez vous.',
    text: 'Anneaux d’objectifs, journal d’entraînement, sommeil, nutrition et coach IA. Les calculs tournent en Rust/WASM, et les imports Apple Health ou Samsung Health restent dans le navigateur.',
    demo: { app: 'pulsecraft', scene: 'today', hold: true },
    duration: 5400,
  },
  {
    target: '[data-tour="fabrique"]',
    title: 'Un seul atelier.',
    text: 'React, TypeScript et Vite pour le socle ; Rust/WASM quand le calcul compte ; web, PWA et Tauri 2 pour la distribution. Les apps sortent de la même chaîne.',
    duration: 5200,
  },
  {
    target: '[data-tour="telecharger"]',
    title: 'Une app, cinq plateformes.',
    text: 'L’installation passe par le navigateur : macOS, Windows, Linux, Android et iPhone. Pas de magasin, pas de compte, mise à jour automatique.',
    duration: 5400,
  },
  {
    target: '[data-tour="atelier"]',
    title: 'La porte est ouverte.',
    text: 'Signaler, proposer, forker : trois gestes concrets, et un dépôt public par app. Rien n’est priorisé en secret.',
    duration: 5400,
  },
];

function readNight(): boolean {
  try {
    return window.localStorage.getItem(THEME_KEY) === 'night';
  } catch {
    return false;
  }
}

export function ShowcaseSite({
  apps,
  preview,
  appHref,
  githubHref,
  Link,
  formatDuration,
}: ShowcaseSiteProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [night, setNight] = useState(readNight);
  const [copied, setCopied] = useState(false);
  const [galleryApp, setGalleryApp] = useState<OpenSourceApp | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  /** la visite a déjà été lancée : on ne la remet plus en avant */
  const [tourSeen, setTourSeen] = useState(hasSeenTour);
  /**
   * Le bouton reste affiché pendant la visite elle-même : il disparaît
   * seulement à la fermeture, pour que l'arrière-plan ne bouge pas sous le
   * projecteur de la première étape.
   */
  const tourOffered = !tourSeen || tourOpen;
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const tourReturnRef = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const activeSection = useScrollSpy(rootRef, SECTION_IDS);

  useReveal(rootRef);
  useScrollChrome(rootRef);
  useHeroParallax(rootRef);

  const startTour = useCallback(() => {
    // `body` n'est pas une cible de retour : sans ce filtre, un lancement
    // programmatique renverrait le focus sur la page entière.
    const focused = document.activeElement;
    const active =
      focused instanceof HTMLElement &&
      focused !== document.body &&
      focused !== document.documentElement
        ? focused
        : null;
    // Depuis le menu mobile, l'élément déclencheur disparaît avec le menu :
    // le focus revient au bouton d'ouverture, qui reste dans la barre.
    const fromMenu = !!active && !!mobileMenuRef.current?.contains(active);
    tourReturnRef.current = fromMenu ? menuButtonRef.current : active;
    setMenuOpen(false);
    rememberTour();
    setTourSeen(true);
    setTourOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setTourOpen(false);
  }, []);

  // Après la fermeture, le focus revient à l'entrée de visite encore présente :
  // à la première visite, le bouton vient d'être remplacé par le lien discret.
  // L'effet de mise en page court après le rendu, sans dépendre d'une frame
  // d'animation (qui n'arrive pas dans un onglet en arrière-plan).
  const tourWasOpen = useRef(false);
  useLayoutEffect(() => {
    if (tourOpen) {
      tourWasOpen.current = true;
      return;
    }
    if (!tourWasOpen.current) return;
    tourWasOpen.current = false;
    const back = tourReturnRef.current?.isConnected
      ? tourReturnRef.current
      : rootRef.current?.querySelector<HTMLElement>('[data-tour-start]');
    back?.focus({ preventScroll: true });
  }, [tourOpen]);

  const openGallery = (app: OpenSourceApp) => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setGalleryApp(app);
  };

  const closeGallery = () => {
    setGalleryApp(null);
    returnFocusRef.current?.focus();
  };

  // Menu mobile : plein écran sous la barre, verrouillé au clavier.
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      mobileMenuRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = mobileMenuRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const onResize = () => {
      if (window.innerWidth > 1080) setMenuOpen(false);
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [menuOpen]);

  // galerie plein écran : pas de défilement derrière, Échap pour fermer
  useEffect(() => {
    if (!galleryApp) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setGalleryApp(null);
      returnFocusRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [galleryApp]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, night ? 'night' : 'paper');
    } catch {
      /* stockage indisponible : le thème reste valable pour la session */
    }
  }, [night]);

  // Lien profond (`/#telecharger`) : le navigateur résout le hash avant que
  // React n’ait monté les sections. On rejoue le saut après le premier rendu.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        document.getElementById(decodeURIComponent(hash))?.scrollIntoView({ block: 'start' });
      });
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, []);

  const featured = apps.find((app) => app.featured) ?? apps[0];
  const tickerItems = [
    ...apps.map((app) => app.name),
    '100 % open source',
    '0 tracker',
    'Données locales',
    ...preview.map((video) =>
      video.duration ? `${video.title} — ${formatDuration(video.duration)}` : video.title
    ),
    'Zéro clé API',
    'Sans abonnement',
    'InnerTube',
  ];

  return (
    <div
      className={`sc${night ? ' sc--night' : ''}`}
      id="top"
      ref={rootRef}
      style={{ '--sc-progress': 0, '--sc-mx': 0, '--sc-my': 0 } as CSSProperties}
    >
      <a className="sc-skip" href="#contenu">
        Aller au contenu
      </a>
      <span className="sc-progress" aria-hidden />

      <header className="sc-nav">
        <a href="#top" className="sc-brand" aria-label="Craftline — haut de page">
          <span className="sc-brand__mark" aria-hidden>
            <CraftlineMark />
          </span>
          <span className="sc-brand__text">
            Craftline<span className="sc-brand__dot">.</span>
          </span>
        </a>

        <nav className="sc-nav__links" aria-label="Sommaire">
          {SECTIONS.map(({ id, num, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className={activeSection === id ? 'is-active' : undefined}
              aria-current={activeSection === id ? 'location' : undefined}
            >
              <i>{num}</i>
              <span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="sc-nav__actions">
          <button
            type="button"
            className="sc-theme"
            onClick={() => setNight((value) => !value)}
            aria-pressed={night}
            aria-label={night ? 'Passer au thème papier' : 'Passer au thème nuit'}
            title={night ? 'Revenir au thème papier' : 'Passer au thème nuit'}
          >
            <ThemeGlyph night={night} />
          </button>

          <button
            ref={menuButtonRef}
            type="button"
            className="sc-nav__menu"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-controls="sc-mobile-menu"
            aria-label={menuOpen ? 'Fermer le sommaire' : 'Ouvrir le sommaire'}
          >
            <span aria-hidden />
            <span aria-hidden />
          </button>

          {appHref ? (
            <Link
              className="sc-btn sc-btn--ink sc-btn--small sc-nav__cta"
              href={appHref}
              aria-label="Ouvrir Séquence"
            >
              <span className="sc-nav__ctaLong">Ouvrir Séquence</span>
              <span className="sc-nav__ctaShort">Ouvrir</span>
              <span aria-hidden>↗</span>
            </Link>
          ) : (
            <a
              className="sc-btn sc-btn--ink sc-btn--small sc-nav__cta"
              href={githubHref}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Ouvrir le dépôt GitHub"
            >
              GitHub <span aria-hidden>↗</span>
            </a>
          )}
        </div>
      </header>

      {menuOpen ? (
        <nav
          ref={mobileMenuRef}
          className="sc-mobilemenu"
          id="sc-mobile-menu"
          aria-label="Sommaire"
        >
          <div className="sc-mobilemenu__head">
            <span>Sommaire</span>
            <span>{String(SECTIONS.length).padStart(2, '0')} sections</span>
          </div>

          <div className="sc-mobilemenu__list">
            {SECTIONS.map(({ id, num, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className={activeSection === id ? 'is-active' : undefined}
                aria-current={activeSection === id ? 'location' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <i>{num}</i>
                <span>{label}</span>
                <b aria-hidden>↘</b>
              </a>
            ))}
          </div>

          <div className="sc-mobilemenu__actions">
            <button
              type="button"
              className="sc-mobilemenu__theme"
              onClick={() => setNight((value) => !value)}
              aria-pressed={night}
            >
              <ThemeGlyph night={night} />
              Thème {night ? 'nuit' : 'papier'}
            </button>
            <button
              type="button"
              data-tour-start
              className={`sc-mobilemenu__tour${tourOffered ? '' : ' sc-mobilemenu__tour--quiet'}`}
              onClick={() => {
                setMenuOpen(false);
                startTour();
              }}
            >
              {tourOffered ? (
                <span className="sc-mobilemenu__play" aria-hidden>
                  ▶
                </span>
              ) : (
                <span className="sc-mobilemenu__refresh" aria-hidden>
                  ↻
                </span>
              )}
              {tourOffered ? 'Visite guidée' : 'Revoir la visite'}
            </button>
          </div>

          {appHref ? (
            <Link className="sc-btn sc-btn--ink sc-mobilemenu__cta" href={appHref}>
              Ouvrir Séquence <span aria-hidden>↗</span>
            </Link>
          ) : (
            <a
              className="sc-btn sc-btn--ink sc-mobilemenu__cta"
              href={githubHref}
              target="_blank"
              rel="noreferrer noopener"
            >
              Voir le dépôt GitHub <span aria-hidden>↗</span>
            </a>
          )}
        </nav>
      ) : null}

      <main id="contenu" tabIndex={-1}>
        <section className="sc-hero" data-tour="hero">
          <div className="sc-rings" aria-hidden>
            <span className="sc-rings__circle sc-rings__circle--1" />
            <span className="sc-rings__circle sc-rings__circle--2" />
            <span className="sc-rings__circle sc-rings__circle--3" />
            <span className="sc-rings__circle sc-rings__circle--4" />
            <span className="sc-rings__orbit sc-rings__orbit--1">
              <i />
            </span>
            <span className="sc-rings__orbit sc-rings__orbit--2">
              <i />
            </span>
            <span className="sc-rings__sweep" />
            <span className="sc-rings__axis sc-rings__axis--x" />
            <span className="sc-rings__axis sc-rings__axis--y" />
          </div>

          {/* Le hero est centré : le titre occupe l'axe, le catalogue des apps
              vient dessous. On sait en un coup d'œil qu'il y a trois produits. */}
          <div className="sc-hero__grid">
            <div className="sc-hero__lead">
              <p className="sc-kicker sc-kicker--hero">
                <span className="sc-kicker__dot" aria-hidden />
                Collection open source — 2026
              </p>

              <h1 className="sc-hero__title">
                <span className="sc-hero__line">
                  <span>Des outils</span>
                </span>
                <span className="sc-hero__line">
                  <span>
                    qu’on{' '}
                    <span className="sc-hero__em">
                      <em>possède</em>
                      <svg
                        className="sc-hero__scribble"
                        viewBox="0 0 260 18"
                        preserveAspectRatio="none"
                        aria-hidden
                      >
                        <path
                          d="M3 13 C 52 4, 108 16, 158 8 S 226 4, 257 11"
                          pathLength="1"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </span>
                  </span>
                </span>
                <span className="sc-hero__line">
                  <span>vraiment.</span>
                </span>
              </h1>

              <p className="sc-hero__lede">
                Une famille d’applications open source qui reprennent les outils du quotidien —                  sans compte obligatoire, sans abonnement, sans télémétrie. Quatre apps, un même
                socle et un même principe : le logiciel est public, et les données restent chez vous.
              </p>

              <div className="sc-hero__cta">
                <Link className="sc-btn sc-btn--ink" href="#collection">
                  Explorer la collection <span aria-hidden>↓</span>
                </Link>
                {appHref ? (
                  <Link className="sc-btn sc-btn--line" href={appHref}>
                    Lancer Séquence <span aria-hidden>↗</span>
                  </Link>
                ) : (
                  <a
                    className="sc-btn sc-btn--line"
                    href={githubHref}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Voir sur GitHub <span aria-hidden>↗</span>
                  </a>
                )}
              </div>

              <button type="button" data-tour-start className="sc-tourlink" onClick={startTour}>
                <span aria-hidden>{tourOffered ? '▶' : '↻'}</span>{' '}
                {tourOffered ? 'Visite guidée' : 'Revoir la visite guidée'}
              </button>

              <p className="sc-hero__meta">
                Open source sur GitHub · Web · Sans compte · Aucun abonnement
              </p>
            </div>

          </div>

          {/* Vignettes flottantes : les vraies miniatures du catalogue,
              disposées autour du texte et animées doucement. */}
          <div className="sc-floats" aria-hidden>
            {preview.slice(0, 4).map((video, index) => (
              <span className={`sc-shot sc-shot--${index + 1}`} key={video.id}>
                <span className="sc-shot__frame">
                  <img
                    src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  {video.duration ? <i>{formatDuration(video.duration)}</i> : null}
                </span>
              </span>
            ))}
          </div>
        </section>

        <div className="sc-ticker" aria-hidden>
          <div className="sc-ticker__track">
            {[0, 1].map((copy) => (
              <div className="sc-ticker__group" key={copy}>
                {tickerItems.map((item, index) => (
                  <span className="sc-ticker__item" key={`${copy}-${index}`}>
                    {item}
                    <i>✳</i>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section className="sc-section" id="collection">
          <header className="sc-label" data-reveal>
            <span className="sc-label__num">01</span>
            <span className="sc-label__text">La collection</span>
            <span className="sc-label__meta">
              {apps.length} application{apps.length > 1 ? 's' : ''} · {apps[0]?.license ?? 'MIT'}
            </span>
          </header>

          <div className="sc-intro" data-reveal>
            <h2 className="sc-h2">
              Des outils qui font <em>une chose</em>, et qui la font bien.
            </h2>
            <p className="sc-lede">
              Chaque app répond à un besoin précis, puis s’arrête là. Une seule règle commune : le
              code est public et vos données ne quittent pas votre machine.
            </p>
          </div>

          {/* La collection : une fiche pleine largeur par app, qui alterne le
              texte et la démonstration. Le catalogue se lit comme une brochure. */}
          <div className="sc-apps">
            {apps.map((app, index) => {
              const isInternal = app.self === true;
              const href = app.self ? appHref : (app.url ?? null);
              return (
                <article
                  key={app.id}
                  id={`app-${app.id}`}
                  className={`sc-app sc-app--visual${index % 2 === 1 ? ' sc-app--flip' : ''}`}
                  data-reveal
                  style={
                    {
                      '--app-accent': app.accent,
                      '--d': `${index * 90}ms`,
                    } as CSSProperties
                  }
                >
                  <span className="sc-app__index" aria-hidden>
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <div className="sc-app__body">
                    <h3 className="sc-app__name">
                      <img
                        className="sc-app__mark"
                        src={app.icon}
                        alt=""
                        width={54}
                        height={54}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="sc-app__nameText">{app.name}</span>
                    </h3>
                    <p className="sc-app__tagline">{app.tagline}</p>
                    <p className="sc-app__desc">{app.description}</p>
                    <ul className="sc-app__points" aria-label="Points forts">
                      {app.highlights.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                    <ul className="sc-app__stack" aria-label="Technologies">
                      {app.stack.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>

                    <div className="sc-app__meta">
                      <span className="sc-app__license">{app.license}</span>
                      {href && isInternal ? (
                        <Link className="sc-app__open" href={href}>
                          Ouvrir l’app <span aria-hidden>↗</span>
                        </Link>
                      ) : href ? (
                        <a
                          className="sc-app__open"
                          href={href}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Lancer {app.name} <span aria-hidden>↗</span>
                        </a>
                      ) : null}
                      {app.source ? (
                        <a
                          className="sc-app__source"
                          href={app.source}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Code source <span aria-hidden>↗</span>
                        </a>
                      ) : (
                        <span className="sc-app__soon">Dépôt bientôt public</span>
                      )}
                    </div>
                  </div>

                  <div
                    className="sc-app__visual"
                    data-tour={
                      app.id === 'tubecraft'
                        ? 'tubecraft-demo'
                        : app.id === 'spotifycraft'
                          ? 'spotifycraft-demo'
                          : app.id === 'pulsecraft'
                            ? 'pulsecraft-demo'
                            : undefined
                    }
                  >
                    {app.id === 'tubecraft' ? (
                      <DemoFrame
                        url="sequence.app / accueil"
                        label="Séquence"
                        tone="dark"
                        onOpen={() => openGallery(app)}
                      >
                        <VideoDemo />
                      </DemoFrame>
                    ) : app.id === 'feuilletcraft' ? (
                      <DemoFrame
                        url="feuillet.app / bienvenue"
                        label="Feuillet"
                        tone="light"
                        onOpen={() => openGallery(app)}
                      >
                        <NotesDemo />
                      </DemoFrame>
                    ) : app.id === 'pulsecraft' ? (
                      <DemoFrame
                        url="battement.app / aujourd’hui"
                        label="Battement"
                        tone="dark"
                        onOpen={() => openGallery(app)}
                      >
                        <HealthDemo />
                      </DemoFrame>
                    ) : (
                      <DemoFrame
                        url="portee.app / bonjour"
                        label="Portée"
                        tone="light"
                        onOpen={() => openGallery(app)}
                      >
                        <MusicDemo />
                      </DemoFrame>
                    )}
                  </div>
                </article>
              );
            })}

            <article className="sc-app sc-app--next sc-app--visual sc-app--flip" id="app-suite" data-reveal>
              <span className="sc-app__index" aria-hidden>
                +
              </span>
              <div className="sc-app__body">
                <h3 className="sc-app__name">
                  <span className="sc-app__mark sc-app__mark--ghost" aria-hidden>
                    +
                  </span>
                  <span className="sc-app__nameText">La suite</span>
                </h3>
                <p className="sc-app__desc">
                  Une nouvelle app arrive quand elle est réellement utilisable — jamais pour
                  remplir une grille. Les dépôts sont publics dès le premier commit.
                </p>
                <ul className="sc-app__stack" aria-label="Ce qui vient">
                  <li>En préparation</li>
                  <li>Un dépôt par app</li>
                  <li>Sans compte</li>
                </ul>
                <div className="sc-app__meta">
                  <a
                    className="sc-app__source"
                    href={githubHref}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Suivre sur GitHub <span aria-hidden>↗</span>
                  </a>
                </div>
              </div>
              <div className="sc-app__visual sc-app__visual--next">
                <div className="sc-nextscreen" aria-hidden>
                  <span>+</span>
                  <strong>Prochaine app</strong>
                  <em>quand elle sera prête</em>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="sc-section sc-section--band sc-section--proof" id="preuve">
          <header className="sc-label" data-reveal>
            <span className="sc-label__num">02</span>
            <span className="sc-label__text">La preuve</span>
            <span className="sc-label__meta">Trois fiches · mêmes lignes</span>
          </header>

          <div className="sc-intro" data-reveal>
            <h2 className="sc-h2">
              Pas des promesses. Des <em>fiches</em>.
            </h2>
            <p className="sc-lede">
              Chaque app publie la même fiche d’identité : d’où vient le code, où vivent les
              données, à qui elle parle. Rien à croire sur parole — tout est dans le dépôt.
            </p>
          </div>

          <div className="sc-proof-grid">
            {apps.map((app, index) => {
              const proof = APP_PROOF[app.id];
              if (!proof) return null;
              return (
                <article
                  className="sc-proof-card"
                  key={app.id}
                  data-reveal
                  style={
                    {
                      '--app-accent': app.accent,
                      '--d': `${index * 80}ms`,
                    } as CSSProperties
                  }
                >
                  <header className="sc-proof-card__head">
                    <img
                      className="sc-proof-card__mark"
                      src={app.icon}
                      alt=""
                      width={38}
                      height={38}
                      loading="lazy"
                      decoding="async"
                    />
                    <h3>{app.name}</h3>
                    <span className="sc-proof-card__license">{app.license}</span>
                  </header>

                  <dl>
                    <div>
                      <dt>Dépôt</dt>
                      <dd>
                        {app.source ? (
                          <a href={app.source} target="_blank" rel="noreferrer noopener">
                            Public <span aria-hidden>↗</span>
                          </a>
                        ) : (
                          'Bientôt public'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Licence</dt>
                      <dd>{app.license} · code modifiable et redistribuable</dd>
                    </div>
                    <div>
                      <dt>Données</dt>
                      <dd>{proof.data}</dd>
                    </div>
                    <div>
                      <dt>Réseau</dt>
                      <dd>{proof.network}</dd>
                    </div>
                    <div>
                      <dt>Compte</dt>
                      <dd>{proof.account}</dd>
                    </div>
                  </dl>

                  <footer className="sc-proof-card__foot">
                    <span>Aucune donnée revendue</span>
                    {app.source ? (
                      <a href={app.source} target="_blank" rel="noreferrer noopener">
                        Vérifier <span aria-hidden>↗</span>
                      </a>
                    ) : null}
                  </footer>
                </article>
              );
            })}
          </div>

          <div className="sc-proof__howHead" data-reveal>
            <span>Vérifier vous-même</span>
            <span>Trois gestes, moins d’une minute</span>
          </div>

          <ol className="sc-proof__how">
            <li data-reveal style={{ '--d': '0ms' } as CSSProperties}>
              <span className="sc-proof__howNum">01</span>
              <div>
                <strong>Lisez la licence.</strong>
                <p>
                  Chaque dépôt contient son fichier LICENSE. Trois lignes suffisent pour savoir ce
                  que vous pouvez lire, modifier et republier.
                </p>
              </div>
            </li>
            <li data-reveal style={{ '--d': '80ms' } as CSSProperties}>
              <span className="sc-proof__howNum">02</span>
              <div>
                <strong>Ouvrez l’onglet Réseau.</strong>
                <p>
                  Rechargez l’app : les requêtes sortantes vont vers YouTube, iTunes — ou nulle
                  part. Aucun domaine d’analyse, aucun cookie publicitaire.
                </p>
              </div>
            </li>
            <li data-reveal style={{ '--d': '160ms' } as CSSProperties}>
              <span className="sc-proof__howNum">03</span>
              <div>
                <strong>Videz le stockage.</strong>
                <p>
                  Effacez les données du site : historique, réglages et progression disparaissent.
                  C’est la preuve qu’ils n’existaient que chez vous.
                </p>
              </div>
            </li>
          </ol>

          <p className="sc-note" data-reveal>
            Relevé en octobre 2026. Si une fiche ne correspond plus au code, c’est un bug : ouvrez
            une issue. Le lecteur de Séquence reste celui de YouTube, dans une iframe officielle.
          </p>
        </section>

        <section className="sc-section sc-section--fabrique" id="fabrique">
          <header className="sc-label" data-reveal>
            <span className="sc-label__num">03</span>
            <span className="sc-label__text">La fabrique</span>
            <span className="sc-label__meta">Un socle · trois distributions</span>
          </header>

          <div className="sc-intro" data-reveal>
            <h2 className="sc-h2">
              Un seul atelier. <em>Trois</em> objets.
            </h2>
            <p className="sc-lede">
              La collection n’est pas trois bases de code qui se ressemblent : c’est un même socle
              React/TypeScript, des noyaux Rust là où le calcul compte, et trois façons de livrer
              la même app.
            </p>
          </div>

          <div className="sc-shop__flow" data-reveal data-tour="fabrique">
            {WORKSHOP_STEPS.map((step) => (
              <div className="sc-shop__step" key={step.num}>
                <span className="sc-shop__num">{step.num}</span>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
                <span className="sc-shop__chip">{step.chip}</span>
              </div>
            ))}
          </div>

          <div className="sc-shop__apps">
            {apps.map((app, index) => {
              const role = WORKSHOP_ROLES[app.id];
              if (!role) return null;
              return (
                <article
                  className="sc-shop__app"
                  key={app.id}
                  data-reveal
                  style={
                    {
                      '--app-accent': app.accent,
                      '--d': `${index * 80}ms`,
                    } as CSSProperties
                  }
                >
                  <span className="sc-shop__role">{role.role}</span>
                  <h3>
                    <img
                      className="sc-shop__mark"
                      src={app.icon}
                      alt=""
                      width={28}
                      height={28}
                      loading="lazy"
                      decoding="async"
                    />
                    {app.name}
                  </h3>
                  <p>{role.text}</p>
                  {app.source ? (
                    <a href={app.source} target="_blank" rel="noreferrer noopener">
                      Lire le dépôt <span aria-hidden>↗</span>
                    </a>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="sc-shop__facts" data-reveal>
            <span>
              <strong>{apps.length}</strong> dépôts publics
            </span>
            <span>
              <strong>2</strong> noyaux WASM
            </span>
            <span>
              <strong>0</strong> serveur à administrer
            </span>
            <span>
              <strong>5</strong> plateformes installables
            </span>
            <span>
              <strong>1</strong> base de code par app
            </span>
          </div>
        </section>

        <DownloadShowcase
          variant="section"
          sectionTitle={
            <>
              Installer. <em>Partout.</em>
            </>
          }
          sectionLede="Choisissez votre app et votre plateforme. Séquence et Battement s’installent depuis le navigateur ; Portée arrive en binaires signés — par TestFlight sur iPhone. Aucun magasin, aucun compte."
          appHref={appHref}
          githubHref={githubHref}
          Link={Link}
          appIds={['tubecraft', 'spotifycraft', 'pulsecraft']}
        />

        <section className="sc-section sc-section--band sc-section--atelier" id="atelier" data-tour="atelier">
          <header className="sc-label" data-reveal>
            <span className="sc-label__num">05</span>
            <span className="sc-label__text">L’atelier</span>
            <span className="sc-label__meta">{apps.length} dépôts · trois façons d’aider</span>
          </header>

          <div className="sc-intro" data-reveal>
            <h2 className="sc-h2">
              Le code est public. <em>La porte aussi.</em>
            </h2>
            <p className="sc-lede">
              Pas de formulaire ni de communauté payante. Des dépôts GitHub, des issues lisibles et
              des forks bienvenus — voici les trois gestes qui font avancer la collection.
            </p>
          </div>

          <div className="sc-open__doors">
            {OPEN_DOORS.map((door, index) => (
              <article
                className="sc-open__door"
                key={door.num}
                data-reveal
                style={{ '--d': `${index * 80}ms` } as CSSProperties}
              >
                <span className="sc-open__num">{door.num}</span>
                <h3>{door.title}</h3>
                <p>{door.text}</p>
              </article>
            ))}
          </div>

          <div className="sc-open__ledger" data-reveal>
            <div>
              <h3>
                <i className="sc-open__dot sc-open__dot--yes" aria-hidden />
                Toujours accepté
              </h3>
              <ul>
                <li>Corrections</li>
                <li>Accessibilité</li>
                <li>Tests</li>
                <li>Traductions</li>
                <li>Documentation</li>
              </ul>
            </div>
            <div>
              <h3>
                <i className="sc-open__dot sc-open__dot--no" aria-hidden />
                Jamais mergé
              </h3>
              <ul>
                <li>Publicité</li>
                <li>Compte obligatoire</li>
                <li>Télémétrie</li>
                <li>Fonctionnalité payante</li>
              </ul>
            </div>
          </div>

          <div className="sc-open__repos">
            {apps.map((app) =>
              app.source ? (
                <a
                  className="sc-open__repo"
                  key={app.id}
                  href={app.source}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ '--app-accent': app.accent } as CSSProperties}
                >
                  <img
                    className="sc-open__repoMark"
                    src={app.icon}
                    alt=""
                    width={28}
                    height={28}
                    loading="lazy"
                    decoding="async"
                  />
                  <strong>{app.name}</strong>
                  <em>Dépôt ↗</em>
                </a>
              ) : null
            )}
            <a
              className="sc-open__repo sc-open__repo--profile"
              href={githubHref}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span className="sc-open__repoMark" aria-hidden>
                GH
              </span>
              <strong>Profil GitHub</strong>
              <em>Tout voir ↗</em>
            </a>
          </div>

          <div className="sc-open__foot" data-reveal>
            <p>
              Une idée qui manque ? Ouvrez une issue dans le dépôt concerné. Les propositions sont
              publiques, priorisées à la main, et jamais vendues.
            </p>
            <a
              className="sc-btn sc-btn--line"
              href={githubHref}
              target="_blank"
              rel="noreferrer noopener"
            >
              Ouvrir GitHub <span aria-hidden>↗</span>
            </a>
          </div>
        </section>

        <section className="sc-final" data-reveal>
          <span className="sc-final__ghost" aria-hidden>
            CRAFTLINE
          </span>
          <p className="sc-kicker">
            <span className="sc-kicker__dot" aria-hidden />
            La suite
          </p>
          <h2 className="sc-final__title">
            La collection commence
            <br />
            par <em>une vidéo</em>.
          </h2>
          <p className="sc-final__lede">
            Ouvrez Séquence, lancez une vidéo, quittez la page : le mini-lecteur continue. Les
            prochaines apps sont déjà en préparation sur GitHub.
          </p>
          <div className="sc-final__cta">
            {appHref ? (
              <Link className="sc-btn sc-btn--paper" href={appHref}>
                Ouvrir Séquence <span aria-hidden>→</span>
              </Link>
            ) : (
              <a
                className="sc-btn sc-btn--paper"
                href={githubHref}
                target="_blank"
                rel="noreferrer noopener"
              >
                Voir sur GitHub <span aria-hidden>↗</span>
              </a>
            )}
            <a href="#collection" className="sc-btn sc-btn--line sc-btn--on-ink">
              Explorer la collection
            </a>
          </div>
          <button
            type="button"
            className="sc-final__copy"
            onClick={() => {
              const url = appHref
                ? new URL(appHref, window.location.href).href
                : window.location.href;
              navigator.clipboard?.writeText(url).then(
                () => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                },
                () => undefined
              );
            }}
          >
            {copied ? 'Lien copié ✓' : 'Copier le lien de la collection'}
          </button>
        </section>
      </main>

      {galleryApp ? (
        <AppGallery
          key={galleryApp.id}
          app={galleryApp}
          apps={apps}
          onClose={closeGallery}
          onSelectApp={(id) => {
            const next = apps.find((item) => item.id === id);
            if (next) setGalleryApp(next);
          }}
          appHref={appHref}
          githubHref={githubHref}
          Link={Link}
        />
      ) : null}

      {tourOpen ? <GuidedTour steps={TOUR_STEPS} onClose={closeTour} /> : null}

      <footer className="sc-footer">
        <div className="sc-footer__brand">
          <span className="sc-brand__mark" aria-hidden>
            <CraftlineMark />
          </span>
          <div>
            <strong>Craftline</strong>
            <p>Des apps open source, faites pour durer.</p>
          </div>
        </div>

        <nav className="sc-footer__links" aria-label="Liens de pied de page">
          {appHref ? <Link href={appHref}>Accueil Séquence</Link> : null}
          <a href="#collection">La collection</a>
          <a href="#telecharger">Télécharger</a>
          <a href="#atelier">Contribuer</a>
          <a href={githubHref} target="_blank" rel="noreferrer noopener">
            GitHub ↗
          </a>
        </nav>

        <p className="sc-footer__note">
          © {new Date().getFullYear()} — fait à la main. Aucune donnée collectée, aucun cookie.
          {featured ? ` ${featured.name} est publié sous licence ${featured.license}.` : ''}
        </p>
      </footer>
    </div>
  );
}
