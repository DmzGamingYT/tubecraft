import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useIsMobile } from '../lib/hooks';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** Chrome de l'application : barre haute + barre latérale + contenu. */
export function Layout() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(true);
  const mainRef = useRef<HTMLElement>(null);
  const wasMobileRef = useRef(isMobile);

  // referme le tiroir mobile à chaque navigation
  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [location.pathname, location.search, isMobile]);

  // raccourcis clavier : Ctrl/⌘+B (barre latérale), « / » (recherche)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // En changeant de format (mobile ↔ ordinateur), on rétablit un état de
  // barre latérale cohérent au lieu de garder le tiroir fermé en grand écran.
  useEffect(() => {
    if (wasMobileRef.current === isMobile) return;
    wasMobileRef.current = isMobile;
    setOpen(!isMobile);
  }, [isMobile]);

  // entrée douce du contenu à chaque navigation (sans remonter la page)
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    main.classList.remove('content--enter');
    void main.offsetWidth;
    main.classList.add('content--enter');
    const timer = window.setTimeout(() => main.classList.remove('content--enter'), 480);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);

  const mode = isMobile ? (open ? 'drawer' : 'hidden') : open ? 'full' : 'mini';

  return (
    <div className={`shell shell--${mode}`}>
      <span className="route-progress" key={location.key} aria-hidden />
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <TopBar onBurger={() => setOpen((v) => !v)} />

      {isMobile && open && (
        <div className="backdrop" onClick={() => setOpen(false)} aria-hidden />
      )}

      <Sidebar mode={mode === 'hidden' ? 'mini' : (mode as 'full' | 'mini' | 'drawer')} onNavigate={isMobile ? () => setOpen(false) : undefined} />

      <main className="content" id="main" tabIndex={-1} ref={mainRef}>
        <Outlet />
      </main>
    </div>
  );
}
