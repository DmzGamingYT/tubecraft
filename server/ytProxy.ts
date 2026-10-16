import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';

/**
 * Dev-only proxy that lets the browser reach YouTube's InnerTube API
 * (the private API youtube.com itself uses) without a Google API key
 * and without CORS problems: the request is issued server-side by the
 * Vite dev server.
 *
 * Endpoints (development only):
 *   GET /yt/api/search?q=...   -> normalized search results
 *   GET /yt/api/raw?q=...      -> raw InnerTube JSON (debugging)
 */

const YT_BASE = 'https://www.youtube.com';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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
  });
  const html = await res.text();
  const key = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  const version = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1];
  if (!key || !version) throw new Error('InnerTube config introuvable sur la page YouTube');
  cfg = { key, version, fetchedAt: Date.now() };
  return cfg;
}

export async function innerTubeSearch(query: string): Promise<unknown> {
  const { key, version } = await fetchInnerTubeConfig();
  const res = await fetch(`${YT_BASE}/youtubei/v1/search?key=${key}&prettyPrint=false`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      'Accept-Language': 'fr-FR,fr;q=0.9',
      Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+888; SOCS=CAI',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: version,
          hl: 'fr',
          gl: 'FR',
        },
      },
      query,
    }),
  });
  if (!res.ok) throw new Error(`InnerTube search a répondu ${res.status}`);
  return res.json();
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
  });
  if (!res.ok) throw new Error(`InnerTube ${endpoint} a répondu ${res.status}`);
  return res.json();
}

export function innerTubePlayer(videoId: string): Promise<unknown> {
  return innerTubePost('player', { videoId, contentCheckOk: true, racyCheckOk: true });
}

/** Commentaires RÉELS d'une vidéo : panneau + continuation. */
export async function innerTubeComments(videoId: string): Promise<{
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
}> {
  const next = await innerTubePost('next', { videoId });

  const findPanel = (n: any): any => {
    if (!n || typeof n !== 'object') return null;
    if (Array.isArray(n)) {
      for (const x of n) {
        const r = findPanel(x);
        if (r) return r;
      }
      return null;
    }
    if (n.engagementPanelSectionListRenderer) return n.engagementPanelSectionListRenderer;
    for (const v of Object.values(n)) {
      const r = findPanel(v);
      if (r) return r;
    }
    return null;
  };

  const tokens: string[] = [];
  const collectTokens = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(collectTokens);
    if (n.continuationCommand?.token) tokens.push(n.continuationCommand.token);
    if (n.continuationEndpoint?.continuationCommand?.token) tokens.push(n.continuationEndpoint.continuationCommand.token);
    Object.values(n).forEach(collectTokens);
  };

  const panel = findPanel(next);
  const header = panel?.header?.engagementPanelTitleHeaderRenderer;
  const count = (header?.contextualInfo?.runs ?? []).map((r: Run) => r.text ?? '').join('');
  collectTokens(panel);

  const token = tokens[0];
  if (!token) return { count, comments: [] };

  const cont = await innerTubePost('next', { continuation: token });

  const payloads: any[] = [];
  const seen = new Set<string>();
  const collectPayloads = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(collectPayloads);
    if (n.commentEntityPayload) {
      const p = n.commentEntityPayload;
      const id = p?.properties?.commentId;
      if (id && !seen.has(id)) {
        seen.add(id);
        payloads.push(p);
      }
    }
    Object.values(n).forEach(collectPayloads);
  };
  collectPayloads(cont);

  const comments = payloads.slice(0, 40).map((p) => ({
    id: p.properties?.commentId ?? '',
    author: p.author?.displayName ?? '',
    avatar: p.author?.avatarThumbnailUrl ?? '',
    channelId: p.author?.channelId ?? '',
    text: p.properties?.content?.content ?? '',
    publishedAt: p.properties?.publishedTime ?? '',
    likes: p.toolbar?.likeCountNotliked ?? p.toolbar?.likeCountA11y ?? '',
    replies: p.toolbar?.replyCount ?? '',
  }));

  return { count, comments };
}

/** Suggestions de recherche (autocomplétion façon YouTube). */
export async function innerTubeSuggest(query: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=fr&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    });
    if (!res.ok) return [];
    const text = await res.text();
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const data = JSON.parse(m[0]);
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

type Run = { text?: string };

const runs = (r?: { runs?: Run[]; simpleText?: string } | null): string => {
  if (!r) return '';
  if (typeof r.simpleText === 'string') return r.simpleText;
  return (r.runs ?? []).map((x: Run) => x.text ?? '').join('');
};

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
  const parts = text.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** Extract videos from an InnerTube search response, old and new response shapes. */
export function parseSearchResults(json: any): any[] {
  const out: any[] = [];

  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    // channelRenderer -> useful for subscriber counts
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
      });
      return;
    }

    // Classic shape: videoRenderer
    if (node.videoRenderer) {
      const v = node.videoRenderer;
      const owner =
        runs(v.ownerText) ||
        runs(v.longBylineText) ||
        runs(v.shortBylineText);
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
      });
      return;
    }

    // New shape: lockupViewModel (video / shorts lockups)
    if (node.lockupViewModel) {
      const l = node.lockupViewModel;
      const metadata = l.metadata?.lockupMetadataViewModel;
      const title = metadata?.title?.content ?? '';
      const rows = metadata?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
      const texts: string[] = [];
      for (const row of rows) {
        for (const part of row.metadataParts ?? []) {
          const t = part.text?.content;
          if (t) texts.push(t);
        }
      }
      const overlay = l.contentImage?.thumbnailViewModel?.overlays?.[0]?.thumbnailOverlayBadgeViewModel
        ?.thumbnailBadges?.[0]?.thumbnailBadgeViewModel;
      const isShort = String(overlay?.styleTags ?? '').includes('SHORTS') || String(l.contentType ?? '').includes('SHORT');
      const contentId = l.contentId ?? '';
      const isVideo = String(l.contentType ?? 'VIDEO').toUpperCase().includes('VIDEO') || isShort;
      const bylineRow = l.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0];
      let channelId = '';
      for (const part of bylineRow?.metadataParts ?? []) {
        for (const run of part.text?.commandRuns ?? []) {
          const bid = run?.onTap?.innertubeCommand?.browseEndpoint?.browseId;
          if (typeof bid === 'string' && bid.startsWith('UC')) {
            channelId = bid;
            break;
          }
        }
        if (channelId) break;
      }
      const avatar = bylineRow?.metadataParts?.[0]?.avatar?.image?.sources?.slice(-1)?.[0]?.url;
      if (isVideo && contentId) {
        out.push({
          kind: 'video',
          videoId: contentId,
          title,
          channelId,
          channelName: texts[0] ?? '',
          channelAvatar: avatar ?? '',
          duration: null,
          views: texts[1] ?? '',
          publishedAt: texts[2] ?? '',
          thumbnail:
            l.contentImage?.thumbnailViewModel?.image?.sources?.slice(-1)?.[0]?.url ?? '',
          isShort,
        });
      }
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
      });
      return;
    }

    for (const value of Object.values(node)) walk(value);
  };

  walk(json);
  // de-duplicate by videoId, keep order
  const seen = new Set<string>();
  return out.filter((v) => {
    const key = v.kind === 'channel' ? 'c:' + v.channelId : 'v:' + v.videoId;
    const valid = v.kind === 'channel' ? Boolean(v.channelId) : Boolean(v.videoId);
    if (!valid || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(body));
}

export function ytProxyPlugin(): Plugin {
  return {
    name: 'tubecraft-yt-proxy',
    configureServer(server) {
      server.middlewares.use(makeHandler());
    },
    // `npm run preview` sert dist/ avec le même proxy : le build est donc utilisable tel quel
    configurePreviewServer(server) {
      server.middlewares.use(makeHandler());
    },
  };
}

function makeHandler(): Connect.NextHandleFunction {
  return async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/yt/api/')) return next();

    if (url.pathname === '/yt/api/raw') {
      const q = url.searchParams.get('q') ?? '';
      try {
        send(res, 200, await innerTubeSearch(q));
      } catch (err) {
        send(res, 502, { error: String(err) });
      }
      return;
    }

    if (url.pathname === '/yt/api/player') {
      const id = url.searchParams.get('v');
      if (!id) return send(res, 400, { error: 'Paramètre v manquant' });
      try {
        send(res, 200, await innerTubePlayer(id));
      } catch (err) {
        send(res, 502, { error: String(err) });
      }
      return;
    }

    if (url.pathname === '/yt/api/comments') {
      const id = url.searchParams.get('v');
      if (!id) return send(res, 400, { error: 'Paramètre v manquant' });
      try {
        send(res, 200, await innerTubeComments(id));
      } catch (err) {
        send(res, 502, { error: String(err) });
      }
      return;
    }

    if (url.pathname === '/yt/api/suggest') {
      const q = url.searchParams.get('q') ?? '';
      if (!q) return send(res, 200, { suggestions: [] });
      try {
        const suggestions = await innerTubeSuggest(q);
        send(res, 200, { suggestions });
      } catch (err) {
        send(res, 502, { error: String(err), suggestions: [] });
      }
      return;
    }

    if (url.pathname === '/yt/api/search') {
      const q = url.searchParams.get('q') ?? '';
      if (!q) return send(res, 400, { error: 'Paramètre q manquant' });
      try {
        const json = await innerTubeSearch(q);
        send(res, 200, { query: q, results: parseSearchResults(json) });
      } catch (err) {
        send(res, 502, { error: String(err) });
      }
      return;
    }

    next();
  };
}
