/**
 * Recherche assistée par IA (gratuite, sans clé API).
 *
 * On interroge l'API texte de Pollinations (https://text.pollinations.ai),
 * ouverte, gratuite et sans inscription. Elle reformule la requête de
 * l'utilisateur en une recherche YouTube plus précise et propose des
 * recherches associées.
 *
 * Si le service est lent, bloqué (CORS) ou indisponible, on retombe
 * silencieusement sur la recherche classique de TubeCraft : le proxy de
 * développement `/yt/api/ai` sert de relais server-side.
 */

export interface AiSearchPlan {
  /** requête reformulée, plus précise */
  query: string;
  /** recherches associées proposées */
  keywords: string[];
  /** intention détectée (courte phrase, facultatif) */
  intent?: string;
}

const DIRECT_ENDPOINT = 'https://text.pollinations.ai/openai';
const PROXY_ENDPOINT = '/yt/api/ai';
const MODEL = 'openai';

const SYSTEM_PROMPT = `Tu es un assistant de recherche pour un site de vidéos francophone.
À partir de la requête de l'utilisateur, réponds UNIQUEMENT par un objet JSON valide (aucun texte autour, aucune balise Markdown) au format :
{"query":"requête YouTube améliorée, en français","keywords":["recherche associée 1","recherche associée 2","recherche associée 3"],"intent":"intention de l'utilisateur en une phrase courte"}
Consignes : garde le sens d'origine, précise le sujet si utile (année, niveau, tutoriel, avis…), chaque mot-clé est une courte recherche complémentaire, n'invente ni marque ni fait.`;

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

function normalize(data: unknown, original: string): AiSearchPlan | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const query = typeof d.query === 'string' ? d.query.trim() : '';
  const keywords = Array.isArray(d.keywords)
    ? d.keywords
        .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        .map((k) => k.trim())
        .slice(0, 6)
    : [];
  const intent = typeof d.intent === 'string' ? d.intent.trim() : undefined;
  if (!query && keywords.length === 0) return null;
  return { query: query || original, keywords, intent };
}

/** Appelle Pollinations en mode « chat completion » OpenAI-compatible. */
async function callDirect(query: string, signal?: AbortSignal): Promise<AiSearchPlan | null> {
  const res = await fetch(DIRECT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 320,
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
  return normalize(extractJson(typeof text === 'string' ? text : ''), query);
}

/* Le palier gratuit de Pollinations limite à ~1 requête / 30 s par IP :
 * on met en cache le plan par requête pour ne pas gaspiller le quota. */
const CACHE_PREFIX = 'tubecraft-ai-plan:';

function readCache(q: string): AiSearchPlan | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + q.toLowerCase());
    return raw ? (JSON.parse(raw) as AiSearchPlan) : null;
  } catch {
    return null;
  }
}

function writeCache(q: string, plan: AiSearchPlan) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + q.toLowerCase(), JSON.stringify(plan));
  } catch {
    /* quota / mode privé : on ignore */
  }
}

/**
 * Demande un plan de recherche à l'IA (avec cache de session).
 * Renvoie `null` si l'IA est indisponible — l'appelant garde alors la recherche classique.
 */
export async function planSearch(
  query: string,
  signal?: AbortSignal
): Promise<AiSearchPlan | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const cached = readCache(q);
  if (cached) return cached;

  try {
    const direct = await callDirect(q, signal);
    if (direct) {
      writeCache(q, direct);
      return direct;
    }
  } catch {
    /* CORS, quota atteint ou réseau : on tente le relais de développement */
  }

  try {
    const res = await fetch(`${PROXY_ENDPOINT}?q=${encodeURIComponent(q)}`, { signal });
    if (!res.ok) return null;
    const plan = normalize(await res.json(), q);
    if (plan) writeCache(q, plan);
    return plan;
  } catch {
    return null;
  }
}
