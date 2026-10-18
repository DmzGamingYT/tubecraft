import { lazy, Suspense, useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PlayerHostProvider } from './components/PlayerHost';
import { useStore } from './store';

/**
 * Chargement à la demande : la page d'accueil et le lecteur ne téléchargent
 * pas le code des Shorts, des playlists ou de la connexion.
 */
const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })));
const Watch = lazy(() => import('./pages/Watch').then((module) => ({ default: module.Watch })));
const SearchPage = lazy(() =>
  import('./pages/SearchPage').then((module) => ({ default: module.SearchPage }))
);
const Shorts = lazy(() => import('./pages/Shorts').then((module) => ({ default: module.Shorts })));
const Feed = lazy(() => import('./pages/Feed').then((module) => ({ default: module.Feed })));
const ChannelPage = lazy(() =>
  import('./pages/Channel').then((module) => ({ default: module.ChannelPage }))
);
const Playlists = lazy(() =>
  import('./pages/Playlists').then((module) => ({ default: module.Playlists }))
);
const QueuePage = lazy(() =>
  import('./pages/Queue').then((module) => ({ default: module.QueuePage }))
);
const PlaylistDetail = lazy(() =>
  import('./pages/PlaylistDetail').then((module) => ({ default: module.PlaylistDetail }))
);
const Settings = lazy(() =>
  import('./pages/Settings').then((module) => ({ default: module.Settings }))
);
const Showcase = lazy(() =>
  import('./pages/Showcase').then((module) => ({ default: module.Showcase }))
);
const Download = lazy(() =>
  import('./pages/Download').then((module) => ({ default: module.Download }))
);

function RouteFallback() {
  return (
    <div className="page" aria-busy="true">
      <span className="skeleton skeleton--line" style={{ width: '220px', height: 22 }} />
      <section className="grid" style={{ marginTop: 20 }}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="card card--skeleton">
            <span className="skeleton skeleton--thumb" />
            <span className="skeleton skeleton--line" style={{ width: '80%' }} />
            <span className="skeleton skeleton--line" style={{ width: '45%' }} />
          </div>
        ))}
      </section>
    </div>
  );
}

/** Chaque navigation repart du haut de page, comme sur un vrai site. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

export default function App() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <>
      <ScrollToTop />
      <PlayerHostProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* vitrine autonome, hors de l'interface YouTube */}
            <Route path="/apps" element={<Showcase />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/watch" element={<Watch />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/shorts" element={<Shorts />} />
              <Route path="/subscriptions" element={<Feed kind="subs" />} />
              <Route path="/history" element={<Feed kind="history" />} />
              <Route path="/liked" element={<Feed kind="liked" />} />
              <Route path="/watch-later" element={<Feed kind="watchLater" />} />
              <Route path="/playlists" element={<Playlists />} />
              <Route path="/queue" element={<QueuePage />} />
              <Route path="/playlist/:id" element={<PlaylistDetail />} />
              <Route path="/channel/:id" element={<ChannelPage />} />
              <Route path="/download" element={<Download />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </PlayerHostProvider>
    </>
  );
}

function NotFound() {
  useEffect(() => {
    document.title = 'Page introuvable — TubeCraft';
  }, []);

  return (
    <div className="page">
      <p className="empty">
        Cette page n’existe pas. <Link to="/">Revenir à l’accueil</Link>
      </p>
    </div>
  );
}
