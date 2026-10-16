import { Link, useSearchParams } from 'react-router-dom';
import { categories, recommendFor, shorts, videosByCategory, generatedAt } from '../data';
import { useStore } from '../store';
import { ChipBar } from '../components/ChipBar';
import { VideoCard } from '../components/VideoCard';

export function Home() {
  const [params, setParams] = useSearchParams();
  const user = useStore((s) => s.user);
  const history = useStore((s) => s.history);
  const subscribed = useStore((s) => s.subscribed);
  const category = params.get('c') ?? 'Toutes';
  const videos = videosByCategory(category);

  // compte connecté → un rayon « Recommandés pour vous » bâti sur l'historique
  const recos = user && category === 'Toutes' ? recommendFor(history, subscribed, 8) : [];

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

      {recos.length > 0 && (
        <section className="recos" aria-label="Recommandations personnalisées">
          <h2 className="recos__title">
            Recommandés pour vous
          </h2>
          <p className="recos__sub">
            Suggérés d'après vos vidéos regardées et vos abonnements, comme sur YouTube.
          </p>
          <section className="grid">
            {recos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </section>
        </section>
      )}

      <section className="grid">
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </section>

      {videos.length === 0 && (
        <p className="empty">
          Aucune vidéo dans cette catégorie. Essayez une autre catégorie ou lancez une recherche.
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
