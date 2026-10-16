import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useIsMobile } from '../lib/hooks';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** Chrome de l'application : barre haute + barre latérale + contenu. */
export function Layout() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(true);

  // referme le tiroir mobile à chaque navigation
  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [location.pathname, location.search, isMobile]);

  // raccourci clavier : toggler la barre latérale
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mode = isMobile ? (open ? 'drawer' : 'hidden') : open ? 'full' : 'mini';

  return (
    <div className={`shell shell--${mode}`}>
      <TopBar onBurger={() => setOpen((v) => !v)} />

      {isMobile && open && (
        <div className="backdrop" onClick={() => setOpen(false)} aria-hidden />
      )}

      <Sidebar mode={mode === 'hidden' ? 'mini' : (mode as 'full' | 'mini' | 'drawer')} onNavigate={isMobile ? () => setOpen(false) : undefined} />

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
