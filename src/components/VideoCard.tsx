import { Link } from 'react-router-dom';
import type { Video } from '../types';
import { formatDuration, translateRelative } from '../lib/format';
import { Avatar } from './Avatar';
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
}

export function VideoCard({ video, variant = 'grid', progress, onRemove, onDismiss }: Props) {
  const watchUrl = `/watch?v=${video.id}`;
  const channelUrl = `/channel/${encodeURIComponent(video.channelId)}`;

  return (
    <article className={`card card--${variant}`}>
      <Link className="card__thumb" to={watchUrl} aria-label={video.title}>
        <div className="thumb">
          <Thumb videoId={video.id} isShort={video.isShort} alt={video.title} />
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
