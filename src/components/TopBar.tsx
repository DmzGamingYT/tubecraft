import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useClickOutside } from '../lib/hooks';
import { AccountMenu } from './AccountMenu';
import { NotificationsBell } from './NotificationsBell';
import { IconClose, IconMenu, IconMoon, IconSearch, IconSun } from './icons';

interface Props {
  onBurger: () => void;
}

export function TopBar({ onBurger }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const [query, setQuery] = useState('');
  const [mobileSearch, setMobileSearch] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const searchRef = useClickOutside<HTMLFormElement>(() => setSuggestOpen(false));

  // suit l'URL pour rester synchronisé avec la page de résultats
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.pathname === '/search') setQuery(params.get('q') ?? '');
    else setQuery('');
  }, [location.pathname, location.search]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/yt/api/suggest?q=${encodeURIComponent(q)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data?.suggestions) ? data.suggestions : [];
        setSuggestions(list);
        setSuggestOpen(list.length > 0);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setMobileSearch(false);
  };

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button className="iconbtn" onClick={onBurger} aria-label="Menu de navigation">
          <IconMenu />
        </button>
        <Link to="/" className="logo" aria-label="TubeCraft — accueil">
          <span className="logo__mark">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="logo__text">
            TubeCraft<sup>FR</sup>
          </span>
        </Link>
      </div>

      <form
        ref={searchRef}
        className={`searchform${mobileSearch ? ' searchform--open' : ''}`}
        onSubmit={submit}
        role="search"
      >
        <div className="searchform__field">
          <input
            value={query}
            onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher"
            aria-label="Rechercher des vidéos"
            aria-autocomplete="list"
            aria-expanded={suggestOpen}
          />
          {suggestOpen && suggestions.length > 0 && (
            <ul className="searchsuggestions" role="listbox">
              {suggestions.map((s, i) => (
                <li key={`${s}-${i}`} role="option">
                  <button
                    type="button"
                    className="searchsuggestions__item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQuery(s);
                      navigate(`/search?q=${encodeURIComponent(s)}`);
                      setSuggestOpen(false);
                      setMobileSearch(false);
                    }}
                  >
                    <IconSearch width={16} height={16} />
                    <span>{s}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query && (
            <button
              type="button"
              className="searchform__clear"
              onClick={() => setQuery('')}
              aria-label="Effacer"
            >
              <IconClose width={18} height={18} />
            </button>
          )}
        </div>
        <button className="searchform__btn" type="submit" aria-label="Lancer la recherche">
          <IconSearch width={22} height={22} />
        </button>
      </form>

      <div className="topbar__right">
        <button
          className="iconbtn iconbtn--search-mobile"
          onClick={() => setMobileSearch((v) => !v)}
          aria-label="Rechercher"
        >
          <IconSearch />
        </button>
        <NotificationsBell />
        <button
          className="iconbtn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
          title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
        >
          {theme === 'dark' ? <IconSun width={22} height={22} /> : <IconMoon width={22} height={22} />}
        </button>
        <AccountMenu />
      </div>
    </header>
  );
}
