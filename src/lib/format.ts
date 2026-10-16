const nf = new Intl.NumberFormat('fr-FR');

/** 12345 -> "12,3 k" / 1234567 -> "1,2 M" (façon YouTube FR) */
export function compactNumber(n: number): string {
  if (n < 1000) return nf.format(n);
  if (n < 1_000_000) return `${fmt(n / 1000)} k`;
  if (n < 1_000_000_000) return `${fmt(n / 1_000_000)} M`;
  return `${fmt(n / 1_000_000_000)} G`;
}

function fmt(v: number): string {
  const s = v.toFixed(v < 10 ? 1 : 0);
  return s.endsWith(',0') ? s.slice(0, -2) : s;
}

/** "10 933 783 vues" -> 10933783 ; "2,3 M vues" -> 2300000 */
export function parseViews(text: string): number {
  if (!text) return 0;
  const clean = text.replace(/[\s\u00a0\u202f]/g, '');
  const m = clean.match(/(\d+(?:[.,]\d+)?)([kKmMgG])?/);
  if (!m) return 0;
  let n = parseFloat(m[1].replace(',', '.'));
  if (Number.isNaN(n)) return 0;
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'k') n *= 1_000;
  else if (unit === 'm') n *= 1_000_000;
  else if (unit === 'g') n *= 1_000_000_000;
  return Math.round(n);
}

/** 3661 -> "1:01:01" ; 205 -> "3:25" */
export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Traduit les textes relatifs EN vers le FR (YouTube renvoie déjà du FR via hl=fr) */
export function translateRelative(text: string): string {
  if (!text) return text;
  const t = text.toLowerCase().replace(/[\s\u00a0\u202f]/g, ' ').trim();
  const rules: Array<[RegExp, string]> = [
    [/^(\d+) (second|seconds|seconde|secondes) ago$/, 'il y a $1 secondes'],
    [/^(\d+) (minute|minutes) ago$/, 'il y a $1 minutes'],
    [/^(\d+) (hour|hours) ago$/, 'il y a $1 heures'],
    [/^(\d+) (day|days) ago$/, 'il y a $1 jours'],
    [/^(\d+) (week|weeks) ago$/, 'il y a $1 semaines'],
    [/^(\d+) (month|months) ago$/, 'il y a $1 mois'],
  ];
  for (const [re, rep] of rules) {
    const m = t.match(re);
    if (m) return rep.replace('$1', m[1]);
  }
  const y = t.match(/^(\d+) (year|years) ago$/);
  if (y) return `il y a ${y[1]} an${Number(y[1]) > 1 ? 's' : ''}`;
  return text;
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} j`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `il y a ${mo} mois`;
  const y = Math.floor(mo / 12);
  return `il y a ${y} an${y > 1 ? 's' : ''}`;
}

export function initials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
