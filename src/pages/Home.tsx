import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  categories,
  generatedAt,
  getVideo,
  recommendWithReasons,
  shorts,
  videosByCategory,
} from '../data';
import { useStore } from '../store';
import type { Video } from '../types';
import { ChipBar } from '../components/ChipBar';
import { VideoCard } from '../components/VideoCard';

const PAGE_SIZE = 24;

export function Home() {
  const [params, setParams] = useSearchParams();
  const user = useStore((s) => s.user);
  const history = useStore((s) => s.history);
  const subscribed = useStore((s) => s.subscribed);
  const dismissed = useStore((s) => s.dismissed);
  const dismissVideo = useStore((s) => s.dismissVideo);
  const restoreDismissed = useStore((s) => s.restoreDismissed);
  const disliked = useStore((s) => s.disliked);
  const mutedChannels = useStore((s) => s.mutedChannels);
  const muteChannel = useStore((s) => s.muteChannel);
  const restoreMutedChannels = useStore((s) => s.restoreMutedChannels);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const category = params.get('c') ?? 'Toutes';
  const videos = videosByCategory(category).filter((v) => !dismissed.includes(v.id));

  useEffect(() => setVisible(PAGE_SIZE), [category]);

  // compte connecté → un rayon « Recommandés pour vous » bâti sur l'historique,
  // avec la raison de chaque suggestion et les signaux négatifs exclus.
  const recos =
    user && category === 'Toutes'
      ? recommendWithReasons(history, subscribed, { dismissed, disliked, mutedChannels, limit: 8 })
      : [];

  // « Reprendre la lecture » : vidéos commencées mais pas terminées
  const resume = useMemo(() => {
    if (category !== 'Toutes') return [];
    const progress = useStore.getState().progress;
    return history
      .map((id) => getVideo(id))
      .filter((video): video is Video => Boolean(video))
      .filter((video) => {
        const seconds = progress[video.id] ?? 0;
        if (seconds < 10) return false;
        return !video.duration || seconds < video.duration * 0.95;
      })
      .slice(0, 4);
  }, [history, category]);

  return (
    <div className="page">
      <ChipBar
        items={['Toutes', ...categories]}
        value={category}
        onChange={(c) => setParams(c === 'Toutes' ? {} : { c })}
      />

      {category === 'Toutes' && shorts.length > 0 && (
        <section className="shelf">
          <header className="shelf__head">
            <h2 className="shelf__title">
              <span className="shelf__logo">▶</span> Shorts
            </h2>
            <Link className="shelf__link" to="/shorts">
              Tout afficher
            </Link>
          </header>
          <div className="shelf__row">
            {shorts.slice(0, 8).map((s) => (
              <Link key={s.id} to={`/watch?v=${s.id}`} className="shortcard" title={s.title}>
                <img src={`https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`} alt="" loading="lazy" />
                <span className="shortcard__title">{s.title}</span>
                <span className="shortcard__views">{s.views}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {resume.length > 0 && (
        <section className="recos" aria-label="Reprendre la lecture">
          <h2 className="recos__title">Reprendre la lecture</h2>
          <section className="grid">
            {resume.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                progress={
                  video.duration
                    ? (useStore.getState().progress[video.id] ?? 0) / video.duration
                    : undefined
                }
              />
            ))}
          </section>
        </section>
      )}

      {recos.length > 0 && (
        <section className="recos" aria-label="Recommandations personnalisées">
          <h2 className="recos__title">
            Recommandés pour vous
          </h2>
          <p className="recos__sub">
            Suggérés d'après vos vidéos regardées et vos abonnements. Chaque carte indique pourquoi,
            et vous pouvez écarter une vidéo ou une chaîne.
          </p>
          <details className="recos__explain">
            <summary>Pourquoi ces vidéos ?</summary>
            <p>
              Le classement est calculé dans ce navigateur : catégories que vous regardez (×3),
              chaînes abonnées (×2), affinité avec une chaîne de votre historique (×2), puis
              popularité. Les vidéos déjà vues, dislikées ou marquées « Pas intéressé » et les
              chaînes mises de côté sont exclues. Aucune donnée n'est envoyée à un serveur.
            </p>
            {mutedChannels.length > 0 && (
              <button className="linkbtn" onClick={restoreMutedChannels}>
                Réactiver {mutedChannels.length} chaîne{mutedChannels.length > 1 ? 's' : ''} mise
                {mutedChannels.length > 1 ? 's' : ''} de côté
              </button>
            )}
          </details>
          <section className="grid">
            {recos.map(({ video, reason }) => (
              <VideoCard
                key={video.id}
                video={video}
                note={reason}
                onDismiss={() => dismissVideo(video.id)}
                onMuteChannel={() => muteChannel(video.channelId)}
              />
            ))}
          </section>
        </section>
      )}

      <section className="grid">
        {videos.slice(0, visible).map((v) => (
          <VideoCard key={v.id} video={v} onDismiss={() => dismissVideo(v.id)} />
        ))}
      </section>

      {visible < videos.length && (
        <div className="loadmore">
          <button className="btn btn--ghost" onClick={() => setVisible((n) => n + PAGE_SIZE)}>
            Charger plus ({videos.length - visible} restantes)
          </button>
        </div>
      )}

      {videos.length === 0 && (
        <p className="empty">
          Aucune vidéo dans cette catégorie. Essayez une autre catégorie ou lancez une recherche.
        </p>
      )}

      {(dismissed.length > 0 || mutedChannels.length > 0) && (
        <p className="page__footnote">
          {dismissed.length > 0 && (
            <>
              {dismissed.length} vidéo{dismissed.length > 1 ? 's' : ''} masquée
              {dismissed.length > 1 ? 's' : ''}.{' '}
              <button className="linkbtn" onClick={restoreDismissed}>
                Tout restaurer
              </button>
            </>
          )}
          {dismissed.length > 0 && mutedChannels.length > 0 ? ' · ' : ''}
          {mutedChannels.length > 0 && (
            <>
              {mutedChannels.length} chaîne{mutedChannels.length > 1 ? 's' : ''} mise
              {mutedChannels.length > 1 ? 's' : ''} de côté.{' '}
              <button className="linkbtn" onClick={restoreMutedChannels}>
                Réactiver
              </button>
            </>
          )}
        </p>
      )}

      <p className="page__footnote">
        Catalogue réel embarqué, collecté depuis YouTube le{' '}
        {new Date(generatedAt).toLocaleDateString('fr-FR')} — relancez <code>npm run catalog</code> pour
        le rafraîchir. Les recherches interrogent YouTube en direct.
      </p>
    </div>
  );
}
