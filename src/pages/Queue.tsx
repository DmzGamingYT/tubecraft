import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getVideo } from '../data';
import { formatDuration } from '../lib/format';
import { setPageMeta } from '../lib/meta';
import { useStore } from '../store';
import type { Video } from '../types';
import { Thumb } from '../components/Thumb';

/**
 * File personnelle « Lire ensuite » : ordre libre, accessible depuis toutes
 * les cartes et depuis « Enregistrer ». Elle sert aussi de file de lecture
 * au mini-lecteur et à la page Watch.
 */
export function QueuePage() {
  const navigate = useNavigate();
  const queue = useStore((s) => s.queue);
  const moveQueue = useStore((s) => s.moveQueue);
  const removeFromQueue = useStore((s) => s.removeFromQueue);
  const clearQueue = useStore((s) => s.clearQueue);
  const progress = useStore((s) => s.progress);

  useEffect(() => {
    setPageMeta('Lire ensuite — TubeCraft');
  }, []);

  const items = useMemo(
    () => queue.map((id) => getVideo(id)).filter((video): video is Video => Boolean(video)),
    [queue]
  );

  const totalSeconds = items.reduce((sum, video) => sum + (video.duration ?? 0), 0);

  if (items.length === 0) {
    return (
      <div className="page">
        <header className="page__head">
          <h1 className="page__title">Lire ensuite</h1>
        </header>
        <div className="empty">
          <p>Votre file est vide.</p>
          <p>
            Survolez une vignette et cliquez sur <strong>Lire ensuite</strong>, ou utilisez{' '}
            <strong>Enregistrer</strong> sous une vidéo. <Link to="/">Parcourir l’accueil</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Lire ensuite</h1>
          <p className="muted">
            {items.length} vidéo{items.length > 1 ? 's' : ''}
            {totalSeconds > 0 ? ` · ${formatDuration(totalSeconds)}` : ''} · ordre enregistré dans ce
            navigateur
          </p>
        </div>
        <div className="headtools">
          <button className="btn btn--primary" onClick={() => navigate(`/watch?v=${items[0].id}`)}>
            ▶ Tout lire
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              if (window.confirm('Vider la file « Lire ensuite » ?')) clearQueue();
            }}
          >
            Vider
          </button>
        </div>
      </header>

      <ol className="queuepage">
        {items.map((video, index) => {
          const seconds = progress[video.id] ?? 0;
          const ratio = video.duration && seconds > 0 ? seconds / video.duration : 0;
          return (
            <li className="queuepage__item" key={video.id}>
              <span className="queuepage__index" aria-hidden>
                {index + 1}
              </span>
              <Link
                className="queuepage__thumb"
                to={`/watch?v=${video.id}`}
                aria-label={`Lire ${video.title}`}
              >
                <div className="thumb">
                  <Thumb videoId={video.id} isShort={video.isShort} alt={video.title} />
                  {video.duration != null && video.duration > 0 && (
                    <span className="thumb__duration">{formatDuration(video.duration)}</span>
                  )}
                  {ratio > 0 && ratio < 0.98 && (
                    <span className="thumb__progress">
                      <span style={{ width: `${Math.min(100, Math.max(2, ratio * 100))}%` }} />
                    </span>
                  )}
                </div>
              </Link>

              <div className="queuepage__text">
                <Link className="queuepage__title" to={`/watch?v=${video.id}`}>
                  {video.title}
                </Link>
                <Link className="queuepage__channel" to={`/channel/${encodeURIComponent(video.channelId)}`}>
                  {video.channelName}
                </Link>
                <span className="muted">
                  {video.views}
                  {video.publishedAt ? ` • ${video.publishedAt}` : ''}
                </span>
              </div>

              <div className="queuepage__actions">
                <button
                  type="button"
                  className="queuepage__btn"
                  onClick={() => moveQueue(video.id, -1)}
                  disabled={index === 0}
                  aria-label={`Monter ${video.title}`}
                  title="Monter"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="queuepage__btn"
                  onClick={() => moveQueue(video.id, 1)}
                  disabled={index === items.length - 1}
                  aria-label={`Descendre ${video.title}`}
                  title="Descendre"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="queuepage__btn queuepage__btn--remove"
                  onClick={() => removeFromQueue(video.id)}
                  aria-label={`Retirer ${video.title} de la file`}
                  title="Retirer"
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="page__footnote">
        La file est locale : elle appartient à ce profil et à ce navigateur. Elle sert de « à suivre »
        au mini-lecteur et à la lecture automatique.
      </p>
    </div>
  );
}
