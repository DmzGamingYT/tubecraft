import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSubscriptionFeed } from '../api/youtube';
import { subscribedVideos } from '../data';
import { useStore } from '../store';
import { useClickOutside } from '../lib/hooks';
import { notificationCacheKey } from '../lib/notifications';
import type { Video } from '../types';
import { IconBell } from './icons';
import { Thumb } from './Thumb';

const CACHE_KEY = 'tubecraft-notifications-v1';
const CACHE_TTL = 10 * 60_000;

type Source = 'idle' | 'loading' | 'live' | 'cache' | 'offline' | 'fallback';

interface NotificationCache {
  at: number;
  key: string;
  videos: Video[];
  live: boolean;
}

function readCache(): NotificationCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NotificationCache>;
    if (!Array.isArray(parsed.videos) || typeof parsed.at !== 'number') return null;
    return {
      at: parsed.at,
      key: typeof parsed.key === 'string' ? parsed.key : '',
      videos: parsed.videos as Video[],
      live: Boolean(parsed.live),
    };
  } catch {
    return null;
  }
}

function writeCache(cache: NotificationCache) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // quota dépassé : la cloche reste utilisable sans cache
  }
}

/**
 * Cloche de notifications : dernières vidéos réelles des chaînes abonnées.
 * Le relevé est mis en cache 10 minutes, et le catalogue embarqué sert de
 * repli quand YouTube est injoignable. Le niveau « Aucune » exclut la chaîne.
 */
export function NotificationsBell() {
  const subscribed = useStore((s) => s.subscribed);
  const levels = useStore((s) => s.notifLevels);
  const seen = useStore((s) => s.notificationsSeen);
  const markSeen = useStore((s) => s.markNotificationsSeen);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Video[]>([]);
  const [source, setSource] = useState<Source>('idle');
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const controller = useRef<AbortController | null>(null);

  const channels = useMemo(
    () => subscribed.filter((id) => (levels[id] ?? 'personalized') !== 'none'),
    [subscribed, levels]
  );
  const cacheKey = useMemo(() => notificationCacheKey(channels), [channels]);

  // repli : nouveautés du catalogue, dans l'ordre des abonnements
  const fallback = useMemo(() => subscribedVideos(channels).slice(0, 24), [channels]);

  const load = useCallback(
    async (force = false) => {
      if (channels.length === 0) {
        setItems([]);
        setSource('idle');
        setError('');
        return;
      }

      const cached = readCache();
      const sameProfile = cached?.key === cacheKey;
      if (!force && sameProfile && Date.now() - cached.at < CACHE_TTL) {
        setItems(cached.videos);
        setRefreshedAt(cached.at);
        setSource(navigator.onLine ? 'cache' : 'offline');
        return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setItems(sameProfile && cached ? cached.videos : fallback);
        setRefreshedAt(sameProfile && cached ? cached.at : null);
        setSource('offline');
        setError('');
        return;
      }

      controller.current?.abort();
      const next = new AbortController();
      controller.current = next;
      setSource('loading');
      setError('');

      try {
        const feed = await fetchSubscriptionFeed(channels, next.signal);
        if (next.signal.aborted) return;
        const videos = feed.live && feed.videos.length > 0 ? feed.videos : fallback;
        const at = Date.now();
        setItems(videos);
        setRefreshedAt(at);
        setSource(feed.live ? 'live' : 'fallback');
        if (!feed.live) setError('YouTube indisponible : nouveautés du catalogue affichées.');
        writeCache({ at, key: cacheKey, videos, live: feed.live });
      } catch {
        if (next.signal.aborted) return;
        const same = cached?.key === cacheKey ? cached : null;
        setItems(same?.videos ?? fallback);
        setRefreshedAt(same?.at ?? null);
        setSource(same ? 'cache' : 'fallback');
        setError('Impossible de joindre YouTube. Dernières nouveautés connues affichées.');
      }
    },
    [channels, cacheKey, fallback]
  );

  // premier relevé (ou changement d'abonnements / de niveaux)
  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void load(true);
    };
    const onOffline = () => {
      setOnline(false);
      setSource('offline');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      controller.current?.abort();
    };
  }, [load]);

  const unseen = useMemo(() => items.filter((video) => !seen.includes(video.id)), [items, seen]);

  const closeAndMark = () => {
    if (unseen.length > 0) markSeen(unseen.map((video) => video.id));
    setOpen(false);
  };

  const toggle = () => {
    if (open) closeAndMark();
    else {
      setOpen(true);
      if (items.length === 0 || (refreshedAt && Date.now() - refreshedAt > CACHE_TTL)) {
        void load(false);
      }
    }
  };

  const status =
    source === 'loading'
      ? 'Chargement des nouveautés…'
      : source === 'live'
        ? 'En direct des chaînes abonnées'
        : source === 'cache'
          ? 'Dernier relevé enregistré'
          : source === 'offline'
            ? 'Hors ligne — dernières nouveautés connues'
            : source === 'fallback'
              ? 'Catalogue local'
              : 'Aucune chaîne suivie';

  return (
    <div className="bellwrap" ref={ref}>
      <button
        className="iconbtn"
        onClick={toggle}
        aria-label="Notifications"
        aria-expanded={open}
        title="Notifications"
      >
        <IconBell width={22} height={22} />
        {unseen.length > 0 && (
          <span className="bellcount">{unseen.length > 9 ? '9+' : unseen.length}</span>
        )}
      </button>

      {open && (
        <div className="menu menu--notif">
          <div className="notif__head">
            <p className="menu__title">Notifications</p>
            <button
              className="notif__refresh"
              onClick={() => void load(true)}
              disabled={source === 'loading' || !online}
              title="Actualiser"
            >
              {source === 'loading' ? '…' : '↻'}
            </button>
          </div>
          <p className="notif__status" aria-live="polite">
            {status}
            {refreshedAt && source !== 'live'
              ? ` · ${new Date(refreshedAt).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : ''}
          </p>
          {error && <p className="notif__error">{error}</p>}

          {items.length === 0 && source !== 'loading' && (
            <p className="menu__empty">
              Aucune notification. Abonnez-vous à des chaînes pour suivre leurs nouveautés.
            </p>
          )}
          {source === 'loading' && items.length === 0 && (
            <p className="menu__empty">Recherche des dernières vidéos…</p>
          )}

          {items.map((video) => (
            <Link
              key={video.id}
              className={`notif${seen.includes(video.id) ? '' : ' notif--new'}`}
              to={`/watch?v=${video.id}`}
              onClick={() => {
                markSeen([video.id]);
                setOpen(false);
              }}
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
              <div className="notif__actions">
                <button className="menu__item" onClick={() => markSeen(items.map((v) => v.id))}>
                  Tout marquer comme lu
                </button>
                <button className="menu__item" onClick={closeAndMark}>
                  Fermer
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
