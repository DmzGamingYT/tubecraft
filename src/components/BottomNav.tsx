import { Link, useLocation } from 'react-router-dom';
import { IconHistory, IconHome, IconShorts, IconSubs } from './icons';

/**
 * Barre de navigation basse, affichée seulement sur téléphone (≤ 767 px) :
 * les quatre destinations principales restent à portée de pouce, comme dans
 * l'app YouTube, sans ouvrir le tiroir latéral.
 */
const items = [
  { to: '/', label: 'Accueil', icon: <IconHome />, matches: (path: string) => path === '/' },
  { to: '/shorts', label: 'Shorts', icon: <IconShorts />, matches: (path: string) => path === '/shorts' },
  {
    to: '/subscriptions',
    label: 'Abonnements',
    icon: <IconSubs />,
    matches: (path: string) => path === '/subscriptions',
  },
  {
    to: '/history',
    label: 'Bibliothèque',
    icon: <IconHistory />,
    matches: (path: string) =>
      ['/history', '/liked', '/watch-later', '/playlists', '/queue'].some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`)
      ),
  },
];

export function BottomNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();

  return (
    <nav className="bottomnav" aria-label="Navigation rapide">
      {items.map((item) => {
        const active = item.matches(pathname);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`bottomnav__item${active ? ' bottomnav__item--active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
