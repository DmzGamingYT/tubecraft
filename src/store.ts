import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Comment, Playlist } from './types';

export type NotifLevel = 'all' | 'personalized' | 'none';

export interface User {
  name: string;
  email: string;
  /** photo Google si la connexion a eu lieu via Google Identity Services */
  photo?: string;
}

/** Compte de démonstration proposé dans la fenêtre « Connexion avec Google ». */
export const DEMO_ACCOUNT: User = {
  name: 'Alessio Martin',
  email: 'alessio.martin@gmail.com',
};

/** Abonnements « de base » offerts à la première connexion, comme sur YouTube. */
const DEFAULT_SUBS = [
  'UCz75RVbH8q2jdBJ4SnwuZZQ', // Blender Studio (Animation)
  'UCsooa4yRKGN_zEE8iknghZA', // TED-Ed (Éducation)
  'UCLA_DiR1FfKNvjuUpBHmylQ', // NASA (Science / Espace)
  'UCWv7vMbMWH4-V0ZXdmDpPBA', // Programming with Mosh (Techno)
  'UCwmZiChSryoWQCZMIQezgTg', // BBC Earth (Nature)
];

interface Settings {
  autoplayNext: boolean;
  loop: boolean;
  theater: boolean;
  captions: boolean;
  speed: number;
  volume: number;
}

interface AppState {
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  /** compte connecté via « Google » (démonstration locale) */
  user: User | null;
  signIn: (user: User) => void;
  signOut: () => void;

  liked: string[];
  disliked: string[];
  toggleLike: (id: string) => void;
  toggleDislike: (id: string) => void;

  subscribed: string[];
  toggleSubscribe: (id: string) => void;

  history: string[];
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

  /** position de lecture en secondes, par vidéo */
  progress: Record<string, number>;
  saveProgress: (videoId: string, seconds: number) => void;

  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;

  notifLevels: Record<string, NotifLevel>;
  setNotifLevel: (channelId: string, level: NotifLevel) => void;
  notificationsSeen: string[];
  markNotificationsSeen: (videoIds: string[]) => void;
}

const MAX_HISTORY = 100;

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      user: null,
      // La connexion « Google » essaie sur le compte un lot de vidéos de base
      // et d'abonnements, comme sur YouTube (identité conservée via localStorage).
      signIn: (user) =>
        set((s) => ({
          user,
          subscribed: s.subscribed.length > 0 ? s.subscribed : [...DEFAULT_SUBS],
        })),
      signOut: () => set({ user: null, notifLevels: {} }),

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
      addToHistory: (id) =>
        set((s) => ({
          history: [id, ...s.history.filter((x) => x !== id)].slice(0, MAX_HISTORY),
        })),
      removeFromHistory: (id) => set((s) => ({ history: s.history.filter((x) => x !== id) })),
      clearHistory: () => set({ history: [] }),

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

      progress: {},
      saveProgress: (videoId, seconds) =>
        set((s) => ({
          progress: { ...s.progress, [videoId]: Math.max(0, Math.floor(seconds)) },
        })),

      settings: { autoplayNext: true, loop: false, theater: false, captions: false, speed: 1, volume: 100 },
      setSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } })),

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
      version: 2,
      // v1 -> v2 : aucune clé renommée, on conserve les données de l'utilisateur
      migrate: (persisted) => persisted as AppState,
    }
  )
);
