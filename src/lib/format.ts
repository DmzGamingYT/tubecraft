const nf = new Intl.NumberFormat('fr-FR');

/** 12345 -> "12,3 k" / 1234567 -> "1,2 M" (façon YouTube FR) */
export function compactNumber(n: number): string {
  if (n < 1000) return nf.format(n);
  if (n < 1_000_000) return `${fmt(n / 1000)} k`;
  if (n < 1_000_000_000) return `${fmt(n / 1_000_000)} M`;
  return `${fmt(n / 1_000_000_000)} G`;
}

function fmt(v: number): string {
  const s = v.toFixed(v < 10 ? 1 : 0).replace('.', ',');
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

/**
 * Traduit les textes relatifs EN vers le FR (YouTube renvoie déjà du FR via hl=fr)
 * et met en forme les dates ISO du catalogue (« 2019-04-04 » → « 4 avr. 2019 »).
 */
export function translateRelative(text: string): string {
  if (!text) return text;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text.trim());
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }
  const t = text.toLowerCase().replace(/[\s\u00a0\u202f]/g, ' ').trim();
  const match = t.match(/^(\d+) (second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years) ago$/);
  if (!match) return text;

  const count = Number(match[1]);
  const unit = match[2].replace(/s$/, '');
  const labels: Record<string, [string, string]> = {
    second: ['seconde', 'secondes'],
    minute: ['minute', 'minutes'],
    hour: ['heure', 'heures'],
    day: ['jour', 'jours'],
    week: ['semaine', 'semaines'],
    month: ['mois', 'mois'],
    year: ['an', 'ans'],
  };
  const [singular, plural] = labels[unit] ?? [unit, unit];
  return `il y a ${count} ${count > 1 ? plural : singular}`;
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
