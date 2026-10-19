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
import { proposals, proposalStatusLabel } from '../data/proposals';
import { DemoFrame, PulseCraftDemo, SpotifyCraftDemo, TubeCraftDemo } from './showcase/AppDemo';
import { AppGallery } from './showcase/AppGallery';
import { GuidedTour, type TourStep } from './showcase/GuidedTour';
import { hasSeenTour, rememberTour } from './showcase/tourMemory';
import { UnderTheHood } from './showcase/UnderTheHood';
import { IdeaPreview } from './showcase/IdeaPreview';
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
  /** URL de l'app TubeCraft. `null` hors SPA tant que l'app n'est pas déployée. */
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
  { id: 'manifeste', num: '02', label: 'Manifeste' },
  { id: 'capot', num: '03', label: 'Sous le capot' },
  { id: 'telecharger', num: '04', label: 'Télécharger' },
  { id: 'etude', num: '05', label: 'À l’étude' },
] as const;
const SECTION_IDS = SECTIONS.map((section) => section.id);

/** Quatre principes techniques, présentés comme une grille de fonctionnalités. */
const CAPABILITIES = [
  {
    id: 'reseau',
    viz: 'network',
    meta: '01 / Réseau',
    title: 'InnerTube, en direct.',
    text: 'Aucune clé Google, aucun quota. Un proxy same-origin avec cache, timeout et limite par IP.',
  },
  {
    id: 'donnees',
    viz: 'local',
    meta: '02 / Données',
    title: 'Local par défaut.',
    text: 'IndexedDB, localStorage, fichiers importés : les données ne quittent pas l’appareil.',
  },
  {
    id: 'noyau',
    viz: 'wasm',
    meta: '03 / Noyau',
    title: 'Rust → WASM.',
    text: 'Les calculs de PulseCraft et l’import audio de SpotifyCraft tournent en WebAssembly.',
  },
  {
    id: 'portabilite',
    viz: 'platforms',
    meta: '04 / Portabilité',
    title: 'Un code, trois distributions.',
    text: 'Web, PWA installable et coque Tauri 2 : la même base, sans fork ni réécriture.',
  },
] as const;

function CapabilityVisual({ kind }: { kind: (typeof CAPABILITIES)[number]['viz'] }) {
  if (kind === 'network') {
    return (
      <div className="sc-cap__viz sc-cap__viz--network" aria-hidden>
        <span>vous</span>
        <i />
        <span>/yt</span>
        <i />
        <span>YT</span>
      </div>
    );
  }
  if (kind === 'local') {
    return (
      <div className="sc-cap__viz sc-cap__viz--local" aria-hidden>
        <i />
        <i />
        <i />
        <em>local</em>
      </div>
    );
  }
  if (kind === 'wasm') {
    return (
      <div className="sc-cap__viz sc-cap__viz--wasm" aria-hidden>
        <span>RUST</span>
        <b>→</b>
        <strong>WASM</strong>
      </div>
    );
  }
  return (
    <div className="sc-cap__viz sc-cap__viz--platforms" aria-hidden>
      <span>WEB</span>
      <span>PWA</span>
      <span>TAURI</span>
    </div>
  );
}

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
    text: 'Bienvenue dans Craftline. La visite dure une minute : elle va vous montrer la collection, les démos, l’architecture et l’installation — sans rien télécharger.',
    duration: 5600,
  },
  {
    target: '[data-tour="tubecraft-demo"]',
    title: 'Chercher dans TubeCraft.',
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
    title: 'SpotifyCraft, la musique en local.',
    text: 'Même philosophie : extraits officiels, pochettes réelles, Daily Mix calculés sur l’appareil et import de vos propres fichiers.',
    demo: { app: 'spotifycraft', scene: 'home', hold: true },
    duration: 5000,
  },
  {
    target: '[data-tour="pulsecraft-demo"]',
    title: 'PulseCraft, la santé qui reste chez vous.',
    text: 'Anneaux d’objectifs, journal d’entraînement, sommeil, nutrition et coach IA. Les calculs tournent en Rust/WASM, et les imports Apple Health ou Samsung Health restent dans le navigateur.',
    demo: { app: 'pulsecraft', scene: 'today', hold: true },
    duration: 5400,
  },
  {
    target: '[data-tour="capot"]',
    title: 'Le capot est ouvert.',
    text: 'TubeCraft parle à InnerTube via un proxy local : aucune clé API, aucun secret, un cache mémoire et une limite de requêtes. Le journal défile en direct.',
    duration: 5200,
  },
  {
    target: '[data-tour="telecharger"]',
    title: 'Une app, cinq plateformes.',
    text: 'L’installation passe par le navigateur : macOS, Windows, Linux, Android et iPhone. Pas de magasin, pas de compte, mise à jour automatique.',
    duration: 5400,
  },
  {
    target: '[data-tour="etude"]',
    title: 'La suite se décide en public.',
    text: 'Les prochaines fonctions sont listées à l’étude, avec un aperçu animé. Rien n’est présenté comme terminé avant de l’être.',
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
  const [activeIdea, setActiveIdea] = useState(proposals[0]?.id ?? '');
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
  const activeProposal = proposals.find((proposal) => proposal.id === activeIdea) ?? proposals[0];
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
              aria-label="Ouvrir TubeCraft"
            >
              <span className="sc-nav__ctaLong">Ouvrir TubeCraft</span>
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
              Ouvrir TubeCraft <span aria-hidden>↗</span>
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

          {/* Le hero est une page de catalogue : le titre à gauche, l'index des
              apps à droite. On sait en un coup d'œil qu'il y a trois produits. */}
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
                Une famille d’applications open source qui reprennent les outils du quotidien —
                sans compte obligatoire, sans abonnement, sans télémétrie. Trois apps, un même
                code, un même principe : le logiciel est public, et les données restent chez vous.
              </p>

              <div className="sc-hero__cta">
                {appHref ? (
                  <Link className="sc-btn sc-btn--ink" href={appHref}>
                    Lancer TubeCraft <span aria-hidden>→</span>
                  </Link>
                ) : (
                  <a
                    className="sc-btn sc-btn--ink"
                    href={githubHref}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Voir sur GitHub <span aria-hidden>↗</span>
                  </a>
                )}
                {tourOffered ? (
                  <button
                    type="button"
                    data-tour-start
                    className="sc-btn sc-btn--line sc-btn--tour"
                    onClick={startTour}
                  >
                    <span className="sc-btn__play" aria-hidden>
                      ▶
                    </span>
                    Visite guidée
                  </button>
                ) : null}
              </div>

              {tourOffered ? null : (
                <button type="button" data-tour-start className="sc-tourlink" onClick={startTour}>
                  <span aria-hidden>↻</span> Revoir la visite guidée
                </button>
              )}

              <p className="sc-hero__meta">
                Open source sur GitHub · Web · Sans compte · Aucun abonnement
              </p>
            </div>

            {/* Le catalogue en un coup d'œil : chaque ligne mène à sa fiche. */}
            <nav className="sc-launcher" aria-label="Catalogue des applications">
              <span className="sc-launcher__head">
                <span>Catalogue</span>
                <span>{String(apps.length).padStart(2, '0')} applications</span>
              </span>

              {apps.map((app, index) => (
                <a
                  key={app.id}
                  className="sc-launcher__app"
                  href={`#app-${app.id}`}
                  style={{ '--app-accent': app.accent } as CSSProperties}
                >
                  <span className="sc-launcher__num" aria-hidden>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="sc-launcher__icon" aria-hidden>
                    {app.mark}
                  </span>
                  <span className="sc-launcher__text">
                    <strong>{app.name}</strong>
                    <em>{app.tagline}</em>
                  </span>
                  <span className="sc-launcher__go" aria-hidden>
                    ↘
                  </span>
                </a>
              ))}

              <a className="sc-launcher__app sc-launcher__app--next" href="#app-suite">
                <span className="sc-launcher__num" aria-hidden>
                  +
                </span>
                <span className="sc-launcher__icon" aria-hidden>
                  +
                </span>
                <span className="sc-launcher__text">
                  <strong>La suite</strong>
                  <em>En préparation</em>
                </span>
                <span className="sc-launcher__go" aria-hidden>
                  ↘
                </span>
              </a>
            </nav>
          </div>

          {/* Planche contact : les vraies vignettes du catalogue, qui débordent
              du bas du hero. La collection commence déjà sous la ligne de flottaison. */}
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
                      <span className="sc-app__mark" aria-hidden>
                        {app.mark}
                      </span>
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
                        url="tubecraft.app / accueil"
                        label="TubeCraft"
                        tone="dark"
                        onOpen={() => openGallery(app)}
                      >
                        <TubeCraftDemo />
                      </DemoFrame>
                    ) : app.id === 'pulsecraft' ? (
                      <DemoFrame
                        url="pulsecraft.app / aujourd’hui"
                        label="PulseCraft"
                        tone="dark"
                        onOpen={() => openGallery(app)}
                      >
                        <PulseCraftDemo />
                      </DemoFrame>
                    ) : (
                      <DemoFrame
                        url="spotifycraft.app / bonjour"
                        label="SpotifyCraft"
                        tone="light"
                        onOpen={() => openGallery(app)}
                      >
                        <SpotifyCraftDemo />
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

        <section className="sc-section sc-section--band sc-section--manifeste" id="manifeste">
          <header className="sc-label" data-reveal>
            <span className="sc-label__num">02</span>
            <span className="sc-label__text">Le manifeste</span>
            <span className="sc-label__meta">Trois règles, aucune exception</span>
          </header>

          <div className="sc-manifeste">
            <h2 className="sc-h2 sc-h2--wide" data-reveal>
              On ne loue pas un outil. On le <em>possède</em>.
            </h2>
            <p className="sc-lede" data-reveal>
              Pas de compte obligatoire, pas d’abonnement, pas de télémétrie. Trois règles,
              aucune exception — et elles ne bougeront pas.
            </p>

            <ol className="sc-principles">
              <li data-reveal style={{ '--d': '0ms' } as CSSProperties}>
                <span className="sc-principle__num">A</span>
                <h3>Le code est le contrat.</h3>
                <p>
                  Chaque app est un dépôt public : lisible, forkeable, réparable. Si une fonction
                  vous manque, vous pouvez l’ajouter — ou payer quelqu’un pour le faire.
                </p>
                <a
                  className="sc-principle__link"
                  href={githubHref}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Voir le code <span aria-hidden>↗</span>
                </a>
              </li>
              <li data-reveal style={{ '--d': '90ms' } as CSSProperties}>
                <span className="sc-principle__num">B</span>
                <h3>Vos données restent chez vous.</h3>
                <p>
                  Historique, réglages, progression : tout vit dans le navigateur. Aucun serveur
                  Craftline ne récolte ce que vous regardez ou écrivez.
                </p>
              </li>
              <li data-reveal style={{ '--d': '180ms' } as CSSProperties}>
                <span className="sc-principle__num">C</span>
                <h3>Pas de péage à l’entrée.</h3>
                <p>
                  Pas d’essai qui expire, pas de fonctionnalité derrière un abonnement. Une app
                  qu’on installe, qu’on utilise, et qu’on garde.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="sc-section sc-section--capot" id="capot">
          <header className="sc-label" data-reveal>
            <span className="sc-label__num">03</span>
            <span className="sc-label__text">Sous le capot</span>
            <span className="sc-label__meta">Quatre principes techniques</span>
          </header>

          <div className="sc-intro" data-reveal>
            <h2 className="sc-h2">
              Pas de boîte noire. Un <em>capot ouvert</em>.
            </h2>
            <p className="sc-lede">
              TubeCraft parle directement à InnerTube, PulseCraft calcule en Rust/WASM,
              SpotifyCraft lit vos fichiers en local. Même principe partout : le moins de serveurs
              possible.
            </p>
          </div>

          <div className="sc-capot__media" data-reveal data-tour="capot">
            <div className="sc-capot__mediaHead">
              <span>Architecture réelle · TubeCraft</span>
              <span>navigateur → proxy → InnerTube</span>
            </div>
            <UnderTheHood />
          </div>

          <div className="sc-cap-grid">
            {CAPABILITIES.map((capability, index) => (
              <article
                className="sc-cap"
                key={capability.id}
                data-reveal
                style={{ '--d': `${index * 70}ms` } as CSSProperties}
              >
                <CapabilityVisual kind={capability.viz} />
                <div className="sc-cap__body">
                  <span className="sc-cap__meta">{capability.meta}</span>
                  <h3>{capability.title}</h3>
                  <p>{capability.text}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="sc-stats">
            {[
              {
                value: '0',
                label: 'clé API',
                text: 'Les métadonnées passent par InnerTube, sans identifiant et sans quota.',
              },
              {
                value: '100 %',
                label: 'local',
                text: 'Profils, likes, playlists et reprise de lecture vivent dans le navigateur.',
              },
              {
                value: '0',
                label: 'tracker',
                text: 'Pas de cookie publicitaire, pas de script d’analyse, rien à accepter.',
              },
              {
                value: '∞',
                label: 'forks',
                text: 'Le code est là pour être lu, modifié et réutilisé, y compris ailleurs.',
              },
            ].map((stat, index) => (
              <article
                className="sc-stat"
                key={stat.label}
                data-reveal
                style={{ '--d': `${index * 80}ms` } as CSSProperties}
              >
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
                <p>{stat.text}</p>
              </article>
            ))}
          </div>

          <p className="sc-note" data-reveal>
            Transparence : {featured ? `${featured.name} est publié sous licence ${featured.license}.` : ''}{' '}
            Le lecteur reste celui de YouTube, dans une iframe officielle.
          </p>
        </section>

        <DownloadShowcase
          variant="section"
          sectionTitle={
            <>
              Installer. <em>Partout.</em>
            </>
          }
          sectionLede="Choisissez votre app et votre plateforme. L’installation passe par le navigateur — aucun magasin, aucun compte, aucun binaire à vérifier."
          appHref={appHref}
          githubHref={githubHref}
          Link={Link}
          appIds={['tubecraft', 'pulsecraft', 'spotifycraft']}
        />

        <section className="sc-section sc-section--band sc-section--etude" id="etude" data-tour="etude">
          <header className="sc-label" data-reveal>
            <span className="sc-label__num">05</span>
            <span className="sc-label__text">À l’étude</span>
            <span className="sc-label__meta">{proposals.length} propositions ouvertes</span>
          </header>

          <div className="sc-intro" data-reveal>
            <h2 className="sc-h2">
              Ce qui n’est pas encore là. Et qui pourrait <em>l’être</em>.
            </h2>
            <p className="sc-lede">
              Des propositions publiques, classées par thème et priorisées à la main. Rien n’est
              vendu, rien n’est promis avant d’être utilisable.
            </p>
          </div>

          <div className="sc-ideasWrap" data-reveal>
            <ol className="sc-ideas">
              {proposals.map((proposal, index) => (
                <li
                  key={proposal.id}
                  className={`sc-idea sc-idea--${proposal.status}${
                    proposal.id === activeIdea ? ' is-active' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="sc-idea__btn"
                    onMouseEnter={() => setActiveIdea(proposal.id)}
                    onFocus={() => setActiveIdea(proposal.id)}
                    onClick={() => setActiveIdea(proposal.id)}
                    aria-pressed={proposal.id === activeIdea}
                    aria-label={`Voir l’aperçu : ${proposal.title}`}
                  >
                    <span className="sc-idea__num" aria-hidden>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="sc-idea__body">
                      <strong className="sc-idea__title">{proposal.title}</strong>
                      <span className="sc-idea__desc">{proposal.summary}</span>
                    </span>
                    <span className="sc-idea__side">
                      <span className="sc-idea__tag">{proposal.tag}</span>
                      <span className="sc-idea__status">
                        <i aria-hidden />
                        {proposalStatusLabel[proposal.status]}
                      </span>
                    </span>
                  </button>

                  {/* sur mobile, l’aperçu s’ouvre directement sous la proposition */}
                  {proposal.id === activeIdea ? (
                    <IdeaPreview proposal={proposal} variant="inline" />
                  ) : null}
                </li>
              ))}
            </ol>

            {activeProposal ? <IdeaPreview proposal={activeProposal} /> : null}
          </div>

          <div className="sc-ideas__foot" data-reveal>
            <p>
              Une idée qui manque ? Elle a sa place ici. Les propositions sont ouvertes, priorisées
              à la main, et jamais vendues.
            </p>
            <a
              className="sc-btn sc-btn--line"
              href={`${githubHref}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Proposer une idée <span aria-hidden>↗</span>
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
            Ouvrez TubeCraft, lancez une vidéo, quittez la page : le mini-lecteur continue. Les
            prochaines apps sont déjà en préparation sur GitHub.
          </p>
          <div className="sc-final__cta">
            {appHref ? (
              <Link className="sc-btn sc-btn--paper" href={appHref}>
                Ouvrir TubeCraft <span aria-hidden>→</span>
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
          {appHref ? <Link href={appHref}>Accueil TubeCraft</Link> : null}
          <a href="#collection">La collection</a>
          <a href="#telecharger">Télécharger</a>
          <a href="#etude">Les propositions</a>
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
