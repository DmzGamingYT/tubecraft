import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { SP_MIXES, SP_TRACKS, YT_THUMBS as TC_THUMBS } from './media';

/**
 * Démos animées des interfaces, intégrées à la vitrine.
 *
 * Ce ne sont pas des vidéos : ce sont de vraies maquettes HTML/CSS qui bouclent
 * comme un extrait vidéo (progression, égaliseur, curseur, transitions). Elles
 * restent nettes à toutes les tailles, se mettent en pause hors écran et
 * respectent `prefers-reduced-motion`. Les vignettes et les pochettes sont les
 * vraies images des apps.
 */

interface DemoRuntime {
  paused: boolean;
  inView: boolean;
  setStatus: (status: string) => void;
  setUrl: (url: string) => void;
}

const DemoRuntimeContext = createContext<DemoRuntime | null>(null);

function useDemoRuntime() {
  return useContext(DemoRuntimeContext);
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

function useInView<T extends HTMLElement>(ref: React.RefObject<T>) {
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? true),
      { rootMargin: '240px 0px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return inView;
}

interface DemoFrameProps {
  url: string;
  label: string;
  tone?: 'dark' | 'light';
  children: ReactNode;
  /** clic sur l'écran : ouvre la galerie dédiée */
  onOpen?: () => void;
}

export function DemoFrame({ url, label, tone = 'dark', children, onOpen }: DemoFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState('');
  const [address, setUrl] = useState(url);

  return (
    <figure
      ref={ref}
      className={[
        'sc-demo',
        `sc-demo--${tone}`,
        inView ? 'is-live' : '',
        paused ? 'is-paused' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="sc-demo__chrome">
        <span className="sc-demo__dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="sc-demo__url">{address}</span>
        {status ? <span className="sc-demo__status">{status}</span> : null}
        {onOpen ? <span className="sc-demo__tag">Galerie</span> : null}
        <button
          type="button"
          className="sc-demo__toggle"
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? `Relancer la démo : ${label}` : `Mettre en pause la démo : ${label}`}
          aria-pressed={paused}
        >
          <span aria-hidden>{paused ? '▶' : '❚❚'}</span>
        </button>
      </div>

      <div className="sc-demo__viewport">
        <div className="sc-demo__ui">
          <DemoRuntimeContext.Provider value={{ paused, inView, setStatus, setUrl }}>
            {children}
          </DemoRuntimeContext.Provider>
        </div>
        {onOpen ? (
          <button
            type="button"
            className="sc-demo__openZone"
            onClick={onOpen}
            aria-label={`Ouvrir la galerie ${label}`}
          >
            <span>
              Voir la galerie <i aria-hidden>↗</i>
            </span>
          </button>
        ) : null}
      </div>

      <figcaption className="sc-sr">{label} — démo animée de l’interface</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ TubeCraft */

type TubeScene = 'search' | 'playback' | 'mini';

const TUBE_SCENES: { id: TubeScene; label: string; short: string }[] = [
  { id: 'search', label: 'Recherche', short: 'Chercher' },
  { id: 'playback', label: 'Lecture', short: 'Regarder' },
  { id: 'mini', label: 'Mini-lecteur', short: 'Continuer' },
];

const SEARCH_RESULTS = [
  {
    thumb: TC_THUMBS.spring,
    title: 'Spring — Blender Open Movie',
    channel: 'Blender Studio',
    meta: '10,9 M de vues · il y a 6 ans',
    duration: '7:44',
  },
  {
    thumb: TC_THUMBS.sprite,
    title: 'Sprite Fright — Blender Open Movie',
    channel: 'Blender Studio',
    meta: '9,4 M de vues · il y a 4 ans',
    duration: '10:30',
  },
  {
    thumb: TC_THUMBS.charge,
    title: 'CHARGE — Blender Open Movie',
    channel: 'Blender Studio',
    meta: '2,5 M de vues · il y a 2 ans',
    duration: '4:23',
  },
];

function TubeTopBar({ query }: { query?: string }) {
  return (
    <div className="tc__bar">
      <div className="tc__brand">
        <span className="tc__mark">▶</span>
        TubeCraft
        <span className="tc__fr">FR</span>
      </div>
      <div className={`tc__search${query ? ' tc__search--typing' : ''}`}>
        {query ? (
          <span className="tc__query">
            <b>{query}</b>
            <i className="tc__caret" />
          </span>
        ) : (
          <span>Rechercher</span>
        )}
        <i className="tc__lens" />
      </div>
      <div className="tc__barRight">
        <span className="tc__avatar" />
      </div>
    </div>
  );
}

function TubeRail() {
  return (
    <aside className="tc__rail" aria-hidden>
      <span className="tc__railItem tc__railItem--on" />
      <span className="tc__railItem" />
      <span className="tc__railItem" />
      <span className="tc__railItem" />
      <span className="tc__railItem tc__railItem--short" />
    </aside>
  );
}

function TubeSearchScene() {
  return (
    <div className="tc-scene tc-scene--search">
      <TubeTopBar query="blender spring" />
      <div className="tc__body">
        <TubeRail />
        <div className="tc-search">
          <div className="tc-search__head">
            <span className="tc-search__count">Environ 11 344 531 résultats</span>
            <div className="tc-search__filters">
              <span className="is-on">Toutes</span>
              <span>Vidéos</span>
              <span>Chaînes</span>
            </div>
          </div>

          <div className="tc-results">
            {SEARCH_RESULTS.map((result, index) => (
              <div
                className={`tc-result${index === 0 ? ' is-first' : ''}`}
                key={result.title}
                style={{ '--i': index } as CSSProperties}
              >
                <span className="tc-result__thumb">
                  <img src={result.thumb} alt="" loading="lazy" decoding="async" />
                  <i>{result.duration}</i>
                  {index === 0 ? <b className="tc-result__progress"><i /></b> : null}
                </span>
                <span className="tc-result__text">
                  <b>{result.title}</b>
                  <em>{result.meta}</em>
                  <span className="tc-result__channel">
                    <i className="tc-result__chan" />
                    {result.channel}
                    <span className="tc-result__badge">✓</span>
                  </span>
                  <span className="tc-result__desc">
                    Une forêt, un sacrifice, et la première open movie de Blender Studio.
                  </span>
                </span>
                {index === 0 ? <span className="tc-result__hover">▶</span> : null}
              </div>
            ))}
          </div>

          <div className="tc-search__foot">
            <span className="tc-search__ai">
              <i>✳</i> IA · intention : animation 3D
            </span>
            <span>Recherches associées : blender studio · spring open movie</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TubePlaybackScene() {
  return (
    <div className="tc-scene tc-scene--playback">
      <TubeTopBar />
      <div className="tc__body">
        <TubeRail />

        <div className="tc__content">
          <div className="tc__stage">
            <img src={TC_THUMBS.spring} alt="" decoding="async" />
            <span className="tc__stageShade" />
            <span className="tc__badge">Résumé IA · 8 chapitres</span>
            <span className="tc__play">▶</span>
            <span className="tc__chapterNums">
              <i>00:00</i>
              <i>01:12</i>
              <i>03:40</i>
            </span>
            <span className="tc__timeline">
              <i />
              <b />
            </span>
          </div>

          <div className="tc__title">Spring — Blender Open Movie</div>
          <div className="tc__meta">
            <span className="tc__chan" />
            <span>
              <strong>Blender Studio</strong>
              <em>10,9 M de vues · 4 avr. 2019</em>
            </span>
            <span className="tc__follow">Abonné</span>
          </div>

          <div className="tc__actions">
            <span>👍 18 k</span>
            <span>↗ Partager</span>
            <span>＋ Enregistrer</span>
          </div>

          <div className="tc__chapters">
            <span>
              <b>00:00</b> Introduction
            </span>
            <span>
              <b>01:12</b> La forêt
            </span>
            <span>
              <b>03:40</b> Le sacrifice
            </span>
          </div>
        </div>

        <aside className="tc__aside">
          <div className="tc__asideTitle">À suivre</div>
          {[
            { src: TC_THUMBS.sprite, title: 'Sprite Fright — Blender Open Movie', meta: '10:30', live: true },
            { src: TC_THUMBS.charge, title: 'CHARGE — Blender Open Movie', meta: '4:23' },
            { src: TC_THUMBS.singularity, title: 'The Making of SINGULARITY', meta: '16:59' },
          ].map((item) => (
            <div className={`tc__row${item.live ? ' tc__row--live' : ''}`} key={item.title}>
              <span className="tc__rowThumb">
                <img src={item.src} alt="" decoding="async" loading="lazy" />
                <i>{item.meta}</i>
              </span>
              <span className="tc__rowText">
                <b>{item.title}</b>
                <em>{item.live ? 'En lecture' : 'Blender Studio'}</em>
              </span>
            </div>
          ))}
          <span className="tc__row tc__row--ghost">
            <span className="tc__rowThumb" />
            <span className="tc__rowText">
              <b>Suggestions YouTube en direct</b>
              <em>chargées à la volée</em>
            </span>
          </span>
        </aside>
      </div>
    </div>
  );
}

function TubeMiniScene() {
  return (
    <div className="tc-scene tc-scene--mini">
      <TubeTopBar />

      <div className="tc__body">
        <TubeRail />
        <div className="tc-mini">
          <div className="tc-mini__chips">
            <span className="is-on">Toutes</span>
            <span>Animation</span>
            <span>Musique</span>
          </div>

          <div className="tc-mini__grid">
            {[
              { thumb: TC_THUMBS.sprite, title: 'Sprite Fright', meta: 'Blender Studio · 10:30' },
              { thumb: TC_THUMBS.charge, title: 'CHARGE', meta: 'Blender Studio · 4:23' },
              { thumb: TC_THUMBS.singularity, title: 'Making of SINGULARITY', meta: 'Blender Studio · 16:59' },
              { thumb: TC_THUMBS.spring, title: 'Spring', meta: 'Blender Studio · 7:44' },
            ].map((video, index) => (
              <div className="tc-mini__card" key={video.title} style={{ '--i': index } as CSSProperties}>
                <span className="tc-mini__thumb">
                  <img src={video.thumb} alt="" loading="lazy" decoding="async" />
                  <i>{video.meta.split(' · ')[1]}</i>
                </span>
                <b>{video.title}</b>
                <em>{video.meta}</em>
              </div>
            ))}
          </div>

          <div className="tc-mini__hint">
            <span aria-hidden>↙</span> La lecture continue pendant que vous naviguez
          </div>

          <div className="tc-pip">
            <div className="tc-pip__video">
              <img src={TC_THUMBS.spring} alt="" loading="lazy" decoding="async" />
              <span className="tc-pip__shade" />
              <span className="tc-pip__pause">❚❚</span>
              <span className="tc-pip__time">12:04 / 7:44</span>
              <span className="tc-pip__bar">
                <i />
              </span>
              <span className="tc-pip__grip" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span className="tc-pip__close" aria-hidden>
                ×
              </span>
            </div>
            <div className="tc-pip__text">
              <b>Spring — Blender Open Movie</b>
              <em>mini-lecteur persistant</em>
            </div>
            <div className="tc-pip__actions" aria-hidden>
              <span>◱</span>
              <span>⤢</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TubeCraftDemo({
  initialScene = 'search',
  cycle = true,
}: {
  initialScene?: TubeScene;
  cycle?: boolean;
} = {}) {
  const runtime = useDemoRuntime();
  const reduced = useReducedMotion();
  const [scene, setScene] = useState<TubeScene>(initialScene);
  const [hold, setHold] = useState(false);

  // Pendant la visite guidée, les scènes sont pilotées par la visite et la
  // boucle automatique est mise en attente.
  useEffect(() => {
    const onScene = (event: Event) => {
      const detail = (event as CustomEvent<{ app?: string; scene?: TubeScene; hold?: boolean }>).detail;
      if (detail?.app !== 'tubecraft') return;
      if (detail.scene && TUBE_SCENES.some((item) => item.id === detail.scene)) {
        setScene(detail.scene);
      }
      setHold(detail.hold === true);
    };
    window.addEventListener('showcase:scene', onScene);
    return () => window.removeEventListener('showcase:scene', onScene);
  }, []);

  useEffect(() => {
    if (!cycle || reduced || hold) return;
    if (runtime?.paused || runtime?.inView === false) return;
    const timer = window.setInterval(() => {
      setScene((current) => {
        const index = TUBE_SCENES.findIndex((item) => item.id === current);
        return TUBE_SCENES[(index + 1) % TUBE_SCENES.length].id;
      });
    }, 4200);
    return () => window.clearInterval(timer);
  }, [cycle, reduced, hold, runtime?.paused, runtime?.inView]);

  useEffect(() => {
    const current = TUBE_SCENES.find((item) => item.id === scene);
    runtime?.setStatus(
      current ? `${String(TUBE_SCENES.indexOf(current) + 1).padStart(2, '0')} / 03 · ${current.label}` : ''
    );
    runtime?.setUrl(
      scene === 'search'
        ? 'tubecraft.app / recherche?q=blender+spring'
        : scene === 'playback'
          ? 'tubecraft.app / watch?v=WhWc3b3KhnY'
          : 'tubecraft.app / accueil — mini-lecteur'
    );
  }, [scene, runtime?.setStatus, runtime?.setUrl]);

  const activeIndex = TUBE_SCENES.findIndex((item) => item.id === scene);

  return (
    <div
      className={`tc tc--sequence${cycle ? ' tc--cycle' : ''}`}
      data-scene={scene}
      aria-hidden
    >
      <div className="tc__sceneWrap" key={scene}>
        {scene === 'search' ? <TubeSearchScene /> : null}
        {scene === 'playback' ? <TubePlaybackScene /> : null}
        {scene === 'mini' ? <TubeMiniScene /> : null}
      </div>

      <div className="tc__reel">
        <span className="tc__reelCount" aria-hidden>
          0{activeIndex + 1}
        </span>
        {TUBE_SCENES.map((item, index) => (
          <span
            className={`tc__reelItem${item.id === scene ? ' is-on' : ''}${
              index < activeIndex ? ' is-past' : ''
            }`}
            key={item.id}
          >
            <i />
            {item.short}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- SpotifyCraft */

export function SpotifyCraftDemo() {
  return (
    <div className="sp" aria-hidden>
      <div className="sp__bar">
        <div className="sp__nav">
          <span>‹</span>
          <span>›</span>
        </div>
        <div className="sp__search">Titre, artiste, album…</div>
        <span className="sp__pill">Connexion Spotify</span>
      </div>

      <div className="sp__body">
        <aside className="sp__rail">
          <span className="sp__railItem sp__railItem--on" />
          <span className="sp__railItem" />
          <span className="sp__railItem" />
          <span className="sp__railItem" />
        </aside>

        <div className="sp__content">
          <div className="sp__hello">Bonjour</div>
          <div className="sp__sub">Vos Daily Mix, calculés en local.</div>

          <div className="sp__mixes">
            {SP_MIXES.map((mix, index) => (
              <div className={`sp__mix${index === 1 ? ' sp__mix--hover' : ''}`} key={mix.name}>
                <span className="sp__art">
                  {mix.covers.map((cover) => (
                    <img key={cover} src={cover} alt="" loading="lazy" decoding="async" />
                  ))}
                  <b className="sp__mixPlay">{index === 1 ? '▶' : ''}</b>
                </span>
                <strong>{mix.name}</strong>
                <em>{mix.meta}</em>
              </div>
            ))}
          </div>

          <div className="sp__section">
            Pop du moment <span>›</span>
          </div>
          <div className="sp__shelf">
            {SP_TRACKS.slice(0, 4).map((track) => (
              <div className="sp__album" key={track.title}>
                <span className="sp__cover">
                  <img src={track.cover} alt="" loading="lazy" decoding="async" />
                </span>
                <strong>{track.title}</strong>
                <em>{track.artist}</em>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sp__player">
        <span className="sp__playerArt">
          <img src={SP_MIXES[2].covers[0]} alt="" loading="lazy" decoding="async" />
        </span>
        <span className="sp__now">
          <strong>{SP_TRACKS[0].title}</strong>
          <em>{SP_TRACKS[0].artist} · extrait 30 s</em>
        </span>
        <span className="sp__controls">
          <i>⏮</i>
          <i className="sp__mainControl">▶</i>
          <i>⏭</i>
        </span>
        <span className="sp__progress">
          <i />
        </span>
        <span className="sp__eq">
          {Array.from({ length: 12 }).map((_, index) => (
            <i key={index} style={{ '--bar': index } as CSSProperties} />
          ))}
        </span>
        <span className="sp__time">1:12 / 3:04</span>
      </div>
    </div>
  );
}
