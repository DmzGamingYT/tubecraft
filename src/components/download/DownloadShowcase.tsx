import { useId, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import {
  findDownloadApp,
  type DownloadApp,
  type DownloadAppId,
  type DownloadPlatform,
  type DownloadPlatformId,
} from '../../data/downloads';
import { useInstallPrompt } from '../../lib/pwa';
import { MIXES, TRACKS, YT_THUMBS } from '../showcase/media';

/**
 * Page / section « Télécharger ».
 *
 * Même composant pour l’app (`/download`) et pour la vitrine (`#telecharger`) :
 * un sélecteur de plateforme, un aperçu de l’app dans son cadre, les étapes
 * d’installation réellement applicables et un bouton d’installation PWA quand
 * le navigateur le permet.
 *
 * Aucun faux binaire : tant que les paquets natifs ne sont pas publiés, la
 * page propose l’installation de la web app et l’explique plateforme par
 * plateforme.
 */

type LinkComponent = (props: {
  href: string;
  className?: string;
  children: ReactNode;
}) => JSX.Element;

interface Props {
  appHref: string | null;
  githubHref: string;
  Link: LinkComponent;
  /** `page` : route de l’app ; `section` : bloc dans la vitrine */
  variant?: 'page' | 'section';
  /** Titre de la section vitrine (sinon « App, emphasis. »). */
  sectionTitle?: ReactNode;
  /** Introduction de la section vitrine (sinon le texte de l’app). */
  sectionLede?: string;
  /**
   * Apps proposées, dans l’ordre d’affichage. La route interne de Séquence
   * n’en montre qu’une ; la vitrine présente la collection entière.
   */
  appIds?: DownloadAppId[];
}

/** Plateforme détectée : la page s’ouvre directement sur le bon onglet. */
function detectPlatform(): DownloadPlatformId {
  if (typeof navigator === 'undefined') return 'macos';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/mac/i.test(ua)) return 'macos';
  if (/win/i.test(ua)) return 'windows';
  if (/linux|x11|cros/i.test(ua)) return 'linux';
  return 'macos';
}

const MOCK_VIDEOS = [
  {
    thumb: YT_THUMBS.spring,
    title: 'Spring — Blender Open Movie',
    meta: 'Blender Studio · 10,9 M de vues',
    duration: '7:44',
  },
  {
    thumb: YT_THUMBS.sprite,
    title: 'Sprite Fright — Blender Open Movie',
    meta: 'Blender Studio · 9,4 M de vues',
    duration: '10:30',
  },
  {
    thumb: YT_THUMBS.charge,
    title: 'CHARGE — Blender Open Movie',
    meta: 'Blender Studio · 2,5 M de vues',
    duration: '4:23',
  },
  {
    thumb: YT_THUMBS.singularity,
    title: 'The Making of SINGULARITY',
    meta: 'Blender Studio · 55 k de vues',
    duration: '16:59',
  },
];

/* --------------------------------------------------------------- pictogrammes */

function PlatformGlyph({ id }: { id: DownloadPlatformId }) {
  if (id === 'macos') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M16.3 12.9c0-2 1.6-3 1.7-3.1-.9-1.4-2.3-1.6-2.8-1.6-1.2-.1-2.3.7-2.9.7-.6 0-1.5-.7-2.5-.7-1.3 0-2.5.8-3.2 2-1.4 2.4-.4 5.9 1 7.8.6.9 1.4 1.9 2.5 1.9 1 0 1.4-.6 2.6-.6 1.2 0 1.5.6 2.5.6s1.7-.9 2.3-1.8c.7-1 1-2 1-2.1-.1 0-2.2-.9-2.2-3.1Z" />
        <path d="M14.4 6.6c.5-.6.9-1.5.8-2.4-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.5-.8 2.4.9.1 1.8-.5 2.3-1.2Z" />
      </svg>
    );
  }

  if (id === 'windows') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M3 4.7 10.6 3v8.2H3V4.7Zm0 14.6 7.6 1.7v-8.1H3V19.3Zm8.6 1.9L21 23V12.9h-9.4v8.3Zm0-16.5v8.2H21V1.8L11.6 3.7Z" />
      </svg>
    );
  }

  if (id === 'linux') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        {/* Tux, le manchot Linux — pas un terminal générique. */}
        <path d="M12 2.2c-2.2 0-3.7 1.8-3.7 4.2 0 1.2.3 2.1.3 3 0 .8-.5 1.6-1.2 2.6-.9 1.3-1.8 2.9-1.8 4.5 0 1.7 1 2.8 2.5 2.8.7 0 1.3-.2 1.9-.5.4-.2.8-.3 1.2-.3s.8.1 1.2.3c.6.3 1.2.5 1.9.5 1.5 0 2.5-1.1 2.5-2.8 0-1.6-.9-3.2-1.8-4.5-.7-1-1.2-1.8-1.2-2.6 0-.9.3-1.8.3-3 0-2.4-1.5-4.2-3.7-4.2Z" />
        <ellipse cx="8.8" cy="20.8" rx="2.2" ry="1.1" />
        <ellipse cx="15.2" cy="20.8" rx="2.2" ry="1.1" />
        <ellipse cx="12" cy="15.2" rx="3.4" ry="4.2" fill="var(--dl-glyph-cut, var(--dl-bg))" />
        <circle cx="10.4" cy="5.4" r=".8" fill="var(--dl-glyph-cut, var(--dl-bg))" />
        <circle cx="13.6" cy="5.4" r=".8" fill="var(--dl-glyph-cut, var(--dl-bg))" />
        <path d="M10.9 7.3h2.2L12 8.7Z" fill="#f5a623" />
      </svg>
    );
  }

  if (id === 'android') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        {/* Tête du robot Android : antennes, yeux, bas plat. */}
        <path d="M12 4.2c-4.2 0-7.6 3.4-7.6 7.6V18h15.2v-6.2c0-4.2-3.4-7.6-7.6-7.6Z" />
        <path d="m7.2 4.6-1.1-2M16.8 4.6l1.1-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="9.2" cy="10.2" r=".95" fill="var(--dl-bg)" />
        <circle cx="14.8" cy="10.2" r=".95" fill="var(--dl-bg)" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* iPhone : contour, haut-parleur et bouton d’accueil. */}
      <rect x="6.4" y="1.8" width="11.2" height="20.4" rx="2.9" stroke="currentColor" strokeWidth="1.9" />
      <path d="M10.4 4.9h3.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10.5 19.2h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8h9M8.5 3.5 13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="m3.2 8.4 3 3L12.8 4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------- aperçu device */

function MockVideo({ video, small = false }: { video: (typeof MOCK_VIDEOS)[number]; small?: boolean }) {
  return (
    <div className={`dlm__video${small ? ' dlm__video--small' : ''}`}>
      <span className="dlm__thumb">
        <img src={video.thumb} alt="" loading="lazy" decoding="async" />
        <i>{video.duration}</i>
      </span>
      <span className="dlm__vtext">
        <b>{video.title}</b>
        <em>{video.meta}</em>
      </span>
    </div>
  );
}

/* ------------------------------------------------- écrans & chrome appareil */

type NavKind =
  | 'home'
  | 'shorts'
  | 'subs'
  | 'library'
  | 'activity'
  | 'moon'
  | 'apple'
  | 'user';

function NavGlyph({ kind }: { kind: NavKind }) {
  const base = { viewBox: '0 0 24 24', 'aria-hidden': true } as const;

  if (kind === 'home') {
    return (
      <svg {...base} fill="currentColor">
        <path d="M4 11.4 12 4l8 7.4V20h-5.4v-5.2h-5.2V20H4v-8.6Z" />
      </svg>
    );
  }
  if (kind === 'shorts') {
    return (
      <svg {...base} fill="currentColor">
        <rect x="4.6" y="3.4" width="14.8" height="17.2" rx="4.2" />
        <path d="m10 8.8 5.2 3.2L10 15.2V8.8Z" fill="var(--dl-bg)" />
      </svg>
    );
  }
  if (kind === 'subs') {
    return (
      <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4.5 7h15M4.5 12h15M4.5 17h9" />
        <circle cx="18.5" cy="17" r="1.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === 'library') {
    return (
      <svg {...base} fill="currentColor">
        <path d="M6 3.8h12v16.4l-6-3.9-6 3.9V3.8Z" />
      </svg>
    );
  }
  if (kind === 'activity') {
    return (
      <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.2 12h3.9l2.2-5.4 4.1 10.8 2.2-5.4h5.2" />
      </svg>
    );
  }
  if (kind === 'moon') {
    return (
      <svg {...base} fill="currentColor">
        <path d="M20.2 14.8A8.8 8.8 0 0 1 9.2 3.8a8.8 8.8 0 1 0 11 11Z" />
      </svg>
    );
  }
  if (kind === 'apple') {
    return (
      <svg {...base} fill="currentColor">
        <path d="M12.2 7.2c1.5 0 2.7.8 3.4 1.5.9-.8 2.1-1.4 3.4-1.4 0 5.8-2.2 10.5-6.8 10.5S5.4 13.1 5.4 7.3c1.3 0 2.5.6 3.4 1.4.7-.7 1.9-1.5 3.4-1.5Z" />
        <path d="M12 6.9c0-1.8.9-3.3 2.7-4.1.1 1.9-.9 3.4-2.7 4.1Z" />
      </svg>
    );
  }
  return (
    <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8.2" r="3.2" />
      <path d="M5.4 20c.6-4 3.2-6 6.6-6s6 2 6.6 6" />
    </svg>
  );
}

function Rail({ items }: { items: NavKind[] }) {
  return (
    <aside className="dlm__rail" aria-hidden>
      {items.map((kind, index) => (
        <span key={kind} className={index === 0 ? 'is-on' : undefined}>
          <NavGlyph kind={kind} />
        </span>
      ))}
    </aside>
  );
}

function BottomNav({ items }: { items: NavKind[] }) {
  return (
    <div className="dlm__pnav" aria-hidden>
      {items.map((kind, index) => (
        <span key={kind} className={index === 0 ? 'is-on' : undefined}>
          <NavGlyph kind={kind} />
        </span>
      ))}
    </div>
  );
}

/**
 * Barre système de chaque OS : Dock macOS, barre des tâches Windows, lanceur
 * GNOME. Le but n’est pas d’imiter pixel par pixel mais que chaque version se
 * reconnaisse au premier coup d’œil.
 */
function PlatformDock({ platform, app }: { platform: DownloadPlatform; app: DownloadApp }) {
  const appIcon = (
    <span className="dlm__dockApp is-open">
      <img src={app.icon} alt="" width={28} height={28} />
    </span>
  );

  if (platform.id === 'windows') {
    return (
      <div className="dlm__dock dlm__dock--windows" aria-hidden>
        <span className="dlm__start">
          <PlatformGlyph id="windows" />
        </span>
        <span className="dlm__dockSearch">
          <svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.3" stroke="currentColor" strokeWidth="1.5" /><path d="m10.2 10.2 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </span>
        {appIcon}
        <span className="dlm__clock">21:16</span>
      </div>
    );
  }

  if (platform.id === 'linux') {
    return (
      <div className="dlm__dock dlm__dock--linux" aria-hidden>
        <span className="dlm__start">
          <PlatformGlyph id="linux" />
        </span>
        <span className="dlm__dockDivider" />
        {appIcon}
        <span className="dlm__workspaces">
          <i className="is-on" />
          <i />
        </span>
      </div>
    );
  }

  return <div className="dlm__dock dlm__dock--macos" aria-hidden>{appIcon}</div>;
}

function VideoDesktop({ app }: { app: DownloadApp }) {
  return (
    <div className="dlm__app dlm__app--tube">
      <div className="dlm__top">
        <span className="dlm__brand">
          <img className="dlm__appMark" src={app.icon} alt="" />
          Séquence <i>FR</i>
        </span>
        <span className="dlm__search">Rechercher</span>
        <span className="dlm__avatar">
          <NavGlyph kind="user" />
        </span>
      </div>

      <div className="dlm__body">
        <Rail items={['home', 'shorts', 'subs', 'library']} />
        <div className="dlm__content">
          <div className="dlm__chips">
            <span className="is-on">Toutes</span>
            <span>Animation</span>
            <span>Musique</span>
            <span>Science</span>
          </div>
          <div className="dlm__grid">
            {MOCK_VIDEOS.map((video) => (
              <MockVideo key={video.title} video={video} />
            ))}
          </div>
          <div className="dlm__mini">
            <span className="dlm__miniThumb">
              <img src={YT_THUMBS.spring} alt="" loading="lazy" decoding="async" />
            </span>
            <span className="dlm__miniText">
              <b>Spring — Blender Open Movie</b>
              <em>mini-lecteur persistant</em>
            </span>
            <span className="dlm__miniBar">
              <i />
            </span>
            <span className="dlm__miniBtn">❚❚</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoMobile({ app }: { app: DownloadApp }) {
  return (
    <div className="dlm__papp dlm__papp--tube">
      <div className="dlm__ptop">
        <span className="dlm__pbrand">
          <img className="dlm__appMark" src={app.icon} alt="" /> Séquence
        </span>
        <span className="dlm__pavatar">
          <NavGlyph kind="user" />
        </span>
      </div>
      <div className="dlm__psearch">Rechercher</div>
      <div className="dlm__pchips">
        <span className="is-on">Toutes</span>
        <span>Animation</span>
        <span>Musique</span>
      </div>
      <div className="dlm__pfeature">
        <MockVideo video={MOCK_VIDEOS[0]} />
        <span className="dlm__pfeatureBar" aria-hidden>
          <i />
        </span>
      </div>
      <div className="dlm__plist">
        {MOCK_VIDEOS.slice(1, 3).map((video) => (
          <MockVideo key={video.title} video={video} small />
        ))}
      </div>
      <div className="dlm__pshelf">
        <span className="dlm__pshelfHead">Continuer à regarder</span>
        <span className="dlm__pshelfRow">
          {MOCK_VIDEOS.slice(2, 4).map((video) => (
            <span className="dlm__pshelfCard" key={video.title}>
              <span className="dlm__pshelfThumb">
                <img src={video.thumb} alt="" loading="lazy" decoding="async" />
                <em>{video.duration}</em>
                <span className="dlm__pshelfBar">
                  <i />
                </span>
              </span>
              <b>{video.title.replace(' — Blender Open Movie', '')}</b>
            </span>
          ))}
        </span>
      </div>
      <div className="dlm__pmini">
        <span className="dlm__pminiThumb">
          <img src={YT_THUMBS.spring} alt="" loading="lazy" decoding="async" />
        </span>
        <span className="dlm__pminiText">
          <b>Spring — Blender Open Movie</b>
          <em>mini-lecteur</em>
        </span>
        <span className="dlm__pminiBtn">❚❚</span>
      </div>
      <BottomNav items={['home', 'shorts', 'subs', 'library']} />
    </div>
  );
}

const PULSE_RINGS = [
  { value: '84%', ring: '#c9ff3d', main: '420', unit: 'kcal' },
  { value: '100%', ring: '#3ddc91', main: '32', unit: 'min' },
  { value: '90%', ring: '#ffb84d', main: '9', unit: 'h' },
];

function PulseRings({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`dlp__rings${compact ? ' dlp__rings--compact' : ''}`}>
      {PULSE_RINGS.map((ring) => (
        <span
          className="dlp__ring"
          key={ring.unit}
          style={{ '--p': ring.value, '--ring': ring.ring } as CSSProperties}
        >
          <span>
            <b>{ring.main}</b>
            <em>{ring.unit}</em>
          </span>
        </span>
      ))}
    </div>
  );
}

function HealthDesktop({ app }: { app: DownloadApp }) {
  return (
    <div className="dlm__app dlm__app--pulse">
      <div className="dlm__top">
        <span className="dlm__brand">
          <img className="dlm__appMark" src={app.icon} alt="" />
          Battement <i>AUJOURD’HUI</i>
        </span>
        <span className="dlp__date">Lun. 19 octobre</span>
        <span className="dlm__avatar">
          <NavGlyph kind="user" />
        </span>
      </div>

      <div className="dlm__body">
        <Rail items={['home', 'activity', 'moon', 'apple']} />
        <div className="dlm__content dlp__content">
          <div className="dlp__head">
            <b>Bonjour, Alessio.</b>
            <span>3 objectifs sur 4 tenus cette semaine.</span>
          </div>
          <PulseRings />
          <div className="dlp__stats">
            <span><b>8 420</b><em>pas</em></span>
            <span><b>7 h 32</b><em>sommeil</em></span>
            <span><b>72,4</b><em>kg</em></span>
          </div>
          <div className="dlp__cards">
            <div className="dlp__card">
              <span>Dernière séance</span>
              <b>Course · 5,2 km</b>
              <em>32 min · 412 kcal</em>
              <span className="dlp__spark" aria-hidden>
                {[34, 48, 40, 62, 55, 78, 68, 88, 74, 96].map((height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ))}
              </span>
            </div>
            <div className="dlp__card">
              <span>Sommeil</span>
              <b>7 h 32</b>
              <em>Qualité 86 %</em>
              <span className="dlp__bars" aria-hidden>
                {[42, 68, 54, 82, 74, 92, 66].map((height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthMobile({ app }: { app: DownloadApp }) {
  return (
    <div className="dlm__papp dlp__papp">
      <div className="dlm__ptop">
        <span className="dlm__pbrand">
          <img className="dlm__appMark" src={app.icon} alt="" /> Battement
        </span>
        <span className="dlm__pavatar">
          <NavGlyph kind="user" />
        </span>
      </div>
      <div className="dlp__pdate">Aujourd’hui · 19 octobre</div>
      <PulseRings compact />
      <div className="dlp__pstats">
        <span><b>8 420</b><em>pas</em></span>
        <span><b>7 h 32</b><em>sommeil</em></span>
        <span><b>1 840</b><em>kcal</em></span>
      </div>
      <div className="dlp__pcard">
        <span>Dernière séance</span>
        <b>Course · 5,2 km</b>
        <em>32 min · 412 kcal</em>
        <span className="dlp__spark" aria-hidden>
          {[34, 52, 44, 70, 58, 84, 72, 96].map((height, index) => (
            <i key={index} style={{ height: `${height}%` }} />
          ))}
        </span>
      </div>
      <div className="dlp__pcard">
        <span>Sommeil</span>
        <b>7 h 32</b>
        <em>Qualité 86 % · 4 cycles</em>
        <span className="dlp__bars" aria-hidden>
          {[42, 68, 54, 82, 74, 92, 66].map((height, index) => (
            <i key={index} style={{ height: `${height}%` }} />
          ))}
        </span>
      </div>
      <div className="dlp__pcard">
        <span>Nutrition</span>
        <b>112 g protéines</b>
        <em>204 g glucides · 62 g lipides</em>
      </div>
      <div className="dlp__pcard">
        <span>Cette semaine</span>
        <b>4 séances · 2 h 08</b>
        <span className="dlp__pweek" aria-hidden>
          {[36, 72, 8, 54, 88, 8, 62].map((height, index) => (
            <i
              key={index}
              className={height < 10 ? 'is-rest' : undefined}
              style={{ height: `${height}%` }}
            />
          ))}
        </span>
      </div>
      <div className="dlp__pcoach">
        <span>Coach</span>
        <b>Demain · footing 30 min</b>
        <em>Zone 2 · récupération</em>
      </div>
      <BottomNav items={['home', 'activity', 'moon', 'apple']} />
    </div>
  );
}

/**
 * Même parti pris que sur le bureau : la version mobile montre l’écran de
 * l’app, pas son icône — mix, titres et mini-lecteur, dans le cadre du
 * téléphone.
 */
function PortéeMobile({ app }: { app: DownloadApp }) {
  return (
    <div className="dlm__papp dlm__papp--spot">
      <div className="dlm__ptop">
        <span className="dlm__pbrand">
          <img className="dlm__appMark" src={app.icon} alt="" /> Portée
        </span>
        <span className="dlm__pavatar">
          <NavGlyph kind="user" />
        </span>
      </div>

      <div className="dlm__pspotGreet">
        <b>Bonsoir</b>
        <em>Vos mix du moment</em>
      </div>

      <div className="dlm__pspotMixes">
        {MIXES.slice(0, 2).map((mix) => (
          <span className="dlm__pspotMix" key={mix.name}>
            <span className="dlm__pspotCover">
              <img src={mix.covers[0]} alt="" loading="lazy" decoding="async" />
            </span>
            <b>{mix.name}</b>
          </span>
        ))}
      </div>

      <span className="dlm__pspotHead">Titres populaires</span>
      <div className="dlm__pspotList">
        {TRACKS.slice(0, 3).map((track, index) => (
          <span className="dlm__pspotRow" key={track.title}>
            <em className="dlm__pspotNum">{String(index + 1).padStart(2, '0')}</em>
            <img src={track.cover} alt="" loading="lazy" decoding="async" />
            <span className="dlm__pspotText">
              <b>{track.title}</b>
              <em>{track.artist}</em>
            </span>
          </span>
        ))}
      </div>

      <span className="dlm__pspotHead">Récemment écouté</span>
      <div className="dlm__pspotShelf">
        {TRACKS.slice(3).map((track) => (
          <span className="dlm__pspotTile" key={track.title}>
            <img src={track.cover} alt="" loading="lazy" decoding="async" />
            <b>{track.title}</b>
          </span>
        ))}
      </div>

      <div className="dlm__pmini">
        <span className="dlm__pminiThumb">
          <img src={TRACKS[0].cover} alt="" loading="lazy" decoding="async" />
        </span>
        <span className="dlm__pminiText">
          <b>{TRACKS[0].title}</b>
          <em>{TRACKS[0].artist}</em>
        </span>
        <span className="dlm__pminiBtn">❚❚</span>
      </div>
      <BottomNav items={['home', 'library', 'user']} />
    </div>
  );
}

function PortéeDesktop({ app }: { app: DownloadApp }) {
  return (
    <div className="dlm__app dlm__app--spotify">
      <div className="dlm__spotTop">
        <span className="dlm__spotArrows" aria-hidden>
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg viewBox="0 0 16 16" fill="none">
            <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="dlm__spotSearch">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="4.1" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.1 10.1 3.1 3.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Rechercher
        </span>
        <span className="dlm__avatar">
          <NavGlyph kind="user" />
        </span>
      </div>

      <div className="dlm__spotBody">
        <aside className="dlm__spotSide">
          <span className="dlm__spotBrand">
            <img src={app.icon} alt="" />
            Portée
          </span>
          <span className="is-on">Accueil</span>
          <span>Rechercher</span>
          <span>Bibliothèque</span>
          <span className="dlm__spotRule" />
          <span className="dlm__spotSideLabel">Vos mix</span>
          {MIXES.map((mix) => (
            <span className="dlm__spotSideItem" key={mix.name}>
              {mix.name}
            </span>
          ))}
        </aside>

        <div className="dlm__spotMain">
          <div className="dlm__spotGreet">
            <b>Bonsoir</b>
            <span>Vos mix du moment</span>
          </div>

          <div className="dlm__spotMixes">
            {MIXES.map((mix) => (
              <span className="dlm__spotMix" key={mix.name}>
                <span className="dlm__spotCovers">
                  {mix.covers.map((cover) => (
                    <img key={cover} src={cover} alt="" loading="lazy" decoding="async" />
                  ))}
                </span>
                <b>{mix.name}</b>
                <em>{mix.meta}</em>
              </span>
            ))}
          </div>

          <div className="dlm__spotTracks">
            <span className="dlm__spotTracksHead">Titres populaires</span>
            {TRACKS.slice(0, 4).map((track, index) => (
              <span className="dlm__spotTrack" key={track.title}>
                <em className="dlm__spotTrackNum">{String(index + 1).padStart(2, '0')}</em>
                <img src={track.cover} alt="" loading="lazy" decoding="async" />
                <span className="dlm__spotTrackText">
                  <b>{track.title}</b>
                  <em>{track.artist}</em>
                </span>
                <em className="dlm__spotTrackTime">{track.duration}</em>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="dlm__spotBar">
        <img className="dlm__spotBarCover" src={TRACKS[0].cover} alt="" loading="lazy" decoding="async" />
        <span className="dlm__spotBarText">
          <b>{TRACKS[0].title}</b>
          <em>{TRACKS[0].artist}</em>
        </span>
        <span className="dlm__spotControls" aria-hidden>
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M6.2 3.4 2.4 8l3.8 4.6V3.4Zm6.2 0L8.6 8l3.8 4.6V3.4Z" />
          </svg>
          <svg className="is-play" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" opacity=".16" />
            <path d="M9.2 7.4 17 12l-7.8 4.6V7.4Z" />
          </svg>
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.8 3.4 13.6 8l-3.8 4.6V3.4Zm-6.2 0L7.4 8l-3.8 4.6V3.4Z" />
          </svg>
        </span>
        <span className="dlm__spotProgress" aria-hidden>
          <i />
        </span>
        <span className="dlm__spotTime">1:12</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------- chrome de fenêtre par OS */

function WindowChrome({
  platform,
  app,
  kind,
  url,
  tag,
}: {
  platform: DownloadPlatform;
  app: DownloadApp;
  kind: 'web' | 'native';
  url: string;
  tag?: ReactNode;
}) {
  const installed = (
    <span className="dlm__installed">
      <i /> Installée
    </span>
  );

  const controls = (
    <span className={`dlm__winControls dlm__winControls--${platform.id}`} aria-hidden>
      <i>–</i>
      <i>□</i>
      <i>×</i>
    </span>
  );

  if (platform.id === 'macos') {
    return (
      <div className={`dlm__chrome dlm__chrome--mac dlm__chrome--${kind}`}>
        <span className="dlm__dots">
          <i />
          <i />
          <i />
        </span>
        {kind === 'web' ? (
          <span className="dlm__url">{url}</span>
        ) : (
          <span className="dlm__chromeTitle">{app.name}</span>
        )}
        <span className="dlm__winRight">
          {tag}
          {kind === 'web' ? installed : null}
        </span>
      </div>
    );
  }

  if (platform.id === 'windows') {
    return (
      <div className={`dlm__chrome dlm__chrome--win dlm__chrome--${kind}`}>
        <span className="dlm__titleRow">
          <span className="dlm__tab">
            <img src={app.icon} alt="" />
            {app.name}
          </span>
          <span className="dlm__winRight">
            {tag}
            {controls}
          </span>
        </span>
        {kind === 'web' ? (
          <span className="dlm__addressRow">
            <span className="dlm__shield" aria-hidden>
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 1.8 13 3.4v4.2c0 3-2.1 5.4-5 6.6-2.9-1.2-5-3.6-5-6.6V3.4L8 1.8Z" stroke="currentColor" strokeWidth="1.3" />
                <path d="m5.8 8 1.6 1.6L10.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="dlm__url">{url}</span>
            {installed}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`dlm__chrome dlm__chrome--linux dlm__chrome--${kind}`}>
      <span className="dlm__titleRow">
        <span className="dlm__tab">
          <img src={app.icon} alt="" />
          {app.name}
        </span>
        <span className="dlm__winRight">
          {tag}
          {kind === 'native' ? (
            <span className="dlm__winControls dlm__winControls--close" aria-hidden>
              <i>×</i>
            </span>
          ) : (
            controls
          )}
        </span>
      </span>
      {kind === 'web' ? (
        <span className="dlm__addressRow">
          <span className="dlm__url">{url}</span>
          {installed}
        </span>
      ) : null}
    </div>
  );
}

function DesktopFrame({
  platform,
  app,
  kind = 'web',
  tag,
  label,
  children,
}: {
  platform: DownloadPlatform;
  app: DownloadApp;
  kind?: 'web' | 'native';
  tag?: ReactNode;
  label?: string;
  children: ReactNode;
}) {
  const url =
    app.id === 'pulsecraft'
      ? 'battement.app / aujourd’hui'
      : app.id === 'spotifycraft'
        ? 'portee.app / bibliothèque'
        : 'sequence.app / accueil';
  const caption =
    label ??
    (platform.id === 'macos'
      ? 'Fenêtre macOS · Dock'
      : platform.id === 'windows'
        ? 'Fenêtre Windows · barre des tâches'
        : 'Fenêtre Linux · lanceur');

  return (
    <div className={`dlm dlm--desktop dlm--${platform.id}`} aria-hidden>
      <div className="dlm__window">
        <WindowChrome platform={platform} app={app} kind={kind} url={url} tag={tag} />
        {children}
      </div>
      <PlatformDock platform={platform} app={app} />
      <span className="dlm__deviceLabel">
        <i />
        {caption}
      </span>
    </div>
  );
}

/* ----------------------------------------------------- barre d’état mobile */

function StatusGlyphs() {
  return (
    <span className="dlm__statusIcons" aria-hidden>
      <svg className="dlm__signal" viewBox="0 0 18 12" fill="currentColor">
        <rect x="0" y="7.4" width="2.6" height="4.6" rx=".7" />
        <rect x="4" y="5.2" width="2.6" height="6.8" rx=".7" />
        <rect x="8" y="3" width="2.6" height="9" rx=".7" />
        <rect x="12" y=".8" width="2.6" height="11.2" rx=".7" />
      </svg>
      <svg className="dlm__wifi" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M1.7 4.7a9.3 9.3 0 0 1 12.6 0" />
        <path d="M4.1 7.3a6 6 0 0 1 7.8 0" />
        <circle cx="8" cy="10.1" r=".9" fill="currentColor" stroke="none" />
      </svg>
      <svg className="dlm__battery" viewBox="0 0 26 12" fill="none">
        <rect x=".6" y=".6" width="21.8" height="10.8" rx="3" stroke="currentColor" strokeWidth="1.2" opacity=".5" />
        <rect x="2.4" y="2.4" width="14.4" height="7.2" rx="1.8" fill="currentColor" />
        <path d="M24 4.2v3.6a2 2 0 0 0 0-3.6Z" fill="currentColor" opacity=".5" />
      </svg>
    </span>
  );
}

function PhoneFrame({
  platform,
  label,
  children,
}: {
  platform: DownloadPlatform;
  /** légende du cadre : le canal diffère entre web app et app native */
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className={`dlm dlm--mobile dlm--${platform.id}`} aria-hidden>
      <div className="dlm__phone">
        <span className="dlm__notch" />
        <div className="dlm__status">
          <span>{platform.id === 'ios' ? '9:41' : '21:16'}</span>
          <StatusGlyphs />
        </div>
        {children}
        <span className="dlm__homebar" />
      </div>
      <span className="dlm__deviceLabel">
        <i />
        {label ?? (platform.id === 'ios' ? 'iPhone · Safari' : 'Android · Chrome')}
      </span>
    </div>
  );
}

function DeviceMock({ app, platform }: { app: DownloadApp; platform: DownloadPlatform }) {
  const pulse = app.id === 'pulsecraft';

  if (platform.family === 'mobile') {
    return (
      <PhoneFrame platform={platform}>
        {pulse ? <HealthMobile app={app} /> : <VideoMobile app={app} />}
      </PhoneFrame>
    );
  }

  return (
    <DesktopFrame platform={platform} app={app}>
      {pulse ? <HealthDesktop app={app} /> : <VideoDesktop app={app} />}
    </DesktopFrame>
  );
}

/* --------------------------------------------------------- aperçu app native */

/**
 * Les apps natives n’ont pas d’interface navigateur à imiter : on montre le
 * binaire lui-même — icône, version, format — dans une fenêtre sobre.
 */
function NativeMock({ app, platform }: { app: DownloadApp; platform: DownloadPlatform }) {
  const pending = app.releaseState === 'pending';

  /* Une app native sur téléphone n’a pas de fenêtre : on garde le même
     aperçu dépouillé (icône, nom, canal de distribution) dans un cadre de
     téléphone, pour ne pas montrer un Dock macOS sur un écran Android. */
  if (platform.family === 'mobile') {
    const testflight = platform.delivery === 'testflight';

    return (
      <PhoneFrame
        platform={platform}
        label={
          testflight
            ? `iPhone · TestFlight${pending ? ' · aperçu' : ''}`
            : `Android · APK${pending ? ' · aperçu' : ''}`
        }
      >
        {app.id === 'spotifycraft' ? (
          <PortéeMobile app={app} />
        ) : (
          <div className="dln__body dln__body--phone">
            <span className="dln__icon">
              <img src={app.icon} alt="" width={132} height={132} loading="lazy" decoding="async" />
            </span>
            <strong className="dln__name">{app.name}</strong>
            <span className="dln__meta">{platform.file ?? platform.detail}</span>
            {pending ? <span className="dlm__previewTag">Aperçu · non publié</span> : null}
          </div>
        )}
      </PhoneFrame>
    );
  }

  return (
    <DesktopFrame
      platform={platform}
      app={app}
      kind="native"
      tag={
        pending ? <span className="dlm__previewTag">Aperçu · non publié</span> : null
      }
      label={`Application native · ${platform.short}${pending ? ' · aperçu' : ''}`}
    >
      {app.id === 'spotifycraft' ? (
        <PortéeDesktop app={app} />
      ) : (
        <div className="dln__body">
          <span className="dln__icon">
            <img src={app.icon} alt="" width={132} height={132} loading="lazy" decoding="async" />
          </span>
          <strong className="dln__name">{app.name}</strong>
          <span className="dln__meta">{platform.file ?? platform.detail}</span>
        </div>
      )}
    </DesktopFrame>
  );
}

/* -------------------------------------------------------------------- écran */

export function DownloadShowcase({
  appHref,
  githubHref,
  Link,
  variant = 'section',
  sectionTitle,
  sectionLede,
  appIds = ['tubecraft'],
}: Props) {
  const apps = appIds.map(findDownloadApp);
  const [activeAppId, setActiveAppId] = useState<DownloadAppId>(apps[0].id);
  const app = apps.find((entry) => entry.id === activeAppId) ?? apps[0];
  const platforms = app.platforms;
  const [activeId, setActiveId] = useState<DownloadPlatformId>(() => {
    const detected = detectPlatform();
    return platforms.some((platform) => platform.id === detected) ? detected : platforms[0].id;
  });
  const [installNote, setInstallNote] = useState('');
  const { available, installed, promptInstall } = useInstallPrompt();
  const tabsId = useId();
  const active = platforms.find((platform) => platform.id === activeId) ?? platforms[0];
  /** app native dont rien n’est encore publié : on ne promet aucun fichier */
  const pending = app.mode === 'native' && app.releaseState === 'pending';
  /**
   * URL de lancement : l’app de ce dépôt est servie par la page elle-même, les
   * autres apportent la leur. Sans adresse connue, on renvoie vers le code.
   */
  const launchHref = app.self ? appHref : (app.launchHref ?? null);
  /**
   * L’invite d’installation ne concerne que l’app servie par cette page : on ne
   * peut pas installer Battement depuis la page de Séquence.
   */
  const canPrompt =
    Boolean(app.self) &&
    app.mode === 'web' &&
    variant === 'page' &&
    available &&
    !installed &&
    active.id !== 'ios';

  const selectApp = (next: DownloadApp) => {
    if (next.id === app.id) return;
    // On garde la plateforme quand elle existe des deux côtés, sinon on
    // retombe sur celle de l’appareil puis sur la première de l’app.
    const detected = detectPlatform();
    const chosen =
      next.platforms.find((platform) => platform.id === activeId) ??
      next.platforms.find((platform) => platform.id === detected) ??
      next.platforms[0];
    setActiveAppId(next.id);
    setActiveId(chosen.id);
    setInstallNote('');
  };

  const moveTab = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = platforms.findIndex((platform) => platform.id === activeId);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? platforms.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + platforms.length) %
            platforms.length;
    const nextId = platforms[next].id;
    setActiveId(nextId);
    setInstallNote('');
    window.requestAnimationFrame(() => document.getElementById(`${tabsId}-${nextId}`)?.focus());
  };

  const onInstall = async () => {
    if (!canPrompt) {
      setInstallNote('Votre navigateur ne propose pas l’installation en un clic : suivez les étapes ci-dessous.');
      return;
    }
    const outcome = await promptInstall();
    setInstallNote(
      outcome === 'accepted'
        ? 'Séquence est installée. Vous pouvez la lancer depuis votre Dock, votre menu Démarrer ou votre écran d’accueil.'
        : outcome === 'dismissed'
          ? 'Installation annulée. Vous pouvez la relancer quand vous voulez.'
          : 'L’installation n’est pas disponible pour le moment : suivez les étapes ci-dessous.'
    );
  };

  return (
    <section
      className={`dl${variant === 'page' ? ' dl--page' : ''}`}
      id={variant === 'section' ? 'telecharger' : undefined}
      data-tour={variant === 'section' ? 'telecharger' : undefined}
      data-app={app.id}
    >
      <header className="dl__head">
        {variant === 'section' ? (
          <p className="dl__kicker">
            <span>04</span> Télécharger
          </p>
        ) : (
          <p className="dl__kicker">
            <span className="dl__kickerDot" /> Installation officielle ·{' '}
            {app.mode === 'native' ? 'binaire natif' : 'web app'}
          </p>
        )}

        <div className="dl__headRow">
          {variant === 'page' ? (
            <h1 className="dl__title">
              {app.name}, <em>{app.emphasis}</em>.
            </h1>
          ) : (
            <h2 className="dl__title">
              {sectionTitle ?? (
                <>
                  {app.name}, <em>{app.emphasis}</em>.
                </>
              )}
            </h2>
          )}
          <p className="dl__lede">{sectionLede ?? app.lede}</p>
        </div>

        <ul className="dl__badges" aria-label="Avantages">
          {app.badges.map((badge) => (
            <li key={badge}>
              <Check /> {badge}
            </li>
          ))}
        </ul>
      </header>

      {/* ----------------------------------------------------------------
          Le catalogue : une ligne par application, avec ses plateformes.

          Les trois apps de la collection sont visibles en même temps —
          on compare avant de choisir, au lieu de remplir un formulaire
          d'onglets. Cliquer une plateforme cible l'app et la plateforme.
          ---------------------------------------------------------------- */}
      {apps.length > 1 ? (
        <div className="dl__catalog" role="group" aria-label="Choisir une application">
          {apps.map((entry, index) => (
            <div
              className="dl__row"
              key={entry.id}
              data-on={entry.id === app.id}
              style={{ '--dl-app-accent': entry.accent } as CSSProperties}
            >
              <span className="dl__rowNum" aria-hidden>
                {String(index + 1).padStart(2, '0')}
              </span>

              <button
                type="button"
                className="dl__rowApp"
                aria-pressed={entry.id === app.id}
                onClick={() => selectApp(entry)}
              >
                <span className="dl__appIcon">
                  <img src={entry.icon} alt="" width={40} height={40} loading="lazy" decoding="async" />
                </span>
                <span className="dl__appText">
                  <strong>{entry.name}</strong>
                  <em>{entry.summary}</em>
                </span>
              </button>

              <div className="dl__rowPlatforms" role="group" aria-label={`Plateformes — ${entry.name}`}>
                {entry.platforms.map((platform) => {
                  const on = entry.id === app.id && platform.id === active.id;
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      className={`dl__platform${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      onClick={() => {
                        if (entry.id !== app.id) selectApp(entry);
                        setActiveId(platform.id);
                        setInstallNote('');
                      }}
                    >
                      <PlatformGlyph id={platform.id} />
                      <span>{platform.name}</span>
                    </button>
                  );
                })}
              </div>

              <span
                className={`dl__rowState${
                  entry.mode === 'native' && entry.releaseState === 'pending' ? ' is-pending' : ''
                }`}
              >
                {entry.mode === 'native' && entry.releaseState === 'pending'
                  ? 'En préparation'
                  : entry.mode === 'native'
                    ? `Publiée v${entry.version ?? '—'}`
                    : 'Disponible'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        /* Une seule app : le choix de plateforme reste une barre à part. */
        <div
          className="dl__platforms"
          role="tablist"
          aria-label="Choisir une plateforme"
          onKeyDown={moveTab}
        >
          {platforms.map((platform) => (
            <button
              key={platform.id}
              type="button"
              role="tab"
              id={`${tabsId}-${platform.id}`}
              aria-selected={platform.id === activeId}
              aria-controls={`${tabsId}-${platform.id}-panel`}
              tabIndex={platform.id === activeId ? 0 : -1}
              className={`dl__platform dl__platform--lg${platform.id === activeId ? ' is-on' : ''}`}
              onClick={() => {
                setActiveId(platform.id);
                setInstallNote('');
              }}
            >
              <span className="dl__platformIcon">
                <PlatformGlyph id={platform.id} />
              </span>
              <span className="dl__platformText">
                <strong>{platform.name}</strong>
                <em>{platform.family === 'mobile' ? 'Mobile' : 'Ordinateur'}</em>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Le dossier : le détail de l'app et de la plateforme choisies. */}
      <div
        className="dl__panel"
        key={active.id}
        role={variant === 'page' ? 'tabpanel' : undefined}
        id={variant === 'page' ? `${tabsId}-${active.id}-panel` : undefined}
        aria-labelledby={variant === 'page' ? `${tabsId}-${active.id}` : undefined}
        tabIndex={0}
      >
        <div className="dl__panelTop">
          <span className="dl__panelApp">
            <img src={app.icon} alt="" width={22} height={22} loading="lazy" decoding="async" />
            {app.name}
          </span>
          <span className="dl__panelKind">
            <PlatformGlyph id={active.id} /> {active.detail}
          </span>
          <span
            className={[
              'dl__status',
              app.mode === 'web' && app.self && installed ? 'is-installed' : '',
              pending ? 'is-pending' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <i />
            {app.mode === 'native'
              ? pending
                ? 'Binaires en préparation'
                : `Build natif · v${app.version ?? '—'}`
              : app.self && installed
                ? 'Installée sur cet appareil'
                : 'Disponible · installation navigateur'}
          </span>
        </div>

        <div className="dl__panelBody">
          <div className="dl__copy">
            <p className="dl__tagline">{active.tagline}</p>
            <p className="dl__intro">{active.intro}</p>

            <div className="dl__ctaRow">
              {app.mode === 'native' ? (
                <>
                  {app.releasesHref ? (
                    <a
                      className="dl__cta"
                      href={app.releasesHref}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {pending ? 'Suivre les versions' : 'Télécharger sur GitHub'} <Arrow />
                    </a>
                  ) : null}
                  {app.sourceHref ? (
                    <a
                      className="dl__cta dl__cta--ghost"
                      href={app.sourceHref}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Code source <Arrow />
                    </a>
                  ) : null}
                </>
              ) : (
                <>
                  {variant === 'page' && active.id !== 'ios' ? (
                    <button type="button" className="dl__cta" onClick={onInstall}>
                      {installed ? (
                        <>
                          <Check /> {app.name} est installée
                        </>
                      ) : (
                        <>
                          Installer sur {active.short} <Arrow />
                        </>
                      )}
                    </button>
                  ) : null}

                  {launchHref ? (
                    <Link
                      className={`dl__cta${variant === 'page' && active.id !== 'ios' ? ' dl__cta--ghost' : ''}`}
                      href={launchHref}
                    >
                      {active.id === 'ios' ? 'Ouvrir dans Safari' : `Ouvrir sur ${active.short}`}
                      <Arrow />
                    </Link>
                  ) : (
                    <a
                      className={`dl__cta${variant === 'page' && active.id !== 'ios' ? ' dl__cta--ghost' : ''}`}
                      href={githubHref}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Voir sur GitHub <Arrow />
                    </a>
                  )}
                </>
              )}
            </div>

            {installNote ? (
              <p className="dl__installNote" role="status">
                {installNote}
              </p>
            ) : null}

            {pending ? (
              <p className="dl__stepsLead">
                Dès la première publication, voici comment ça se passera :
              </p>
            ) : null}

            <ol className="dl__steps">
              {active.steps.map((step, index) => (
                <li key={step.title}>
                  <span className="dl__stepNum">{String(index + 1).padStart(2, '0')}</span>
                  <span className="dl__stepText">
                    <strong>{step.title}</strong>
                    <span>{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>

            <p className="dl__requirement">
              <span>Prérequis</span> {active.requirement}
            </p>
            <p className="dl__note">{active.note}</p>
          </div>

          <div className="dl__preview">
            {app.mode === 'native' ? (
              <NativeMock app={app} platform={active} />
            ) : (
              <DeviceMock app={app} platform={active} />
            )}
          </div>
        </div>
      </div>

      <ul className="dl__facts">
        {app.facts.map((fact) => (
          <li key={fact.label}>
            <strong>{fact.value}</strong>
            <span>{fact.label}</span>
            <p>{fact.text}</p>
          </li>
        ))}
      </ul>

      <p className="dl__fineprint">
        <span aria-hidden>✳</span> {app.note}
      </p>
    </section>
  );
}
