import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getChannel, videosFromChannel } from '../data';
import type { Channel, Video } from '../types';
import { fetchChannelMore, fetchChannelPage } from '../api/youtube';
import { setPageMeta } from '../lib/meta';
import { SubscribeButton } from '../components/Actions';
import { Avatar } from '../components/Avatar';
import { VideoCard } from '../components/VideoCard';

type Tab = 'videos' | 'shorts';

export function ChannelPage() {
  const { id } = useParams();
  const channelId = decodeURIComponent(id ?? '');
  const known = getChannel(channelId);
  const catalog = useMemo(() => videosFromChannel(channelId), [channelId]);

  const [tab, setTab] = useState<Tab>('videos');
  const [channel, setChannel] = useState<Channel | null>(null);
  const [liveVideos, setLiveVideos] = useState<Video[]>([]);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!channelId) return;
    const controller = new AbortController();
    setStatus('loading');
    setLiveVideos([]);
    setContinuation(null);

    fetchChannelPage(channelId, tab, controller.signal)
      .then((page) => {
        setChannel(page.channel);
        setLiveVideos(page.videos);
        setContinuation(page.continuation);
        setStatus('ok');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });

    return () => controller.abort();
  }, [channelId, tab]);

  const loadMore = useCallback(() => {
    if (!continuation || loadingMore) return;
    setLoadingMore(true);
    fetchChannelMore(channelId, tab, continuation)
      .then((page) => {
        setLiveVideos((current) => {
          const seen = new Set(current.map((v) => v.id));
          return [...current, ...page.videos.filter((v) => !seen.has(v.id))];
        });
        setContinuation(page.continuation);
      })
      .catch(() => setContinuation(null))
      .finally(() => setLoadingMore(false));
  }, [channelId, tab, continuation, loadingMore]);

  // repli : catalogue local si YouTube est injoignable
  const fallback = catalog.filter((video) => (tab === 'shorts' ? video.isShort : !video.isShort));
  const list = liveVideos.length > 0 ? liveVideos : fallback;

  const info = channel ?? known;
  const name = info?.name ?? catalog[0]?.channelName ?? '';
  const handle = info?.handle ?? '';
  const subscribers = info?.subscribers ?? '';
  const avatar = info?.avatar ?? catalog[0]?.channelAvatar ?? '';
  const banner = info?.banner;

  useEffect(() => {
    if (name) setPageMeta(`${name} — TubeCraft`);
  }, [name]);

  if (!name) {
    return (
      <div className="page">
        <p className="empty">
          Chaîne introuvable (identifiant invalide ou YouTube injoignable).{' '}
          <Link to="/">Retour à l’accueil</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <div
        className="channel__banner"
        style={banner ? { backgroundImage: `url("${banner}")` } : undefined}
      />

      <header className="channel__head">
        <Avatar name={name} src={avatar} size={80} />
        <div className="channel__meta">
          <h1 className="channel__name">{name}</h1>
          <p className="channel__sub">
            {handle && <span>{handle}</span>}
            {subscribers && <span> · {subscribers}</span>}
            {info?.videoCount && <span> · {info.videoCount}</span>}
            {!info?.videoCount && (
              <span>
                {' '}
                · {list.length} vidéo{list.length > 1 ? 's' : ''} disponible
                {list.length > 1 ? 's' : ''}
              </span>
            )}
          </p>
          {info?.description && <p className="channel__desc">{info.description}</p>}
        </div>
        <SubscribeButton channelId={channelId} />
      </header>

      <nav className="tabs">
        <button className={`tab${tab === 'videos' ? ' tab--active' : ''}`} onClick={() => setTab('videos')}>
          Vidéos
        </button>
        <button
          className={`tab${tab === 'shorts' ? ' tab--active' : ''}`}
          onClick={() => setTab('shorts')}
        >
          Shorts
        </button>
        {status === 'error' && <span className="channel__offline">Catalogue local (hors ligne)</span>}
      </nav>

      <section className="grid">
        {list.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </section>

      {status === 'loading' && list.length === 0 && (
        <section className="grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card card--skeleton">
              <span className="skeleton skeleton--thumb" />
              <span className="skeleton skeleton--line" style={{ width: '80%' }} />
              <span className="skeleton skeleton--line" style={{ width: '45%' }} />
            </div>
          ))}
        </section>
      )}

      {list.length === 0 && status !== 'loading' && (
        <p className="empty">Rien à afficher dans cet onglet.</p>
      )}

      {continuation && (
        <div className="loadmore">
          <button className="btn btn--ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Chargement…' : 'Charger plus'}
          </button>
        </div>
      )}
    </div>
  );
}
