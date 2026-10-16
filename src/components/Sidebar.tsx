import { Link, useLocation } from 'react-router-dom';
import { allVideos, categories, getChannel } from '../data';
import { useStore } from '../store';
import { Avatar } from './Avatar';
import {
  IconCastle, IconClock, IconGames, IconGrowth, IconHistory, IconHome, IconKitchen, IconLike,
  IconMovie, IconMusicNote, IconNature, IconSchool, IconScience, IconShorts, IconSport,
  IconSubs, IconTech, IconTravel,
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
  { to: '/playlists', label: 'Playlists', icon: <IconShorts /> },
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
              title={item.label}
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
              title={item.label}
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
                Aucun abonnement pour l’ouvrez une vidéo et cliquez sur <strong>S’abonner</strong>.
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
                    title={cat}
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
    </nav>
  );
}
