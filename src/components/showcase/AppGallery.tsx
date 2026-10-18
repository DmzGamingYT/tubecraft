import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { OpenSourceApp } from '../../data/apps';
import type { ShowcaseLinkProps } from '../ShowcaseSite';
import { DemoFrame, SpotifyCraftDemo, TubeCraftDemo } from './AppDemo';
import {
  SpotifyEqScene,
  SpotifyImportScene,
  SpotifyNowScene,
  SpotifyQueueScene,
  TubeHomeScene,
  TubeMiniScene,
  TubeSearchScene,
  TubeShortsScene,
} from './GalleryScenes';

/**
 * Galerie d'une app : une section plein écran, uniquement visuelle, ouverte
 * depuis les démos de la collection. On y retrouve les grands écrans animés
 * et des scènes plus courtes (accueil, recherche, Shorts, mini-lecteur,
 * lecture, file d'attente, égaliseur, import).
 */

interface AppGalleryProps {
  app: OpenSourceApp;
  apps: OpenSourceApp[];
  onClose: () => void;
  onSelectApp: (id: string) => void;
  appHref: string | null;
  githubHref: string;
  Link: (props: ShowcaseLinkProps) => JSX.Element;
}

interface Tile {
  title: string;
  note: string;
  url: string;
  tone: 'dark' | 'light';
  wide?: boolean;
  scene: ReactNode;
}

function Caption({ title, note }: { title: string; note: string }) {
  return (
    <div className="sc-gal__caption">
      <strong>{title}</strong>
      <span>{note}</span>
    </div>
  );
}

function tilesFor(app: OpenSourceApp): Tile[] {
  if (app.id === 'spotifycraft') {
    return [
      {
        title: 'Accueil',
        note: 'Daily Mix, Pop du moment et pochettes réelles du catalogue iTunes.',
        url: 'spotifycraft.app / bonjour',
        tone: 'light',
        wide: true,
        scene: <SpotifyCraftDemo />,
      },
      {
        title: 'Lecture',
        note: 'Extrait officiel de 30 s, paroles synchronisées et transport complet.',
        url: 'spotifycraft.app / lecture',
        tone: 'light',
        scene: <SpotifyNowScene />,
      },
      {
        title: 'File d’attente',
        note: 'Mix calculé en local, lecture de vos propres fichiers sans serveur.',
        url: 'spotifycraft.app / mix-pop',
        tone: 'light',
        scene: <SpotifyQueueScene />,
      },
      {
        title: 'Égaliseur',
        note: 'Dix bandes, presets Studio, Basses, Voix et Live.',
        url: 'spotifycraft.app / égaliseur',
        tone: 'dark',
        scene: <SpotifyEqScene />,
      },
      {
        title: 'Bibliothèque',
        note: 'MP3, FLAC et M4A importés dans le navigateur, disponibles hors ligne.',
        url: 'spotifycraft.app / bibliothèque',
        tone: 'light',
        scene: <SpotifyImportScene />,
      },
    ];
  }

  return [
    {
      title: 'Lecture',
      note: 'Lecteur, chapitres, résumé IA, suggestions et mini-lecteur.',
      url: 'tubecraft.app / lecture',
      tone: 'dark',
      wide: true,        scene: <TubeCraftDemo initialScene="playback" cycle={false} />,
    },
    {
      title: 'Accueil',
      note: 'Catalogue embarqué, reprise de lecture et Shorts.',
      url: 'tubecraft.app / accueil',
      tone: 'dark',
      scene: <TubeHomeScene />,
    },
    {
      title: 'Recherche',
      note: 'Résultats YouTube en direct, filtres et suggestions.',
      url: 'tubecraft.app / recherche',
      tone: 'dark',
      scene: <TubeSearchScene />,
    },
    {
      title: 'Shorts',
      note: 'Défilement vertical, likes, commentaires et partage.',
      url: 'tubecraft.app / shorts',
      tone: 'dark',
      scene: <TubeShortsScene />,
    },
    {
      title: 'Mini-lecteur',
      note: 'La vidéo continue pendant que vous naviguez dans l’app.',
      url: 'tubecraft.app / mini-lecteur',
      tone: 'dark',
      scene: <TubeMiniScene />,
    },
  ];
}

export function AppGallery({
  app,
  apps,
  onClose,
  onSelectApp,
  appHref,
  githubHref,
  Link,
}: AppGalleryProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const tiles = tilesFor(app);
  const launchHref = app.self ? appHref : (app.url ?? null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <section
      className="sc-gal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sc-gal-title"
      style={{ '--gal-accent': app.accent } as CSSProperties}
    >
      <header className="sc-gal__bar">
        <button type="button" className="sc-gal__back" onClick={onClose}>
          <span aria-hidden>←</span> Collection
        </button>

        <nav className="sc-gal__apps" aria-label="Changer d’application">
          {apps.map((item) => (
            <button
              type="button"
              key={item.id}
              className={item.id === app.id ? 'is-on' : undefined}
              onClick={() => onSelectApp(item.id)}
              aria-pressed={item.id === app.id}
            >
              {item.name}
            </button>
          ))}
        </nav>

        <button
          ref={closeRef}
          type="button"
          className="sc-gal__close"
          onClick={onClose}
          aria-label="Fermer la galerie"
        >
          Fermer <span aria-hidden>×</span>
        </button>
      </header>

      <div className="sc-gal__scroll">
        <header className="sc-gal__hero">
          <p className="sc-kicker">
            <span className="sc-kicker__dot" aria-hidden /> Galerie · démos animées
          </p>
          <h2 id="sc-gal-title" className="sc-gal__title">
            {app.name}
          </h2>
          <p className="sc-gal__tagline">{app.tagline}</p>
          <p className="sc-gal__lede">{app.description}</p>

          <div className="sc-gal__meta">
            <span className="sc-gal__license">{app.license}</span>
            <ul className="sc-gal__stack" aria-label="Technologies">
              {app.stack.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            {launchHref ? (
              app.self ? (
                <Link className="sc-btn sc-btn--ink sc-btn--small" href={launchHref}>
                  Ouvrir l’app <span aria-hidden>↗</span>
                </Link>
              ) : (
                <a
                  className="sc-btn sc-btn--ink sc-btn--small"
                  href={launchHref}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Lancer {app.name} <span aria-hidden>↗</span>
                </a>
              )
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

        <div className="sc-gal__grid">
          {tiles.map((tile) => (
            <div className={`sc-gal__item${tile.wide ? ' is-wide' : ''}`} key={tile.title}>
              <DemoFrame url={tile.url} label={`${app.name} — ${tile.title}`} tone={tile.tone}>
                {tile.scene}
              </DemoFrame>
              <Caption title={tile.title} note={tile.note} />
            </div>
          ))}
        </div>

        <footer className="sc-gal__foot">
          <p>
            Toutes les scènes sont des reconstitutions animées, pas des captures figées : elles
            bouclent, se mettent en pause hors écran et respectent les réglages de mouvement.
          </p>
          <button type="button" className="sc-btn sc-btn--line" onClick={onClose}>
            <span aria-hidden>←</span> Retour à la collection
          </button>
        </footer>
      </div>
    </section>
  );
}
