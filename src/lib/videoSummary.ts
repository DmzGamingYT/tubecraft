import type { Chapter } from './chapters';
import { parseChapters, parseTimestamp } from './chapters';
import type { Video } from '../types';

/**
 * Résumé de la vidéo en cours + chapitres, à partir de la description et des
 * métadonnées.
 *
 * L'IA gratuite (Pollinations) fait le travail quand elle répond ; sinon on
 * retombe sur un résumé extractif de la description et sur les chapitres déjà
 * horodatés par la chaîne. Aucun chapitre n'est inventé sans IA.
 */

export interface VideoSummary {
  summary: string;
  chapters: Chapter[];
  source: 'ai' | 'auto';
}

export interface SummaryInput {
  id: string;
  title: string;
  channelName: string;
  duration: number | null;
  publishedAt: string;
  category: string;
  tags: string[];
  description: string;
}

const DIRECT_ENDPOINT = 'https://text.pollinations.ai/openai';
const PROXY_ENDPOINT = '/yt/api/summary';
const CACHE_PREFIX = 'tubecraft-ai-summary:v1:';
const MAX_DESCRIPTION = 3_500;
const MAX_CHAPTERS = 10;
const MAX_SUMMARY = 900;

export function summaryInput(video: Video): SummaryInput {
  return {
    id: video.id,
    title: video.title,
    channelName: video.channelName,
    duration: video.duration,
    publishedAt: video.publishedAt,
    category: video.category,
    tags: video.tags,
    description: video.description,
  };
}

/** Empreinte courte du contenu : une description enrichie invalide le cache. */
function contentFingerprint(input: SummaryInput): string {
  const text = `${input.title}|${input.description}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function cacheKeyFor(input: SummaryInput): string {
  return `${CACHE_PREFIX}${input.id}:${contentFingerprint(input)}`;
}

function humanDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return 'durée inconnue';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h} h ${String(m).padStart(2, '0')} min`
    : `${m} min ${String(s).padStart(2, '0')} s`;
}

/** Construit les instructions et le contexte envoyés au modèle. */
export function buildSummaryPrompt(input: SummaryInput): { system: string; user: string } {
  const system = `Tu résumes des vidéos YouTube pour un spectateur francophone.
Réponds UNIQUEMENT par un objet JSON valide, sans texte ni balise Markdown :
{"summary":"résumé factuel de 2 à 4 phrases","chapters":[{"time":"mm:ss","title":"titre court"}]}
Consignes :
- résume uniquement ce que disent le titre, la description et les métadonnées ; n'invente aucun fait ;
- si la description est pauvre, dis-le et résume à partir du titre, de la chaîne, de la catégorie et des tags ;
- propose 4 à 8 chapitres, horodatages strictement croissants et inférieurs à la durée ;
- si la description contient déjà des horodatages, réutilise-les et améliore leurs titres ;
- titres de chapitre de 2 à 8 mots, en français, sans numéro ni ponctuation finale ;
- pas de promotion, pas d'emoji, pas de retour à la ligne dans les chaînes.`;

  const context = [
    `Titre : ${input.title}`,
    `Chaîne : ${input.channelName || 'inconnue'}`,
    `Durée : ${humanDuration(input.duration)}`,
    input.publishedAt ? `Publication : ${input.publishedAt}` : '',
    input.category ? `Catégorie : ${input.category}` : '',
    input.tags.length > 0 ? `Tags : ${input.tags.slice(0, 12).join(', ')}` : '',
    '',
    'Description :',
    input.description.trim().slice(0, MAX_DESCRIPTION) || '(vide)',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user: context };
}

function extractJson(text: string): unknown {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Nettoie et valide les chapitres renvoyés par l'IA. */
export function normalizeChapters(raw: unknown, duration: number | null): Chapter[] {
  if (!Array.isArray(raw)) return [];

  const chapters: Chapter[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const title =
      typeof record.title === 'string'
        ? record.title
            .replace(/\s+/g, ' ')
            .replace(/^\d{1,2}[.)]\s*/, '')
            .trim()
            .slice(0, 80)
        : '';
    if (!title) continue;

    const rawTime =
      typeof record.time === 'string'
        ? record.time
        : typeof record.sec === 'number'
          ? record.sec
          : typeof record.start === 'number'
            ? record.start
            : null;
    if (rawTime == null) continue;

    const sec = typeof rawTime === 'number' ? Math.floor(rawTime) : parseTimestamp(rawTime);
    if (!Number.isFinite(sec) || sec < 0) continue;
    // un repère pile à la fin ne mène nulle part
    if (duration != null && duration > 0 && sec >= duration) continue;
    chapters.push({ sec, title });
  }

  const seen = new Set<number>();
  const ordered = chapters
    .sort((a, b) => a.sec - b.sec)
    .filter((chapter) => {
      if (seen.has(chapter.sec)) return false;
      seen.add(chapter.sec);
      return true;
    })
    .slice(0, MAX_CHAPTERS);

  return ordered.length > 1 ? ordered : [];
}

function normalizeSummaryText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const text = raw
    .replace(/^résumé\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SUMMARY);
  return text.length >= 40 ? text : '';
}

/** Valide la réponse du modèle ; `null` si elle est inexploitable. */
export function parseSummaryPayload(
  payload: unknown,
  duration: number | null
): { summary: string; chapters: Chapter[] } | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const summary = normalizeSummaryText(record.summary);
  if (!summary) return null;
  return { summary, chapters: normalizeChapters(record.chapters, duration) };
}

/** Retire liens, horodatages et hashtags pour ne garder que le texte utile. */
function cleanDescription(text: string): string {
  return text
    // les lignes « 00:00 Titre » sont un sommaire, pas de la prose
    .split(/\r?\n/)
    .filter((line) => !/^\s*\d{1,2}(?::\d{2}){1,2}\s+/.test(line))
    .join(' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/[#@][\w-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentences(text: string, limit: number): string {
  const sentences = text.split(/(?<=[.!?…])\s+/).filter((s) => s.length >= 25);
  const picked: string[] = [];
  let length = 0;
  for (const sentence of sentences) {
    if (length + sentence.length > limit && picked.length > 0) break;
    picked.push(sentence.trim());
    length += sentence.length + 1;
    if (picked.length === 3) break;
  }
  const result = picked.join(' ');
  return result.length > limit ? `${result.slice(0, limit - 1).trimEnd()}…` : result;
}

/**
 * Repli sans IA : résumé extractif de la description + chapitres horodatés
 * déjà fournis par la chaîne. Si la description est vide, on s'en tient aux
 * métadonnées, sans rien inventer.
 */
export function autoSummary(input: SummaryInput): VideoSummary {
  const chapters = parseChapters(input.description);
  const cleaned = cleanDescription(input.description);

  const facts = [
    `« ${input.title} »`,
    input.channelName ? `est une vidéo de ${input.channelName}` : '',
    input.publishedAt ? `(${input.publishedAt})` : '',
    input.category ? `dans la catégorie ${input.category}` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');

  const extract = firstSentences(cleaned, 420);
  const summary = extract
    ? `${facts}. ${extract}`
    : `${facts}. La chaîne n’a pas fourni de description : ce résumé se limite donc aux métadonnées disponibles.`;

  return { summary, chapters, source: 'auto' };
}

/* ------------------------------------------------------------------ réseau */

async function callDirect(
  system: string,
  user: string,
  signal?: AbortSignal
): Promise<unknown> {
  const res = await fetch(DIRECT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 800,
      referrer: 'tubecraft',
    }),
    signal,
  });
  if (!res.ok) throw new Error(`IA ${res.status}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    text?: string;
  };
  const text = data.choices?.[0]?.message?.content ?? data.text ?? '';
  return extractJson(typeof text === 'string' ? text : '');
}

async function callProxy(input: SummaryInput, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(PROXY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) throw new Error(`Relais ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------- cache */

function readCache(input: SummaryInput): VideoSummary | null {
  try {
    const raw = sessionStorage.getItem(cacheKeyFor(input));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VideoSummary;
    if (!parsed || typeof parsed.summary !== 'string') return null;
    if (parsed.source !== 'ai' && parsed.source !== 'auto') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(input: SummaryInput, summary: VideoSummary): void {
  try {
    sessionStorage.setItem(cacheKeyFor(input), JSON.stringify(summary));
  } catch {
    /* quota / navigation privée : on ignore */
  }
}

/**
 * Résumé de la vidéo : cache de session, puis IA directe, puis relais serveur,
 * puis repli automatique. Ne lève jamais : le repli est toujours utilisable.
 */
export async function generateSummary(
  input: SummaryInput,
  options: { signal?: AbortSignal; force?: boolean } = {}
): Promise<VideoSummary> {
  const { signal, force = false } = options;

  if (!force) {
    const cached = readCache(input);
    if (cached) return cached;
  }

  if (!input.description.trim() && !input.title.trim()) return autoSummary(input);

  const { system, user } = buildSummaryPrompt(input);
  const task = (async (): Promise<VideoSummary> => {
    for (const call of [callDirect, callProxy]) {
      try {
        const payload =
          call === callDirect
            ? await callDirect(system, user, signal)
            : await callProxy(input, signal);
        const parsed = parseSummaryPayload(payload, input.duration);
        if (parsed) {
          const fallbackChapters = parseChapters(input.description);
          const result: VideoSummary = {
            summary: parsed.summary,
            chapters: parsed.chapters.length > 1 ? parsed.chapters : fallbackChapters,
            source: 'ai',
          };
          writeCache(input, result);
          return result;
        }
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') throw error;
        /* on tente l'appel suivant */
      }
    }
    const fallback = autoSummary(input);
    writeCache(input, fallback);
    return fallback;
  })();

  return task;
}
