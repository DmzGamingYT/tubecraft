import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useEscapeKey, useIsMobile, useOnline } from '../lib/hooks';
import { BottomNav } from './BottomNav';
import { OfflineBar } from './OfflineBar';
import { ShortcutsHelp } from './ShortcutsHelp';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** hauteur de la barre de navigation basse (téléphone), zone sûre comprise */
const BOTTOM_NAV_HEIGHT = 'calc(56px + env(safe-area-inset-bottom, 0px))';

/** Chrome de l'application : barre haute + barre latérale + contenu. */
export function Layout() {
  const location = useLocation();
  const isMobile = useIsMobile();
  // la barre basse n'apparaît que sur téléphone, pas sur tablette
  const isPhone = useIsMobile(767);
  const online = useOnline();
  // sur téléphone le tiroir démarre fermé : pas de flash de menu au chargement
  const [open, setOpen] = useState(() => !isMobile);
  const [helpOpen, setHelpOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const wasMobileRef = useRef(isMobile);
  // la page Shorts occupe tout l'écran et le tiroir recouvre tout : dans ces
  // deux cas la barre de navigation basse n'a rien à faire là
  const showBottomNav = isPhone && !open && location.pathname !== '/shorts';

  // referme le tiroir mobile à chaque navigation
  useEffect(() => {
    if (isMobile) setOpen(false);
    setHelpOpen(false);
  }, [location.pathname, location.search, isMobile]);

  // et avec `Échap`, comme n'importe quel panneau qui recouvre la page
  useEscapeKey(isMobile && open, () => setOpen(false));

  // Les éléments fixes (mini-lecteur, bas de page) ont besoin de connaître la
  // place prise par la barre de navigation basse.
  useEffect(() => {
    const value = showBottomNav ? BOTTOM_NAV_HEIGHT : '0px';
    document.documentElement.style.setProperty('--bottomnav-h', value);
    return () => {
      document.documentElement.style.setProperty('--bottomnav-h', '0px');
    };
  }, [showBottomNav]);

  // raccourcis clavier : Ctrl/⌘+B (barre latérale), « / » (recherche), « ? » (aide)
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
      } else if (e.key === '/' && !typing && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      } else if ((e.key === '?' || (e.key === '/' && e.shiftKey)) && !typing) {
        e.preventDefault();
        setHelpOpen((v) => !v);
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
    <div className={`shell shell--${mode}${online ? '' : ' shell--offline'}`}>
      <span className="route-progress" key={location.key} aria-hidden />
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <TopBar onBurger={() => setOpen((v) => !v)} onShortcuts={() => setHelpOpen(true)} />
      <OfflineBar online={online} />

      {isMobile && open && (
        <div className="backdrop" onClick={() => setOpen(false)} aria-hidden />
      )}

      <Sidebar mode={mode === 'hidden' ? 'mini' : (mode as 'full' | 'mini' | 'drawer')} onNavigate={isMobile ? () => setOpen(false) : undefined} />

      <main className="content" id="main" tabIndex={-1} ref={mainRef}>
        <Outlet />
      </main>

      {showBottomNav && <BottomNav onNavigate={() => setOpen(false)} />}
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
