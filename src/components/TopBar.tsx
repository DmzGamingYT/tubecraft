import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useClickOutside } from '../lib/hooks';
import { AccountMenu } from './AccountMenu';
import { NotificationsBell } from './NotificationsBell';
import {
  IconClose,
  IconDownload,
  IconKeyboard,
  IconMenu,
  IconMoon,
  IconSearch,
  IconSun,
} from './icons';

interface Props {
  onBurger: () => void;
  onShortcuts?: () => void;
}

export function TopBar({ onBurger, onShortcuts }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const [query, setQuery] = useState('');
  const [mobileSearch, setMobileSearch] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Les suggestions ne s'ouvrent que sur une action de l'utilisateur (frappe,
  // focus, flèches) : au chargement d'une URL /search, le panneau doit rester
  // fermé pour ne pas masquer les résultats.
  const interactedRef = useRef(false);
  const searchRef = useClickOutside<HTMLFormElement>(() => {
    interactedRef.current = false;
    setSuggestOpen(false);
    setActiveIndex(-1);
  });

  // suit l'URL pour rester synchronisé avec la page de résultats
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.pathname === '/search') setQuery(params.get('q') ?? '');
    else setQuery('');
    interactedRef.current = false;
    setSuggestOpen(false);
    setActiveIndex(-1);
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
        setActiveIndex(-1);
        setSuggestOpen(interactedRef.current && list.length > 0);
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
    interactedRef.current = false;
    setSuggestOpen(false);
    setActiveIndex(-1);
    setMobileSearch(false);
  };

  const chooseSuggestion = (value: string) => {
    setQuery(value);
    navigate(`/search?q=${encodeURIComponent(value)}`);
    interactedRef.current = false;
    setSuggestOpen(false);
    setActiveIndex(-1);
    setMobileSearch(false);
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (suggestOpen) {
        e.preventDefault();
        setSuggestOpen(false);
        setActiveIndex(-1);
      }
      return;
    }
    if (!suggestOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const value = suggestions[activeIndex];
      if (value) chooseSuggestion(value);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button className="iconbtn" onClick={onBurger} aria-label="Menu de navigation">
          <IconMenu />
        </button>
        <Link to="/" className="logo" aria-label="Séquence — accueil">
          <span className="logo__mark">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="logo__text">
            Séquence<span className="logo__sup">FR</span>
          </span>
        </Link>
      </div>

      <form
        ref={searchRef}
        className={`searchform${mobileSearch ? ' searchform--open' : ''}${
          suggestOpen && suggestions.length > 0 ? ' searchform--suggest' : ''
        }`}
        onSubmit={submit}
        role="search"
      >
        <div className="searchform__field">
          <input
            id="global-search"
            value={query}
            onFocus={() => {
              interactedRef.current = true;
              if (suggestions.length > 0) setSuggestOpen(true);
            }}
            onChange={(e) => {
              interactedRef.current = true;
              setQuery(e.target.value);
              setSuggestOpen(true);
            }}
            onKeyDown={onSearchKeyDown}
            placeholder="Rechercher ( / )"
            autoComplete="off"
            aria-label="Rechercher des vidéos"
            aria-autocomplete="list"
            aria-expanded={suggestOpen}
            aria-controls="search-suggestions"
            aria-activedescendant={
              suggestOpen && activeIndex >= 0 ? `search-suggestion-${activeIndex}` : undefined
            }
          />
          {suggestOpen && suggestions.length > 0 && (
            <ul className="searchsuggestions" role="listbox" id="search-suggestions">
              {suggestions.map((s, i) => (
                <li
                  key={`${s}-${i}`}
                  id={`search-suggestion-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`searchsuggestions__item${i === activeIndex ? ' is-active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => chooseSuggestion(s)}
                >
                  <IconSearch width={16} height={16} />
                  <span>{s}</span>
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
        <Link
          to="/download"
          className="iconbtn"
          aria-label="Installer Séquence sur cet appareil"
          title="Installer Séquence"
        >
          <IconDownload width={22} height={22} />
        </Link>
        <NotificationsBell />
        {onShortcuts && (
          <button
            className="iconbtn iconbtn--keys"
            onClick={onShortcuts}
            aria-label="Afficher les raccourcis clavier"
            title="Raccourcis clavier (?)"
          >
            <IconKeyboard width={22} height={22} />
          </button>
        )}
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
