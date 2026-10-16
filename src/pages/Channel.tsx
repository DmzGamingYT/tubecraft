import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getChannel, videosFromChannel } from '../data';
import { SubscribeButton } from '../components/Actions';
import { Avatar } from '../components/Avatar';
import { VideoCard } from '../components/VideoCard';

export function ChannelPage() {
  const { id } = useParams();
  const channelId = decodeURIComponent(id ?? '');
  const known = getChannel(channelId);
  const all = videosFromChannel(channelId);
  const videos = all.filter((v) => !v.isShort);
  const shorts = all.filter((v) => v.isShort);
  const sample = all[0];
  const [tab, setTab] = useState<'videos' | 'shorts'>('videos');

  const name = known?.name ?? sample?.channelName;
  const handle = known?.handle ?? '';
  const subscribers = known?.subscribers ?? '';
  const avatar = known?.avatar ?? '';

  if (!name) {
    return (
      <div className="page">
        <p className="empty">
          Chaîne inconnue dans le catalogue local (les chaînes découvertes par la recherche ne sont pas
          encore indexées). <Link to="/">Retour à l’accueil</Link>
        </p>
      </div>
    );
  }

  const list = tab === 'shorts' ? shorts : videos;

  return (
    <div className="page">
      <div className="channel__banner" />

      <header className="channel__head">
        <Avatar name={name} src={avatar} size={80} />
        <div className="channel__meta">
          <h1 className="channel__name">{name}</h1>
          <p className="channel__sub">
            {handle && <span>{handle}</span>}
            {subscribers && <span> · {subscribers}</span>}
            <span> · {all.length} vidéo{all.length > 1 ? 's' : ''} dans le catalogue</span>
          </p>
        </div>
        <SubscribeButton channelId={channelId} />
      </header>

      <nav className="tabs">
        <button className={`tab${tab === 'videos' ? ' tab--active' : ''}`} onClick={() => setTab('videos')}>
          Vidéos ({videos.length})
        </button>
        <button
          className={`tab${tab === 'shorts' ? ' tab--active' : ''}`}
          onClick={() => setTab('shorts')}
          disabled={shorts.length === 0}
        >
          Shorts ({shorts.length})
        </button>
      </nav>

      <section className="grid">
        {list.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </section>

      {list.length === 0 && <p className="empty">Rien à afficher dans cet onglet.</p>}
    </div>
  );
}
