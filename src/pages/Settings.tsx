import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, snapshotCurrentProfile, useStore } from '../store';
import type { User } from '../store';
import {
  clearAllLocalData,
  exportFileName,
  exportUserData,
  formatBytes,
  importUserData,
  localDataSize,
  parseUserData,
  STORAGE_KEYS,
} from '../lib/userData';
import { setPageMeta } from '../lib/meta';
import { useOnline } from '../lib/hooks';
import { emptyProfile, profileIdFor, readProfile, saveProfile } from '../lib/profiles';
import { Avatar } from '../components/Avatar';

type Status = { kind: 'ok' | 'error' | 'info'; text: string };

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const PROVIDERS: Record<string, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  apple: 'Apple',
  github: 'GitHub',
  email: 'E-mail',
};

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="settings__row">
      <span className="settings__row-text">
        <strong>{label}</strong>
        {hint && <span>{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="settings__check"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function Settings() {
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const settings = useStore((state) => state.settings);
  const setSetting = useStore((state) => state.setSetting);
  const resetSettings = useStore((state) => state.resetSettings);

  const user = useStore((state) => state.user);
  const accounts = useStore((state) => state.accounts);
  const signIn = useStore((state) => state.signIn);
  const signOut = useStore((state) => state.signOut);
  const forgetAccount = useStore((state) => state.forgetAccount);

  const clearHistory = useStore((state) => state.clearHistory);
  const restoreDismissed = useStore((state) => state.restoreDismissed);
  const restoreMutedChannels = useStore((state) => state.restoreMutedChannels);
  const online = useOnline();

  const [status, setStatus] = useState<Status | null>(null);
  const [storageVersion, setStorageVersion] = useState(0);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const size = useMemo(
    () => localDataSize(window.localStorage),
    // recalculé après chaque opération sur les données
    [storageVersion]
  );

  useEffect(() => {
    setPageMeta('Paramètres — TubeCraft');
  }, []);

  const refresh = () => setStorageVersion((version) => version + 1);

  const handleExport = () => {
    // la sauvegarde doit refléter le profil actif tel qu'il est à l'écran
    snapshotCurrentProfile();
    const bundle = exportUserData(window.localStorage);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFileName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setStatus({ kind: 'ok', text: 'Sauvegarde téléchargée.' });
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      if (file.size > 5 * 1024 * 1024) {
        setStatus({ kind: 'error', text: 'Fichier trop volumineux (5 Mo maximum).' });
        return;
      }
      const result = parseUserData(await file.text());
      if (!result.ok) {
        setStatus({ kind: 'error', text: result.error });
        return;
      }
      if (
        !window.confirm(
          'Remplacer les données locales actuelles (compte, réglages, historique, playlists…) par ce fichier ?'
        )
      ) {
        return;
      }

      // garantit que les réglages ajoutés après la sauvegarde ont une valeur
      const rawStore = result.data[STORAGE_KEYS.store];
      if (rawStore) {
        const parsedStore = JSON.parse(rawStore) as {
          state?: Record<string, unknown> & { settings?: Record<string, unknown> };
        };
        parsedStore.state = {
          ...parsedStore.state,
          settings: { ...DEFAULT_SETTINGS, ...(parsedStore.state?.settings ?? {}) },
        };
        result.data[STORAGE_KEYS.store] = JSON.stringify(parsedStore);
      }

      importUserData(window.localStorage, result.data);
      setStatus({ kind: 'ok', text: 'Import réussi. Rechargement de l’application…' });
      window.setTimeout(() => window.location.reload(), 800);
    } catch {
      setStatus({
        kind: 'error',
        text: 'Import impossible : fichier illisible ou espace de stockage insuffisant.',
      });
    } finally {
      setImporting(false);
    }
  };

  const confirmClear = (label: string, action: () => void) => {
    if (!window.confirm(`Effacer ${label} ? Cette action est irréversible.`)) return;
    action();
    // garde l'instantané du profil aligné sur l'état affiché
    snapshotCurrentProfile();
    refresh();
    setStatus({ kind: 'ok', text: `${label[0].toUpperCase()}${label.slice(1)} effacé.` });
  };

  const clearOfflineCache = async () => {
    if (!('caches' in window)) {
      setStatus({ kind: 'info', text: 'Ce navigateur ne prend pas en charge le cache hors ligne.' });
      return;
    }
    try {
      const keys = await caches.keys();
      const ours = keys.filter((key) => key.startsWith('tubecraft-'));
      await Promise.all(ours.map((key) => caches.delete(key)));
      setStatus({
        kind: 'ok',
        text: `Cache hors ligne vidé (${ours.length} espace${ours.length > 1 ? 's' : ''}).`,
      });
    } catch {
      setStatus({ kind: 'error', text: 'Impossible de vider le cache hors ligne.' });
    }
  };

  const clearEverything = async () => {
    if (
      !window.confirm(
        'Effacer toutes les données TubeCraft de ce navigateur (compte, réglages, historique, playlists, commentaires, progression, cache hors ligne) ? Cette action est irréversible.'
      )
    ) {
      return;
    }
    clearAllLocalData();
    // le mode avion stocke aussi la coquille, les vignettes et des réponses API
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((key) => key.startsWith('tubecraft-')).map((key) => caches.delete(key))
        );
      }
    } catch {
      /* navigation privée ou quota : on recharge quand même */
    }
    window.location.reload();
  };

  const switchAccount = (account: User) => {
    if (!signIn(account)) {
      setStatus({
        kind: 'error',
        text: 'Stockage local saturé : le profil n’a pas été changé pour ne rien perdre. Libérez de l’espace puis réessayez.',
      });
      return;
    }
    refresh();
    setStatus({ kind: 'ok', text: `Profil « ${account.name} » activé.` });
  };

  const eraseProfile = (account: User) => {
    if (
      !window.confirm(
        `Effacer définitivement les données de ${account.email} (historique, likes, playlists, commentaires, progression) ?`
      )
    ) {
      return;
    }
    saveProfile(profileIdFor(account.email), emptyProfile());
    refresh();
    setStatus({ kind: 'ok', text: `Données de ${account.name} effacées.` });
  };

  const profileStats = (email: string) => {
    const data = readProfile(profileIdFor(email));
    if (!data) return 'profil inutilisé';
    const comments = Object.values(data.comments).reduce((n, list) => n + list.length, 0);
    return `${data.history.length} vues · ${data.liked.length} likes · ${data.playlists.length} playlists · ${comments} commentaires`;
  };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Paramètres</h1>
          <p className="muted">
            Réglages d’affichage et de lecture, profils et données conservées dans ce navigateur.
          </p>
        </div>
      </header>

      {status && (
        <p
          className={`settings__status settings__status--${status.kind}`}
          role="status"
          aria-live="polite"
        >
          {status.text}
        </p>
      )}

      <div className="settings">
        <section className="settings__card" aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className="settings__title">
            Apparence
          </h2>
          <p className="settings__desc">Le thème s’applique immédiatement et reste mémorisé.</p>

          <div className="settings__row settings__row--stack">
            <span className="settings__row-text">
              <strong>Thème</strong>
              <span>Sombre par défaut, comme YouTube.</span>
            </span>
            {/* sélecteur segmenté : deux moitiés égales, y compris quand la
                ligne passe sur deux niveaux sur téléphone */}
            <div className="settings__control settings__control--seg" role="group" aria-label="Thème">
              <button
                className={`chip${theme === 'dark' ? ' chip--active' : ''}`}
                onClick={() => setTheme('dark')}
                aria-pressed={theme === 'dark'}
              >
                Sombre
              </button>
              <button
                className={`chip${theme === 'light' ? ' chip--active' : ''}`}
                onClick={() => setTheme('light')}
                aria-pressed={theme === 'light'}
              >
                Clair
              </button>
            </div>
          </div>
        </section>

        <section className="settings__card" aria-labelledby="settings-playback">
          <h2 id="settings-playback" className="settings__title">
            Lecture
          </h2>
          <p className="settings__desc">
            Ces réglages sont appliqués au lecteur YouTube intégré.
          </p>

          <ToggleRow
            label="Lecture automatique"
            hint="Enchaîner sur la vidéo suivante à la fin."
            checked={settings.autoplayNext}
            onChange={(value) => setSetting('autoplayNext', value)}
          />
          <ToggleRow
            label="Boucle"
            hint="Rejouer la vidéo en boucle (appliqué au prochain chargement)."
            checked={settings.loop}
            onChange={(value) => setSetting('loop', value)}
          />
          <ToggleRow
            label="Mode théâtre"
            hint="Élargir le lecteur et masquer la colonne de suggestions."
            checked={settings.theater}
            onChange={(value) => setSetting('theater', value)}
          />
          <ToggleRow
            label="Sous-titres"
            hint="Activer les sous-titres quand la vidéo en propose."
            checked={settings.captions}
            onChange={(value) => setSetting('captions', value)}
          />

          <label className="settings__row">
            <span className="settings__row-text">
              <strong>Vitesse de lecture</strong>
              <span>Appliquée immédiatement à la vidéo en cours.</span>
            </span>
            <select
              className="settings__select"
              value={settings.speed}
              onChange={(event) => setSetting('speed', Number(event.target.value))}
            >
              {SPEEDS.map((speed) => (
                <option key={speed} value={speed}>
                  {String(speed).replace('.', ',')}×
                </option>
              ))}
            </select>
          </label>

          <label className="settings__row">
            <span className="settings__row-text">
              <strong>Volume</strong>
              <span>{settings.volume} %</span>
            </span>
            <input
              type="range"
              className="settings__range"
              min={0}
              max={100}
              step={5}
              value={settings.volume}
              onChange={(event) => setSetting('volume', Number(event.target.value))}
            />
          </label>

          <div className="settings__footer">
            <button
              className="btn btn--ghost"
              onClick={() => {
                resetSettings();
                setStatus({ kind: 'ok', text: 'Réglages réinitialisés.' });
              }}
            >
              Réinitialiser les réglages
            </button>
          </div>
        </section>

        <section className="settings__card" aria-labelledby="settings-ai">
          <h2 id="settings-ai" className="settings__title">
            IA et confort de visionnage
          </h2>
          <p className="settings__desc">
            L’IA de recherche et de résumé est gratuite, sans clé et sans inscription.
          </p>

          <ToggleRow
            label="Recherche assistée par IA"
            hint="Reformule la requête et propose des recherches associées."
            checked={settings.aiSearch}
            onChange={(value) => setSetting('aiSearch', value)}
          />
          <ToggleRow
            label="Résumé IA des vidéos"
            hint="Résumé et chapitres cliquables sous chaque vidéo, à partir de sa description."
            checked={settings.aiSummary}
            onChange={(value) => setSetting('aiSummary', value)}
          />
          <ToggleRow
            label="SponsorBlock"
            hint="Sauter automatiquement les sponsors, intros et autopromotions."
            checked={settings.sponsorBlock}
            onChange={(value) => setSetting('sponsorBlock', value)}
          />
        </section>

        <section className="settings__card" aria-labelledby="settings-profiles">
          <h2 id="settings-profiles" className="settings__title">
            Profils
          </h2>
          <p className="settings__desc">
            Les comptes sont mémorisés localement. Chaque profil garde ses propres données
            (historique, likes, playlists, progression, commentaires, abonnements) : changer de
            profil change réellement de contenu. Les réglages d’affichage et le thème restent communs.
          </p>

          {user ? (
            <div className="settings__account settings__account--current">
              <Avatar name={user.name} src={user.photo} size={42} />
              <div className="settings__account-text">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                {user.provider && (
                  <span className="muted">Via {PROVIDERS[user.provider] ?? user.provider}</span>
                )}
              </div>
              <span className="badge badge--live">Profil actif</span>
              <button
                className="btn btn--ghost"
                onClick={() => {
                  if (!signOut()) {
                    setStatus({
                      kind: 'error',
                      text: 'Stockage local saturé : la déconnexion a été annulée pour ne rien perdre.',
                    });
                    return;
                  }
                  refresh();
                  setStatus({ kind: 'info', text: 'Vous êtes déconnecté.' });
                }}
              >
                Se déconnecter
              </button>
            </div>
          ) : (
            <p className="settings__empty">
              Aucun profil actif. Utilisez <strong>Se connecter</strong> dans la barre supérieure.
            </p>
          )}

          {accounts.filter((account) => account.email !== user?.email).length > 0 && (
            <div className="settings__accounts">
              <p className="settings__subtitle">Autres profils mémorisés</p>
              {accounts
                .filter((account) => account.email !== user?.email)
                .map((account) => (
                  <div className="settings__account" key={account.email}>
                    <Avatar name={account.name} src={account.photo} size={36} />
                    <div className="settings__account-text">
                      <strong>{account.name}</strong>
                      <span>{account.email}</span>
                      <span className="muted">{profileStats(account.email)}</span>
                    </div>
                    <button className="btn btn--ghost" onClick={() => switchAccount(account)}>
                      Utiliser
                    </button>
                    <button
                      className="settings__iconbtn"
                      onClick={() => eraseProfile(account)}
                      aria-label={`Effacer les données de ${account.email}`}
                      title="Effacer les données de ce profil"
                    >
                      🗑
                    </button>
                    <button
                      className="settings__iconbtn"
                      onClick={() => {
                        forgetAccount(account.email);
                        setStatus({ kind: 'ok', text: 'Profil retiré de la liste.' });
                      }}
                      aria-label={`Retirer ${account.email} de la liste`}
                      title="Retirer ce profil (les données sont conservées)"
                    >
                      ✕
                    </button>
                  </div>
                ))}
            </div>
          )}

          <p className="settings__note">
            Les comptes locaux (hors Google) ne sont pas une authentification sécurisée : ils
            identifient un profil, ils ne le protègent pas. Sur un appareil partagé, quiconque ouvre
            le navigateur peut changer de profil.
          </p>
        </section>

        <section className="settings__card" aria-labelledby="settings-offline">
          <h2 id="settings-offline" className="settings__title">
            Mode avion
          </h2>
          <p className="settings__desc">
            TubeCraft garde une copie locale des pages, métadonnées et vignettes déjà visitées,
            ainsi que des dernières réponses YouTube. Hors ligne, vous pouvez parcourir ces pages,
            gérer votre file, vos playlists et vos likes ; la lecture vidéo, elle, nécessite une
            connexion.
          </p>
          <div className="settings__row">
            <span className="settings__row-text">
              <strong>État du réseau</strong>
              <span>
                {online
                  ? 'En ligne — le cache se met à jour au fil de la navigation.'
                  : 'Hors ligne — les données déjà visitées restent disponibles.'}
              </span>
            </span>
            <span className={`badge${online ? ' badge--live' : ''}`}>
              {online ? 'En ligne' : 'Hors ligne'}
            </span>
          </div>
          <div className="settings__footer">
            <button className="btn btn--ghost" onClick={() => void clearOfflineCache()}>
              Vider le cache hors ligne
            </button>
          </div>
        </section>

        <section className="settings__card" aria-labelledby="settings-data">
          <h2 id="settings-data" className="settings__title">
            Mes données
          </h2>
          <p className="settings__desc">
            Tout est stocké dans ce navigateur, rien n’est envoyé à un serveur. Espace utilisé :{' '}
            <strong>{formatBytes(size)}</strong>.
          </p>

          <div className="settings__actions">
            <button className="btn btn--primary" onClick={handleExport}>
              Exporter mes données
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing ? 'Import en cours…' : 'Importer une sauvegarde'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImport}
              hidden
              aria-label="Fichier de sauvegarde TubeCraft"
            />
          </div>
          <p className="settings__hint">
            L’import remplace les données actuelles par celles du fichier, puis recharge la page.
          </p>

          <p className="settings__subtitle">Effacer sélectivement</p>
          <div className="settings__actions settings__actions--wrap">
            <button
              className="btn btn--ghost"
              onClick={() => confirmClear('l’historique', clearHistory)}
            >
              Historique
            </button>
            <button
              className="btn btn--ghost"
              onClick={() =>
                confirmClear('les vidéos likées et dislikées', () =>
                  useStore.setState({ liked: [], disliked: [] })
                )
              }
            >
              Likes et dislikes
            </button>
            <button
              className="btn btn--ghost"
              onClick={() =>
                confirmClear('les abonnements', () =>
                  useStore.setState({ subscribed: [], notifLevels: {} })
                )
              }
            >
              Abonnements
            </button>
            <button
              className="btn btn--ghost"
              onClick={() =>
                confirmClear('les playlists, « Regarder plus tard » et « Lire ensuite »', () =>
                  useStore.setState({ playlists: [], watchLater: [], queue: [] })
                )
              }
            >
              Playlists
            </button>
            <button
              className="btn btn--ghost"
              onClick={() =>
                confirmClear('les commentaires locaux', () => useStore.setState({ comments: {} }))
              }
            >
              Commentaires
            </button>
            <button
              className="btn btn--ghost"
              onClick={() =>
                confirmClear('la progression de lecture', () => useStore.setState({ progress: {} }))
              }
            >
              Reprise de lecture
            </button>
            <button
              className="btn btn--ghost"
              onClick={() =>
                confirmClear('les vidéos masquées et les chaînes mises de côté', () => {
                  restoreDismissed();
                  restoreMutedChannels();
                })
              }
            >
              Recommandations masquées
            </button>
          </div>

          <div className="settings__danger">
            <div>
              <strong>Tout effacer</strong>
              <p>
                Supprime le compte mémorisé, les réglages, l’historique, les playlists, les
                commentaires et les caches de ce navigateur.
              </p>
            </div>
            <button className="btn btn--danger" onClick={() => void clearEverything()}>
              Effacer toutes mes données
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
