import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Video } from '../types';
import { formatDuration } from '../lib/format';
import { useStore } from '../store';

/* --- chargement unique de l'API IFrame de YouTube ------------------------- */

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<any> | null = null;

function loadYouTubeApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });
  return apiPromise;
}

interface Props {
  video: Video;
  startAt?: number;
  autoplayNext: boolean;
  onEnded?: () => void;
}

/**
 * Lecteur basé sur l'API IFrame de YouTube : reprise de lecture, vitesse,
 * sous-titres, mode théâtre, raccourcis clavier et partage horodaté.
 * Les contrôles natifs de YouTube restent disponibles.
 */
export function Player({ video, startAt = 0, autoplayNext, onEnded }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(startAt);
  const [duration, setDuration] = useState(video.duration ?? 0);
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(() => {
    const v = useStore.getState().settings.volume;
    return typeof v === 'number' ? v : 100;
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const speed = useStore((s) => s.settings.speed);
  const captions = useStore((s) => s.settings.captions);
  const loop = useStore((s) => s.settings.loop ?? false);
  const theater = useStore((s) => s.settings.theater);
  const setSetting = useStore((s) => s.setSetting);
  const saveProgress = useStore((s) => s.saveProgress);
  const autoplayNextRef = useRef(autoplayNext);
  autoplayNextRef.current = autoplayNext;
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const applySettings = useCallback(() => {
    const player = playerRef.current;
    if (!player?.setPlaybackRate) return;
    try {
      player.setPlaybackRate(speed);
      if (captions) player.loadModule?.('captions');
      else player.unloadModule?.('captions');
    } catch {
      /* le module captions n'est pas toujours disponible */
    }
  }, [speed, captions]);

  // création du lecteur
  useEffect(() => {
    let disposed = false;

    loadYouTubeApi().then((YT) => {
      if (disposed || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId: video.id,
        playerVars: {
          start: Math.max(0, Math.floor(startAt)),
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          hl: 'fr',
          cc_load_policy: captions ? 1 : 0,
        },
        events: {
          onReady: (event: any) => {
            setReady(true);
            setDuration(event.target.getDuration?.() || video.duration || 0);
            const v = useStore.getState().settings.volume;
            const vol = typeof v === 'number' ? v : (event.target.getVolume?.() ?? 100);
            event.target.setVolume?.(vol);
            setVolume(vol);
            setMuted(event.target.isMuted?.() ?? false);
            applySettings();
          },
          onStateChange: (event: any) => {
            const state = event.data;
            setPlaying(state === 1);
            if (state === 0) {
              if (loopRef.current) {
                playerRef.current?.seekTo?.(0, true);
                playerRef.current?.playVideo?.();
              } else if (autoplayNextRef.current) {
                onEndedRef.current?.();
              }
            }
            if (state === 1) setDuration(event.target.getDuration?.() || 0);
          },
        },
      });
    });

    return () => {
      disposed = true;
      const player = playerRef.current;
      playerRef.current = null;
      setReady(false);
      setPlaying(false);
      try {
        player?.destroy?.();
      } catch {
        /* ignore */
      }
    };
    // la vidéo change -> nouveau lecteur ; les autres réglages passent par applySettings
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  // suivi de la position (barre de progression + reprise de lecture)
  useEffect(() => {
    if (!ready) return;
    const tick = window.setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;
      const time = player.getCurrentTime() || 0;
      setCurrent(time);
      if (time > 1) saveProgress(video.id, time);
    }, 2000);
    return () => window.clearInterval(tick);
  }, [ready, video.id, saveProgress]);

  useEffect(() => {
    applySettings();
  }, [applySettings]);

  // raccourcis clavier (comme YouTube) — ignorés quand on écrit dans un champ
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const player = playerRef.current;
      if (!player) return;
      const seconds = player.getCurrentTime?.() ?? 0;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        seekTo(((video.duration || duration || 0) * Number(event.key)) / 10);
        return;
      }
      switch (event.key) {
        case 'k':
        case ' ':
          event.preventDefault();
          playing ? player.pauseVideo?.() : player.playVideo?.();
          break;
        case 'j':
          player.seekTo?.(Math.max(0, seconds - 10), true);
          break;
        case 'l':
          player.seekTo?.(seconds + 10, true);
          break;
        case 'ArrowRight':
          player.seekTo?.(seconds + 5, true);
          break;
        case 'ArrowLeft':
          player.seekTo?.(Math.max(0, seconds - 5), true);
          break;
        case 'm':
          event.preventDefault();
          player.isMuted?.() ? player.unMute?.() : player.mute?.();
          setMuted(player.isMuted?.() ?? false);
          break;
        case 'c':
          setSetting('captions', !captions);
          break;
        case 't':
          setSetting('theater', !theater);
          break;
        case 'f':
          event.preventDefault();
          if (document.fullscreenElement) void document.exitFullscreen?.();
          else void containerRef.current?.requestFullscreen?.();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, captions, theater, setSetting, duration]);

  const toggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isMuted?.()) player.unMute?.();
    else player.mute?.();
    setMuted(player.isMuted?.() ?? !muted);
    setVolume(player.getVolume?.() ?? volume);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) void document.exitFullscreen?.();
      else void el.requestFullscreen?.();
    } catch {
      /* fullscreen non supporté */
    }
  };

  const shareAtCurrentTime = async () => {
    const seconds = Math.floor(playerRef.current?.getCurrentTime?.() ?? current);
    const url = `${window.location.origin}/watch?v=${video.id}&t=${seconds}s`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers refusé */
    }
  };

  const seekTo = (seconds: number) => {
    playerRef.current?.seekTo?.(seconds, true);
    setCurrent(seconds);
  };

  const percent = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div className="player2">
      <div ref={containerRef} className={`player${theater ? ' player--theater' : ''}`}>
        <div ref={hostRef} className="player__host" />
      </div>

      <div className="playbar">
        <button
          className="playbar__btn"
          onClick={() => (playing ? playerRef.current?.pauseVideo?.() : playerRef.current?.playVideo?.())}
          aria-label={playing ? 'Pause (k)' : 'Lecture (k)'}
          title={playing ? 'Pause (k)' : 'Lecture (k)'}
        >
          {playing ? '❚❚' : '▶'}
        </button>

        <button
          className="playbar__btn"
          onClick={() => seekTo(Math.max(0, current - 10))}
          aria-label="Reculer de 10 secondes (j)"
          title="Reculer de 10 s (j)"
        >
          ↺10
        </button>

        <button
          className="playbar__btn"
          onClick={() => seekTo(current + 10)}
          aria-label="Avancer de 10 secondes (l)"
          title="Avancer de 10 s (l)"
        >
          ↻10
        </button>

        <span className="playbar__time">
          {formatDuration(Math.floor(current))} / {formatDuration(Math.floor(duration))}
        </span>

        <input
          className="playbar__range"
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duration))}
          value={Math.floor(current)}
          onChange={(e) => seekTo(Number(e.target.value))}
          aria-label="Position de lecture"
          style={{ '--progress': `${percent}%` } as CSSProperties}
        />

        <label className="playbar__select">
          <span className="sr-only">Vitesse de lecture</span>
          <select
            value={speed}
            onChange={(e) => setSetting('speed', Number(e.target.value))}
            title="Vitesse de lecture"
          >
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>

        <button
          className={`playbar__btn playbar__btn--text${captions ? ' on' : ''}`}
          onClick={() => setSetting('captions', !captions)}
          title="Sous-titres (c)"
        >
          CC
        </button>

        <button
          className={`playbar__btn playbar__btn--text${autoplayNext ? ' on' : ''}`}
          onClick={() => setSetting('autoplayNext', !autoplayNext)}
          title="Lecture automatique de la vidéo suivante"
        >
          Autoplay
        </button>

        <button
          className={`playbar__btn playbar__btn--text${loop ? ' on' : ''}`}
          onClick={() => setSetting('loop', !loop)}
          title="Lire en boucle"
          aria-label="Lire en boucle"
        >
          🔁
        </button>

        <button
          className={`playbar__btn playbar__btn--text${theater ? ' on' : ''}`}
          onClick={() => setSetting('theater', !theater)}
          title="Mode théâtre (t)"
        >
          Théâtre
        </button>

        <button
          className={`playbar__btn playbar__btn--text${muted ? ' on' : ''}`}
          onClick={toggleMute}
          title={muted ? 'Réactiver le son (m)' : 'Couper le son (m)'}
          aria-label={muted ? 'Réactiver le son' : 'Couper le son'}
        >
          {muted ? '🔇' : '🔊'}
        </button>

        <input
          className="playbar__volume"
          type="range"
          min={0}
          max={100}
          value={muted ? 0 : volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            const player = playerRef.current;
            player?.setVolume?.(v);
            player?.unMute?.();
            setVolume(v);
            setMuted(v === 0);
            setSetting('volume', v);
          }}
          aria-label="Volume"
          title="Volume"
        />

        <button
          className="playbar__btn playbar__btn--text"
          onClick={toggleFullscreen}
          title="Plein écran"
          aria-label="Plein écran"
        >
          ⛶
        </button>

        <button className="playbar__btn playbar__btn--text" onClick={shareAtCurrentTime} title="Copier le lien à cet instant">
          {copied ? 'Lien copié !' : 'Partager ici'}
        </button>
      </div>
    </div>
  );
}
