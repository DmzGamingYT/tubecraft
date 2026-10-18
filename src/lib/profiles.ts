import type { Comment, NotifLevel, Playlist } from '../types';

/**
 * Instantanés de données par profil.
 *
 * Le store principal reste « plat » (likes, historique… de la session active)
 * pour ne pas réécrire toute l'application. Chaque bascule de compte archive
 * l'instantané courant et charge celui du profil cible dans une clé dédiée.
 */

export const PROFILE_STORAGE_KEY = 'tubecraft-profiles';
export const GUEST_PROFILE_ID = 'guest';
const PROFILES_VERSION = 1;

/** Abonnements offerts à la création d'un nouveau profil, comme sur YouTube. */
export const DEFAULT_SUBSCRIPTIONS = [
  'UCz75RVbH8q2jdBJ4SnwuZZQ', // Blender Studio (Animation)
  'UCsooa4yRKGN_zEE8iknghZA', // TED-Ed (Éducation)
  'UCLA_DiR1FfKNvjuUpBHmylQ', // NASA (Science / Espace)
  'UCWv7vMbMWH4-V0ZXdmDpPBA', // Programming with Mosh (Techno)
  'UCwmZiChSryoWQCZMIQezgTg', // BBC Earth (Nature)
];

export interface AccountData {
  liked: string[];
  disliked: string[];
  subscribed: string[];
  history: string[];
  historyDates: Record<string, number>;
  comments: Record<string, Comment[]>;
  playlists: Playlist[];
  watchLater: string[];
  dismissed: string[];
  progress: Record<string, number>;
  notifLevels: Record<string, NotifLevel>;
  notificationsSeen: string[];
}

interface ProfilesFile {
  version: number;
  profiles: Record<string, AccountData>;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Identifiant stable d'un profil : l'e-mail normalisé, ou « guest ». */
export function profileIdFor(email?: string | null): string {
  const normalized = (email ?? '').trim().toLowerCase();
  return normalized ? `email:${normalized}` : GUEST_PROFILE_ID;
}

export function emptyProfile(): AccountData {
  return {
    liked: [],
    disliked: [],
    subscribed: [],
    history: [],
    historyDates: {},
    comments: {},
    playlists: [],
    watchLater: [],
    dismissed: [],
    progress: {},
    notifLevels: {},
    notificationsSeen: [],
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function numberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isFinite(entry[1])
    )
  );
}

function commentsRecord(value: unknown): Record<string, Comment[]> {
  if (!isRecord(value)) return {};
  const result: Record<string, Comment[]> = {};
  for (const [videoId, list] of Object.entries(value)) {
    if (!Array.isArray(list)) continue;
    const comments = list.filter((comment): comment is Comment => {
      if (!isRecord(comment)) return false;
      return typeof comment.id === 'string' && typeof comment.text === 'string';
    });
    if (comments.length > 0) result[videoId] = comments;
  }
  return result;
}

const LEVELS: NotifLevel[] = ['all', 'personalized', 'none'];

function notifLevelsRecord(value: unknown): Record<string, NotifLevel> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, NotifLevel] =>
      LEVELS.includes(entry[1] as NotifLevel)
    )
  );
}

function playlistsArray(value: unknown): Playlist[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((playlist): playlist is Record<string, unknown> => {
      return (
        isRecord(playlist) &&
        typeof playlist.id === 'string' &&
        typeof playlist.name === 'string' &&
        Array.isArray(playlist.videoIds)
      );
    })
    .map((playlist) => ({
      id: playlist.id as string,
      name: playlist.name as string,
      videoIds: stringArray(playlist.videoIds),
      createdAt: typeof playlist.createdAt === 'number' ? playlist.createdAt : Date.now(),
    }));
}

/** Complète un instantané partiel ou issu d'une ancienne version. */
export function normalizeProfile(value: unknown): AccountData {
  const source = isRecord(value) ? value : {};
  return {
    liked: stringArray(source.liked),
    disliked: stringArray(source.disliked),
    subscribed: stringArray(source.subscribed),
    history: stringArray(source.history),
    historyDates: numberRecord(source.historyDates),
    comments: commentsRecord(source.comments),
    playlists: playlistsArray(source.playlists),
    watchLater: stringArray(source.watchLater),
    dismissed: stringArray(source.dismissed),
    progress: numberRecord(source.progress),
    notifLevels: notifLevelsRecord(source.notifLevels),
    notificationsSeen: stringArray(source.notificationsSeen),
  };
}

/** Extrait les tranches « compte » d'un état de store complet. */
export function snapshotOf(state: Partial<AccountData>): AccountData {
  return normalizeProfile(state);
}

/** État persisté avant le découpage par profil (v4), `user` compris. */
export interface LegacyState extends Partial<AccountData> {
  user?: { email?: string } | null;
}

/**
 * v4 -> v5 : les données étaient uniques pour tout le navigateur. On les
 * rattache au profil actif (ou invité) sans jamais écraser un profil déjà
 * enregistré, et sans retirer aucune donnée.
 *
 * @returns l'instantané archivé, ou `null` si un profil existait déjà.
 */
export function archiveLegacyState(
  state: LegacyState,
  storage?: StorageLike | null
): AccountData | null {
  const profileId = profileIdFor(state.user?.email);
  if (profileExists(profileId, storage)) return null;
  const snapshot = snapshotOf(state);
  return saveProfile(profileId, snapshot, storage) ? snapshot : null;
}

function readProfilesFile(storage?: StorageLike | null): ProfilesFile {
  const target = getStorage(storage);
  if (!target) return { version: PROFILES_VERSION, profiles: {} };
  try {
    const raw = target.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return { version: PROFILES_VERSION, profiles: {} };
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.profiles)) {
      return { version: PROFILES_VERSION, profiles: {} };
    }
    return { version: PROFILES_VERSION, profiles: parsed.profiles as Record<string, AccountData> };
  } catch {
    return { version: PROFILES_VERSION, profiles: {} };
  }
}

function writeProfilesFile(file: ProfilesFile, storage?: StorageLike | null): boolean {
  const target = getStorage(storage);
  if (!target) return false;
  try {
    target.setItem(PROFILE_STORAGE_KEY, JSON.stringify(file));
    return true;
  } catch {
    // quota dépassé : l'état actif reste dans la clé principale, rien n'est perdu
    return false;
  }
}

/** Instantané d'un profil, ou `null` s'il n'a jamais été enregistré. */
export function readProfile(profileId: string, storage?: StorageLike | null): AccountData | null {
  const file = readProfilesFile(storage);
  const entry = file.profiles[profileId];
  return entry === undefined ? null : normalizeProfile(entry);
}

export function saveProfile(
  profileId: string,
  data: Partial<AccountData>,
  storage?: StorageLike | null
): boolean {
  const file = readProfilesFile(storage);
  file.profiles[profileId] = normalizeProfile(data);
  return writeProfilesFile(file, storage);
}

export function profileExists(profileId: string, storage?: StorageLike | null): boolean {
  const file = readProfilesFile(storage);
  return Object.prototype.hasOwnProperty.call(file.profiles, profileId);
}

/** Identifiants des profils enregistrés, invité compris. */
export function listProfileIds(storage?: StorageLike | null): string[] {
  return Object.keys(readProfilesFile(storage).profiles);
}

/** Nombre de profils enregistrés (hors invité). */
export function profileCount(storage?: StorageLike | null): number {
  const file = readProfilesFile(storage);
  return Object.keys(file.profiles).filter((id) => id !== GUEST_PROFILE_ID).length;
}
