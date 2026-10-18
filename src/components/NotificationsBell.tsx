import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribedVideos } from '../data';
import { useStore } from '../store';
import { useClickOutside } from '../lib/hooks';
import { IconBell } from './icons';
import { Thumb } from './Thumb';

/** Cloche de notifications : nouveautés des chaînes abonnées (niveau « Aucune » exclu). */
export function NotificationsBell() {
  const subscribed = useStore((s) => s.subscribed);
  const levels = useStore((s) => s.notifLevels);
  const seen = useStore((s) => s.notificationsSeen);
  const markSeen = useStore((s) => s.markNotificationsSeen);
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const items = useMemo(() => {
    const channels = subscribed.filter((id) => (levels[id] ?? 'personalized') !== 'none');
    return subscribedVideos(channels).slice(0, 24);
  }, [subscribed, levels]);

  const unseen = items.filter((v) => !seen.includes(v.id));

  return (
    <div className="bellwrap" ref={ref}>
      <button
        className="iconbtn"
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unseen.length > 0) markSeen(unseen.map((v) => v.id));
        }}
        aria-label="Notifications"
        title="Notifications"
      >
        <IconBell width={22} height={22} />
        {unseen.length > 0 && <span className="bellcount">{unseen.length > 9 ? '9+' : unseen.length}</span>}
      </button>

      {open && (
        <div className="menu menu--notif">
          <p className="menu__title">Notifications</p>
          {items.length === 0 && (
            <p className="menu__empty">
              Aucune notification. Abonnez-vous à des chaînes pour suivre leurs nouveautés.
            </p>
          )}
          {items.map((video) => (
            <Link
              key={video.id}
              className={`notif${seen.includes(video.id) ? '' : ' notif--new'}`}
              to={`/watch?v=${video.id}`}
              onClick={() => setOpen(false)}
            >
              <span className="notif__thumb">
                <Thumb videoId={video.id} isShort={video.isShort} />
              </span>
              <span className="notif__text">
                <strong>{video.channelName}</strong>
                <span>{video.title}</span>
                <span className="muted">{video.publishedAt}</span>
              </span>
            </Link>
          ))}
          {items.length > 0 && (
            <>
              <hr className="menu__sep" />
              <button className="menu__item" onClick={() => markSeen(items.map((v) => v.id))}>
                Tout marquer comme lu
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
