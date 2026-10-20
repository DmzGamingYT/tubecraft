import { Link } from 'react-router-dom';
import type { Video } from '../types';
import { formatDuration, translateRelative } from '../lib/format';
import { useStore } from '../store';
import { Avatar } from './Avatar';
import { IconClock } from './icons';
import { Thumb } from './Thumb';

type Variant = 'grid' | 'row' | 'compact';

interface Props {
  video: Video;
  variant?: Variant;
  /** barre de progression (historique) 0..1 */
  progress?: number;
  onRemove?: () => void;
  /** « Pas intéressé » (accueil) */
  onDismiss?: () => void;
  /** explication d'une recommandation (accueil) */
  note?: string;
  /** « Moins de cette chaîne » dans les recommandations */
  onMuteChannel?: () => void;
}

export function VideoCard({
  video,
  variant = 'grid',
  progress,
  onRemove,
  onDismiss,
  note,
  onMuteChannel,
}: Props) {
  const watchUrl = `/watch?v=${video.id}`;
  const channelUrl = `/channel/${encodeURIComponent(video.channelId)}`;
  const queued = useStore((s) => s.queue.includes(video.id));
  const toggleQueue = useStore((s) => s.toggleQueue);
  const showQueue = variant !== 'compact';
  // largeur réellement occupée par la vignette, selon la variante et l'écran
  const thumbSizes =
    variant === 'row'
      ? '(max-width: 900px) 100vw, 360px'
      : variant === 'compact'
        ? '168px'
        : '(max-width: 560px) 100vw, (max-width: 1024px) 45vw, 300px';

  return (
    <article className={`card card--${variant}`}>
      <div className="card__thumbwrap">
        <Link className="card__thumb" to={watchUrl} aria-label={video.title}>
          <div className="thumb">
            <Thumb videoId={video.id} isShort={video.isShort} alt={video.title} sizes={thumbSizes} />
            {video.duration != null && video.duration > 0 && (
              <span className="thumb__duration">{formatDuration(video.duration)}</span>
            )}
            {progress != null && (
              <span className="thumb__progress">
                <span style={{ width: `${Math.min(100, Math.max(2, progress * 100))}%` }} />
              </span>
            )}
            {video.isShort && <span className="thumb__badge">Short</span>}
          </div>
        </Link>
        {showQueue && (
          <button
            type="button"
            className={`card__queue${queued ? ' is-queued' : ''}`}
            onClick={() => toggleQueue(video.id)}
            aria-pressed={queued}
            aria-label={queued ? 'Retirer de Lire ensuite' : 'Ajouter à Lire ensuite'}
            title={queued ? 'Retirer de Lire ensuite' : 'Lire ensuite'}
          >
            <IconClock width={16} height={16} />
            <span>{queued ? 'Dans la file' : 'Lire ensuite'}</span>
          </button>
        )}
      </div>

      <div className="card__body">
        {variant === 'grid' && (
          <Link className="card__avatar" to={channelUrl} aria-label={video.channelName}>
            <Avatar name={video.channelName} size={36} />
          </Link>
        )}

        <div className="card__text">
          <Link className="card__title" to={watchUrl}>
            {video.title}
          </Link>
          <div className="card__channel">
            <Link to={channelUrl}>{video.channelName}</Link>
          </div>
          <div className="card__stats">
            {video.views}
            {video.publishedAt ? ` • ${translateRelative(video.publishedAt)}` : ''}
          </div>
          {note && (
            <p className="card__why">
              <span>{note}</span>
              {onMuteChannel && (
                <button type="button" onClick={onMuteChannel}>
                  Moins de cette chaîne
                </button>
              )}
            </p>
          )}
          {variant !== 'grid' && video.description && (
            <p className="card__desc">{video.description}</p>
          )}
        </div>

        {onDismiss && (
          <button className="card__dismiss" onClick={onDismiss} title="Pas intéressé">
            ✕
          </button>
        )}

        {onRemove && (
          <button className="card__remove" onClick={onRemove} title="Retirer de la liste">
            ✕
          </button>
        )}
      </div>
    </article>
  );
}
