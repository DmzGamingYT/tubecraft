export interface Channel {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  subscribers: string;
  banner?: string;
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
}
