import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { SponsorSegment, Video } from '../types';
import { useStore } from '../store';

/* --- chargement unique de l'API IFrame de YouTube ------------------------- */

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * Une promesse d'API **par fenêtre** : le lecteur peut être déplacé dans une
 * fenêtre Picture-in-Picture, et l'API YouTube doit alors y être chargée aussi
 * (c'est la fenêtre qui possède l'iframe qui reçoit ses messages).
 */
const apiPromises = new WeakMap<Window, Promise<any>>();

function loadYouTubeApi(view: Window): Promise<any> {
  const target = view as Window & { YT?: any };
  if (target.YT?.Player) return Promise.resolve(target.YT);
  const known = apiPromises.get(view);
  if (known) return known;

  const promise = new Promise((resolve, reject) => {
    const previous = target.onYouTubeIframeAPIReady;
    target.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(target.YT);
    };
    const script = view.document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('API IFrame YouTube indisponible'));
    view.document.head.appendChild(script);
    target.setTimeout(() => reject(new Error('Délai dépassé pour l’API YouTube')), 12_000);
  });
  apiPromises.set(view, promise);
  return promise;
}

interface Props {
  video: Video;
  /** seconde de reprise */
  startAt?: number;
  /** enchainer automatiquement sur la vidéo suivante de Séquence */
  autoplayNext: boolean;
  onEnded?: () => void;
  /** segments SponsorBlock à sauter */
  segments?: SponsorSegment[];
  /** lecture en boucle (YouTube exige `playlist` pour l’iframe) */
  loop: boolean;
  /** vitesse et volume persistés dans les réglages */
  speed: number;
  volume: number;
  captions: boolean;
  /** état lecture/pause, pour les commandes du mini-lecteur */
  onPlayingChange?: (playing: boolean) => void;
}

/** Commandes exposées à l'hôte (mini-lecteur, chapitres cliquables). */
export interface PlayerHandle {
  /**
   * déplace la lecture ; `false` si le lecteur n'est pas encore prêt.
   * `resume` relance la lecture après le déplacement (utile pour un chapitre),
   * à laisser à `false` quand on se déplace dans une vidéo en pause.
   */
  seekTo: (seconds: number, resume?: boolean) => boolean;
  getCurrentTime: () => number;
  /** durée totale en secondes (0 tant que le lecteur ne la connaît pas) */
  getDuration: () => number;
  play: () => void;
  pause: () => void;
  isPlaying: () => boolean;
}

const SAVE_EVERY_MS = 5_000;
const SPONSOR_LABELS: Record<string, string> = {
  sponsor: 'Sponsor',
  selfpromo: 'Autopromotion',
  interaction: 'Demande d’abonnement',
  intro: 'Intro',
  outro: 'Outro',
  preview: 'Aperçu',
  music_offtopic: 'Musique hors sujet',
  filler: 'Remplissage',
};

/**
 * Lecteur YouTube officiel (iframe + API IFrame). Séquence ne gère que :
 * - la reprise de lecture (?t= / position mémorisée) ;
 * - la sauvegarde espacée de la position (moins d'écritures localStorage) ;
 * - l'enchaînement vers la suggestion suivante ;
 * - le saut automatique des segments SponsorBlock ;
 * - lecture/pause et l'état du lecteur pour le mini-lecteur.
 */
export const Player = forwardRef<PlayerHandle, Props>(function Player(
  {
    video,
    startAt = 0,
    autoplayNext,
    onEnded,
    segments = [],
    loop,
    speed,
    volume,
    captions,
    onPlayingChange,
  },
  ref
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const autoplayNextRef = useRef(autoplayNext);
  autoplayNextRef.current = autoplayNext;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const playingRef = useRef(false);
  const onPlayingChangeRef = useRef(onPlayingChange);
  onPlayingChangeRef.current = onPlayingChange;
  const lastSavedRef = useRef(0);
  const skippedRef = useRef(new Set<string>());
  const [sponsorNotice, setSponsorNotice] = useState('');
  const [failed, setFailed] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      seekTo(seconds: number, resume = true) {
        const player = playerRef.current;
        if (!player?.seekTo) return false;
        try {
          player.seekTo(Math.max(0, seconds), true);
          if (!resume) return true;
          // `playVideo()` immédiat annule parfois le seek : on laisse au
          // lecteur le temps d'appliquer la position avant de relancer.
          window.setTimeout(() => {
            if (playerRef.current !== player) return;
            try {
              player.playVideo?.();
            } catch {
              /* lecteur détruit entre-temps */
            }
          }, 450);
          return true;
        } catch {
          return false;
        }
      },
      getCurrentTime() {
        try {
          const time = Number(playerRef.current?.getCurrentTime?.() ?? 0);
          return Number.isFinite(time) ? time : 0;
        } catch {
          // la fenêtre du lecteur peut être en train de se fermer (PiP)
          return 0;
        }
      },
      getDuration() {
        try {
          const duration = Number(playerRef.current?.getDuration?.() ?? 0);
          return Number.isFinite(duration) && duration > 0 ? duration : 0;
        } catch {
          return 0;
        }
      },
      play() {
        try {
          playerRef.current?.playVideo?.();
        } catch {
          /* lecteur détruit */
        }
      },
      pause() {
        try {
          playerRef.current?.pauseVideo?.();
        } catch {
          /* lecteur détruit */
        }
      },
      isPlaying() {
        return playingRef.current;
      },
    }),
    []
  );

  // création du lecteur (une fois par vidéo, par position de reprise)
  useEffect(() => {
    let disposed = false;
    const wrap = wrapRef.current;
    if (!wrap) return;
    // la fenêtre qui contient l'iframe : la page, ou la fenêtre Picture-in-Picture
    const view = wrap.ownerDocument.defaultView ?? window;

    // YT.Player remplace l'élément hôte : on lui donne un div jetable.
    const host = view.document.createElement('div');
    host.className = 'player__host';
    wrap.appendChild(host);
    setFailed(false);
    lastSavedRef.current = 0;
    skippedRef.current.clear();

    const reportPlaying = (value: boolean) => {
      if (playingRef.current === value) return;
      playingRef.current = value;
      onPlayingChangeRef.current?.(value);
    };

    /** la lecture a-t-elle atteint la fin de la vidéo ? */
    const reachedEnd = () => {
      try {
        const player = playerRef.current;
        const duration = Number(player?.getDuration?.() ?? 0);
        const time = Number(player?.getCurrentTime?.() ?? 0);
        // direct ou durée inconnue : on ne peut pas trancher, on enchaîne
        if (!Number.isFinite(duration) || duration <= 0) return true;
        return time >= duration - 15;
      } catch {
        return true;
      }
    };

    loadYouTubeApi(view)
      .then((YT) => {
        if (disposed) return;
        const reportReady = () => {
          applyPlaybackSettings();
          // l'autoplay a pu démarrer pendant le chargement du lecteur
          try {
            if (playerRef.current?.getPlayerState?.() === 1) reportPlaying(true);
          } catch {
            /* état indisponible avant la première lecture */
          }
        };
        playerRef.current = new YT.Player(host, {
          videoId: video.id,
          playerVars: {
            start: Math.max(0, Math.floor(startAt)),
            autoplay: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            hl: 'fr',
            cc_load_policy: captions ? 1 : 0,
            loop: loop ? 1 : 0,
            ...(loop ? { playlist: video.id } : {}),
          },
          events: {
            onReady: reportReady,
            onStateChange: (event: any) => {
              // `destroy()` peut émettre un état 0 : ne pas relancer une
              // navigation alors qu'on quitte déjà la vidéo
              if (disposed) return;
              const state = event.data;
              // 1 = lecture, 2 = pause, 0 = fin (3 = mise en mémoire tampon)
              if (state === 0 || state === 2) reportPlaying(false);
              else if (state === 1) reportPlaying(true);
              if (state === 0 || state === 2) saveNow();
              // Un état 0 peut aussi être émis quand la vidéo n'est pas lisible :
              // on n'enchaîne que si la lecture a réellement atteint la fin,
              // sinon la file d'attente se viderait d'un coup.
              if (state === 0 && autoplayNextRef.current && reachedEnd()) onEndedRef.current?.();
            },
          },
        });
      })
      .catch(() => !disposed && setFailed(true));

    return () => {
      disposed = true;
      saveNow();
      reportPlaying(false);
      const player = playerRef.current;
      playerRef.current = null;
      try {
        player?.destroy?.();
      } catch {
        /* ignore */
      }
      host.remove();
    };
  }, [video.id, startAt]);

  const applyPlaybackSettings = () => {
    const player = playerRef.current;
    if (!player) return;
    const current = useStore.getState().settings;
    try {
      player.setPlaybackRate?.(current.speed);
      player.setVolume?.(current.volume);
      if (current.captions) player.loadModule?.('captions');
      else player.unloadModule?.('captions');
    } catch {
      /* certains réglages ne sont pas disponibles avant la première lecture */
    }
  };

  const saveNow = () => {
    const player = playerRef.current;
    if (!player?.getCurrentTime) return;
    let time = 0;
    try {
      time = Number(player.getCurrentTime()) || 0;
    } catch {
      return;
    }
    if (time > 1) {
      useStore.getState().saveProgress(video.id, time);
      lastSavedRef.current = time;
    }
  };

  // Les réglages changés depuis la page Paramètres s'appliquent à chaud.
  useEffect(() => {
    playerRef.current?.setPlaybackRate?.(speed);
  }, [speed]);

  useEffect(() => {
    playerRef.current?.setVolume?.(volume);
  }, [volume]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player?.loadModule) return;
    if (captions) player.loadModule('captions');
    else player.unloadModule?.('captions');
  }, [captions]);

  // Position : sauvegarde espacée + saut des segments SponsorBlock.
  useEffect(() => {
    const tick = window.setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;
      let time = 0;
      try {
        time = Number(player.getCurrentTime()) || 0;
      } catch {
        return;
      }
      if (time <= 1) return;

      if (Math.abs(time - lastSavedRef.current) >= SAVE_EVERY_MS / 1000) {
        useStore.getState().saveProgress(video.id, time);
        lastSavedRef.current = time;
      }

      const segment = segmentsRef.current.find(
        (s) =>
          s.actionType === 'skip' &&
          time >= s.start - 0.3 &&
          time < s.end - 0.75 &&
          !skippedRef.current.has(s.uuid || `${s.start}-${s.end}`)
      );
      if (segment && player.seekTo) {
        skippedRef.current.add(segment.uuid || `${segment.start}-${segment.end}`);
        player.seekTo(segment.end, true);
        setSponsorNotice(`Sponsor ignoré · ${SPONSOR_LABELS[segment.category] ?? segment.category}`);
        window.setTimeout(() => setSponsorNotice(''), 3_500);
      }
    }, 1_000);
    return () => window.clearInterval(tick);
  }, [video.id]);

  // Dernière chance de sauvegarder la position avant de quitter l'onglet.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', saveNow);
      document.removeEventListener('visibilitychange', onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  return (
    <div className="player">
      <div className="player__wrap" ref={wrapRef} />
      {failed && (
        <p className="player__error">
          Le lecteur YouTube n’a pas pu se charger. Vérifiez votre connexion ou ouvrez la vidéo sur
          YouTube.
        </p>
      )}
      {sponsorNotice && (
        <p className="player__notice" role="status" aria-live="polite">
          {sponsorNotice}
        </p>
      )}
    </div>
  );
});
