import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  findDownloadApp,
  type DownloadApp,
  type DownloadAppId,
  type DownloadPlatform,
  type DownloadPlatformId,
} from '../../data/downloads';
import { useInstallPrompt } from '../../lib/pwa';
import { YT_THUMBS } from '../showcase/media';

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
   * Apps proposées, dans l’ordre d’affichage. La route interne de TubeCraft
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
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="2.6" y="3.6" width="18.8" height="16.8" rx="4" stroke="currentColor" strokeWidth="1.7" />
        <path d="m7 9 2.6 3L7 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.4 15.4H17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (id === 'android') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M7.2 6.1 5.9 3.9a.6.6 0 0 1 1-.6l1.4 2.2A8.7 8.7 0 0 1 12 4.8c1.3 0 2.6.3 3.7.7l1.4-2.2a.6.6 0 0 1 1 .6l-1.3 2.2A7.1 7.1 0 0 1 20 11H4a7.1 7.1 0 0 1 3.2-4.9Zm1.9 2.5a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6Zm5.8 0a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6ZM4 12.2h16v5.1a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 17.3v-5.1Zm-2.4.2a1.3 1.3 0 0 1 2.6 0v3.4a1.3 1.3 0 0 1-2.6 0v-3.4Zm18.2 0a1.3 1.3 0 0 1 2.6 0v3.4a1.3 1.3 0 0 1-2.6 0v-3.4ZM7.4 20.7v2a1.2 1.2 0 0 1-2.4 0v-2h2.4Zm11.6 0v2a1.2 1.2 0 0 1-2.4 0v-2H19Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5.2" y="1.8" width="13.6" height="20.4" rx="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.4 2.2h5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10.4 4.2h3.2a.8.8 0 0 1 0 1.6h-3.2a.8.8 0 0 1 0-1.6Z" fill="currentColor" />
      <path d="M11 19.4h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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

function DeviceMock({ platform }: { platform: DownloadPlatform }) {
  const mobile = platform.family === 'mobile';

  if (mobile) {
    return (
      <div className={`dlm dlm--mobile dlm--${platform.id}`} aria-hidden>
        <div className="dlm__phone">
          <span className="dlm__notch" />
          <div className="dlm__status">
            <span>9:41</span>
            <span className="dlm__statusRight">
              <i />
              <i />
              <i />
            </span>
          </div>

          <div className="dlm__papp">
            <div className="dlm__ptop">
              <span className="dlm__pbrand">
                <b>▶</b> TubeCraft
              </span>
              <span className="dlm__pavatar" />
            </div>
            <div className="dlm__psearch">Rechercher</div>
            <div className="dlm__pchips">
              <span className="is-on">Toutes</span>
              <span>Animation</span>
              <span>Musique</span>
            </div>
            <div className="dlm__pgrid">
              {MOCK_VIDEOS.slice(0, 4).map((video) => (
                <MockVideo key={video.title} video={video} small />
              ))}
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
              <span className="dlm__pminiBar">
                <i />
              </span>
            </div>
          </div>

          <div className="dlm__pnav">
            <span className="is-on">⌂</span>
            <span>▤</span>
            <span>▷</span>
            <span>◉</span>
          </div>
          <span className="dlm__homebar" />
        </div>
        <span className="dlm__deviceLabel">
          <i />
          {platform.id === 'ios' ? 'iPhone · Safari' : 'Android · Chrome'}
        </span>
      </div>
    );
  }

  return (
    <div className={`dlm dlm--desktop dlm--${platform.id}`} aria-hidden>
      <div className="dlm__browser">
        <span className="dlm__dots">
          <i />
          <i />
          <i />
        </span>
        <span className="dlm__url">tubecraft.app / accueil</span>
        <span className="dlm__installed">
          <i />
          Installée
        </span>
      </div>

      <div className="dlm__app">
        <div className="dlm__top">
          <span className="dlm__brand">
            <b>▶</b> TubeCraft <i>FR</i>
          </span>
          <span className="dlm__search">Rechercher</span>
          <span className="dlm__avatar" />
        </div>

        <div className="dlm__body">
          <aside className="dlm__rail">
            <span className="is-on" />
            <span />
            <span />
            <span />
          </aside>
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

      <span className="dlm__deviceLabel">
        <i />
        {platform.id === 'macos' ? 'Fenêtre macOS · Dock' : platform.id === 'windows' ? 'Fenêtre Windows · barre des tâches' : 'Fenêtre Linux · lanceur'}
      </span>
    </div>
  );
}

/* --------------------------------------------------------- aperçu app native */

/**
 * Les apps natives n’ont pas d’interface navigateur à imiter : on montre le
 * binaire lui-même — icône, version, format — dans une fenêtre sobre.
 */
function NativeMock({ app, platform }: { app: DownloadApp; platform: DownloadPlatform }) {
  const pending = app.releaseState === 'pending';

  return (
    <div className="dln" aria-hidden>
      <div className="dln__win">
        <div className="dln__bar">
          <span className="dlm__dots">
            <i />
            <i />
            <i />
          </span>
          <span className="dln__title">{app.name}</span>
          <span className="dln__barTag">{platform.short}</span>
        </div>

        <div className="dln__body">
          <span className="dln__icon">
            <img src={app.icon} alt="" width={132} height={132} loading="lazy" decoding="async" />
          </span>
          <strong className="dln__name">{app.name}</strong>
          <span className="dln__meta">
            {pending
              ? `Format prévu · ${platform.file ?? platform.detail}`
              : `Version ${app.version} · ${platform.file ?? platform.detail}`}
          </span>
          {pending ? (
            <span className="dln__trust dln__trust--pending">
              Pas encore publié · à chaque version ensuite
            </span>
          ) : (
            <span className="dln__trust">{platform.trust}</span>
          )}
        </div>
      </div>

      <span className="dlm__deviceLabel">
        <i />
        {`Application native · ${platform.short}`}
      </span>
    </div>
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
   * peut pas installer PulseCraft depuis la page de TubeCraft.
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
        ? 'TubeCraft est installée. Vous pouvez la lancer depuis votre Dock, votre menu Démarrer ou votre écran d’accueil.'
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

      {apps.length > 1 ? (
        <div className="dl__apps" role="group" aria-label="Choisir une application">
          {apps.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={entry.id === app.id}
              data-app={entry.id}
              className={`dl__appBtn${entry.id === app.id ? ' is-on' : ''}`}
              onClick={() => selectApp(entry)}
            >
              <span className="dl__appIcon">
                <img src={entry.icon} alt="" width={46} height={46} loading="lazy" decoding="async" />
              </span>
              <span className="dl__appText">
                <strong>{entry.name}</strong>
                <em>{entry.summary}</em>
              </span>
              <span className="dl__appCheck" aria-hidden>
                <Check />
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="dl__stage">
        <div
          className="dl__tabs"
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
              className={`dl__tab${platform.id === activeId ? ' is-on' : ''}`}
              onClick={() => {
                setActiveId(platform.id);
                setInstallNote('');
              }}
            >
              <span className="dl__tabIcon">
                <PlatformGlyph id={platform.id} />
              </span>
              <span className="dl__tabText">
                <strong>{platform.name}</strong>
                <em>{platform.family === 'mobile' ? 'Mobile' : 'Ordinateur'}</em>
              </span>
              <span className="dl__tabCheck" aria-hidden>
                <Check />
              </span>
            </button>
          ))}
        </div>

        <div
          className="dl__panel"
          key={active.id}
          role="tabpanel"
          id={`${tabsId}-${active.id}-panel`}
          aria-labelledby={`${tabsId}-${active.id}`}
          tabIndex={0}
        >
          <div className="dl__panelTop">
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
                <DeviceMock platform={active} />
              )}
            </div>
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
