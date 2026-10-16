import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getChannel, getVideo, relatedVideos, videosFromChannel } from '../data';
import { formatDuration } from '../lib/format';
import { useStore } from '../store';
import { LikeBar, SaveMenu, SubscribeButton } from '../components/Actions';
import { Avatar } from '../components/Avatar';
import { Comments } from '../components/Comments';
import { Player } from '../components/Player';
import { VideoCard } from '../components/VideoCard';

export function Watch() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('v');
  const startParam = params.get('t');
  const video = getVideo(id);

  const addToHistory = useStore((s) => s.addToHistory);
  const saveProgress = useStore((s) => s.saveProgress);
  const storedProgress = useStore((s) => (id ? (s.progress[id] ?? 0) : 0));
  const autoplayNext = useStore((s) => s.settings.autoplayNext);
  const theater = useStore((s) => s.settings.theater);
  const playlistId = params.get('list');
  const playlists = useStore((s) => s.playlists);
  const [descOpen, setDescOpen] = useState(false);

  const chapters = (() => {
    const desc = video?.description ?? '';
    const matches = [...desc.matchAll(/(?:^|\s)(\d{1,2}(?::\d{2}){1,2})\s+([^]+?)(?=\s+\d{1,2}(?::\d{2}){1,2}(?:\s|$)|$)/g)];
    const list = matches
      .map((m) => {
        const parts = m[1].split(':').map((p) => parseInt(p, 10));
        if (parts.some((n) => Number.isNaN(n))) return null;
        const sec = parts.reduce((acc, p) => acc * 60 + p, 0);
        return { sec, title: m[2].trim().replace(/^[:*\s]+|[:*\s]+$/g, '') };
      })
      .filter((c): c is { sec: number; title: string } => Boolean(c));
    // on garde les chapitres dans l'ordre chronologique uniquement
    const ordered: { sec: number; title: string }[] = [];
    let last = -1;
    for (const c of list) {
      if (c.sec > last && c.title.length > 0) {
        ordered.push(c);
        last = c.sec;
      }
    }
    return ordered;
  })();

  const videoId = video?.id;
  const videoTitle = video?.title;

  useEffect(() => {
    if (!videoId || !videoTitle) return;
    addToHistory(videoId);
    const previous = document.title;
    document.title = `${videoTitle} — TubeCraft`;
    window.scrollTo({ top: 0 });
    return () => {
      document.title = previous;
    };
  }, [videoId, videoTitle, addToHistory]);

  useEffect(() => setDescOpen(false), [videoId]);

  const playlist = playlistId ? playlists.find((p) => p.id === playlistId) : undefined;
  const queue = useMemo(
    () => (playlist ? playlist.videoIds.map((v) => getVideo(v)).filter(Boolean) : []),
    [playlist]
  );

  if (!video) {
    return (
      <div className="page">
        <p className="empty">
          Cette vidéo n’est pas disponible dans le clone (elle a peut-être été ouverte depuis un lien
          direct). Lancez une recherche pour la retrouver. <Link to="/">Retour à l’accueil</Link>
        </p>
      </div>
    );
  }

  const channel = getChannel(video.channelId);
  const channelName = channel?.name ?? video.channelName;
  const subscribers = channel?.subscribers ?? '';
  const fromChannel = videosFromChannel(video.channelId)
    .filter((v) => v.id !== video.id)
    .slice(0, 4);
  const related = relatedVideos(video, 16);

  // reprise : ?t=42s prioritaire, sinon la position mémorisée (si l'on n'est pas à la fin)
  const parsedStart = startParam ? parseInt(startParam.replace(/\D/g, ''), 10) || 0 : 0;
  const resumeAt =
    parsedStart > 0
      ? parsedStart
      : storedProgress > 5 && (!video.duration || storedProgress < video.duration - 10)
        ? storedProgress
        : 0;

  const nextVideo = related[0];
  const queueIndex = queue.findIndex((v) => v?.id === video.id);
  const nextInQueue = queueIndex >= 0 ? queue[queueIndex + 1] : undefined;

  const goNext = () => {
    const next = nextInQueue ?? nextVideo;
    if (next) {
      saveProgress(video.id, 0);
      navigate(`/watch?v=${next.id}${playlist ? `&list=${playlist.id}` : ''}`);
    }
  };

  return (
    <div className={`watch${theater ? ' watch--theater' : ''}`}>
      <div className="watch__main">
        <Player
          key={`${video.id}-${resumeAt}`}
          video={video}
          startAt={resumeAt}
          autoplayNext={autoplayNext}
          onEnded={goNext}
        />

        {resumeAt > 0 && (
          <p className="watch__resume">
            Reprise à {formatDuration(resumeAt)}{' '}
            <button className="linkbtn" onClick={() => navigate(`/watch?v=${video.id}`)}>
              recommencer du début
            </button>
          </p>
        )}

        <h1 className="watch__title">{video.title}</h1>

        <div className="watch__bar">
          <Link className="watch__channel" to={`/channel/${encodeURIComponent(video.channelId)}`}>
            <Avatar name={channelName} src={channel?.avatar} size={40} />
            <span className="watch__channel-text">
              <strong>{channelName}</strong>
              {subscribers && <span className="muted">{subscribers}</span>}
            </span>
          </Link>

          <div className="watch__bar-right">
            <LikeBar video={video} />
            <SaveMenu video={video} />
            <SubscribeButton channelId={video.channelId} />
          </div>
        </div>

        {playlist && (
          <div className="queuebar">
            <span className="queuebar__label">
              Playlist : <strong>{playlist.name}</strong> ({queueIndex + 1}/{queue.length})
            </span>
            <button className="btn btn--ghost" onClick={goNext} disabled={!nextInQueue}>
              Vidéo suivante de la playlist
            </button>
            <Link className="btn btn--ghost" to={`/playlist/${playlist.id}`}>
              Voir la playlist
            </Link>
          </div>
        )}

        <div className={`desc${descOpen ? ' desc--open' : ''}`}>
          <div className="desc__stats">
            {video.views}
            {video.publishedAt ? ` • ${video.publishedAt}` : ''}
            {video.category ? ` • ${video.category}` : ''}
          </div>
          <p className="desc__text">{video.description || 'Aucune description fournie par la chaîne.'}</p>
          {video.tags.length > 0 && (
            <p className="desc__tags">
              {video.tags.map((t) => (
                <span key={t} className="tag">
                  #{t}
                </span>
              ))}
            </p>
          )}
          {(video.description.length > 180 || video.tags.length > 0) && (
            <button className="desc__more" onClick={() => setDescOpen((v) => !v)}>
              {descOpen ? '…moins' : '…plus'}
            </button>
          )}
        </div>

        <Comments videoId={video.id} />
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
        {chapters.length > 1 && (
          <>
            <h2 className="aside__title">Chapitres</h2>
            <ol className="chapters">
              {chapters.map((c, i) => (
                <li key={i}>
                  <Link to={`/watch?v=${video.id}&t=${c.sec}s`}>
                    <span className="chapters__time">{formatDuration(c.sec)}</span>
                    {c.title}
                  </Link>
                </li>
              ))}
            </ol>
            <hr className="aside__sep" />
          </>
        )}
        <h2 className="aside__title">Suggestions</h2>
        {related.map((v) => (
          <VideoCard key={v.id} video={v} variant="compact" />
        ))}
        <p className="aside__note">
          Suggestions issues du catalogue embarqué. Raccourcis du lecteur : k (lecture), j / l (±10 s), c
          (sous-titres), m (muet), t (théâtre).
        </p>
      </aside>
    </div>
  );
}
