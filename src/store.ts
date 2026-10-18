import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Comment, NotifLevel, Playlist } from './types';
import {
  archiveLegacyState,
  DEFAULT_SUBSCRIPTIONS,
  emptyProfile,
  GUEST_PROFILE_ID,
  profileIdFor,
  readProfile,
  saveProfile,
  snapshotOf,
} from './lib/profiles';

export type { NotifLevel };

export interface User {
  name: string;
  email: string;
  /** photo Google si la connexion a eu lieu via Google Identity Services */
  photo?: string;
  /** fournisseur utilisé pour la connexion (google, microsoft, apple, github, email…) */
  provider?: string;
}



export interface Settings {
  autoplayNext: boolean;
  loop: boolean;
  theater: boolean;
  captions: boolean;
  speed: number;
  volume: number;
  /** recherche assistée par IA (reformulation + mots-clés associés) */
  aiSearch: boolean;
  /** résumé + chapitres générés sous chaque vidéo */
  aiSummary: boolean;
  /** saut automatique des sponsors/intros via SponsorBlock */
  sponsorBlock: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoplayNext: true,
  loop: false,
  theater: false,
  captions: false,
  speed: 1,
  volume: 100,
  aiSearch: true,
  aiSummary: true,
  sponsorBlock: true,
};

interface AppState {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;

  /** compte actuellement connecté */
  user: User | null;
  /** comptes mémorisés localement (sélecteur de comptes façon Google) */
  accounts: User[];
  /** renvoie `false` si l'archivage du profil courant a échoué (quota) */
  signIn: (user: User) => boolean;
  signOut: () => boolean;
  forgetAccount: (email: string) => void;

  liked: string[];
  disliked: string[];
  toggleLike: (id: string) => void;
  toggleDislike: (id: string) => void;

  subscribed: string[];
  toggleSubscribe: (id: string) => void;

  history: string[];
  /** date de dernière lecture (ms) par vidéo, pour l'historique groupé par jour */
  historyDates: Record<string, number>;
  addToHistory: (id: string) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;

  comments: Record<string, Comment[]>;
  addComment: (videoId: string, text: string, parentId?: string) => void;
  likeComment: (videoId: string, commentId: string) => void;
  deleteComment: (videoId: string, commentId: string) => void;

  playlists: Playlist[];
  createPlaylist: (name: string, videoId?: string) => string;
  addToPlaylist: (playlistId: string, videoId: string) => void;
  removeFromPlaylist: (playlistId: string, videoId: string) => void;
  renamePlaylist: (playlistId: string, name: string) => void;
  deletePlaylist: (playlistId: string) => void;

  watchLater: string[];
  toggleWatchLater: (videoId: string) => void;

  /** vidéos masquées du fil d'accueil via « Pas intéressé » */
  dismissed: string[];
  dismissVideo: (videoId: string) => void;
  restoreDismissed: () => void;

  /** position de lecture en secondes, par vidéo */
  progress: Record<string, number>;
  saveProgress: (videoId: string, seconds: number) => void;

  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;

  notifLevels: Record<string, NotifLevel>;
  setNotifLevel: (channelId: string, level: NotifLevel) => void;
  notificationsSeen: string[];
  markNotificationsSeen: (videoIds: string[]) => void;
}

const MAX_HISTORY = 100;

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (theme) => set({ theme }),

      user: null,
      accounts: [],
      /**
       * Bascule de profil : on archive les données du profil courant, puis on
       * recharge celles du profil cible. Un profil inédit démarre avec les
       * abonnements de base ; le profil invité conserve ses propres données.
       */
      signIn: (user) => {
        const s = get();
        // archivage d'abord : si le stockage est plein, on ne bascule pas et
        // l'état affiché reste la source de vérité (aucune perte silencieuse)
        if (!saveProfile(profileIdFor(s.user?.email), snapshotOf(s))) return false;

        const existing = readProfile(profileIdFor(user.email));
        const base = existing ?? (s.user ? emptyProfile() : snapshotOf(s));
        const data = existing
          ? base
          : {
              ...base,
              subscribed:
                base.subscribed.length > 0 ? base.subscribed : [...DEFAULT_SUBSCRIPTIONS],
            };

        set({
          user,
          accounts: [user, ...s.accounts.filter((a) => a.email !== user.email)].slice(0, 6),
          ...data,
        });
        return true;
      },
      signOut: () => {
        const s = get();
        if (!saveProfile(profileIdFor(s.user?.email), snapshotOf(s))) return false;
        const guest = readProfile(GUEST_PROFILE_ID) ?? emptyProfile();
        set({ user: null, ...guest });
        saveProfile(GUEST_PROFILE_ID, guest);
        return true;
      },
      forgetAccount: (email) =>
        set((s) => ({ accounts: s.accounts.filter((a) => a.email !== email) })),

      liked: [],
      disliked: [],
      toggleLike: (id) =>
        set((s) => ({
          liked: s.liked.includes(id) ? s.liked.filter((x) => x !== id) : [id, ...s.liked],
          disliked: s.disliked.includes(id) ? s.disliked.filter((x) => x !== id) : s.disliked,
        })),
      toggleDislike: (id) =>
        set((s) => ({
          disliked: s.disliked.includes(id) ? s.disliked.filter((x) => x !== id) : [id, ...s.disliked],
          liked: s.liked.includes(id) ? s.liked.filter((x) => x !== id) : s.liked,
        })),

      subscribed: [],
      toggleSubscribe: (id) =>
        set((s) => ({
          subscribed: s.subscribed.includes(id)
            ? s.subscribed.filter((x) => x !== id)
            : [id, ...s.subscribed],
        })),

      history: [],
      historyDates: {},
      addToHistory: (id) =>
        set((s) => ({
          history: [id, ...s.history.filter((x) => x !== id)].slice(0, MAX_HISTORY),
          historyDates: { ...s.historyDates, [id]: Date.now() },
        })),
      removeFromHistory: (id) =>
        set((s) => {
          const { [id]: _removed, ...historyDates } = s.historyDates;
          return { history: s.history.filter((x) => x !== id), historyDates };
        }),
      clearHistory: () => set({ history: [], historyDates: {} }),

      comments: {},
      addComment: (videoId, text, parentId) =>
        set((s) => {
          const list = s.comments[videoId] ?? [];
          const comment: Comment = {
            id: crypto.randomUUID(),
            author: 'Vous',
            text,
            createdAt: Date.now(),
            likes: 0,
            parentId,
          };
          return { comments: { ...s.comments, [videoId]: [comment, ...list] } };
        }),
      likeComment: (videoId, commentId) =>
        set((s) => {
          const list = s.comments[videoId] ?? [];
          return {
            comments: {
              ...s.comments,
              [videoId]: list.map((c) =>
                c.id === commentId ? { ...c, likes: c.likes + 1 } : c
              ),
            },
          };
        }),
      deleteComment: (videoId, commentId) =>
        set((s) => ({
          comments: {
            ...s.comments,
            [videoId]: (s.comments[videoId] ?? []).filter((c) => c.id !== commentId),
          },
        })),

      playlists: [],
      createPlaylist: (name, videoId) => {
        const playlist: Playlist = {
          id: crypto.randomUUID(),
          name: name.trim() || 'Nouvelle playlist',
          videoIds: videoId ? [videoId] : [],
          createdAt: Date.now(),
        };
        set((s) => ({ playlists: [playlist, ...s.playlists] }));
        return playlist.id;
      },
      addToPlaylist: (playlistId, videoId) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId && !p.videoIds.includes(videoId)
              ? { ...p, videoIds: [videoId, ...p.videoIds] }
              : p
          ),
        })),
      removeFromPlaylist: (playlistId, videoId) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId ? { ...p, videoIds: p.videoIds.filter((v) => v !== videoId) } : p
          ),
        })),
      renamePlaylist: (playlistId, name) =>
        set((s) => ({
          playlists: s.playlists.map((p) => (p.id === playlistId ? { ...p, name } : p)),
        })),
      deletePlaylist: (playlistId) =>
        set((s) => ({ playlists: s.playlists.filter((p) => p.id !== playlistId) })),

      watchLater: [],
      toggleWatchLater: (videoId) =>
        set((s) => ({
          watchLater: s.watchLater.includes(videoId)
            ? s.watchLater.filter((v) => v !== videoId)
            : [videoId, ...s.watchLater],
        })),

      dismissed: [],
      dismissVideo: (videoId) =>
        set((s) => ({
          dismissed: s.dismissed.includes(videoId)
            ? s.dismissed
            : [videoId, ...s.dismissed].slice(0, 500),
        })),
      restoreDismissed: () => set({ dismissed: [] }),

      progress: {},
      saveProgress: (videoId, seconds) =>
        set((s) => ({
          progress: { ...s.progress, [videoId]: Math.max(0, Math.floor(seconds)) },
        })),

      settings: { ...DEFAULT_SETTINGS },
      setSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } })),
      resetSettings: () => set({ settings: { ...DEFAULT_SETTINGS } }),

      notifLevels: {},
      setNotifLevel: (channelId, level) =>
        set((s) => ({ notifLevels: { ...s.notifLevels, [channelId]: level } })),
      notificationsSeen: [],
      markNotificationsSeen: (videoIds) =>
        set((s) => ({
          notificationsSeen: [...new Set([...s.notificationsSeen, ...videoIds])].slice(-300),
        })),
    }),
    {
      name: 'tubecraft-store',
      version: 6,
      /**
       * v4 -> v5 : les données étaient communes à tous les comptes. On les
       * rattache au profil actif (ou au profil invité) une seule fois, sans en
       * supprimer aucune. Les autres comptes mémorisés repartent de zéro.
       * v5 -> v6 : ajoute `settings.aiSummary` (activé par défaut).
       */
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<AppState>;
        if (version < 5) archiveLegacyState(state);
        return {
          ...state,
          settings: {
            aiSearch: true,
            aiSummary: true,
            sponsorBlock: true,
            ...(state.settings ?? {}),
          },
        } as AppState;
      },
    }
  )
);

/** Archive l'état courant dans le profil actif. */
export const snapshotCurrentProfile = (): boolean => {
  const s = useStore.getState();
  return saveProfile(profileIdFor(s.user?.email), snapshotOf(s));
};

/**
 * `migrate` peut réécrire `tubecraft-store` juste avant que Zustand ne repose
 * l'état migré. On réarchive donc une fois la réhydratation terminée : la
 * copie du profil ne reste jamais en arrière, même si le marqueur de version
 * a été écrit entre-temps.
 */
const archiveOnRehydrate = () => {
  if (!useStore.persist.hasHydrated()) return;
  snapshotCurrentProfile();
};
if (useStore.persist.hasHydrated()) archiveOnRehydrate();
else useStore.persist.onFinishHydration(archiveOnRehydrate);
