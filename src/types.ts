export type NotifLevel = 'all' | 'personalized' | 'none';

export interface Channel {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  subscribers: string;
  banner?: string;
  /** description publique de la chaîne (renseignée à la volée) */
  description?: string;
  /** « 287 vidéos », fourni par la page chaîne */
  videoCount?: string;
}

export interface Video {
  id: string;
  title: string;
  channelId: string;
  channelName: string;
  duration: number | null;
  views: string;
  viewsCount: number;
  publishedAt: string;
  description: string;
  category: string;
  tags: string[];
  likes: number;
  isShort?: boolean;
  /** libellé compact renvoyé par YouTube (« 19 M ») */
  likesText?: string;
  /** dislikes réels via Return YouTube Dislike (facultatif) */
  dislikes?: number | null;
  /** avatar de la chaîne quand il est connu */
  channelAvatar?: string;
  /** badge de statut (« En direct », « Première »…) */
  statusText?: string;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  likes: number;
  parentId?: string;
}

export interface Playlist {
  id: string;
  name: string;
  videoIds: string[];
  createdAt: number;
}

export interface SearchResult {
  videoId: string;
  title: string;
  channelId: string;
  channelName: string;
  channelAvatar: string;
  duration: number | null;
  views: string;
  publishedAt: string;
  thumbnail: string;
  isShort: boolean;
  statusText?: string;
}

/** Page de lecture enrichie par le proxy (métadonnées + suggestions réelles). */
export interface VideoPage {
  video: Video;
  channel: Channel | null;
  related: Video[];
}

export interface SponsorSegment {
  category: string;
  actionType: string;
  start: number;
  end: number;
  uuid: string;
}
