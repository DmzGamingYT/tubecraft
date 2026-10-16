import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { searchYouTube, type SearchResponse } from '../api/search';
import { getVideo } from '../data';
import { Avatar } from '../components/Avatar';
import { VideoCard } from '../components/VideoCard';

export function SearchPage() {
  const [params] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResponse(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchYouTube(query)
      .then((r) => {
        if (!cancelled) setResponse(r);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!query) {
    return (
      <div className="page">
        <p className="empty">Utilisez la barre de recherche en haut de page pour trouver une vidéo.</p>
      </div>
    );
  }

  const results = response?.results ?? [];

  return (
    <div className="page">
      <header className="searchhead">
        <h1 className="searchhead__title">
          Résultats pour <span className="searchhead__q">« {query} »</span>
        </h1>
        <span className={`badge badge--${response?.live ? 'live' : 'local'}`}>
          {loading
            ? 'Recherche en cours…'
            : response?.live
              ? 'YouTube en direct'
              : 'Hors ligne — catalogue local'}
        </span>
      </header>

      {!loading && (response?.channels?.length ?? 0) > 0 && (
        <section className="searchchannels" aria-label="Chaînes">
          {(response?.channels ?? []).map((c) => (
            <Link key={c.id} to={`/channel/${encodeURIComponent(c.id)}`} className="channelrow">
              <Avatar name={c.name} src={c.avatar} size={48} />
              <span className="channelrow__meta">
                <strong>{c.name}</strong>
                <span className="muted">{c.subscribers}</span>
              </span>
            </Link>
          ))}
        </section>
      )}

      <div className="searchlist">
        {loading &&
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="card card--row card--skeleton">
              <span className="skeleton skeleton--thumb" />
              <div className="card__text">
                <span className="skeleton skeleton--line" style={{ width: '70%' }} />
                <span className="skeleton skeleton--line" style={{ width: '40%' }} />
              </div>
            </div>
          ))}

        {!loading &&
          results.map((r) => {
            const video = getVideo(r.videoId);
            return video ? <VideoCard key={r.videoId} video={video} variant="row" /> : null;
          })}
      </div>

      {!loading && results.length === 0 && (
        <p className="empty">
          Aucun résultat pour « {query} ». Essayez d’autres mots-clés.{' '}
          <Link to="/">Retour à l’accueil</Link>
        </p>
      )}
    </div>
  );
}
