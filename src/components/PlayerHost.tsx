import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { fetchSponsorSegments } from '../api/youtube';
import { useStore } from '../store';
import { formatDuration } from '../lib/format';
import type { SponsorSegment, Video } from '../types';
import {
  IconClose,
  IconExpand,
  IconNext,
  IconPause,
  IconPip,
  IconPlay,
  IconQueue,
  IconVolume,
  IconVolumeOff,
} from './icons';
import { Player, type PlayerHandle } from './Player';
import { Thumb } from './Thumb';

/**
 * Hôte unique du lecteur YouTube.
 *
 * Le lecteur est monté une seule fois, au-dessus des routes : quitter la page
 * Watch ne détruit donc plus l'iframe, la lecture continue et le lecteur se
 * réduit dans un coin. La page Watch ne fait que fournir un emplacement
 * (une « ancre ») que l'hôte recouvre exactement.
 *
 * Le mini-lecteur expose lecture/pause, la file d'attente et le
 * Picture-in-Picture. Pour le PiP, le lecteur est rendu dans la fenêtre via un
 * portail React : YouTube recharge l'iframe dans ce nouveau document, on la
 * recrée donc à la seconde courante (aucune lecture perdue).
 */

interface Session {
  video: Video;
  startAt: number;
}

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SEEK_STEP = 10;
const POSITION_TICK_MS = 400;

/** Remplissage de la piste d'un curseur (utilisé par `--fill` en CSS). */
function fillPercent(position: number, duration: number) {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return '0%';
  return `${Math.min(100, Math.max(0, (position / duration) * 100)).toFixed(2)}%`;
}

interface PlayerHostApi {
  /** La page Watch déclare son emplacement et la vidéo à jouer. */
  attach: (video: Video, startAt: number, anchor: HTMLElement) => void;
  /** La page Watch disparaît : le lecteur passe en mode mini. */
  detach: (videoId: string) => void;
  /** Rafraîchit les métadonnées (titre chargé après coup) sans relancer la lecture. */
  update: (video: Video) => void;
  setOnEnded: (handler: (() => void) | null) => void;
  /** liste « à suivre » publiée par la page Watch */
  setUpNext: (videos: Video[], label: string) => void;
  seekTo: (seconds: number) => boolean;
  getCurrentTime: () => number;
  /** vidéo déjà en cours de lecture (retour depuis le mini-lecteur) */
  currentVideoId: () => string | null;
}

const PlayerHostContext = createContext<PlayerHostApi | null>(null);

export function usePlayerHost(): PlayerHostApi {
  const host = useContext(PlayerHostContext);
  if (!host) throw new Error('usePlayerHost doit être utilisé sous <PlayerHostProvider>');
  return host;
}

const QUEUE_PREVIEW = 8;

/** Recopie les feuilles de style dans la fenêtre PiP (elle n'hérite de rien). */
function copyStyles(target: Document) {
  for (const node of Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))) {
    const clone = node.cloneNode(true) as HTMLElement;
    if (clone.tagName === 'LINK') {
      // l'URL relative se résoudrait contre le document PiP
      (clone as HTMLLinkElement).href = (node as HTMLLinkElement).href;
    }
    target.head.appendChild(clone);
  }
  target.documentElement.lang = 'fr';
  target.body.classList.add('pip-window');
}

export function PlayerHostProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const playerRef = useRef<PlayerHandle>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [docked, setDocked] = useState(false);
  const [rect, setRect] = useState<AnchorRect | null>(null);
  // force une nouvelle mesure quand on ré-attache le même emplacement
  const [revision, setRevision] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pip, setPip] = useState<Window | null>(null);
  const [pipError, setPipError] = useState('');
  const [upNext, setUpNextState] = useState<Video[]>([]);
  const [queueLabel, setQueueLabel] = useState('À suivre');
  const [queueOpen, setQueueOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // les valeurs lues par les callbacks impératifs (pas de rendu inutile)
  const sessionRef = useRef<Session | null>(null);
  const modeRef = useRef<'inline' | 'mini'>('mini');
  const endedRef = useRef<(() => void) | null>(null);
  const upNextRef = useRef<Video[]>([]);
  const queueLabelRef = useRef('À suivre');
  const queueOpenRef = useRef(false);
  const pipRef = useRef<Window | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const pipErrorTimer = useRef<number | undefined>(undefined);
  // la barre de progression ne doit pas sauter pendant (ni juste après) un déplacement
  const seekTimerRef = useRef<number | undefined>(undefined);
  const seekingRef = useRef(false);
  const volumeOpenRef = useRef(false);
  const lastVolumeRef = useRef(0);
  // un même appui sur Échap ne doit fermer qu'une chose (le PiP, puis la file,
  // puis le lecteur) même si le navigateur répète l'évènement
  const lastEscapeRef = useRef(0);

  const speed = useStore((s) => s.settings.speed);
  const volume = useStore((s) => s.settings.volume);
  const captions = useStore((s) => s.settings.captions);
  const loop = useStore((s) => s.settings.loop);
  const autoplayNext = useStore((s) => s.settings.autoplayNext);
  const sponsorBlock = useStore((s) => s.settings.sponsorBlock);

  const videoId = session?.video.id;
  // mémorisés à chaque rendu : les callbacks impératifs (raccourcis, mute) les lisent
  volumeOpenRef.current = volumeOpen;
  if (volume > 0) lastVolumeRef.current = volume;
  // Les segments sont étiquetés par vidéo : un saut calculé pour la vidéo
  // précédente ne doit jamais s'appliquer à celle qui vient d'être lancée
  // (sinon on saute à la fin et la file d'attente se vide d'un coup).
  const [segments, setSegments] = useState<{ videoId: string; list: SponsorSegment[] }>({
    videoId: '',
    list: [],
  });

  const pipSupported = useMemo(
    () => typeof window !== 'undefined' && 'documentPictureInPicture' in window,
    []
  );

  useEffect(() => {
    setSegments({ videoId: videoId ?? '', list: [] });
    if (!videoId || !sponsorBlock) return;
    const controller = new AbortController();
    fetchSponsorSegments(videoId, controller.signal).then((list) => {
      if (!controller.signal.aborted) setSegments({ videoId, list });
    });
    return () => controller.abort();
  }, [videoId, sponsorBlock]);

  const activeSegments = segments.videoId === videoId ? segments.list : [];

  /** Position exacte de l'emplacement fourni par la page Watch. */
  useEffect(() => {
    if (!docked || !anchor) return;
    let previous = '';

    // mesure synchrone : les évènements de scroll sont déjà limités à une
    // frame par le navigateur, et un onglet en arrière-plan ne bloque rien.
    const measure = () => {
      const box = anchor.getBoundingClientRect();
      const next = `${box.top}|${box.left}|${box.width}|${box.height}`;
      if (next === previous) return;
      previous = next;
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
    };

    measure();
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    window.addEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    observer.observe(anchor);

    return () => {
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [docked, anchor, revision]);

  const attach = useCallback((video: Video, startAt: number, anchorEl: HTMLElement) => {
    if (sessionRef.current?.video.id !== video.id) {
      const next = { video, startAt };
      sessionRef.current = next;
      setSession(next);
    }
    modeRef.current = 'inline';
    setAnchor(anchorEl);
    setDocked(true);
    setRevision((value) => value + 1);
  }, []);

  const detach = useCallback((closedVideoId: string) => {
    // une navigation vers une autre vidéo enchaîne sur un `attach` juste après
    if (sessionRef.current?.video.id !== closedVideoId) return;
    modeRef.current = 'mini';
    setAnchor(null);
    setRect(null);
    setDocked(false);
  }, []);

  const update = useCallback((video: Video) => {
    const current = sessionRef.current;
    if (!current || current.video.id !== video.id) return;
    if (
      current.video.title === video.title &&
      current.video.duration === video.duration &&
      current.video.channelName === video.channelName &&
      current.video.views === video.views
    ) {
      return;
    }
    const next = { ...current, video };
    sessionRef.current = next;
    setSession(next);
  }, []);

  const setOnEnded = useCallback((handler: (() => void) | null) => {
    endedRef.current = handler;
  }, []);

  const setUpNext = useCallback((videos: Video[], label: string) => {
    if (label !== queueLabelRef.current) {
      queueLabelRef.current = label;
      setQueueLabel(label);
    }
    const current = upNextRef.current;
    const same =
      current.length === videos.length && current.every((video, index) => video.id === videos[index].id);
    if (same) return;
    upNextRef.current = videos;
    setUpNextState(videos);
  }, []);

  const close = useCallback(() => {
    // fermer le mini-lecteur ferme aussi la fenêtre PiP éventuelle
    const win = pipRef.current;
    if (win) {
      pipRef.current = null;
      setPip(null);
      try {
        if (!win.closed) win.close();
      } catch {
        /* fenêtre déjà fermée */
      }
    }
    sessionRef.current = null;
    modeRef.current = 'mini';
    setSession(null);
    setAnchor(null);
    setRect(null);
    setDocked(false);
    queueOpenRef.current = false;
    setQueueOpen(false);
  }, []);

  const seekTo = useCallback((seconds: number) => playerRef.current?.seekTo(seconds) ?? false, []);
  const getCurrentTime = useCallback(() => playerRef.current?.getCurrentTime() ?? 0, []);
  const currentVideoId = useCallback(() => sessionRef.current?.video.id ?? null, []);

  const api = useMemo<PlayerHostApi>(
    () => ({
      attach,
      detach,
      update,
      setOnEnded,
      setUpNext,
      seekTo,
      getCurrentTime,
      currentVideoId,
    }),
    [attach, detach, update, setOnEnded, setUpNext, seekTo, getCurrentTime, currentVideoId]
  );

  /* --------------------------------------------------- lecture / pause */

  const togglePlay = useCallback(() => {
    const handle = playerRef.current;
    if (!handle) return;
    if (handle.isPlaying()) handle.pause();
    else handle.play();
  }, []);

  /* --------------------------------------------------- file d'attente */

  const switchTo = useCallback((video: Video) => {
    const next = { video, startAt: 0 };
    sessionRef.current = next;
    setSession(next);
    queueOpenRef.current = false;
    setQueueOpen(false);
  }, []);

  const playNext = useCallback(() => {
    const next = upNextRef.current[0];
    if (!next) return;
    upNextRef.current = upNextRef.current.slice(1);
    setUpNextState(upNextRef.current);
    switchTo(next);
  }, [switchTo]);

  const playFromQueue = useCallback(
    (index: number) => {
      const video = upNextRef.current[index];
      if (!video) return;
      upNextRef.current = upNextRef.current.slice(index + 1);
      setUpNextState(upNextRef.current);
      switchTo(video);
    },
    [switchTo]
  );

  const advance = useCallback(() => {
    // sur la page Watch, c'est elle qui connaît la playlist et met l'URL à jour
    if (modeRef.current === 'inline') {
      endedRef.current?.();
      return;
    }
    playNext();
  }, [playNext]);

  const handleEnded = useCallback(() => {
    if (modeRef.current === 'inline') {
      endedRef.current?.();
      return;
    }
    // en mini, on enchaîne la file d'attente si la lecture automatique est active
    if (useStore.getState().settings.autoplayNext) playNext();
  }, [playNext]);

  const closeQueue = useCallback(() => {
    queueOpenRef.current = false;
    setQueueOpen(false);
  }, []);

  const toggleQueue = useCallback(() => {
    const next = !queueOpenRef.current;
    queueOpenRef.current = next;
    setQueueOpen(next);
  }, []);

  /* ------------------------------- progression, volume, plein écran */

  /** Déplacement relatif (±10 s) sans relancer une lecture en pause. */
  const seekBy = useCallback((delta: number) => {
    const handle = playerRef.current;
    if (!handle) return;
    const target = Math.max(0, handle.getCurrentTime() + delta);
    const total = handle.getDuration();
    const bounded = total > 0 ? Math.min(target, total) : target;
    handle.seekTo(bounded, handle.isPlaying());
    setPosition(bounded);
    seekingRef.current = true;
    window.clearTimeout(seekTimerRef.current);
    seekTimerRef.current = window.setTimeout(() => {
      seekingRef.current = false;
    }, 600);
  }, []);

  /** Déplacement direct depuis la barre de progression (glisser ou clic). */
  const scrubTo = useCallback((seconds: number) => {
    setPosition(seconds);
    seekingRef.current = true;
    window.clearTimeout(seekTimerRef.current);
    seekTimerRef.current = window.setTimeout(() => {
      const handle = playerRef.current;
      if (handle) handle.seekTo(seconds, handle.isPlaying());
      window.setTimeout(() => {
        seekingRef.current = false;
      }, 400);
    }, 120);
  }, []);

  const toggleMute = useCallback(() => {
    const { settings, setSetting } = useStore.getState();
    if (settings.volume > 0) {
      lastVolumeRef.current = settings.volume;
      setSetting('volume', 0);
      return;
    }
    setSetting('volume', lastVolumeRef.current > 0 ? lastVolumeRef.current : 65);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
      return;
    }
    // le dock couvre tout l'écran en plein écran (voir `.dock:fullscreen`)
    void dockRef.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  /* --------------------------------------------------- Picture-in-Picture */

  const readTime = useCallback(() => {
    try {
      const time = Number(playerRef.current?.getCurrentTime?.() ?? 0);
      if (time > 1) return time;
    } catch {
      /* fenêtre en cours de fermeture */
    }
    const current = sessionRef.current;
    const saved = current ? useStore.getState().progress[current.video.id] : 0;
    return saved || current?.startAt || 0;
  }, []);

  const restoreAt = useCallback((seconds: number) => {
    const current = sessionRef.current;
    if (!current) return;
    const next = { ...current, startAt: seconds > 1 ? Math.floor(seconds) : current.startAt };
    sessionRef.current = next;
    setSession(next);
    setRevision((value) => value + 1);
  }, []);

  const exitPip = useCallback(() => {
    const win = pipRef.current;
    if (!win) return;
    const time = readTime();
    pipRef.current = null;
    setPip(null);
    try {
      if (!win.closed) win.close();
    } catch {
      /* déjà fermée */
    }
    restoreAt(time);
  }, [readTime, restoreAt]);

  const enterPip = useCallback(async () => {
    if (pipRef.current || !sessionRef.current) return;
    const api = (window as unknown as {
      documentPictureInPicture?: { requestWindow?: (options: object) => Promise<Window> };
    }).documentPictureInPicture;
    if (!api?.requestWindow) return;

    const time = readTime();
    let win: Window | null = null;
    try {
      win = await api.requestWindow({ width: 480, height: 320 });
      if (!win) throw new Error('Fenêtre Picture-in-Picture indisponible');
      const opened = win;
      copyStyles(opened.document);
      opened.document.title = sessionRef.current?.video.title ?? 'Séquence';
      // Échap ferme la fenêtre ; `pagehide` ramène alors le lecteur dans la page.
      opened.document.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Escape') opened.close();
      });
      pipRef.current = opened;
      // le lecteur est recréé dans la fenêtre, à la seconde courante
      restoreAt(time);
      setPip(win);
      setQueueOpen(false);
      queueOpenRef.current = false;
      opened.addEventListener('pagehide', () => {
        if (pipRef.current !== opened) return;
        // fermée par la fenêtre elle-même : on ramène le lecteur dans la page
        const last = readTime();
        pipRef.current = null;
        setPip(null);
        restoreAt(last);
      });
    } catch {
      // PiP refusé par le navigateur : on reste dans la page et on explique.
      try {
        if (win && !win.closed) win.close();
      } catch {
        /* fenêtre déjà fermée */
      }
      setPipError('Picture-in-Picture indisponible dans ce navigateur.');
      window.clearTimeout(pipErrorTimer.current);
      pipErrorTimer.current = window.setTimeout(() => setPipError(''), 4_000);
    }
  }, [readTime, restoreAt]);

  /* --------------------------------------------------- raccourcis / nettoyage */

  // Échap ferme d'abord la file d'attente, puis le mini-lecteur.
  useEffect(() => {
    if (!session || docked) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // en plein écran, la touche est gérée par le navigateur
      if (document.fullscreenElement) return;
      const now = Date.now();
      if (now - lastEscapeRef.current < 300) return;
      lastEscapeRef.current = now;
      if (pipRef.current) {
        exitPip();
        return;
      }
      if (queueOpenRef.current) {
        closeQueue();
        return;
      }
      if (volumeOpenRef.current) {
        setVolumeOpen(false);
        return;
      }
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, docked, close, closeQueue, exitPip]);

  // revenir sur Watch referme la file d'attente
  useEffect(() => {
    if (docked) closeQueue();
  }, [docked, closeQueue]);

  // un clic hors du mini-lecteur referme la file d'attente et le panneau volume
  useEffect(() => {
    if (!queueOpen && !volumeOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const dock = dockRef.current;
      if (!dock || dock.contains(event.target as Node)) return;
      closeQueue();
      setVolumeOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [queueOpen, volumeOpen, closeQueue]);

  // position courante : seulement en mini / PiP (sur Watch, YouTube s'en charge)
  useEffect(() => {
    if (!session || docked) return;
    setPosition(session.startAt);
    const tick = () => {
      const handle = playerRef.current;
      if (!handle) return;
      if (!seekingRef.current) setPosition(handle.getCurrentTime());
      const total = handle.getDuration();
      if (total > 0) setDuration(total);
    };
    tick();
    const timer = window.setInterval(tick, POSITION_TICK_MS);
    return () => window.clearInterval(timer);
    // le changement de vidéo repart de sa position de départ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.video.id, session?.startAt, docked]);

  /* -------------------------------------------- raccourcis clavier globaux */

  // espace / k : lecture-pause, j / l : ±10 s, m : son, f : plein écran.
  // Actifs hors de l'iframe : le lecteur YouTube garde ses propres raccourcis
  // quand il a le focus.
  useEffect(() => {
    if (!session) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (typing) return;

      const key = event.key.toLowerCase();

      if (key === ' ' || key === 'k') {
        // Espace active nativement un bouton ou un lien focalisé : on le laisse
        // faire. `k` n'a pas de sens natif, il marche donc toujours.
        if (key === ' ' && target?.closest('button, a, [role="button"]')) return;
        event.preventDefault();
        togglePlay();
        return;
      }
      if (key === 'j' || key === 'l') {
        event.preventDefault();
        seekBy(key === 'j' ? -SEEK_STEP : SEEK_STEP);
        return;
      }
      if (key === 'm') {
        event.preventDefault();
        toggleMute();
        return;
      }
      if (key === 'f') {
        event.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, togglePlay, seekBy, toggleMute, toggleFullscreen]);

  useEffect(
    () => () => {
      window.clearTimeout(pipErrorTimer.current);
      window.clearTimeout(seekTimerRef.current);
    },
    []
  );

  const watchHref = session ? `/watch?v=${encodeURIComponent(session.video.id)}` : '/';

  const dockClass = [
    'dock',
    pip ? 'dock--pip' : docked ? 'dock--inline' : 'dock--mini',
    !pip && docked && !rect ? 'dock--waiting' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const dock = session ? (
    <div
      ref={dockRef}
      className={dockClass}
      style={
        {
          ...(!pip && docked && rect
            ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
            : {}),
          // sur téléphone, la barre compacte affiche sa progression en bas
          '--mini-fill': fillPercent(position, duration),
        } as CSSProperties
      }
      role={docked || pip ? undefined : 'complementary'}
      aria-label={docked || pip ? undefined : 'Mini-lecteur'}
    >
      {!docked && !pip && queueOpen && upNext.length > 0 && (
        <div className="queuepanel" role="dialog" aria-label="File d’attente">
          <div className="queuepanel__head">
            <span className="queuepanel__label">{queueLabel}</span>
            <button
              type="button"
              className="queuepanel__close"
              onClick={closeQueue}
              aria-label="Fermer la file d’attente"
            >
              <IconClose width={16} height={16} />
            </button>
          </div>
          <ol className="queuepanel__list">
            {upNext.slice(0, QUEUE_PREVIEW).map((video, index) => (
              <li key={video.id}>
                <button
                  type="button"
                  className="queuepanel__item"
                  onClick={() => playFromQueue(index)}
                  title={video.title}
                >
                  <span className="queuepanel__thumb">
                    <Thumb videoId={video.id} isShort={video.isShort} />
                  </span>
                  <span className="queuepanel__text">
                    <strong>{video.title}</strong>
                    <span>
                      {video.channelName}
                      {video.duration ? ` · ${formatDuration(video.duration)}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {upNext.length > QUEUE_PREVIEW && (
            <p className="queuepanel__more">+ {upNext.length - QUEUE_PREVIEW} autres vidéos</p>
          )}
        </div>
      )}

      {pipError && !pip && (
        <p className="miniplayer__error" role="status" aria-live="polite">
          {pipError}
        </p>
      )}

      {(!docked || pip) && (
      <div className="miniplayer__bar">
        {pip ? (
          <span className="miniplayer__title miniplayer__title--static">
            <span className="miniplayer__pulse" aria-hidden />
            <span className="miniplayer__text">{session.video.title}</span>
          </span>
        ) : (
          <button
            type="button"
            className="miniplayer__title"
            onClick={() => navigate(watchHref)}
            title={`Revenir à la vidéo : ${session.video.title}`}
          >
            <span className="miniplayer__pulse" aria-hidden />
            <span className="miniplayer__text">{session.video.title}</span>
          </button>
        )}

        <button
          type="button"
          className="miniplayer__action miniplayer__action--play"
          onClick={togglePlay}
          aria-label={playing ? 'Mettre en pause' : 'Lire'}
          title={playing ? 'Pause' : 'Lecture'}
        >
          {playing ? <IconPause width={18} height={18} /> : <IconPlay width={18} height={18} />}
        </button>

        <button
          type="button"
          className="miniplayer__action miniplayer__action--next"
          onClick={advance}
          disabled={upNext.length === 0}
          aria-label="Vidéo suivante"
          title={upNext.length > 0 ? `Vidéo suivante : ${upNext[0].title}` : 'Aucune vidéo suivante'}
        >
          <IconNext width={18} height={18} />
        </button>

        {!pip && (
          <button
            type="button"
            className={`miniplayer__action miniplayer__action--queue${queueOpen ? ' is-on' : ''}`}
            onClick={toggleQueue}
            disabled={upNext.length === 0}
            aria-label="File d’attente"
            aria-expanded={queueOpen}
            title="File d’attente"
          >
            <IconQueue width={18} height={18} />
            {upNext.length > 0 && <span className="miniplayer__count">{upNext.length}</span>}
          </button>
        )}

        {!pip && pipSupported && (
          <button
            type="button"
            className="miniplayer__action miniplayer__action--pip"
            onClick={enterPip}
            aria-label="Picture-in-Picture"
            title="Picture-in-Picture"
          >
            <IconPip width={18} height={18} />
          </button>
        )}

        {pip ? (
          <button
            type="button"
            className="miniplayer__action"
            onClick={exitPip}
            aria-label="Revenir dans la page"
            title="Revenir dans la page"
          >
            <IconExpand width={18} height={18} />
          </button>
        ) : (
          <>
            <button
              type="button"
              className="miniplayer__action miniplayer__action--expand"
              onClick={() => navigate(watchHref)}
              aria-label="Agrandir le lecteur"
              title="Revenir à la vidéo"
            >
              <IconExpand width={18} height={18} />
            </button>
            <button
              type="button"
              className="miniplayer__action miniplayer__action--close"
              onClick={close}
              aria-label="Fermer le mini-lecteur"
              title="Fermer"
            >
              <IconClose width={18} height={18} />
            </button>
          </>
        )}
      </div>
      )}

      {(!docked || pip) && (
        <div className="miniplayer__footer">
          <span className="miniplayer__time">{formatDuration(position)}</span>
          <input
            className="miniplayer__range"
            type="range"
            min={0}
            max={duration > 0 ? Math.floor(duration) : 100}
            step={1}
            value={duration > 0 ? Math.min(Math.floor(position), Math.floor(duration)) : 0}
            disabled={duration === 0}
            onChange={(event) => scrubTo(Number(event.target.value))}
            onPointerDown={() => {
              seekingRef.current = true;
            }}
            aria-label="Position de lecture"
            aria-valuetext={`${formatDuration(position)} sur ${formatDuration(duration)}`}
            style={{ '--fill': fillPercent(position, duration) } as CSSProperties}
          />
          <span className="miniplayer__time">{duration > 0 ? formatDuration(duration) : '--:--'}</span>

          <div className="miniplayer__volume">
            <button
              type="button"
              className={`miniplayer__action${volumeOpen ? ' is-on' : ''}`}
              onClick={() => setVolumeOpen((open) => !open)}
              aria-label="Volume"
              aria-expanded={volumeOpen}
              title={`Volume ${volume} %`}
            >
              {volume === 0 ? <IconVolumeOff width={18} height={18} /> : <IconVolume width={18} height={18} />}
            </button>

            {volumeOpen && (
              <div className="volpanel" role="group" aria-label="Réglage du volume">
                <button
                  type="button"
                  className="volpanel__mute"
                  onClick={toggleMute}
                  aria-label={volume === 0 ? 'Rétablir le son' : 'Couper le son'}
                  title={volume === 0 ? 'Rétablir le son' : 'Couper le son'}
                >
                  {volume === 0 ? (
                    <IconVolumeOff width={16} height={16} />
                  ) : (
                    <IconVolume width={16} height={16} />
                  )}
                </button>
                <input
                  className="volpanel__range"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={volume}
                  onChange={(event) =>
                    useStore.getState().setSetting('volume', Number(event.target.value))
                  }
                  aria-label="Niveau du volume"
                  aria-valuetext={`${volume} %`}
                  style={{ '--fill': `${volume}%` } as CSSProperties}
                />
                <span className="volpanel__value">{volume}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <Player
        ref={playerRef}
        key={`${session.video.id}@${session.startAt}`}
        video={session.video}
        startAt={session.startAt}
        autoplayNext={autoplayNext}
        onEnded={handleEnded}
        onPlayingChange={setPlaying}
        segments={activeSegments}
        loop={loop}
        speed={speed}
        volume={volume}
        captions={captions}
      />
    </div>
  ) : null;

  return (
    <PlayerHostContext.Provider value={api}>
      {children}
      {dock && pip ? createPortal(dock, pip.document.body) : dock}
    </PlayerHostContext.Provider>
  );
}

interface PlayerSlotProps {
  video: Video;
  startAt: number;
  onEnded: () => void;
}

/**
 * Emplacement du lecteur dans la page Watch : l'hôte vient se poser dessus.
 * Le div garde la place (16/9) pour que la mise en page ne saute pas.
 */
export function PlayerSlot({ video, startAt, onEnded }: PlayerSlotProps) {
  const host = usePlayerHost();
  const anchorRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(startAt);
  startRef.current = startAt;
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    host.attach(video, startRef.current, anchor);
    return () => host.detach(video.id);
    // `video` est volontairement absent : seule l'identité de la vidéo recrée
    // le lecteur. Les métadonnées sont mises à jour par l'effet ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, video.id]);

  useEffect(() => {
    host.update(video);
  }, [host, video]);

  useEffect(() => {
    host.setOnEnded(() => endedRef.current());
    return () => host.setOnEnded(null);
  }, [host]);

  return <div className="player player-slot" ref={anchorRef} aria-hidden="true" />;
}
