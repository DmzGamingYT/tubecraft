import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEMO_ACCOUNT, useStore, type User } from '../store';
import { Avatar } from './Avatar';
import { IconHistory, IconLike, IconShorts } from './icons';
import {
  hasGoogleClientId,
  renderGoogleButton,
  type GooglePayload,
} from '../lib/googleAuth';

/** Logo officiel Google « G » (identité de marque, 48×48). */
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * Zone de compte de la barre supérieure :
 * - déconnecté  → bouton « Se connecter » + fenêtre « Connexion avec Google »
 * - connecté    → avatar + menu (historique, vidéos likées, déconnexion)
 */
export function AccountMenu() {
  const user = useStore((s) => s.user);
  const signIn = useStore((s) => s.signIn);
  const signOut = useStore((s) => s.signOut);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [custom, setCustom] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const gBtnRef = useRef<HTMLDivElement>(null);

  // ferme le menu au clic extérieur
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  // fenêtre ouverte → dessine le bouton Google officiel (si un client_id est fourni)
  useEffect(() => {
    if (!dialogOpen || !hasGoogleClientId || !gBtnRef.current) return;
    let cancelled = false;
    renderGoogleButton(gBtnRef.current, (payload: GooglePayload) => {
      if (cancelled) return;
      const email = payload.email;
      if (!email) {
        return;
      }
      connect({
        name: payload.name?.trim() || email.split('@')[0],
        email,
        photo: payload.picture,
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dialogOpen]);

  const connect = (account: User) => {
    signIn(account);
    setDialogOpen(false);
    setCustom(false);
    setName('');
    setEmail('');
  };

  if (user) {
    return (
      <div className="account" ref={menuRef}>
        <button
          className="account__avatar"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={`${user.name} — ${user.email}`}
        >
          <Avatar name={user.name} src={user.photo} size={32} />
        </button>
        {menuOpen && (
          <div className="account__menu" role="menu">
            <div className="account__head">
              <Avatar name={user.name} src={user.photo} size={40} />
              <div>
                <div className="account__name">{user.name}</div>
                <div className="account__email">{user.email}</div>
              </div>
            </div>
            <div className="account__sep" />
            <Link className="account__row" to="/history" onClick={() => setMenuOpen(false)}>
              <IconHistory width={20} height={20} /> Historique
            </Link>
            <Link className="account__row" to="/playlists" onClick={() => setMenuOpen(false)}>
              <IconShorts width={20} height={20} /> Vos playlists
            </Link>
            <Link className="account__row" to="/liked" onClick={() => setMenuOpen(false)}>
              <IconLike width={20} height={20} /> Vidéos likées
            </Link>
            <div className="account__sep" />
            <button className="account__row" onClick={() => { signOut(); setMenuOpen(false); }}>
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button className="signinbtn" onClick={() => setDialogOpen(true)}>
        <svg viewBox="0 -960 960 960" width={20} height={20} fill="currentColor" aria-hidden>
          <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Z" />
        </svg>
        Se connecter
      </button>

      {dialogOpen && (
        <div className="auth" role="dialog" aria-modal aria-label="Connexion avec Google">
          <div className="auth__backdrop" onClick={() => setDialogOpen(false)} />
          <div className="auth__card">
            <div className="auth__logo">
              <GoogleG size={26} />
            </div>
            <h2 className="auth__title">Se connecter</h2>
            <p className="auth__sub">
              {!custom ? 'Choisissez un compte pour continuer vers TubeCraft' : 'Utilisez un compte existant ou créez-en un'}
            </p>

            {!custom ? (
              <>
                {hasGoogleClientId && (
                  <div className="auth__google">
                    {/* bouton officiel « Se connecter avec Google » (popup accounts.google.com) */}
                    <div ref={gBtnRef} className="auth__g_btn" />

                  </div>
                )}
                <div className="auth__or">
                  <span>{hasGoogleClientId ? 'ou choisir un compte local' : 'Choisir un compte'}</span>
                </div>
                <button className="auth__item" onClick={() => connect(DEMO_ACCOUNT)}>
                  <Avatar name={DEMO_ACCOUNT.name} size={36} />
                  <span>
                    <span className="auth__item-name">{DEMO_ACCOUNT.name}</span>
                    <span className="auth__item-email">{DEMO_ACCOUNT.email}</span>
                  </span>
                </button>
                <button className="auth__item auth__item--alt" onClick={() => setCustom(true)}>
                  <span className="auth__item-plus">＋</span>
                  <span>Utiliser un autre compte</span>
                </button>
              </>
            ) : (
              <form
                className="auth__form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = name.trim();
                  const m = email.trim();
                  if (!n || !m.includes('@')) return;
                  connect({ name: n, email: m });
                }}
              >
                <input
                  className="auth__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nom complet"
                  autoFocus
                />
                <input
                  className="auth__input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@gmail.com"
                />
                <div className="auth__actions">
                  <button type="button" className="auth__link" onClick={() => setCustom(false)}>
                    Retour
                  </button>
                  <button type="submit" className="auth__go">
                    Se connecter
                  </button>
                </div>
              </form>
            )}

            <p className="auth__note">
              {hasGoogleClientId ? (
                <>
                  Connexion réelle via Google (OAuth). TubeCraft ne reçoit que votre nom, votre
                  e-mail et votre photo — vos données restent dans ce navigateur.
                </>
              ) : (
                <>
                  Connexion simulée pour l'instant : pour utiliser votre vrai compte Gmail,
                  ajoutez <code>VITE_GOOGLE_CLIENT_ID</code> dans un fichier <code>.env</code>
                  {' '}(voir <code>.env.example</code>). Vos données restent locales.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
