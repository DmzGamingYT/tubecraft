import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getVideo, subscribedVideos } from '../data';
import { useStore } from '../store';
import type { Video } from '../types';
import { Avatar } from '../components/Avatar';
import { VideoCard } from '../components/VideoCard';

type Kind = 'subs' | 'history' | 'liked' | 'watchLater';

const titles: Record<Kind, string> = {
  subs: 'Abonnements',
  history: 'Historique',
  liked: 'Vidéos likées',
  watchLater: 'Regarder plus tard',
};

export function Feed({ kind }: { kind: Kind }) {
  const subscribed = useStore((s) => s.subscribed);
  const history = useStore((s) => s.history);
  const liked = useStore((s) => s.liked);
  const watchLater = useStore((s) => s.watchLater);
  const progress = useStore((s) => s.progress);
  const clearHistory = useStore((s) => s.clearHistory);
  const removeFromHistory = useStore((s) => s.removeFromHistory);
  const toggleWatchLater = useStore((s) => s.toggleWatchLater);
  const [search, setSearch] = useState('');

  const ids =
    kind === 'subs'
      ? subscribedVideos(subscribed).map((v) => v.id)
      : kind === 'history'
        ? history
        : kind === 'liked'
          ? liked
          : watchLater;

  let items = ids.map((id) => getVideo(id)).filter((v): v is Video => Boolean(v));

  if (kind === 'history' && search.trim()) {
    const needle = search.trim().toLowerCase();
    items = items.filter(
      (v) => v.title.toLowerCase().includes(needle) || v.channelName.toLowerCase().includes(needle)
    );
  }

  const channels = subscribed
    .map((id) => ({ id, video: subscribedVideos([id])[0] }))
    .filter((c) => c.video);

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">{titles[kind]}</h1>
        {kind === 'history' && (
          <div className="headtools">
            <input
              className="headtools__input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher dans l’historique"
              aria-label="Rechercher dans l’historique"
            />
            {items.length > 0 && (
              <button className="btn btn--ghost" onClick={clearHistory}>
                Effacer l’historique
              </button>
            )}
          </div>
        )}
      </header>

      {kind === 'subs' && channels.length > 0 && (
        <div className="channelsrow">
          {channels.map((c) => (
            <Link key={c.id} to={`/channel/${encodeURIComponent(c.id)}`} className="channelsrow__item">
              <Avatar name={c.video!.channelName} size={56} />
              <span>{c.video!.channelName}</span>
            </Link>
          ))}
        </div>
      )}

      <section className="grid">
        {items.map((v, i) => {
          const seconds = progress[v.id] ?? 0;
          const ratio = v.duration && seconds > 0 ? seconds / v.duration : 0;
          return (
            <VideoCard
              key={`${v.id}-${i}`}
              video={v}
              progress={kind === 'history' && ratio > 0 && ratio < 0.98 ? ratio : undefined}
              onRemove={
                kind === 'history'
                  ? () => removeFromHistory(v.id)
                  : kind === 'watchLater'
                    ? () => toggleWatchLater(v.id)
                    : undefined
              }
            />
          );
        })}
      </section>

      {items.length === 0 && (
        <div className="empty">
          {kind === 'subs' && (
            <>
              <p>Aucun abonnement pour le moment.</p>
              <p>
                Ouvrez une vidéo et cliquez sur <strong>S’abonner</strong> pour retrouver les nouveautés
                de vos chaînes ici. <Link to="/">Explorer l’accueil</Link>
              </p>
            </>
          )}
          {kind === 'history' && (
            <>
              <p>{search ? 'Aucun résultat pour cette recherche.' : 'Votre historique de visionnage est vide.'}</p>
              {!search && (
                <p>
                  Les vidéos que vous ouvrez apparaissent ici. <Link to="/">Commencer à regarder</Link>
                </p>
              )}
            </>
          )}
          {kind === 'liked' && (
            <>
              <p>Aucune vidéo likée.</p>
              <p>
                Cliquez sur <strong>J’aime</strong> sous une vidéo pour la garder ici.{' '}
                <Link to="/">Découvrir des vidéos</Link>
              </p>
            </>
          )}
          {kind === 'watchLater' && (
            <>
              <p>Rien dans « Regarder plus tard ».</p>
              <p>
                Utilisez <strong>Enregistrer</strong> sous une vidéo pour la mettre de côté.{' '}
                <Link to="/">Parcourir l’accueil</Link>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
