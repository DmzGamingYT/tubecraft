import { useEffect } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useStore } from './store';
import { ChannelPage } from './pages/Channel';
import { Feed } from './pages/Feed';
import { Home } from './pages/Home';
import { PlaylistDetail } from './pages/PlaylistDetail';
import { Playlists } from './pages/Playlists';
import { SearchPage } from './pages/SearchPage';
import { Shorts } from './pages/Shorts';
import { Watch } from './pages/Watch';

export default function App() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <Routes>
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
        <Route path="/playlist/:id" element={<PlaylistDetail />} />
        <Route path="/channel/:id" element={<ChannelPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="page">
      <p className="empty">
        Cette page n’existe pas. <Link to="/">Revenir à l’accueil</Link>
      </p>
    </div>
  );
}
