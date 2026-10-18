import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';

/**
 * Proxy InnerTube (l'API privée utilisée par youtube.com lui-même).
 *
 * Le navigateur ne peut pas appeler YouTube en direct (CORS) : ces routes
 * interrogent YouTube côté serveur, sans clé API Google. Elles existent en
 * développement et en preview (`npm run preview`).
 *
 * Routes :
 *   GET /yt/api/search?q=&continuation=&sort=&type=   recherche paginée
 *   GET /yt/api/video?v=                              métadonnées + suggestions + likes
 *   GET /yt/api/channel?id=&tab=&continuation=        chaîne, vidéos, shorts
 *   GET /yt/api/comments?v=&continuation=             commentaires paginés
 *   GET /yt/api/suggest?q=                            autocomplétion
 *   GET /yt/api/sponsorblock?v=                       segments SponsorBlock
 *   GET /yt/api/ai?q=                                 plan de recherche (Pollinations)
 *   POST /yt/api/summary                              résumé + chapitres d'une vidéo (Pollinations)
 *   GET /yt/api/raw?q=                                JSON brut (développement uniquement)
 */

const YT_BASE = 'https://www.youtube.com';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT = 9_000;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

/* ------------------------------------------------------------------ cache */

interface CacheEntry {
  expires: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 300;

function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T);
  if (hit) cache.delete(key);

  return load().then((value) => {
    // évite de faire grossir le cache indéfiniment (proxy exposé)
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { expires: Date.now() + ttlMs, value });
    return value;
  });
}

/* ---------------------------------------------------------- rate limiting */

const RATE_WINDOW = 60_000;
const RATE_MAX = 240;

interface RateEntry {
  count: number;
  reset: number;
}

const rate = new Map<string, RateEntry>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rate.get(ip);
  if (!entry || entry.reset < now) {
    rate.set(ip, { count: 1, reset: now + RATE_WINDOW });
    if (rate.size > 5_000) rate.clear();
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

/* --------------------------------------------------------------- InnerTube */

interface InnerTubeConfig {
  key: string;
  version: string;
  fetchedAt: number;
}

let cfg: InnerTubeConfig | null = null;

async function fetchInnerTubeConfig(): Promise<InnerTubeConfig> {
  if (cfg && Date.now() - cfg.fetchedAt < 1000 * 60 * 60 * 6) return cfg;

  const res = await fetch(YT_BASE + '/', {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+888; SOCS=CAI',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!res.ok) throw new Error(`Page YouTube : HTTP ${res.status}`);

  const html = await res.text();
  const key = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  const version = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1];
  if (!key || !version) throw new Error('InnerTube config introuvable sur la page YouTube');

  cfg = { key, version, fetchedAt: Date.now() };
  return cfg;
}

async function innerTubePost(endpoint: string, payload: Record<string, unknown>): Promise<any> {
  const { key, version } = await fetchInnerTubeConfig();
  const res = await fetch(`${YT_BASE}/youtubei/v1/${endpoint}?key=${key}&prettyPrint=false`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      'Accept-Language': 'fr-FR,fr;q=0.9',
      Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+888; SOCS=CAI',
    },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: version, hl: 'fr', gl: 'FR' } },
      ...payload,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!res.ok) throw new Error(`InnerTube ${endpoint} : HTTP ${res.status}`);
  return res.json();
}

/** Paramètres de filtre de recherche (protobuf encodé, valeurs stables de YouTube). */
function searchParams(sort: string, type: string): string | undefined {
  // YouTube ignore le tri s'il n'est pas combiné au type « vidéo »
  // (les tokens seuls « CAI= » / « CAM= » ne changent rien dans les faits).
  if (sort === 'date') return 'CAISAhAB';
  if (sort === 'views') return 'CAMSAhAB';
  return type === 'video' ? 'EgIQAQ==' : undefined;
}

export function innerTubeSearch(
  query: string,
  options: { continuation?: string; sort?: string; type?: string } = {}
): Promise<any> {
  if (options.continuation) {
    return innerTubePost('search', { continuation: options.continuation });
  }
  return innerTubePost('search', {
    query,
    ...(searchParams(options.sort ?? 'relevance', options.type ?? 'all')
      ? { params: searchParams(options.sort ?? 'relevance', options.type ?? 'all') }
      : {}),
  });
}

export function innerTubePlayer(videoId: string): Promise<any> {
  return innerTubePost('player', { videoId, contentCheckOk: true, racyCheckOk: true });
}

/* --------------------------------------------------------------- parsing */

type Run = { text?: string };

const runs = (r?: { runs?: Run[]; simpleText?: string } | null): string => {
  if (!r) return '';
  if (typeof r.simpleText === 'string') return r.simpleText;
  return (r.runs ?? []).map((x: Run) => x.text ?? '').join('');
};

export function findFirst(node: any, key: string): any {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFirst(item, key);
      if (found) return found;
    }
    return null;
  }
  if (node[key]) return node[key];
  for (const value of Object.values(node)) {
    const found = findFirst(value, key);
    if (found) return found;
  }
  return null;
}

export function findAll(node: any, key: string, out: any[] = []): any[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((item) => findAll(item, key, out));
    return out;
  }
  if (node[key]) out.push(node[key]);
  Object.values(node).forEach((value) => findAll(value, key, out));
  return out;
}

function continuationTokens(node: any, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((item) => continuationTokens(item, out));
    return out;
  }
  const token = node.continuationCommand?.token ?? node.continuationEndpoint?.continuationCommand?.token;
  if (typeof token === 'string' && !out.includes(token)) out.push(token);
  Object.values(node).forEach((value) => continuationTokens(value, out));
  return out;
}

interface Thumb {
  url: string;
  width?: number;
  height?: number;
}

function bestThumb(thumbs?: Thumb[]): string {
  if (!thumbs || thumbs.length === 0) return '';
  return thumbs[thumbs.length - 1].url;
}

function secondsOf(text: string): number | null {
  const clean = text.trim();
  if (!clean) return null;
  if (!/^\d+(?::\d{1,2}){1,2}$/.test(clean)) return null;
  const parts = clean.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

interface BadgeLike {
  text?: string;
}

/** Durée affichée sur les vignettes (badge « 12:34 ») des nouveaux lockups. */
function durationFromBadges(badges?: BadgeLike[]): number | null {
  for (const badge of badges ?? []) {
    const duration = secondsOf(badge?.text ?? '');
    if (duration != null) return duration;
  }
  return null;
}

const VIDEO_LOCKUP_TYPES = new Set([
  'LOCKUP_CONTENT_TYPE_VIDEO',
  'LOCKUP_CONTENT_TYPE_SHORTS',
  'LOCKUP_CONTENT_TYPE_PODCAST',
]);

function lockupToResult(lockup: any): any | null {
  if (!lockup) return null;
  const contentType = String(lockup.contentType ?? '');
  if (contentType && !VIDEO_LOCKUP_TYPES.has(contentType)) return null;

  const videoId = String(lockup.contentId ?? '');
  if (!VIDEO_ID.test(videoId)) return null;

  const metadata = lockup.metadata?.lockupMetadataViewModel;
  const title: string = metadata?.title?.content ?? '';
  const rows: any[] = metadata?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
  const byline = (rows[0]?.metadataParts ?? [])
    .map((p: any) => p?.text?.content)
    .filter((t: string | undefined): t is string => Boolean(t));
  const stats = (rows[1]?.metadataParts ?? [])
    .map((p: any) => p?.text?.content)
    .filter((t: string | undefined): t is string => Boolean(t));

  let channelId = '';
  let channelName = byline[0] ?? '';
  const avatar = rows[0]?.metadataParts?.[0]?.avatar?.image?.sources?.slice(-1)?.[0]?.url;
  for (const part of rows[0]?.metadataParts ?? []) {
    for (const run of part?.text?.commandRuns ?? []) {
      const browse = run?.onTap?.innertubeCommand?.browseEndpoint;
      const id = browse?.browseId;
      if (typeof id === 'string' && id.startsWith('UC')) {
        channelId = id;
        const label = part?.text?.content;
        if (label) channelName = String(label);
        break;
      }
    }
    if (channelId) break;
  }

  const overlays = lockup.contentImage?.thumbnailViewModel?.overlays ?? [];
  const badges = findAll(overlays, 'thumbnailBadgeViewModel');
  const isShort =
    contentType === 'LOCKUP_CONTENT_TYPE_SHORTS' ||
    badges.some((b: any) => String(b?.styleTags ?? '').includes('SHORTS'));

  return {
    kind: 'video',
    videoId,
    title,
    channelId,
    channelName,
    channelAvatar: avatar ?? '',
    duration: durationFromBadges(badges),
    views: stats[0] ?? '',
    publishedAt: stats[1] ?? '',
    thumbnail: lockup.contentImage?.thumbnailViewModel?.image?.sources?.slice(-1)?.[0]?.url ?? '',
    isShort,
    statusText: '',
  };
}

/** Extrait vidéos + chaînes d'une réponse InnerTube (search, browse, next). */
export function parseSearchResults(json: any): any[] {
  const out: any[] = [];

  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (node.videoRenderer) {
      const v = node.videoRenderer;
      const owner = runs(v.ownerText) || runs(v.longBylineText) || runs(v.shortBylineText);
      const channelId =
        v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ??
        v.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ??
        v.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ??
        '';
      out.push({
        kind: 'video',
        videoId: v.videoId,
        title: runs(v.title),
        channelId,
        channelName: owner,
        channelAvatar: bestThumb(
          v.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails
        ),
        duration: secondsOf(runs(v.lengthText)),
        views: runs(v.viewCountText),
        publishedAt: runs(v.publishedTimeText),
        thumbnail: bestThumb(v.thumbnail?.thumbnails),
        isShort: Array.isArray(v.badges)
          ? v.badges.some((b: any) => String(b?.metadataBadgeRenderer?.style).includes('SHORTS'))
          : false,
        statusText: runs(v.badges?.[0]?.metadataBadgeRenderer?.label),
      });
      return;
    }

    if (node.channelRenderer) {
      const c = node.channelRenderer;
      out.push({
        kind: 'channel',
        videoId: '',
        channelId: c.channelId ?? '',
        channelName: runs(c.title),
        channelAvatar: bestThumb(c.thumbnail?.thumbnails),
        handle: runs(c.subscriberCountText),
        subscriberCountText: runs(c.videoCountText),
        title: '',
        duration: null,
        views: '',
        publishedAt: '',
        thumbnail: '',
        isShort: false,
        statusText: '',
      });
      return;
    }

    if (node.shortsLockupViewModel) {
      const s = node.shortsLockupViewModel;
      const thumb =
        s.thumbnailViewModel?.image?.sources?.slice(-1)?.[0]?.url ??
        s.onTap?.innertubeCommand?.reelWatchEndpoint?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ??
        '';
      out.push({
        kind: 'video',
        videoId:
          s.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ??
          s.inlinePlayerData?.onVisible?.innertubeCommand?.watchEndpoint?.videoId ??
          '',
        title: s.overlayMetadata?.primaryText?.content ?? '',
        channelId: '',
        channelName: '',
        channelAvatar: '',
        duration: null,
        views: s.overlayMetadata?.secondaryText?.content ?? '',
        publishedAt: '',
        thumbnail: thumb,
        isShort: true,
        statusText: '',
      });
      return;
    }

    if (node.lockupViewModel) {
      const result = lockupToResult(node.lockupViewModel);
      if (result) out.push(result);
      return;
    }

    for (const value of Object.values(node)) walk(value);
  };

  walk(json);

  // déduplication : les playlists et renderers imbriqués produisent des doublons
  const seen = new Set<string>();
  return out.filter((v) => {
    const key = v.kind === 'channel' ? 'c:' + v.channelId : 'v:' + v.videoId;
    const valid = v.kind === 'channel' ? Boolean(v.channelId) : VIDEO_ID.test(v.videoId);
    if (!valid || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface VideoPageData {
  video: {
    id: string;
    title: string;
    description: string;
    views: string;
    viewsCount: number;
    publishedAt: string;
    category: string;
    tags: string[];
    duration: number | null;
    likesText: string;
    likes: number | null;
    dislikes: number | null;
    isShort: boolean;
  };
  channel: {
    id: string;
    name: string;
    handle: string;
    avatar: string;
    subscribers: string;
  } | null;
  related: any[];
}

function toNumber(text: unknown): number | null {
  if (typeof text === 'number' && Number.isFinite(text)) return text;
  if (typeof text !== 'string') return null;
  const clean = text.replace(/[\s\u00a0\u202f]/g, '');
  const match = clean.match(/(\d+(?:[.,]\d+)?)([kKmMgG])?/);
  if (!match) return null;
  let value = parseFloat(match[1].replace(',', '.'));
  if (Number.isNaN(value)) return null;
  const unit = (match[2] ?? '').toLowerCase();
  if (unit === 'k') value *= 1_000;
  if (unit === 'm') value *= 1_000_000;
  if (unit === 'g') value *= 1_000_000_000;
  return Math.round(value);
}

/** Fusionne `next` (page de lecture) et `player` en données prêtes pour l'UI. */
export function parseVideoPage(next: any, player: any, videoId: string): VideoPageData {
  const primary = findFirst(next, 'videoPrimaryInfoRenderer');
  const secondary = findFirst(next, 'videoSecondaryInfoRenderer');
  const owner = secondary?.owner?.videoOwnerRenderer;
  const details = player?.videoDetails ?? {};
  const micro = player?.microformat?.playerMicroformatRenderer ?? {};

  const likeTitle =
    findFirst(next, 'segmentedLikeDislikeButtonViewModel')?.likeButtonViewModel?.likeButtonViewModel
      ?.toggleButtonViewModel?.toggleButtonViewModel?.defaultButtonViewModel?.buttonViewModel?.title ??
    findFirst(next, 'likeButtonViewModel')?.likeButtonViewModel?.toggleButtonViewModel
      ?.defaultButtonViewModel?.buttonViewModel?.title ??
    '';

  const title = runs(primary?.title) || details.title || '';
  const viewText =
    primary?.viewCount?.videoViewCountRenderer?.viewCount?.simpleText ??
    (details.viewCount ? `${Number(details.viewCount).toLocaleString('fr-FR')} vues` : '');
  const viewsCount = toNumber(details.viewCount ?? viewText.replace(/\D/g, '')) ?? 0;

  const related = parseSearchResults(next).filter(
    (item) => item.kind === 'video' && item.videoId !== videoId
  );

  return {
    video: {
      id: videoId,
      title,
      description:
        secondary?.attributedDescription?.content ??
        runs(secondary?.description) ??
        micro.description?.simpleText ??
        '',
      views: viewText,
      viewsCount,
      publishedAt: runs(primary?.dateText) || micro.publishDate || '',
      category: micro.category ?? '',
      tags: Array.isArray(details.keywords) ? details.keywords.slice(0, 12) : [],
      duration: details.lengthSeconds ? Number(details.lengthSeconds) : null,
      likesText: likeTitle,
      likes: toNumber(likeTitle),
      dislikes: null,
      isShort: String(micro.category ?? '').toLowerCase() === 'shorts',
    },
    channel: owner
      ? {
          id: owner.navigationEndpoint?.browseEndpoint?.browseId ?? details.channelId ?? '',
          name: runs(owner.title) || details.author || '',
          handle: '',
          avatar: bestThumb(owner.thumbnail?.thumbnails),
          subscribers: runs(owner.subscriberCountText),
        }
      : details.channelId
        ? {
            id: details.channelId,
            name: details.author ?? '',
            handle: '',
            avatar: '',
            subscribers: '',
          }
        : null,
    related,
  };
}

export interface ChannelPageData {
  channel: {
    id: string;
    name: string;
    handle: string;
    avatar: string;
    banner: string;
    subscribers: string;
    description: string;
    videoCount: string;
  };
  videos: any[];
  continuation: string | null;
}

export function parseChannelPage(browse: any, channelId: string): ChannelPageData {
  const header = findFirst(browse, 'pageHeaderViewModel');
  const metaParts: string[] = [];
  for (const row of header?.metadata?.contentMetadataViewModel?.metadataRows ?? []) {
    for (const part of row?.metadataParts ?? []) {
      const text = part?.text?.content;
      if (text) metaParts.push(String(text));
    }
  }

  const handle = metaParts.find((t) => t.startsWith('@')) ?? '';
  const subscribers = metaParts.find((t) => t.includes('abonné')) ?? '';
  const videoCount = metaParts.find((t) => /\bvidéo/.test(t)) ?? '';
  const description = header?.description?.descriptionPreviewViewModel?.description?.content ?? '';

  const videos = parseSearchResults(browse).filter((item) => item.kind === 'video');
  const token = continuationTokens(
    findFirst(browse, 'continuationItemRenderer') ?? browse?.contents ?? {}
  )[0];

  return {
    channel: {
      id: channelId,
      name: header?.title?.dynamicTextViewModel?.text?.content ?? '',
      handle,
      avatar: bestThumb(header?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources),
      banner: bestThumb(header?.banner?.imageBannerViewModel?.image?.sources),
      subscribers,
      description,
      videoCount,
    },
    videos,
    continuation: token ?? null,
  };
}

export interface CommentPage {
  count: string;
  comments: Array<{
    id: string;
    author: string;
    avatar: string;
    channelId: string;
    text: string;
    publishedAt: string;
    likes: string;
    replies: string;
  }>;
  continuation: string | null;
}

export function parseComments(data: any, panelRoot?: any): CommentPage {
  // `panelRoot` ne sert qu'au compteur : le jeton de page suivante doit
  // toujours venir de la réponse de continuation, pas du panneau initial.
  const header = findFirst(panelRoot ?? data, 'engagementPanelTitleHeaderRenderer');
  const count = runs(header?.contextualInfo) || '';

  const comments: CommentPage['comments'] = [];
  const seen = new Set<string>();
  for (const payload of findAll(data, 'commentEntityPayload')) {
    const id = payload?.properties?.commentId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    comments.push({
      id,
      author: payload.author?.displayName ?? '',
      avatar: payload.author?.avatarThumbnailUrl ?? '',
      channelId: payload.author?.channelId ?? '',
      text: payload.properties?.content?.content ?? '',
      publishedAt: payload.properties?.publishedTime ?? '',
      likes: payload.toolbar?.likeCountNotliked ?? payload.toolbar?.likeCountA11y ?? '',
      replies: payload.toolbar?.replyCount ?? '',
    });
  }

  return { count, comments: comments.slice(0, 40), continuation: commentContinuation(data) };
}

/**
 * Le jeton « page suivante » est le dernier `continuationItemRenderer` de la
 * liste. Les jetons des réponses imbriquées (`commentRepliesRenderer`) et des
 * menus de tri arrivent avant lui : les prendre en premier renvoyait la même page.
 */
function commentContinuation(root: any): string | null {
  let next: string | null = null;

  const walk = (node: any, insideReplies: boolean) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, insideReplies));
      return;
    }
    const replies = insideReplies || Boolean(node.commentRepliesRenderer);
    if (!replies && node.continuationItemRenderer) {
      const token = node.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token;
      if (typeof token === 'string') next = token;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'continuationItemRenderer') continue;
      walk(value, replies);
    }
  };

  walk(root, false);
  return next;
}

/** Commentaires réels d'une vidéo, ou page suivante via continuation. */
export async function innerTubeComments(
  videoId?: string,
  continuation?: string
): Promise<CommentPage> {
  if (continuation) {
    const data = await innerTubePost('next', { continuation });
    return parseComments(data);
  }
  if (!videoId) throw new Error('Paramètre v manquant');
  const next = await innerTubePost('next', { videoId });
  const panel = findFirst(next, 'engagementPanelSectionListRenderer');
  const token = panel ? commentContinuation(panel) : null;
  if (!token) return { ...parseComments(next, panel), comments: [], continuation: null };

  // la première requête de continuation charge la liste des commentaires
  const data = await innerTubePost('next', { continuation: token });
  return parseComments(data, panel);
}

/* ------------------------------------------------------- services annexes */

/** Suggestions de recherche (autocomplétion façon YouTube). */
export async function innerTubeSuggest(query: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=fr&q=${encodeURIComponent(
    query
  )}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'fr-FR,fr;q=0.9' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const data = JSON.parse(match[0]);
    const rows: any[] = Array.isArray(data?.[1]) ? data[1] : [];
    const out: string[] = [];
    for (const row of rows) {
      if (Array.isArray(row) && typeof row[0] === 'string') out.push(row[0]);
      else if (typeof row === 'string') out.push(row);
    }
    return [...new Set(out)].slice(0, 10);
  } catch {
    return [];
  }
}

export interface SponsorSegment {
  category: string;
  actionType: string;
  start: number;
  end: number;
  uuid: string;
}

const SPONSOR_CATEGORIES = [
  'sponsor',
  'selfpromo',
  'interaction',
  'intro',
  'outro',
  'preview',
  'music_offtopic',
  'filler',
];

/**
 * Segments SponsorBlock (API publique, sans clé) : permet de sauter
 * automatiquement les sponsors et intros, comme l'extension du même nom.
 */
export async function sponsorSegments(videoId: string): Promise<SponsorSegment[]> {
  const categories = encodeURIComponent(JSON.stringify(SPONSOR_CATEGORIES));
  const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=${categories}&actionTypes=${encodeURIComponent(
    '["skip","mute"]'
  )}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TubeCraft/0.2 (+https://github.com)' },
      signal: AbortSignal.timeout(6_000),
    });
    // 404 = aucune donnée pour cette vidéo, ce n'est pas une erreur
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((s: any) => Array.isArray(s?.segment) && s.segment.length === 2)
      .map((s: any) => ({
        category: String(s.category ?? 'sponsor'),
        actionType: String(s.actionType ?? 'skip'),
        start: Number(s.segment[0]),
        end: Number(s.segment[1]),
        uuid: String(s.UUID ?? ''),
      }));
  } catch {
    return [];
  }
}

export interface DislikeData {
  likes: number;
  dislikes: number;
  viewCount: number;
  rating: number;
}

/**
 * Return YouTube Dislike (API publique) : YouTube n'expose plus les dislikes,
 * cette archive communautaire les rétablit. Optionnel et sans clé.
 */
export async function dislikeData(videoId: string): Promise<DislikeData | null> {
  try {
    const res = await fetch(`https://returnyoutubedislikeapi.com/votes?videoId=${videoId}`, {
      headers: { 'User-Agent': 'TubeCraft/0.2' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.likes !== 'number') return null;
    return {
      likes: data.likes,
      dislikes: data.dislikes,
      viewCount: data.viewCount,
      rating: data.rating,
    };
  } catch {
    return null;
  }
}

/** Appel JSON à Pollinations (gratuit, sans clé) avec extraction tolérante. */
async function pollinationsJson(
  system: string,
  user: string,
  maxTokens: number,
  temperature = 0.4
): Promise<unknown> {
  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature,
      max_tokens: maxTokens,
      referrer: 'tubecraft',
    }),
    // un résumé complet (800 jetons) peut dépasser 15 s sur le palier gratuit
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Pollinations : HTTP ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? '';
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Recherche assistée par IA : relais vers Pollinations (gratuit, sans clé). */
export async function aiSearchPlan(query: string): Promise<unknown> {
  const system = `Tu es un assistant de recherche vidéo francophone. Réponds UNIQUEMENT par un objet JSON valide :
{"query":"requête YouTube améliorée en français","keywords":["recherche associée 1","recherche associée 2","recherche associée 3"],"intent":"intention en une phrase courte"}
Garde le sens d'origine, précise si utile, n'invente rien.`;
  const result = await pollinationsJson(system, query, 320);
  return result ?? { query, keywords: [] };
}

/* --------------------------------------------------------- résumé de vidéo */

export interface SummaryInput {
  title: string;
  channelName: string;
  duration: number | null;
  publishedAt: string;
  category: string;
  tags: string[];
  description: string;
}

const SUMMARY_LIMITS = {
  title: 300,
  channelName: 200,
  description: 8_000,
  tags: 20,
  tag: 80,
};

/** Valide le corps envoyé par le client (jamais de texte arbitraire géant). */
export function parseSummaryInput(value: unknown): SummaryInput | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title || title.length > SUMMARY_LIMITS.title) return null;

  const description =
    typeof raw.description === 'string' ? raw.description.slice(0, SUMMARY_LIMITS.description) : '';
  const channelName =
    typeof raw.channelName === 'string' ? raw.channelName.slice(0, SUMMARY_LIMITS.channelName) : '';
  const publishedAt = typeof raw.publishedAt === 'string' ? raw.publishedAt.slice(0, 40) : '';
  const category = typeof raw.category === 'string' ? raw.category.slice(0, 80) : '';
  const duration =
    typeof raw.duration === 'number' && Number.isFinite(raw.duration) && raw.duration > 0
      ? Math.floor(raw.duration)
      : null;
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .filter((tag): tag is string => typeof tag === 'string')
        .slice(0, SUMMARY_LIMITS.tags)
        .map((tag) => tag.slice(0, SUMMARY_LIMITS.tag))
    : [];

  return { title, channelName, publishedAt, category, duration, tags, description };
}

/** Résumé + chapitres générés côté serveur, à partir des seules métadonnées. */
export async function aiVideoSummary(input: SummaryInput): Promise<unknown> {
  const system = `Tu résumes des vidéos YouTube pour un spectateur francophone.
Réponds UNIQUEMENT par un objet JSON valide, sans texte ni balise Markdown :
{"summary":"résumé factuel de 2 à 4 phrases","chapters":[{"time":"mm:ss","title":"titre court"}]}
Consignes : résume uniquement ce que disent le titre, la description et les métadonnées ; n'invente aucun fait ; si la description est pauvre, dis-le ; propose 4 à 8 chapitres strictement croissants et inférieurs à la durée ; réutilise les horodatages déjà présents dans la description ; titres de 2 à 8 mots, en français, sans numéro ni emoji.`;

  const user = [
    `Titre : ${input.title}`,
    `Chaîne : ${input.channelName || 'inconnue'}`,
    `Durée : ${input.duration ?? 'inconnue'} secondes`,
    input.publishedAt ? `Publication : ${input.publishedAt}` : '',
    input.category ? `Catégorie : ${input.category}` : '',
    input.tags.length > 0 ? `Tags : ${input.tags.join(', ')}` : '',
    '',
    'Description :',
    input.description || '(vide)',
  ]
    .filter(Boolean)
    .join('\n');

  return pollinationsJson(system, user, 800, 0.3);
}

async function readJsonBody(req: IncomingMessage, limit: number): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > limit) throw new Error('Corps de requête trop volumineux');
    chunks.push(buffer);
  }
  if (size === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------- HTTP layer */

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function fail(res: ServerResponse, err: unknown, fallback = 'Service YouTube indisponible') {
  // ne jamais renvoyer la stack au client
  console.error('[yt-proxy]', err);
  send(res, 502, { error: fallback });
}

function clientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? 'unknown';
}

/** Empreinte courte pour la clé de cache (FNV-1a). */
function hashText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function makeHandler(options: { dev?: boolean } = {}): Connect.NextHandleFunction {
  return async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/yt/api/')) return next();

    const isSummaryPost = req.method === 'POST' && url.pathname === '/yt/api/summary';
    if (req.method !== 'GET' && req.method !== 'HEAD' && !isSummaryPost) {
      send(res, 405, { error: 'Méthode non autorisée' });
      return;
    }
    if (rateLimited(clientIp(req))) {
      res.setHeader('Retry-After', '60');
      send(res, 429, { error: 'Trop de requêtes, réessayez dans une minute' });
      return;
    }

    const path = url.pathname;

    try {
      if (isSummaryPost) {
        let body: unknown;
        try {
          body = await readJsonBody(req, 16_000);
        } catch {
          return send(res, 413, { error: 'Métadonnées trop volumineuses' });
        }
        const input = parseSummaryInput(body);
        if (!input) return send(res, 400, { error: 'Métadonnées de vidéo invalides' });

        const fingerprint = hashText(JSON.stringify(input));
        const data = await cached(`summary:${fingerprint}`, 1000 * 60 * 60 * 6, () =>
          aiVideoSummary(input)
        ).catch((error) => {
          console.error('[yt-proxy] résumé IA', error);
          return null;
        });
        if (!data) return send(res, 502, { error: 'Résumé IA indisponible' });
        send(res, 200, data);
        return;
      }

      if (path === '/yt/api/search') {
        const q = (url.searchParams.get('q') ?? '').trim();
        const continuation = url.searchParams.get('continuation') ?? undefined;
        if (!q && !continuation) return send(res, 400, { error: 'Paramètre q manquant' });
        if (q.length > 200) return send(res, 400, { error: 'Requête trop longue' });

        const sort = url.searchParams.get('sort') ?? 'relevance';
        const type = url.searchParams.get('type') ?? 'all';
        const data = await cached(
          `search:${q}:${sort}:${type}:${continuation ?? ''}`,
          1000 * 60 * 5,
          () => innerTubeSearch(q, { continuation, sort, type })
        );
        const results = parseSearchResults(data);
        send(res, 200, {
          query: q,
          results,
          continuation: continuationTokens(data)[0] ?? null,
          estimated: data?.estimatedResults ? Number(data.estimatedResults) : null,
        });
        return;
      }

      if (path === '/yt/api/video') {
        const id = url.searchParams.get('v') ?? '';
        if (!VIDEO_ID.test(id)) return send(res, 400, { error: 'Identifiant vidéo invalide' });

        const data = await cached(`video:${id}`, 1000 * 60 * 10, async () => {
          const [next, player, ryd] = await Promise.allSettled([
            innerTubePost('next', { videoId: id }),
            innerTubePlayer(id),
            dislikeData(id),
          ]);
          if (next.status === 'rejected') throw next.reason;
          const page = parseVideoPage(
            next.value,
            player.status === 'fulfilled' ? player.value : null,
            id
          );
          if (ryd.status === 'fulfilled' && ryd.value) {
            page.video.likes = ryd.value.likes;
            page.video.dislikes = ryd.value.dislikes;
            page.video.viewsCount = ryd.value.viewCount || page.video.viewsCount;
          }
          return page;
        });
        send(res, 200, data);
        return;
      }

      // conservé pour `npm run catalog` (statut de lecture + playableInEmbed)
      if (path === '/yt/api/player') {
        const id = url.searchParams.get('v') ?? '';
        if (!VIDEO_ID.test(id)) return send(res, 400, { error: 'Identifiant vidéo invalide' });
        const data = await cached(`player:${id}`, 1000 * 60 * 10, () => innerTubePlayer(id));
        send(res, 200, data);
        return;
      }

      if (path === '/yt/api/channel') {
        const id = url.searchParams.get('id') ?? '';
        if (!CHANNEL_ID.test(id)) return send(res, 400, { error: 'Identifiant de chaîne invalide' });

        const tab = url.searchParams.get('tab') === 'shorts' ? 'shorts' : 'videos';
        const continuation = url.searchParams.get('continuation') ?? undefined;
        const params =
          tab === 'shorts' ? 'EgZzaG9ydHPyBgUKA5oBAA%3D%3D' : 'EgZ2aWRlb3PyBgQKAjoA';

        const data = await cached(
          `channel:${id}:${tab}:${continuation ?? ''}`,
          1000 * 60 * 5,
          () =>
            continuation
              ? innerTubePost('browse', { continuation })
              : innerTubePost('browse', { browseId: id, params })
        );

        if (continuation) {
          send(res, 200, {
            channel: null,
            videos: parseSearchResults(data).filter((v) => v.kind === 'video'),
            continuation: findFirst(data, 'continuationItemRenderer')
              ? continuationTokens(findFirst(data, 'continuationItemRenderer'))[0] ?? null
              : null,
          });
        } else {
          send(res, 200, parseChannelPage(data, id));
        }
        return;
      }

      if (path === '/yt/api/comments') {
        const id = url.searchParams.get('v') ?? '';
        const continuation = url.searchParams.get('continuation') ?? undefined;
        if (!continuation && !VIDEO_ID.test(id)) {
          return send(res, 400, { error: 'Identifiant vidéo invalide' });
        }
        const data = await cached(`comments:${id}:${continuation ?? ''}`, 1000 * 60 * 3, () =>
          innerTubeComments(continuation ? undefined : id, continuation)
        );
        send(res, 200, data);
        return;
      }

      if (path === '/yt/api/suggest') {
        const q = (url.searchParams.get('q') ?? '').trim();
        if (!q) return send(res, 200, { suggestions: [] });
        const suggestions = await innerTubeSuggest(q.slice(0, 100));
        send(res, 200, { suggestions });
        return;
      }

      if (path === '/yt/api/sponsorblock') {
        const id = url.searchParams.get('v') ?? '';
        if (!VIDEO_ID.test(id)) return send(res, 400, { error: 'Identifiant vidéo invalide' });
        const segments = await cached(`sponsor:${id}`, 1000 * 60 * 60, () => sponsorSegments(id));
        send(res, 200, { segments });
        return;
      }

      if (path === '/yt/api/ai') {
        const q = (url.searchParams.get('q') ?? '').trim();
        if (!q) return send(res, 400, { error: 'Paramètre q manquant' });
        const plan = await cached(`ai:${q.toLowerCase()}`, 1000 * 60 * 30, () => aiSearchPlan(q));
        send(res, 200, plan);
        return;
      }

      // route de débogage : jamais exposée en preview/production
      if (path === '/yt/api/raw' && options.dev) {
        const q = (url.searchParams.get('q') ?? '').trim();
        if (!q) return send(res, 400, { error: 'Paramètre q manquant' });
        send(res, 200, await innerTubeSearch(q));
        return;
      }

      send(res, 404, { error: 'Route inconnue' });
    } catch (err) {
      fail(res, err);
    }
  };
}

/**
 * Connect ajoute les middlewares à la fin de sa pile. En preview, Vite a déjà
 * installé son « fallback » SPA : sans remonter notre handler en tête, toutes
 * les routes `/yt/api/*` renverraient `index.html`.
 */
function useFirst(server: { middlewares: Connect.Server }, handler: Connect.NextHandleFunction) {
  server.middlewares.use(handler);
  const stack = (server.middlewares as unknown as {
    stack?: Array<{ handle: Connect.NextHandleFunction }>;
  }).stack;
  if (!stack) return;
  const index = stack.findIndex((entry) => entry.handle === handler);
  if (index > 0) stack.unshift(...stack.splice(index, 1));
}

export function ytProxyPlugin(): Plugin {
  return {
    name: 'tubecraft-yt-proxy',
    configureServer(server) {
      useFirst(server, makeHandler({ dev: true }));
    },
    // `npm run preview` sert dist/ avec le même proxy (sans les routes de debug)
    configurePreviewServer(server) {
      useFirst(server, makeHandler({ dev: false }));
    },
  };
}
