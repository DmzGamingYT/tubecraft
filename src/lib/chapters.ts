export interface Chapter {
  sec: number;
  title: string;
}

/**
 * Détecte les chapitres dans une description YouTube (« 00:00 Intro »).
 * Ne garde que les suites strictement croissantes, comme YouTube.
 */
export function parseChapters(description: string): Chapter[] {
  if (!description) return [];

  const pattern =
    /(?:^|\s)(\d{1,2}(?::\d{2}){1,2})\s+([^]+?)(?=\s+\d{1,2}(?::\d{2}){1,2}(?:\s|$)|$)/g;

  const candidates: Chapter[] = [];
  for (const match of description.matchAll(pattern)) {
    const parts = match[1].split(':').map((part) => parseInt(part, 10));
    if (parts.some((n) => Number.isNaN(n))) continue;
    const sec = parts.reduce((acc, part) => acc * 60 + part, 0);
    const title = match[2].trim().replace(/^[:*\s]+|[:*\s]+$/g, '');
    if (title.length === 0) continue;
    candidates.push({ sec, title });
  }

  const ordered: Chapter[] = [];
  let last = -1;
  for (const chapter of candidates) {
    if (chapter.sec > last) {
      ordered.push(chapter);
      last = chapter.sec;
    }
  }
  // un seul repère n'est pas un sommaire
  return ordered.length > 1 ? ordered : [];
}

/** `?t=1h2m3s`, `?t=90`, `?t=1:30` -> secondes. */
export function parseTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const match = value.trim().match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
  if (match && (match[1] || match[2] || match[3])) {
    const [, h, m, s] = match;
    return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
  }
  const clock = value.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (clock) {
    const [, a, b, c] = clock;
    return c == null ? Number(a) * 60 + Number(b) : Number(a) * 3600 + Number(b) * 60 + Number(c);
  }
  const digits = value.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}
