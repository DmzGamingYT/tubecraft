import { Link, useLocation } from 'react-router-dom';
import { allVideos, categories, getChannel } from '../data';
import { useStore } from '../store';
import { Avatar } from './Avatar';
import {
  IconCastle, IconClock, IconDownload, IconGames, IconGear, IconGrowth, IconHistory, IconHome,
  IconKitchen, IconLike, IconMovie, IconMusicNote, IconNature, IconQueue, IconSchool, IconScience,
  IconShorts, IconSport, IconSparkle, IconSubs, IconTech, IconTravel,
} from './icons';

type Mode = 'full' | 'mini' | 'drawer';

interface Props {
  mode: Mode;
  onNavigate?: () => void;
}

/** icône Emploi du temps : une catégorie = une icône, comme la section Explorer de YouTube */
const categoryIcons: Record<string, JSX.Element> = {
  Animation: <IconMovie />,
  'Éducation': <IconSchool />,
  Science: <IconScience />,
  Technologie: <IconTech />,
  Nature: <IconNature />,
  Histoire: <IconCastle />,
  Cuisine: <IconKitchen />,
  Musique: <IconMusicNote />,
  Voyage: <IconTravel />,
  'Jeux vidéo': <IconGames />,
  Sport: <IconSport />,
  'Développement personnel': <IconGrowth />,
};

const main = [
  { to: '/', label: 'Accueil', icon: <IconHome /> },
  { to: '/shorts', label: 'Shorts', icon: <IconShorts /> },
  { to: '/subscriptions', label: 'Abonnements', icon: <IconSubs /> },
];

const library = [
  { to: '/history', label: 'Historique', icon: <IconHistory /> },
  { to: '/playlists', label: 'Playlists', icon: <IconQueue /> },
  { to: '/watch-later', label: 'Regarder plus tard', icon: <IconClock /> },
  { to: '/liked', label: 'Vidéos likées', icon: <IconLike /> },
];

export function Sidebar({ mode, onNavigate }: Props) {
  const location = useLocation();
  const subscribed = useStore((s) => s.subscribed);
  const channels = subscribed
    .map((id) => {
      const known = getChannel(id);
      if (known) return { id, name: known.name, avatar: known.avatar };
      const fromVideo = allVideos.find((v) => v.channelId === id);
      return fromVideo ? { id, name: fromVideo.channelName, avatar: '' } : null;
    })
    .filter((c): c is { id: string; name: string; avatar: string } => Boolean(c));
  const activeCategory = new URLSearchParams(location.search).get('c') ?? 'Toutes';

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname === to;

  const mini = mode === 'mini';

  return (
    <nav className={`sidebar sidebar--${mode}`} aria-label="Navigation principale">
      <ul className="sidebar__group">
        {main.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className={`sidebar__item${isActive(item.to) ? ' sidebar__item--active' : ''}`}
              onClick={onNavigate}
              title={mini ? item.label : undefined}
            >
              <span className="sidebar__icon">{item.icon}</span>
              {!mini && <span className="sidebar__label">{item.label}</span>}
            </Link>
          </li>
        ))}
      </ul>

      <hr className="sidebar__sep" />
      <ul className="sidebar__group">
        {!mini && <li className="sidebar__title">Vous</li>}
        {library.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className={`sidebar__item${isActive(item.to) ? ' sidebar__item--active' : ''}`}
              onClick={onNavigate}
              title={mini ? item.label : undefined}
            >
              <span className="sidebar__icon">{item.icon}</span>
              {!mini && <span className="sidebar__label">{item.label}</span>}
            </Link>
          </li>
        ))}
      </ul>

      {!mini && (
        <>
          <hr className="sidebar__sep" />

          <div className="sidebar__group">
            <div className="sidebar__title">Abonnements</div>
            {channels.length === 0 ? (
              <p className="sidebar__hint">
                Aucun abonnement pour le moment. Ouvrez une vidéo et cliquez sur{' '}
                <strong>S’abonner</strong>.
              </p>
            ) : (
              <ul>
                {channels.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/channel/${encodeURIComponent(c.id)}`}
                      className="sidebar__item sidebar__item--channel"
                      onClick={onNavigate}
                    >
                      <Avatar name={c.name} src={c.avatar} size={24} />
                      <span className="sidebar__label">{c.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <hr className="sidebar__sep" />

          <div className="sidebar__group">
            <div className="sidebar__title">Explorer</div>
            <ul>
              {categories.slice(0, 10).map((cat) => (
                <li key={cat}>
                  <Link
                    to={`/?c=${encodeURIComponent(cat)}`}
                    className={`sidebar__item${
                      location.pathname === '/' && activeCategory === cat ? ' sidebar__item--active' : ''
                    }`}
                    onClick={onNavigate}
                  >
                    <span className="sidebar__icon sidebar__icon--cat">{categoryIcons[cat] ?? <IconGrowth />}</span>
                    <span className="sidebar__label">{cat}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <hr className="sidebar__sep" />
          <p className="sidebar__footer">
            TubeCraft — clone open-source de YouTube (interface + lecteur).<br />
            Données vidéo : YouTube via InnerTube.
          </p>
        </>
      )}

      <hr className="sidebar__sep" />
      <ul className="sidebar__group">
        <li>
          <Link
            to="/download"
            className={`sidebar__item${isActive('/download') ? ' sidebar__item--active' : ''}`}
            onClick={onNavigate}
            title={mini ? 'Télécharger TubeCraft' : undefined}
            aria-label="Télécharger l’app"
          >
            <span className="sidebar__icon">
              <IconDownload />
            </span>
            {!mini && <span className="sidebar__label">Télécharger l’app</span>}
          </Link>
        </li>
        <li>
          <Link to="/apps" className="sidebar__item" onClick={onNavigate} title={mini ? 'La collection d’apps' : undefined}>
            <span className="sidebar__icon">
              <IconSparkle />
            </span>
            {!mini && <span className="sidebar__label">La collection d’apps</span>}
          </Link>
        </li>
        <li>
          <Link
            to="/settings"
            className={`sidebar__item${isActive('/settings') ? ' sidebar__item--active' : ''}`}
            onClick={onNavigate}
            title={mini ? 'Paramètres' : undefined}
          >
            <span className="sidebar__icon">
              <IconGear />
            </span>
            {!mini && <span className="sidebar__label">Paramètres</span>}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
