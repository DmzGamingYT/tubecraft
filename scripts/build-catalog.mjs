#!/usr/bin/env node
/**
 * Génère src/data/catalog.ts à partir de données YouTube RÉELLES
 * (via le proxy InnerTube du serveur dev, http://127.0.0.1:5183/yt/api/...).
 *
 * Usage : npm run catalog   (le serveur dev doit tourner)
 *
 * Étapes :
 *   1. recherches par catégorie -> candidats
 *   2. vérification via /yt/api/player (statut + playableInEmbed)
 *   3. enrichissement (description, tags, date de publication, vues exactes)
 *   4. recherche des comptes d'abonnés par chaîne
 *   5. écriture de src/data/catalog.ts
 */
import { writeFile } from 'node:fs/promises';

const BASE = process.env.YT_PROXY ?? 'http://127.0.0.1:5183';
const OUT = new URL('../src/data/catalog.ts', import.meta.url);

/** [catégorie, requête, nombre de vidéos visées] */
const QUERIES = [
  ['Animation', 'blender open movie', 6],
  ['Animation', 'animated short film official', 4],
  ['Éducation', 'ted ed', 5],
  ['Science', 'nasa science documentary', 5],
  ['Technologie', 'javascript tutorial for beginners', 5],
  ['Nature', 'nature documentary 4k wildlife', 5],
  ['Histoire', 'histoire de france documentaire', 4],
  ['Cuisine', 'recette cuisine facile rapide', 4],
  ['Musique', 'creative commons music video', 4],
  ['Voyage', 'travel documentary 4k', 4],
  ['Jeux vidéo', 'jeux vidéo gameplay walkthrough', 4],
  ['Sport', 'sport highlights', 3],
  ['Développement personnel', 'productivity tips', 3],
];

const SHORT_QUERIES = ['#shorts', 'shorts funny', 'shorts food', 'shorts nature'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

async function mapLimit(items, limit, fn) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

function pickThumb(r) {
  const t = r.thumbnail || '';
  if (!t) return '';
  // frame0.jpg (portrait) est la vignette native des Shorts, on la garde telle quelle
  if (/frame0\.jpg$/.test(t)) return t;
  const m = t.match(/\/vi\/([^/]+)\//);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : t;
}

function cleanText(s) {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

function parseViews(text) {
  if (!text) return 0;
  const clean = String(text).replace(/[\s\u00a0\u202f]/g, '');
  const m = clean.match(/(\d+(?:[.,]\d+)?)([kKmMgG])?/);
  if (!m) return 0;
  let n = parseFloat(m[1].replace(',', '.'));
  if (Number.isNaN(n)) return 0;
  const u = (m[2] || '').toLowerCase();
  if (u === 'k') n *= 1e3;
  else if (u === 'm') n *= 1e6;
  else if (u === 'g') n *= 1e9;
  return Math.round(n);
}

async function main() {
  // garde-fou : sans proxy joignable, on n'écrase PAS un catalogue existant avec du vide
  try {
    const ping = await getJson('/yt/api/search?q=test');
    if (!Array.isArray(ping.results)) throw new Error('réponse inattendue');
  } catch (err) {
    console.error(
      `Proxy InnerTube injoignable sur ${BASE} (${err.message}).\n` +
        'Lancez `npm run dev` dans un autre terminal puis relancez `npm run catalog`.'
    );
    process.exit(1);
  }

  console.log('1/ Recherches par catégorie…');
  const byId = new Map();
  for (const [category, query, target] of QUERIES) {
    let results = [];
    try {
      const json = await getJson(`/yt/api/search?q=${encodeURIComponent(query)}`);
      results = json.results ?? [];
    } catch (err) {
      console.error(`  ! "${query}" : ${err.message}`);
      continue;
    }
    let kept = 0;
    for (const r of results) {
      if (kept >= target) break;
      if (r.isShort) continue;
      if (r.duration != null && (r.duration < 60 || r.duration > 60 * 60 * 1.5)) continue;
      if (!r.duration) continue;
      if (byId.has(r.videoId)) continue;
      byId.set(r.videoId, { ...r, category, query });
      kept++;
    }
    console.log(`  "${query}" -> ${kept} vidéo(s) [${category}]`);
    await sleep(300);
  }

  console.log('2/ Shorts…');
  const shortIds = new Set();
  for (const q of SHORT_QUERIES) {
    try {
      const json = await getJson(`/yt/api/search?q=${encodeURIComponent(q)}`);
      for (const r of json.results ?? []) {
        if (r.isShort || (r.duration != null && r.duration <= 60)) {
          shortIds.add(r.videoId);
          if (!byId.has(r.videoId)) byId.set(r.videoId, { ...r, category: 'Shorts', query: q });
        }
      }
    } catch (err) {
      console.error(`  ! "${q}" : ${err.message}`);
    }
    await sleep(300);
  }
  console.log(`  ${shortIds.size} short(s) candidat(s)`);

  const candidates = [...byId.values()];
  console.log(`3/ Vérification + enrichissement de ${candidates.length} vidéo(s) via /yt/api/player…`);

  const verified = [];
  await mapLimit(candidates, 3, async (c) => {
    let player = null;
    try {
      player = await getJson(`/yt/api/player?v=${c.videoId}`);
    } catch {
      /* ignore : on garde les métadonnées de recherche */
    }
    await sleep(150);

    const status = player?.playabilityStatus?.status;
    if (!player?.microformat && !player?.videoDetails) {
      console.log(`  ~ ${c.videoId} sans métadonnées player (status=${status ?? 'n/a'}) -> métadonnées de recherche conservées`);
    }
    const micro = player?.microformat?.playerMicroformatRenderer ?? {};
    const details = player?.videoDetails ?? {};
    const isShort = shortIds.has(c.videoId);

    verified.push({
      id: c.videoId,
      title: cleanText(micro.title?.simpleText || details.title || c.title),
      channelId: cleanText(micro.ownerChannelId || details.channelId || c.channelId || 'UC_unknown'),
      channelName: cleanText(micro.ownerChannelName || details.author || c.channelName || 'Chaîne inconnue'),
      channelAvatar: c.channelAvatar || '',
      duration: details.lengthSeconds ? Number(details.lengthSeconds) : c.duration,
      views: details.viewCount ? Number(details.viewCount) : parseViews(c.views),
      publishedAt: micro.publishDate
        ? new Date(micro.publishDate).toISOString().slice(0, 10)
        : (c.publishedAt ?? ''),
      description: cleanText(micro.description?.simpleText || details.shortDescription || ''),
      // on garde la catégorie thématique (issue de la requête, en français) et on
      // conserve la catégorie officielle YouTube dans les tags
      category: c.category || micro.category || 'Divers',
      tags: [
        ...(micro.category ? [micro.category] : []),
        ...(Array.isArray(micro.keywords) ? micro.keywords.slice(0, 7) : []),
      ],
      likes: Math.max(12, Math.round((details.viewCount || 1000) * 0.02)),
      isShort,
      thumb: pickThumb(c),
    });
  });

  console.log(`  ${verified.length} vidéo(s) retenue(s)`);

  console.log('4/ Comptes d’abonnés par chaîne…');
  const channels = new Map();
  const wantedChannels = [...new Set(verified.map((v) => v.channelId))].filter((id) => id !== 'UC_unknown');
  for (const id of wantedChannels) {
    const v = verified.find((x) => x.channelId === id);
    if (channels.has(id)) continue;
    let subscribers = '';
    let handle = '';
    try {
      const json = await getJson(`/yt/api/search?q=${encodeURIComponent(v.channelName)}`);
      const hit = (json.results ?? []).find((r) => r.channelId === id);
      if (hit?.subscriberCountText) subscribers = hit.subscriberCountText;
      if (hit?.handle) handle = hit.handle;
    } catch {
      /* best effort */
    }
    channels.set(id, {
      id,
      name: v.channelName,
      handle: handle || '@' + v.channelName.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''),
      avatar: v.channelAvatar || '',
      subscribers,
    });
    await sleep(250);
  }
  // chaînes découvertes via les résultats de recherche (channelRenderer enrichi)
  for (const [, ch] of channels) if (!ch.avatar) ch.avatar = '';

  console.log(`  ${channels.size} chaîne(s)`);

  if (verified.length < 20) {
    console.error(
      `Seulement ${verified.length} vidéo(s) collectée(s) : catalogue existant conservé par sécurité.`
    );
    process.exit(1);
  }

  const shorts = verified.filter((v) => v.isShort).sort(() => Math.random() - 0.5).slice(0, 14);
  const regular = verified.filter((v) => !v.isShort).slice(0, 55);
  const usedShorts = new Set(shorts.map((s) => s.id));
  const videos = regular.filter((v) => !usedShorts.has(v.id));

  const q = (s) => JSON.stringify(s ?? '').replace(/`/g, '\\`');

  const lines = [];
  lines.push('// Fichier GÉNÉRÉ par `npm run catalog` — données YouTube réelles collectées via le proxy InnerTube.');
  lines.push('// Ne pas éditer à la main : relancez le script pour rafraîchir.');
  lines.push(`import type { Channel, Video } from '../types';`);
  lines.push('');
  lines.push(`export const generatedAt = ${q(new Date().toISOString())};`);
  lines.push('');
  lines.push('export const channels: Channel[] = [');
  for (const ch of channels.values()) {
    lines.push(
      `  { id: ${q(ch.id)}, name: ${q(ch.name)}, handle: ${q(ch.handle)}, avatar: ${q(ch.avatar)}, subscribers: ${q(ch.subscribers)} },`
    );
  }
  lines.push('];');
  lines.push('');

  const emitVideo = (v) =>
    `  { id: ${q(v.id)}, title: ${q(v.title)}, channelId: ${q(v.channelId)}, channelName: ${q(v.channelName)}, ` +
    `duration: ${v.duration ?? null}, views: ${q(formatFr(v.views))}, viewsCount: ${v.views}, ` +
    `publishedAt: ${q(v.publishedAt)}, description: ${q(v.description.slice(0, 600))}, ` +
    `category: ${q(v.category)}, tags: ${JSON.stringify(v.tags)}, likes: ${v.likes}${v.isShort ? ', isShort: true' : ''} },`;

  lines.push('export const videos: Video[] = [');
  for (const v of videos) lines.push(emitVideo(v));
  lines.push('];');
  lines.push('');
  lines.push('export const shorts: Video[] = [');
  for (const v of shorts) lines.push(emitVideo(v));
  lines.push('];');
  lines.push('');
  const cats = [...new Set(videos.map((v) => v.category))];
  lines.push(`export const categories: string[] = ${JSON.stringify(cats)};`);
  lines.push('');
  lines.push('/** URL vignette i.ytimg.com pour une vidéo (réel, depuis YouTube) */');
  lines.push('export function thumbFor(id: string): string {');
  lines.push("  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;");
  lines.push('}');
  lines.push('');
  lines.push('/** Miniature haute résolution (maxres si dispo, sinon hqdefault) */');
  lines.push('export function thumbLargeFor(id: string): string {');
  lines.push("  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;");
  lines.push('}');
  lines.push('');

  await writeFile(OUT, lines.join('\n'), 'utf8');
  console.log(`5/ Écrit ${OUT.pathname} (${videos.length} vidéos, ${shorts.length} shorts, ${channels.size} chaînes)`);
}

function formatFr(n) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' vues';
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
