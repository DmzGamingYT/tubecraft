import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { shorts as catalogShorts, getChannel, getVideo } from '../data';
import { searchYouTube } from '../api/search';
import { useLockBodyScroll } from '../lib/hooks';
import { useStore } from '../store';
import type { Video } from '../types';
import { Avatar } from '../components/Avatar';
import { IconComment, IconDislike, IconLike, IconShare } from '../components/icons';

/** Feed vertical plein écran façon Shorts : défilement magnétique + lecture de la vidéo active. */
export function Shorts() {
  const [items, setItems] = useState<Video[]>(catalogShorts);
  const [active, setActive] = useState(0);
  const [note, setNote] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useLockBodyScroll(true);

  // repli : si le catalogue n'a pas de Shorts, on en cherche en direct
  useEffect(() => {
    if (catalogShorts.length > 0) return;
    let cancelled = false;
    setNote('Chargement des Shorts depuis YouTube…');
    searchYouTube('#shorts')
      .then((r) => {
        if (cancelled) return;
        const list = r.results
          .map((x) => getVideo(x.videoId))
          .filter((v): v is Video => Boolean(v))
          .slice(0, 20);
        setItems(list);
        setNote(list.length ? '' : 'Aucun Short trouvé.');
      })
      .catch(() => !cancelled && setNote('Impossible de charger les Shorts.'));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset.index ?? 0);
            setActive(index);
          }
        }
      },
      { root, threshold: 0.6 }
    );
    root.querySelectorAll('.short').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  const goTo = (index: number) => {
    const target = Math.min(items.length - 1, Math.max(0, index));
    setActive(target);
    const el = containerRef.current?.querySelector<HTMLElement>(`.short[data-index="${target}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        goTo(active + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goTo(active - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, items.length]);

  return (
    <div className="shorts">
      <div className="shorts__feed" ref={containerRef}>
        {items.map((video, index) => (
          <ShortItem
            key={video.id}
            video={video}
            index={index}
            playing={Math.abs(index - active) <= 1}
            active={index === active}
            onNext={() => goTo(index + 1)}
          />
        ))}
        {items.length === 0 && <p className="empty">{note || 'Aucun Short disponible.'}</p>}
      </div>

      {items.length > 1 && (
        <div className="shorts__dots" aria-hidden>
          {items.slice(0, 12).map((v, i) => (
            <span key={v.id} className={i === active ? 'on' : ''} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShortItem({
  video,
  index,
  playing,
  active,
  onNext,
}: {
  video: Video;
  index: number;
  playing: boolean;
  active: boolean;
  onNext: () => void;
}) {
  const liked = useStore((s) => s.liked.includes(video.id));
  const disliked = useStore((s) => s.disliked.includes(video.id));
  const toggleLike = useStore((s) => s.toggleLike);
  const toggleDislike = useStore((s) => s.toggleDislike);
  const subscribed = useStore((s) => s.subscribed.includes(video.channelId));
  const toggleSubscribe = useStore((s) => s.toggleSubscribe);
  const [copied, setCopied] = useState(false);
  const channel = getChannel(video.channelId);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/watch?v=${video.id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="short" data-index={index} aria-label={video.title}>
      <div className="short__frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&loop=1&playlist=${video.id}&controls=1&modestbranding=1&playsinline=1&rel=0&hl=fr`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" loading="lazy" />
        )}
      </div>

      <div className="short__info">
        <Link className="short__channel" to={`/channel/${encodeURIComponent(video.channelId)}`}>
          <Avatar name={video.channelName} src={channel?.avatar} size={36} />
          <span>{video.channelName}</span>
        </Link>
        {!subscribed && (
          <button className="subscribe subscribe--small" onClick={() => toggleSubscribe(video.channelId)}>
            S’abonner
          </button>
        )}
        <p className="short__title">{video.title}</p>
      </div>

      <div className="short__rail">
        <button
          className={`rail__btn${liked ? ' rail__btn--on' : ''}`}
          onClick={() => toggleLike(video.id)}
          aria-label="J’aime"
        >
          <IconLike width={24} height={24} />
          <span>{video.likes > 999 ? `${Math.round(video.likes / 1000)} k` : video.likes}</span>
        </button>
        <button
          className={`rail__btn${disliked ? ' rail__btn--on' : ''}`}
          onClick={() => toggleDislike(video.id)}
          aria-label="Je n’aime pas"
        >
          <IconDislike width={24} height={24} />
          <span>Je n’aime pas</span>
        </button>
        <Link className="rail__btn" to={`/watch?v=${video.id}`} aria-label="Commentaires">
          <IconComment width={24} height={24} />
          <span>Commentaires</span>
        </Link>
        <button className="rail__btn" onClick={share} aria-label="Partager">
          <IconShare width={24} height={24} />
          <span>{copied ? 'Copié !' : 'Partager'}</span>
        </button>
        {active && (
          <button className="rail__btn" onClick={onNext} aria-label="Short suivant">
            <span className="rail__next">▼</span>
            <span>Suivant</span>
          </button>
        )}
      </div>
    </section>
  );
}
