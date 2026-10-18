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

function groupByDay(
  items: Video[],
  dates: Record<string, number>
): Array<{ label: string; videos: Video[] }> {
  const groups: Array<{ label: string; videos: Video[] }> = [];
  for (const video of items) {
    const label = dayLabel(dates[video.id]);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.videos.push(video);
    else groups.push({ label, videos: [video] });
  }
  return groups;
}

function dayLabel(timestamp?: number): string {
  if (!timestamp) return 'Plus tôt';
  const day = new Date(timestamp);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff <= 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  if (diff < 7) return `Il y a ${diff} jours`;
  return day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function Feed({ kind }: { kind: Kind }) {
  const subscribed = useStore((s) => s.subscribed);
  const history = useStore((s) => s.history);
  const historyDates = useStore((s) => s.historyDates);
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

  // historique : regroupé par jour (comme YouTube), en conservant l'ordre récent
  const historyGroups = kind === 'history' ? groupByDay(items, historyDates) : null;

  const renderCard = (v: Video, i: number) => {
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
  };

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
        {kind === 'watchLater' && items.length > 0 && (
          <div className="headtools">
            <Link className="btn btn--primary" to={`/watch?v=${items[0].id}&list=watch-later`}>
              ▶ Tout lire
            </Link>
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

      {historyGroups
        ? historyGroups.map((group) => (
            <section key={group.label} className="historygroup">
              <h2 className="historygroup__title">{group.label}</h2>
              <div className="grid">{group.videos.map((v, i) => renderCard(v, i))}</div>
            </section>
          ))
        : <section className="grid">{items.map((v, i) => renderCard(v, i))}</section>}

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
