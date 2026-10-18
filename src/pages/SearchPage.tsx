import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  searchMore,
  searchYouTube,
  type SearchResponse,
  type SortOrder,
  type ResultType,
} from '../api/youtube';
import { planSearch, type AiSearchPlan } from '../lib/ai';
import { setPageMeta } from '../lib/meta';
import { getVideo } from '../data';
import { useStore } from '../store';
import type { SearchResult } from '../types';
import { Avatar } from '../components/Avatar';
import { VideoCard } from '../components/VideoCard';
import { IconSparkle } from '../components/icons';

type DurationFilter = 'any' | 'short' | 'medium' | 'long';

// La pertinence et le nombre de vues sont les seuls tris réellement honorés
// par InnerTube ; « date » est accepté par l'API mais l'ordre reste mixte.
const SORTS: Array<{ value: SortOrder; label: string }> = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'views', label: 'Plus vues' },
];

export function SearchPage() {
  const [params] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const aiSearch = useStore((s) => s.settings.aiSearch);
  const setSetting = useStore((s) => s.setSetting);

  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [extra, setExtra] = useState<SearchResult[]>([]);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [duration, setDuration] = useState<DurationFilter>('any');
  const [sort, setSort] = useState<SortOrder>('relevance');
  const [type, setType] = useState<ResultType>('all');
  const [plan, setPlan] = useState<AiSearchPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageMeta(query ? `${query} — recherche TubeCraft` : 'Recherche — TubeCraft');
  }, [query]);

  useEffect(() => {
    if (!query) {
      setResponse(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setDuration('any');
    setExtra([]);
    setContinuation(null);

    searchYouTube(query, { sort, type, signal: controller.signal })
      .then((result) => {
        setResponse(result);
        setContinuation(result.continuation);
      })
      .catch(() => {
        /* annulé ou erreur : le repli local est déjà géré par searchYouTube */
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [query, sort, type]);

  // Recherche assistée par IA : reformulation + recherches associées.
  useEffect(() => {
    setPlan(null);
    if (!query || !aiSearch) return;
    const controller = new AbortController();
    setPlanLoading(true);
    planSearch(query, controller.signal)
      .then((result) => setPlan(result))
      .finally(() => {
        if (!controller.signal.aborted) setPlanLoading(false);
      });
    return () => controller.abort();
  }, [query, aiSearch]);

  const loadMore = useCallback(() => {
    if (!continuation || loadingMore) return;
    setLoadingMore(true);
    searchMore(continuation)
      .then((page) => {
        setExtra((current) => {
          const seen = new Set(current.map((r) => r.videoId));
          return [...current, ...page.results.filter((r) => !seen.has(r.videoId))];
        });
        setContinuation(page.continuation);
      })
      .catch(() => setContinuation(null))
      .finally(() => setLoadingMore(false));
  }, [continuation, loadingMore]);

  // chargement automatique en bas de page
  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || !continuation) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [continuation, loadMore]);

  const allResults = useMemo(
    () => [...(response?.results ?? []), ...extra],
    [response, extra]
  );

  const results = allResults.filter((result) => {
    const value = result.duration ?? 0;
    if (duration === 'short') return value > 0 && value < 240;
    if (duration === 'medium') return value >= 240 && value < 1200;
    if (duration === 'long') return value >= 1200;
    return true;
  });

  if (!query) {
    return (
      <div className="page">
        <p className="empty">Utilisez la barre de recherche en haut de page pour trouver une vidéo.</p>
      </div>
    );
  }

  const hasPlanContent = Boolean(
    plan &&
      (plan.keywords.length > 0 ||
        (plan.query && plan.query.toLowerCase() !== query.toLowerCase()))
  );

  return (
    <div className="page">
      <header className="searchhead">
        <h1 className="searchhead__title">
          Résultats pour <span className="searchhead__q">« {query} »</span>
        </h1>
        <div className="searchhead__actions">
          <button
            className={`chip aichip${aiSearch ? ' chip--active' : ''}`}
            onClick={() => setSetting('aiSearch', !aiSearch)}
            title={
              aiSearch
                ? 'Désactiver la recherche assistée par IA'
                : 'Activer la recherche assistée par IA'
            }
            aria-pressed={aiSearch}
          >
            <IconSparkle width={15} height={15} /> IA {aiSearch ? 'activée' : 'désactivée'}
          </button>
          <span className={`badge badge--${response?.live ? 'live' : 'local'}`}>
            {loading
              ? 'Recherche en cours…'
              : response?.live
                ? 'YouTube en direct'
                : 'Hors ligne — catalogue local'}
          </span>
        </div>
      </header>

      <p className="searchhead__count" aria-live="polite">
        {loading
          ? ' '
          : Number(response?.estimated) > 0
            ? `Environ ${Number(response?.estimated).toLocaleString('fr-FR')} résultats`
            : `${allResults.length} résultat${allResults.length > 1 ? 's' : ''}`}
      </p>

      {(planLoading || hasPlanContent) && (
        <section className="aicard" aria-label="Recherche assistée par IA">
          <div className="aicard__head">
            <span className="aicard__spark" aria-hidden>
              <IconSparkle width={18} height={18} />
            </span>
            <strong>Recherche assistée par IA</strong>
            {planLoading && <span className="aicard__status">Analyse de la requête…</span>}
          </div>
          {hasPlanContent && plan && (
            <>
              {plan.intent && <p className="aicard__intent">{plan.intent}</p>}
              {plan.query.toLowerCase() !== query.toLowerCase() && (
                <p className="aicard__query">
                  Requête optimisée :{' '}
                  <Link className="aicard__link" to={`/search?q=${encodeURIComponent(plan.query)}`}>
                    {plan.query}
                  </Link>
                </p>
              )}
              {plan.keywords.length > 0 && (
                <div className="aicard__chips">
                  {plan.keywords.map((keyword) => (
                    <Link key={keyword} className="chip" to={`/search?q=${encodeURIComponent(keyword)}`}>
                      {keyword}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {!loading && (response?.channels?.length ?? 0) > 0 && (
        <section className="searchchannels" aria-label="Chaînes">
          {(response?.channels ?? []).map((channel) => (
            <Link
              key={channel.id}
              to={`/channel/${encodeURIComponent(channel.id)}`}
              className="channelrow"
            >
              <Avatar name={channel.name} src={channel.avatar} size={48} />
              <span className="channelrow__meta">
                <strong>{channel.name}</strong>
                <span className="muted">{channel.subscribers}</span>
              </span>
            </Link>
          ))}
        </section>
      )}

      <div className="searchfilters" role="group" aria-label="Filtres de recherche">
        <div className="searchfilters__group">
          {SORTS.map((option) => (
            <button
              key={option.value}
              className={`chip${sort === option.value ? ' chip--active' : ''}`}
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="searchfilters__group">
          <button
            className={`chip${type === 'all' ? ' chip--active' : ''}`}
            onClick={() => setType('all')}
          >
            Tous les formats
          </button>
          <button
            className={`chip${type === 'video' ? ' chip--active' : ''}`}
            onClick={() => setType('video')}
          >
            Vidéos seulement
          </button>
        </div>
        <div className="searchfilters__group">
          {(
            [
              ['any', 'Durée : toutes'],
              ['short', 'Moins de 4 min'],
              ['medium', '4 à 20 min'],
              ['long', 'Plus de 20 min'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={`chip${duration === value ? ' chip--active' : ''}`}
              onClick={() => setDuration(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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
          results.map((result) => {
            const video = getVideo(result.videoId);
            return video ? <VideoCard key={result.videoId} video={video} variant="row" /> : null;
          })}
      </div>

      {!loading && continuation && (
        <div className="loadmore" ref={sentinelRef}>
          <button className="btn btn--ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Chargement…' : 'Charger plus de résultats'}
          </button>
        </div>
      )}

      {!loading && allResults.length === 0 && (
        <p className="empty">
          Aucun résultat pour « {query} ». Essayez d’autres mots-clés.{' '}
          <Link to="/">Retour à l’accueil</Link>
        </p>
      )}
    </div>
  );
}
