import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { OpenSourceApp } from '../data/apps';
import { proposals, proposalStatusLabel } from '../data/proposals';
import { DemoFrame, SpotifyCraftDemo, TubeCraftDemo } from './showcase/AppDemo';
import { AppGallery } from './showcase/AppGallery';
import { GuidedTour, type TourStep } from './showcase/GuidedTour';
import { UnderTheHood } from './showcase/UnderTheHood';
import { IdeaPreview } from './showcase/IdeaPreview';
import { DownloadShowcase } from './download/DownloadShowcase';

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
const SECTION_IDS = ['collection', 'manifeste', 'capot', 'telecharger', 'etude'];

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

    let frame = 0;
    const update = () => {
      frame = 0;
      // `top < limite` couvre aussi les blocs déjà dépassés (ancre, rechargement
      // au milieu de la page) : sans cela, un saut de navigation les laisserait
      // invisibles en remontant.
      const limit = window.innerHeight * 0.92;
      targets.forEach((el) => {
        if (!el.dataset.in && el.getBoundingClientRect().top < limit) reveal(el);
      });
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
    text: 'Bienvenue dans L’Atelier. La visite dure une minute : elle va vous montrer la collection, les démos, l’architecture et l’installation — sans rien télécharger.',
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
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const tourReturnRef = useRef<HTMLElement | null>(null);
  const activeProposal = proposals.find((proposal) => proposal.id === activeIdea) ?? proposals[0];
  const activeSection = useScrollSpy(rootRef, SECTION_IDS);

  useReveal(rootRef);
  useScrollChrome(rootRef);
  useHeroParallax(rootRef);

  const startTour = useCallback(() => {
    tourReturnRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMenuOpen(false);
    setTourOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    tourReturnRef.current?.focus();
  }, []);

  const openGallery = (app: OpenSourceApp) => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setGalleryApp(app);
  };

  const closeGallery = () => {
    setGalleryApp(null);
    returnFocusRef.current?.focus();
  };

  // menu mobile : Échap pour refermer
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
      <span className="sc-progress" aria-hidden />

      <header className="sc-nav">
        <a href="#top" className="sc-brand" aria-label="L’Atelier — haut de page">
          <span className="sc-brand__mark" aria-hidden>
            A
          </span>
          <span className="sc-brand__text">
            L’Atelier<span className="sc-brand__dim">.apps</span>
          </span>
        </a>

        <nav className="sc-nav__links" aria-label="Sommaire">
          {[
            ['collection', '01', 'Collection'],
            ['manifeste', '02', 'Manifeste'],
            ['capot', '03', 'Sous le capot'],
            ['telecharger', '04', 'Télécharger'],
            ['etude', '05', 'À l’étude'],
          ].map(([id, num, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className={activeSection === id ? 'is-active' : undefined}
              aria-current={activeSection === id ? 'true' : undefined}
            >
              <i>{num}</i> {label}
            </a>
          ))}
        </nav>

        <div className="sc-nav__actions">
          <button
            type="button"
            className="sc-nav__tour"
            onClick={startTour}
            aria-label="Lancer la visite guidée"
          >
            <span className="sc-nav__tourIcon" aria-hidden>
              ▶
            </span>
            <span className="sc-nav__tourLabel">Visite guidée</span>
          </button>

          <button
            type="button"
            className="sc-theme"
            onClick={() => setNight((value) => !value)}
            aria-pressed={night}
            title={night ? 'Revenir au thème papier' : 'Passer au thème nuit'}
          >
            <span className="sc-theme__dot" aria-hidden />
            {night ? 'Nuit' : 'Papier'}
          </button>

          <button
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
            <Link className="sc-btn sc-btn--ink sc-btn--small" href={appHref}>
              Ouvrir TubeCraft <span aria-hidden>↗</span>
            </Link>
          ) : (
            <a
              className="sc-btn sc-btn--ink sc-btn--small"
              href={githubHref}
              target="_blank"
              rel="noreferrer noopener"
            >
              GitHub <span aria-hidden>↗</span>
            </a>
          )}
        </div>
      </header>

      {menuOpen ? (
        <nav className="sc-mobilemenu" id="sc-mobile-menu" aria-label="Sommaire mobile">
          {[
            ['collection', '01', 'Collection'],
            ['manifeste', '02', 'Manifeste'],
            ['capot', '03', 'Sous le capot'],
            ['telecharger', '04', 'Télécharger'],
            ['etude', '05', 'À l’étude'],
          ].map(([id, num, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className={activeSection === id ? 'is-active' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <i>{num}</i> {label}
              <span aria-hidden>↘</span>
            </a>
          ))}
          <button
            type="button"
            className="sc-mobilemenu__tour"
            onClick={() => {
              setMenuOpen(false);
              startTour();
            }}
          >
            <span aria-hidden>▶</span> Lancer la visite guidée
          </button>
        </nav>
      ) : null}

      <main>
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

          <div className="sc-floats" aria-hidden>
            <span className="sc-float sc-float--1">0 tracker</span>
            <span className="sc-float sc-float--2">local-first</span>
            <span className="sc-float sc-float--3">100 % open source</span>
            <span className="sc-float sc-float--4">sans abonnement</span>
            <span className="sc-float sc-float--5">InnerTube</span>
          </div>

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
            Une famille d’applications open source qui reprennent les outils du quotidien — sans
            compte obligatoire, sans abonnement, sans télémétrie. La première est déjà là :{' '}
            <strong>TubeCraft</strong> pour la vidéo, avec <strong>SpotifyCraft</strong> juste
            derrière.
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
            <button type="button" className="sc-btn sc-btn--line sc-btn--tour" onClick={startTour}>
              <span className="sc-btn__play" aria-hidden>
                ▶
              </span>
              Visite guidée
            </button>
          </div>

          <a href="#collection" className="sc-hero__collection">
            ou explorer la collection <span aria-hidden>↓</span>
          </a>

          <p className="sc-hero__meta">
            Open source sur GitHub · Web · Sans compte · Aucun abonnement
          </p>

          <a href="#collection" className="sc-scrollhint" aria-label="Faire défiler vers la collection">
            <span aria-hidden>↓</span> Défiler
          </a>
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

          <div className="sc-apps">
            {apps.map((app, index) => {
              const isInternal = app.self === true;
              const href = app.self ? appHref : (app.url ?? null);
              return (
                <article
                  key={app.id}
                  className="sc-app sc-app--visual"
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
                    <h3 className="sc-app__name">{app.name}</h3>
                    <p className="sc-app__tagline">{app.tagline}</p>
                    <p className="sc-app__desc">{app.description}</p>
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

            <article className="sc-app sc-app--next sc-app--visual" data-reveal>
              <span className="sc-app__index" aria-hidden>
                +
              </span>
              <div className="sc-app__body">
                <h3 className="sc-app__name">La suite</h3>
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

        <section className="sc-section sc-section--manifeste" id="manifeste">
          <header className="sc-label" data-reveal>
            <span className="sc-label__num">02</span>
            <span className="sc-label__text">Le manifeste</span>
            <span className="sc-label__meta">Trois règles, aucune exception</span>
          </header>

          <div className="sc-manifeste">
            <h2 className="sc-h2 sc-h2--wide" data-reveal>
              Un logiciel n’est pas un service qu’on loue. C’est un outil qu’on <em>installe</em>,
              qu’on comprend et qu’on garde.
            </h2>

            <ol className="sc-principles">
              <li data-reveal style={{ '--d': '0ms' } as CSSProperties}>
                <span className="sc-principle__num">01</span>
                <h3>Le code est le contrat.</h3>
                <p>
                  Pas de boîte noire : tout est lisible, forkeable, réparable. Si une fonction vous
                  manque, vous pouvez l’ajouter — ou payer quelqu’un pour le faire.
                </p>
              </li>
              <li data-reveal style={{ '--d': '90ms' } as CSSProperties}>
                <span className="sc-principle__num">02</span>
                <h3>Vos données restent chez vous.</h3>
                <p>
                  Comptes, historique, réglages, progression : tout vit dans votre navigateur.
                  Aucun serveur ne récolte ce que vous regardez ou écrivez.
                </p>
              </li>
              <li data-reveal style={{ '--d': '180ms' } as CSSProperties}>
                <span className="sc-principle__num">03</span>
                <h3>Pas de péage à l’entrée.</h3>
                <p>
                  Pas d’essai gratuit qui expire, pas de fonctionnalité derrière un abonnement. Une
                  app qu’on télécharge, qu’on utilise, et qu’on garde.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="sc-section" id="capot">
          <header className="sc-label" data-reveal>
            <span className="sc-label__num">03</span>
            <span className="sc-label__text">Sous le capot</span>
            <span className="sc-label__meta">TubeCraft, concrètement</span>
          </header>

          <div className="sc-intro" data-reveal>
            <h2 className="sc-h2">
              YouTube, mais avec le <em>capot ouvert</em>.
            </h2>
            <p className="sc-lede">
              TubeCraft parle directement à InnerTube — le canal que youtube.com utilise déjà — via
              un proxy local. Aucune clé API, aucun compte Google, aucun serveur à nous.
            </p>
          </div>

          <div className="sc-under-wrap" data-reveal data-tour="capot">
            <UnderTheHood />
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
          appHref={appHref}
          githubHref={githubHref}
          Link={Link}
          appIds={['tubecraft', 'spotifycraft']}
        />

        <section className="sc-section sc-section--etude" id="etude" data-tour="etude">
          <header className="sc-label" data-reveal>
            <span className="sc-label__num">05</span>
            <span className="sc-label__text">À l’étude</span>
            <span className="sc-label__meta">{proposals.length} propositions ouvertes</span>
          </header>

          <div className="sc-intro" data-reveal>
            <h2 className="sc-h2">
              Ce qui vient <em>ensuite</em>.
            </h2>
            <p className="sc-lede">
              Ces fonctions ne sont pas encore développées : ce sont des propositions, classées par
              thème. Les deux premières sont les plus abouties ; les autres attendent un signal.
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
            ATELIER
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
            A
          </span>
          <div>
            <strong>L’Atelier</strong>
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
