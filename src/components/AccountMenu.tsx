import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, type User } from '../store';
import { Avatar } from './Avatar';
import { IconClose, IconGear, IconHistory, IconLike, IconMail, IconShorts, IconTrash } from './icons';
import { useEscapeKey } from '../lib/hooks';
import { emptyProfile, profileIdFor, readProfile, saveProfile } from '../lib/profiles';
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

/** Logo Microsoft (quatre carrés). */
function MicrosoftG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="#F25022" d="M2 2h9.4v9.4H2z" />
      <path fill="#7FBA00" d="M12.6 2H22v9.4h-9.4z" />
      <path fill="#00A4EF" d="M2 12.6h9.4V22H2z" />
      <path fill="#FFB900" d="M12.6 12.6H22V22h-9.4z" />
    </svg>
  );
}

/** Logo Apple (monochrome). */
function AppleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

/** Logo GitHub (monochrome). */
function GitHubG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.21 11.19.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.37-1.34-1.73-1.34-1.73-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.21 1.84 1.21 1.07 1.79 2.81 1.27 3.5.97.11-.76.42-1.27.76-1.56-2.67-.3-5.47-1.31-5.47-5.81 0-1.28.47-2.33 1.24-3.15-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.21a11.6 11.6 0 0 1 6 0c2.29-1.53 3.3-1.21 3.3-1.21.66 1.64.24 2.86.12 3.16.77.82 1.24 1.87 1.24 3.15 0 4.51-2.8 5.5-5.48 5.79.43.36.81 1.08.81 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.83.56A12.02 12.02 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" />
    </svg>
  );
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;

/** Résumé des données réellement enregistrées pour un profil. */
function profileSummary(email: string): string {
  const data = readProfile(profileIdFor(email));
  if (!data) return 'Profil inutilisé';
  const commentCount = Object.values(data.comments).reduce((n, list) => n + list.length, 0);
  const parts = [
    data.history.length > 0 ? plural(data.history.length, 'vue') : '',
    data.liked.length > 0 ? plural(data.liked.length, 'like') : '',
    data.playlists.length > 0 ? plural(data.playlists.length, 'playlist') : '',
    commentCount > 0 ? plural(commentCount, 'commentaire') : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Aucune donnée';
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  apple: 'Apple',
  github: 'GitHub',
  email: 'E-mail',
};

/** Logo du fournisseur courant, pour l'en-tête du formulaire. */
function ProviderLogo({ id }: { id: string }) {
  if (id === 'google') return <GoogleG size={20} />;
  if (id === 'microsoft') return <MicrosoftG size={20} />;
  if (id === 'apple') return <AppleG size={20} />;
  if (id === 'github') return <GitHubG size={20} />;
  return <IconMail width={20} height={20} />;
}

/**
 * Zone de compte de la barre supérieure :
 * - déconnecté  → bouton « Se connecter » + fenêtre multi-fournisseurs
 * - connecté    → avatar + menu (historique, playlists, changer de compte, déconnexion)
 */
export function AccountMenu() {
  const user = useStore((s) => s.user);
  /** e-mail du profil actif, même après le retour anticipé du mode déconnecté */
  const currentEmail = user?.email ?? null;
  const accounts = useStore((s) => s.accounts);
  const signIn = useStore((s) => s.signIn);
  const signOut = useStore((s) => s.signOut);
  const forgetAccount = useStore((s) => s.forgetAccount);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [view, setView] = useState<'providers' | 'form'>('providers');
  const [provider, setProvider] = useState('email');
  const [googleError, setGoogleError] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  /** force le recalcul des résumés de profils après un effacement */
  const [profilesVersion, setProfilesVersion] = useState(0);

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
    if (!dialogOpen || view !== 'providers' || !hasGoogleClientId || !gBtnRef.current) return;
    let cancelled = false;
    setGoogleError(false);
    renderGoogleButton(gBtnRef.current, (payload: GooglePayload) => {
      if (cancelled) return;
      const email = payload.email;
      if (!email) return;
      connect({
        name: payload.name?.trim() || email.split('@')[0],
        email,
        photo: payload.picture,
        provider: 'google',
      });
    }).catch(() => {
      if (!cancelled) setGoogleError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, view]);

  const connect = (account: User) => {
    if (!signIn(account)) {
      setProfileError(
        'Stockage local saturé : impossible de changer de profil sans risquer de perdre les données actuelles. Libérez de l’espace puis réessayez.'
      );
      return;
    }
    setProfileError(null);
    closeDialog();
  };

  const openForm = (id: string) => {
    setProvider(id);
    setName('');
    setEmail('');
    setView('form');
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setView('providers');
    setGoogleError(false);
    setName('');
    setEmail('');
  };

  // `Échap` referme la fenêtre de connexion, puis le menu du compte
  useEscapeKey(dialogOpen, closeDialog);
  useEscapeKey(menuOpen, () => setMenuOpen(false));

  return (
    <>
      {user ? (
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
                {user.provider && (
                  <div className="account__provider">
                    Via {PROVIDER_LABELS[user.provider] ?? user.provider}
                  </div>
                )}
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
            <Link className="account__row" to="/settings" onClick={() => setMenuOpen(false)}>
              <IconGear width={20} height={20} /> Paramètres
            </Link>
            <div className="account__sep" />
            <button
              className="account__row"
              onClick={() => {
                setMenuOpen(false);
                setDialogOpen(true);
              }}
            >
              Changer de compte
            </button>
            {menuError && (
              <p className="account__error" role="alert">
                {menuError}
              </p>
            )}
            <button
              className="account__row"
              onClick={() => {
                if (!signOut()) {
                  setMenuError(
                    'Stockage local saturé : déconnexion annulée pour ne pas perdre les données de ce profil.'
                  );
                  return;
                }
                setMenuError(null);
                setMenuOpen(false);
              }}
            >
              Se déconnecter
            </button>
          </div>
        )}
        </div>
      ) : (
        <button className="signinbtn" onClick={() => setDialogOpen(true)}>
        <span className="signinbtn__avatar" aria-hidden>
          <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor">
            <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.46-8 5.5V21a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-3.04-3.58-5.5-8-5.5Z" />
          </svg>
        </span>
        <span className="signinbtn__label">Se connecter</span>
        </button>
      )}

      {dialogOpen && (
        <div className="auth" role="dialog" aria-modal aria-label="Connexion">
          <div className="auth__backdrop" onClick={closeDialog} />
          <div className="auth__card">
            <button className="auth__close" onClick={closeDialog} aria-label="Fermer">
              <IconClose width={20} height={20} />
            </button>

            {view === 'providers' ? (
              <>
                <h2 className="auth__title">Se connecter à TubeCraft</h2>
                <p className="auth__sub">
                  Accédez à vos abonnements, à vos playlists et à votre historique.
                </p>

                {profileError && (
                  <p className="auth__error" role="alert">
                    {profileError}
                  </p>
                )}

                {accounts.length > 0 && (
                  <div className="auth__accounts">
                    <p className="auth__section">Choisir un compte</p>
                    {accounts.map((a) => (
                      <div className="auth__account" key={`${a.email}:${profilesVersion}`}>
                        <button className="auth__account-main" onClick={() => connect(a)}>
                          <Avatar name={a.name} src={a.photo} size={36} />
                          <span>
                            <span className="auth__item-name">{a.name}</span>
                            <span className="auth__item-email">{a.email}</span>
                            <span className="auth__item-meta">{profileSummary(a.email)}</span>
                          </span>
                        </button>
                        {a.email !== currentEmail && (
                          <button
                            className="auth__account-forget"
                            title="Effacer les données de ce profil"
                            aria-label={`Effacer les données de ${a.email}`}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Effacer définitivement l’historique, les likes, les playlists et les commentaires de ${a.email} ?`
                                )
                              ) {
                                return;
                              }
                              saveProfile(profileIdFor(a.email), emptyProfile());
                              setProfilesVersion((version) => version + 1);
                            }}
                          >
                            <IconTrash width={16} height={16} />
                          </button>
                        )}
                        <button
                          className="auth__account-forget"
                          title="Retirer ce compte de la liste (les données sont conservées)"
                          aria-label={`Retirer ${a.email} de la liste`}
                          onClick={() => forgetAccount(a.email)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <div className="auth__or">
                      <span>ou</span>
                    </div>
                  </div>
                )}

                {hasGoogleClientId ? (
                  <div className="auth__google">
                    <div ref={gBtnRef} className="auth__g_btn" />
                  </div>
                ) : (
                  <button className="auth__provider" onClick={() => openForm('google')}>
                    <GoogleG size={20} />
                    <span>Continuer avec Google</span>
                  </button>
                )}
                {googleError && (
                  <p className="auth__error">
                    Google n’a pas pu se charger (client_id, origine autorisée ou réseau).
                  </p>
                )}

                <button className="auth__provider" onClick={() => openForm('microsoft')}>
                  <MicrosoftG size={20} />
                  <span>Continuer avec Microsoft</span>
                </button>

                <button className="auth__provider" onClick={() => openForm('apple')}>
                  <AppleG size={20} />
                  <span>Continuer avec Apple</span>
                </button>

                <button className="auth__provider" onClick={() => openForm('github')}>
                  <GitHubG size={20} />
                  <span>Continuer avec GitHub</span>
                </button>

                <div className="auth__or">
                  <span>ou</span>
                </div>

                <button
                  className="auth__provider auth__provider--email"
                  onClick={() => openForm('email')}
                >
                  <IconMail width={20} height={20} />
                  <span>Utiliser une adresse e-mail</span>
                </button>
              </>
            ) : (
              <>
                <div className="auth__provider-head">
                  <ProviderLogo id={provider} />
                  <h2 className="auth__title">Continuer avec {PROVIDER_LABELS[provider]}</h2>
                </div>
                <p className="auth__sub">
                  {hasGoogleClientId && provider === 'google'
                    ? 'Connexion Google sécurisée.'
                    : 'Indiquez le nom et l’adresse à associer à ce compte.'}
                </p>
                <form
                  className="auth__form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = name.trim();
                    const m = email.trim();
                    if (!n || !m.includes('@')) return;
                    connect({ name: n, email: m, provider });
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
                    placeholder={
                      provider === 'microsoft'
                        ? 'vous@outlook.com'
                        : provider === 'apple'
                          ? 'vous@icloud.com'
                          : provider === 'github'
                            ? 'vous@users.noreply.github.com'
                            : 'vous@exemple.com'
                    }
                  />
                  <div className="auth__actions">
                    <button type="button" className="auth__link" onClick={() => setView('providers')}>
                      Retour
                    </button>
                    <button type="submit" className="auth__go">
                      Se connecter
                    </button>
                  </div>
                </form>
              </>
            )}

            <p className="auth__note">
              {hasGoogleClientId ? (
                <>
                  La connexion Google est réelle (OAuth). Les autres fournisseurs créent un compte
                  local : aucune donnée n’est envoyée, tout reste dans ce navigateur.
                </>
              ) : (
                <>
                  Aucune donnée n’est envoyée : les comptes sont créés localement dans ce navigateur.
                  Pour activer la vraie connexion Google, renseignez{' '}
                  <code>VITE_GOOGLE_CLIENT_ID</code> dans un fichier <code>.env</code> (voir{' '}
                  <code>.env.example</code>).
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
