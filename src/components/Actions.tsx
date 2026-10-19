import { useEffect, useRef, useState } from 'react';
import { useStore, type NotifLevel } from '../store';
import type { Video } from '../types';
import { compactNumber } from '../lib/format';
import { useClickOutside } from '../lib/hooks';
import { watchUrl } from '../lib/url';
import {
  IconBell,
  IconBellOff,
  IconCheck,
  IconClock,
  IconDislike,
  IconLike,
  IconList,
  IconPlus,
  IconShare,
} from './icons';
import type { ReactNode } from 'react';

/** J'aime / Je n'aime pas / Partager — état persistant. */
export function LikeBar({ video }: { video: Video }) {
  const liked = useStore((s) => s.liked.includes(video.id));
  const disliked = useStore((s) => s.disliked.includes(video.id));
  const toggleLike = useStore((s) => s.toggleLike);
  const toggleDislike = useStore((s) => s.toggleDislike);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // likes réels (Return YouTube Dislike) + action locale
  const likeCount = (video.likes ?? 0) + (liked ? 1 : 0);
  const dislikeCount = video.dislikes ?? 0;
  const split = likeCount >= 1000;

  const share = async () => {
    const url = watchUrl(video.id);
    try {
      if (navigator.share) await navigator.share({ title: video.title, url });
      else await navigator.clipboard.writeText(url);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* l'utilisateur a annulé le partage */
    }
  };

  return (
    <div className="actions">
      <div className={`actions__like${split ? ' actions__like--split' : ''}`}>
        <button
          className={`actions__btn${liked ? ' actions__btn--on' : ''}`}
          onClick={() => toggleLike(video.id)}
          aria-pressed={liked}
          title="J’aime"
        >
          <IconLike width={22} height={22} />
          <span>{likeCount > 0 ? compactNumber(likeCount) : 'J’aime'}</span>
        </button>
        <span className="actions__divider" />
        <button
          className={`actions__btn actions__btn--dislike${disliked ? ' actions__btn--on' : ''}`}
          onClick={() => toggleDislike(video.id)}
          aria-pressed={disliked}
          title={
            dislikeCount > 0
              ? `Je n’aime pas (${dislikeCount.toLocaleString('fr-FR')})`
              : 'Je n’aime pas'
          }
        >
          <IconDislike width={22} height={22} />
          {dislikeCount > 0 && <span>{compactNumber(dislikeCount)}</span>}
        </button>
      </div>

      <button className="actions__pill" onClick={share}>
        <IconShare width={22} height={22} />
        <span>{copied ? 'Lien copié !' : 'Partager'}</span>
      </button>
    </div>
  );
}

// icônes de l'app (et non emojis) : rendu identique sur macOS, Windows,
// Android et iOS, contrairement aux pictogrammes système.
const LEVELS: Array<{ value: NotifLevel; label: string; icon: ReactNode }> = [
  { value: 'all', label: 'Toutes les notifications', icon: <IconBell width={18} height={18} /> },
  {
    value: 'personalized',
    label: 'Notifications personnalisées',
    icon: <IconBell width={18} height={18} />,
  },
  { value: 'none', label: 'Aucune', icon: <IconBellOff width={18} height={18} /> },
];

/** Bouton S'abonner / Abonné + cloche de notifications (3 niveaux, comme YouTube). */
export function SubscribeButton({ channelId, small = false }: { channelId: string; small?: boolean }) {
  const subscribed = useStore((s) => s.subscribed.includes(channelId));
  const toggle = useStore((s) => s.toggleSubscribe);
  const level = useStore((s) => s.notifLevels[channelId] ?? 'personalized');
  const setNotifLevel = useStore((s) => s.setNotifLevel);
  const [open, setOpen] = useState(false);
  const menuRef = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const cycleLevel = () => {
    const order: NotifLevel[] = ['all', 'personalized', 'none'];
    const next = order[(order.indexOf(level) + 1) % order.length];
    setNotifLevel(channelId, next);
  };

  return (
    <div className={`subwrap${small ? ' subwrap--small' : ''}`}>
      <button
        className={`subscribe${small ? ' subscribe--small' : ''}${subscribed ? ' subscribe--on' : ''}`}
        onClick={() => (subscribed ? setOpen((v) => !v) : toggle(channelId))}
        aria-pressed={subscribed}
      >
        {subscribed ? 'Abonné' : 'S’abonner'}
        {subscribed && <span className="subscribe__caret">▾</span>}
      </button>

      {subscribed && (
        <button
          className={`bell bell--${level}`}
          onClick={cycleLevel}
          title={LEVELS.find((l) => l.value === level)?.label}
          aria-label={LEVELS.find((l) => l.value === level)?.label}
        >
          {level === 'none' ? (
            <IconBellOff width={20} height={20} />
          ) : (
            <IconBell width={20} height={20} />
          )}
        </button>
      )}

      {subscribed && open && (
        <div className="menu menu--bell" ref={menuRef}>
          {LEVELS.map((option) => (
            <button
              key={option.value}
              className={`menu__item${option.value === level ? ' menu__item--active' : ''}`}
              onClick={() => {
                setNotifLevel(channelId, option.value);
                setOpen(false);
              }}
            >
              <span className="menu__icon">{option.icon}</span>
              {option.label}
            </button>
          ))}
          <hr className="menu__sep" />
          <button
            className="menu__item"
            onClick={() => {
              toggle(channelId);
              setOpen(false);
            }}
          >
            Se désabonner
          </button>
        </div>
      )}
    </div>
  );
}

/** Enregistrer : Regarder plus tard + playlists. */
export function SaveMenu({ video }: { video: Video }) {
  const [open, setOpen] = useState(false);
  const playlists = useStore((s) => s.playlists);
  const createPlaylist = useStore((s) => s.createPlaylist);
  const addToPlaylist = useStore((s) => s.addToPlaylist);
  const removeFromPlaylist = useStore((s) => s.removeFromPlaylist);
  const watchLater = useStore((s) => s.watchLater.includes(video.id));
  const toggleWatchLater = useStore((s) => s.toggleWatchLater);
  const queued = useStore((s) => s.queue.includes(video.id));
  const toggleQueue = useStore((s) => s.toggleQueue);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const menuRef = useClickOutside<HTMLDivElement>(() => setOpen(false));

  return (
    <div className="savewrap" ref={menuRef}>
      <button className="actions__pill" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <IconClock width={22} height={22} />
        <span>Enregistrer</span>
      </button>

      {open && (
        <div className="menu menu--save">
          <button
            className="menu__item"
            onClick={() => toggleWatchLater(video.id)}
          >
            <span className="menu__icon">
              {watchLater ? <IconCheck width={18} height={18} /> : <IconClock width={18} height={18} />}
            </span>
            {watchLater ? 'Retirer de Regarder plus tard' : 'Regarder plus tard'}
          </button>

          <button className="menu__item" onClick={() => toggleQueue(video.id)}>
            <span className="menu__icon">
              {queued ? <IconCheck width={18} height={18} /> : <IconList width={18} height={18} />}
            </span>
            {queued ? 'Retirer de Lire ensuite' : 'Lire ensuite'}
          </button>

          <hr className="menu__sep" />
          <p className="menu__title">Playlists</p>

          {playlists.length === 0 && <p className="menu__empty">Aucune playlist pour l’instant.</p>}

          {playlists.map((playlist) => {
            const included = playlist.videoIds.includes(video.id);
            return (
              <button
                key={playlist.id}
                className={`menu__item${included ? ' menu__item--active' : ''}`}
                onClick={() =>
                  included
                    ? removeFromPlaylist(playlist.id, video.id)
                    : addToPlaylist(playlist.id, video.id)
                }
              >
                <span className="menu__icon">
                  {included ? <IconCheck width={18} height={18} /> : <IconPlus width={18} height={18} />}
                </span>
                {playlist.name}
                <span className="menu__count">{playlist.videoIds.length}</span>
              </button>
            );
          })}

          <hr className="menu__sep" />
          {creating ? (
            <form
              className="menu__form"
              onSubmit={(e) => {
                e.preventDefault();
                const id = createPlaylist(name, video.id);
                setName('');
                setCreating(false);
                void id;
              }}
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom de la playlist"
                aria-label="Nom de la playlist"
              />
              <button className="btn btn--primary" type="submit">
                Créer
              </button>
            </form>
          ) : (
            <button className="menu__item" onClick={() => setCreating(true)}>
              <span className="menu__icon">
                <IconPlus width={18} height={18} />
              </span>
              Créer une playlist
            </button>
          )}
        </div>
      )}
    </div>
  );
}
