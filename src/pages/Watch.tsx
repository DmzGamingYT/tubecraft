import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getChannel, getVideo, relatedVideos, videosFromChannel } from '../data';
import { formatDuration } from '../lib/format';
import { parseChapters, parseTimestamp } from '../lib/chapters';
import { setPageMeta } from '../lib/meta';
import { appUrl } from '../lib/url';
import { useStore } from '../store';
import type { Video, VideoPage } from '../types';
import { fetchVideoPage } from '../api/youtube';
import { LikeBar, SaveMenu, SubscribeButton } from '../components/Actions';
import { Avatar } from '../components/Avatar';
import { Comments } from '../components/Comments';
import { PlayerSlot, usePlayerHost } from '../components/PlayerHost';
import { VideoSummaryCard } from '../components/VideoSummary';
import { VideoCard } from '../components/VideoCard';

type LoadState = 'idle' | 'loading' | 'ok' | 'error';

export function Watch() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('v');
  const catalogVideo = getVideo(id);

  const [details, setDetails] = useState<VideoPage | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [descOpen, setDescOpen] = useState(false);
  const player = usePlayerHost();

  const saveProgress = useStore((s) => s.saveProgress);
  const autoplayNext = useStore((s) => s.settings.autoplayNext);
  const theater = useStore((s) => s.settings.theater);
  const sponsorBlock = useStore((s) => s.settings.sponsorBlock);
  const aiSummary = useStore((s) => s.settings.aiSummary);
  const playlistId = params.get('list');
  const playlists = useStore((s) => s.playlists);
  const watchLater = useStore((s) => s.watchLater);
  const personalQueue = useStore((s) => s.queue);

  /* ---------------------------------------------------------- métadonnées */

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setDetails(null);
    setLoadState('loading');

    fetchVideoPage(id, controller.signal)
      .then((page) => {
        setDetails(page);
        setLoadState('ok');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadState('error');
      });

    return () => controller.abort();
  }, [id]);

  // une autre vidéo = on repart du haut, même si le lecteur reste monté
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [id]);

  const video: Video | undefined = details?.video ?? catalogVideo;
  const channel = details?.channel ?? (video ? getChannel(video.channelId) : undefined);
  const related = useMemo(
    () => (details?.related.length ? details.related : video ? relatedVideos(video, 16) : []),
    [details, video]
  );

  // reprendre au bon endroit sans abonner toute la page au store « progress »
  const resumeAt = useMemo(() => {
    if (!id) return 0;
    const seconds = parseTimestamp(params.get('t'));
    if (seconds > 0) return seconds;
    const stored = useStore.getState().progress[id] ?? 0;
    const duration = catalogVideo?.duration ?? null;
    if (stored > 5 && (!duration || stored < duration - 10)) return stored;
    return 0;
    // on ne veut recalculer que lorsqu'on change de vidéo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, params, catalogVideo?.duration]);

  /* ------------------------------------------------------------- chapitres */

  // retour depuis le mini-lecteur : la vidéo tourne déjà, pas de « reprise à… »
  const alreadyPlaying = useMemo(() => player.currentVideoId() === id, [player, id]);

  // un lien « ?t=… » cliqué pendant la lecture déplace le lecteur existant
  const timestamp = params.get('t');
  // `undefined` = premier rendu (le démarrage à la bonne seconde est déjà
  // géré par `startAt`) ; les changements suivants déplacent le lecteur.
  const previousTimestamp = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const previous = previousTimestamp.current;
    previousTimestamp.current = timestamp;
    if (previous === undefined || previous === timestamp) return;
    const seconds = parseTimestamp(timestamp);
    if (seconds <= 0) return;
    player.seekTo(seconds);
    document.querySelector('.player-slot')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [timestamp, player]);

  const chapters = useMemo(
    () => parseChapters(video?.description ?? ''),
    [video?.description]
  );

  /* -------------------------------------------------------- titre / partage */

  useEffect(() => {
    if (!video) return;
    setPageMeta(
      `${video.title} — Séquence`,
      video.description ? video.description.slice(0, 160) : undefined
    );
  }, [video]);

  useEffect(() => setDescOpen(false), [id]);

  const playlist =
    playlistId && playlistId !== 'watch-later'
      ? playlists.find((p) => p.id === playlistId)
      : undefined;
  const isWatchLater = playlistId === 'watch-later';

  // File de lecture : la playlist demandée, sinon la file personnelle
  // « Lire ensuite » (universelle), sinon les suggestions de la vidéo.
  const queue = useMemo(() => {
    if (playlist)
      return playlist.videoIds.map((v) => getVideo(v)).filter((v): v is Video => Boolean(v));
    if (isWatchLater)
      return watchLater.map((v) => getVideo(v)).filter((v): v is Video => Boolean(v));
    return personalQueue.map((v) => getVideo(v)).filter((v): v is Video => Boolean(v));
  }, [playlist, isWatchLater, playlists, watchLater, personalQueue]);

  const usingPersonalQueue = !playlist && !isWatchLater && queue.length > 0;
  const queueIndex = queue.findIndex((item) => item.id === id);

  const upNext = useMemo(() => {
    if (usingPersonalQueue) {
      return queueIndex >= 0 ? queue.slice(queueIndex + 1) : queue;
    }
    return queue.length > 0 && queueIndex >= 0 ? queue.slice(queueIndex + 1) : related;
  }, [usingPersonalQueue, queue, queueIndex, related]);

  const queueLabel = playlist
    ? `Playlist « ${playlist.name} »`
    : isWatchLater
      ? 'Regarder plus tard'
      : usingPersonalQueue
        ? 'Lire ensuite'
        : 'À suivre';

  useEffect(() => {
    player.setUpNext(upNext, queueLabel);
  }, [player, upNext, queueLabel]);

  if (!id) {
    return (
      <div className="page">
        <p className="empty">
          Aucune vidéo sélectionnée. <Link to="/">Retour à l’accueil</Link>
        </p>
      </div>
    );
  }

  if (!video && loadState === 'error') {
    return (
      <div className="page">
        <p className="empty">
          Cette vidéo n’est pas disponible : YouTube ne répond pas et elle n’est pas dans le
          catalogue. <Link to="/">Retour à l’accueil</Link>
        </p>
      </div>
    );
  }

  // pendant le chargement d'une vidéo inconnue, on affiche déjà le lecteur
  const display: Video =
    video ??
    ({
      id,
      title: 'Chargement…',
      channelId: '',
      channelName: '',
      duration: null,
      views: '',
      viewsCount: 0,
      publishedAt: '',
      description: '',
      category: '',
      tags: [],
      likes: 0,
    } satisfies Video);

  const channelName = channel?.name ?? display.channelName;
  const subscribers = channel?.subscribers ?? '';
  const fromChannel = (
    details?.related.length
      ? details.related.filter((v) => v.channelId === display.channelId && v.id !== display.id)
      : videosFromChannel(display.channelId).filter((v) => v.id !== display.id)
  ).slice(0, 4);
  // YouTube renvoie souvent les vidéos de la même chaîne en tête des
  // suggestions : on les retire de « Suggestions » pour éviter le doublon
  // avec la rangée « Autres vidéos de … » juste au-dessus.
  const channelVideoIds = new Set(fromChannel.map((v) => v.id));
  const suggestions = related.filter((v) => !channelVideoIds.has(v.id));

  const nextVideo = related[0];
  const nextInQueue =
    queueIndex >= 0
      ? queue[queueIndex + 1]
      : usingPersonalQueue
        ? queue[0]
        : undefined;
  const listParam = playlist ? `&list=${playlist.id}` : isWatchLater ? '&list=watch-later' : '';

  /** chapitre cliqué : on déplace le lecteur, sinon on recharge au bon timestamp */
  const seekToChapter = (seconds: number) => {
    if (player.seekTo(seconds)) {
      document.querySelector('.player')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    navigate(`/watch?v=${display.id}&t=${seconds}s${listParam}`);
  };

  const goNext = () => {
    const next = nextInQueue ?? nextVideo;
    if (next) {
      saveProgress(display.id, 0);
      navigate(`/watch?v=${next.id}${listParam}`);
    }
  };

  const loadingMeta = loadState === 'loading' || (loadState === 'idle' && !catalogVideo);
  const youtubeUrl = `https://www.youtube.com/watch?v=${display.id}`;

  return (
    <div className={`watch${theater ? ' watch--theater' : ''}`}>
      <div className="watch__main">
        <PlayerSlot video={display} startAt={resumeAt} onEnded={goNext} />

        {resumeAt > 0 && !alreadyPlaying && (
          <p className="watch__resume">
            Reprise à {formatDuration(resumeAt)}{' '}
            <button
              className="linkbtn"
              onClick={() => {
                player.seekTo(0);
                navigate(`/watch?v=${display.id}${listParam}`, { replace: true });
              }}
            >
              recommencer du début
            </button>
          </p>
        )}

        {loadingMeta && !catalogVideo ? (
          <div className="watch__skeleton">
            <span className="skeleton skeleton--line" style={{ width: '70%', height: 24 }} />
            <span className="skeleton skeleton--line" style={{ width: '35%' }} />
          </div>
        ) : (
          <h1 className="watch__title">{display.title}</h1>
        )}

        <div className="watch__bar">
          <Link className="watch__channel" to={`/channel/${encodeURIComponent(display.channelId)}`}>
            <Avatar name={channelName || 'Chaîne'} src={channel?.avatar ?? display.channelAvatar} size={40} />
            <span className="watch__channel-text">
              <strong>{channelName || 'Chaîne inconnue'}</strong>
              {subscribers && <span className="muted">{subscribers}</span>}
            </span>
          </Link>

          <div className="watch__bar-right">
            <LikeBar video={display} />
            <SaveMenu video={display} />
            {display.channelId && <SubscribeButton channelId={display.channelId} />}
          </div>
        </div>

        {(playlist || isWatchLater) && (
          <div className="queuebar">
            <span className="queuebar__label">
              {playlist ? 'Playlist' : 'Regarder plus tard'} :{' '}
              <strong>{playlist?.name ?? 'file d’attente'}</strong> ({queueIndex + 1}/{queue.length})
            </span>
            <button className="btn btn--ghost" onClick={goNext} disabled={!nextInQueue}>
              Vidéo suivante
            </button>
            {playlist ? (
              <Link className="btn btn--ghost" to={`/playlist/${playlist.id}`}>
                Voir la playlist
              </Link>
            ) : (
              <Link className="btn btn--ghost" to="/watch-later">
                Voir Regarder plus tard
              </Link>
            )}
          </div>
        )}

        {usingPersonalQueue && (
          <div className="queuebar">
            <span className="queuebar__label">
              Lire ensuite : <strong>{queue.length} vidéo{queue.length > 1 ? 's' : ''}</strong>
              {queueIndex >= 0 ? ` (${queueIndex + 1}/${queue.length})` : ' · la file démarre ici'}
            </span>
            <button className="btn btn--ghost" onClick={goNext} disabled={!nextInQueue}>
              Vidéo suivante
            </button>
            <Link className="btn btn--ghost" to="/queue">
              Gérer la file
            </Link>
          </div>
        )}

        <div className={`desc${descOpen ? ' desc--open' : ''}`}>
          <div className="desc__stats">
            {display.views || 'Vues indisponibles'}
            {display.publishedAt ? ` • ${display.publishedAt}` : ''}
            {display.category ? ` • ${display.category}` : ''}
            {sponsorBlock && <span className="desc__sponsor"> • SponsorBlock actif</span>}
          </div>
          <p className="desc__text">
            {display.description || (loadState === 'loading' ? 'Chargement de la description…' : 'Aucune description fournie par la chaîne.')}
          </p>
          {display.tags.length > 0 && (
            <p className="desc__tags">
              {display.tags.map((t) => (
                <span key={t} className="tag">
                  #{t}
                </span>
              ))}
            </p>
          )}
          <div className="desc__actions">
            {(display.description.length > 180 || display.tags.length > 0) && (
              <button className="desc__more" onClick={() => setDescOpen((v) => !v)}>
                {descOpen ? '…moins' : '…plus'}
              </button>
            )}
            <a className="desc__more" href={youtubeUrl} target="_blank" rel="noreferrer noopener">
              Ouvrir sur YouTube ↗
            </a>
            <button
              className="desc__more"
              onClick={() => navigator.clipboard?.writeText(appUrl(`watch?v=${display.id}`))}
            >
              Copier le lien
            </button>
            <button
              className="desc__more"
              onClick={() => useStore.getState().setSetting('sponsorBlock', !sponsorBlock)}
              title="Sauter automatiquement les sponsors, intros et autopromotions (SponsorBlock)"
            >
              SponsorBlock : {sponsorBlock ? 'activé' : 'désactivé'}
            </button>
          </div>
        </div>

        {aiSummary && !loadingMeta && (
          <VideoSummaryCard video={display} onSeek={seekToChapter} />
        )}

        <Comments videoId={display.id} />
      </div>

      <aside className="watch__aside">
        {autoplayNext && nextVideo && (
          <label className="autoplaybar">
            <input
              type="checkbox"
              checked={autoplayNext}
              onChange={() => useStore.getState().setSetting('autoplayNext', !autoplayNext)}
            />
            Lecture automatique · prochaine vidéo : {nextVideo.title.slice(0, 40)}
            {nextVideo.title.length > 40 ? '…' : ''}
          </label>
        )}

        {fromChannel.length > 0 && (
          <>
            <h2 className="aside__title">Autres vidéos de {channelName}</h2>
            {fromChannel.map((v) => (
              <VideoCard key={v.id} video={v} variant="compact" />
            ))}
            <hr className="aside__sep" />
          </>
        )}

        {chapters.length > 0 && (
          <>
            <h2 className="aside__title">Chapitres</h2>
            <ol className="chapters">
              {chapters.map((chapter) => (
                <li key={`${chapter.sec}-${chapter.title}`}>
                  <Link to={`/watch?v=${display.id}&t=${chapter.sec}s${listParam}`}>
                    <span className="chapters__time">{formatDuration(chapter.sec)}</span>
                    {chapter.title}
                  </Link>
                </li>
              ))}
            </ol>
            <hr className="aside__sep" />
          </>
        )}

        {suggestions.length > 0 && (
          <>
            <h2 className="aside__title">Suggestions</h2>
            {suggestions.map((v) => (
              <VideoCard key={v.id} video={v} variant="compact" />
            ))}
          </>
        )}
        <p className="aside__note">
          {details?.related.length
            ? 'Suggestions fournies en direct par YouTube pour cette vidéo.'
            : 'Suggestions issues du catalogue embarqué (YouTube indisponible).'}{' '}
          Le lecteur YouTube gère ses propres contrôles et raccourcis (k, j / l, f, m…) : cliquez dans
          la vidéo pour les activer.
        </p>
      </aside>
    </div>
  );
}
