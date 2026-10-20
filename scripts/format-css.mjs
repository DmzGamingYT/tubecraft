#!/usr/bin/env node
/**
 * Reformate un CSS « une règle par ligne » en CSS lisible et indenté.
 *
 * Formatage pur : aucune règle n'est ajoutée, supprimée ni modifiée.
 * Le script vérifie que le nombre de règles (sélecteurs + accolades) est
 * identique avant et après, et échoue si le compte change.
 *
 * Usage : node scripts/format-css.mjs src/styles/showcase.css
 */
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage : node scripts/format-css.mjs <fichier.css>');
  process.exit(1);
}

const source = readFileSync(file, 'utf8');

/** Compte les accolades ouvrantes/fermantes, pour garder une trace du volume. */
const braces = (text) => {
  let open = 0;
  let close = 0;
  for (const char of text) {
    if (char === '{') open += 1;
    else if (char === '}') close += 1;
  }
  return { open, close };
};

/** Retire les commentaires (on ne les perd pas : ils sont réémis en tête). */
const comments = source.match(/\/\*[\s\S]*?\*\//g) ?? [];

let out = '';
let depth = 0;
let buffer = '';
let inString = null;
let inComment = false;

for (let i = 0; i < source.length; i += 1) {
  const char = source[i];
  const next = source[i + 1];

  if (inComment) {
    if (char === '*' && next === '/') {
      inComment = false;
      i += 1;
    }
    continue;
  }
  if (char === '/' && next === '*') {
    inComment = true;
    i += 1;
    continue;
  }
  if (inString) {
    buffer += char;
    if (char === inString && source[i - 1] !== '\\') inString = null;
    continue;
  }
  if (char === '"' || char === "'") {
    inString = char;
    buffer += char;
    continue;
  }

  if (char === '{') {
    const selector = buffer.trim();
    buffer = '';
    const indent = '  '.repeat(depth);
    out += `${indent}${selector} {\n`;
    depth += 1;
    continue;
  }

  if (char === '}') {
    if (buffer.trim()) {
      const indent = '  '.repeat(depth);
      out += `${indent}${buffer.trim()}\n`;
    }
    buffer = '';
    depth = Math.max(0, depth - 1);
    out += `${'  '.repeat(depth)}}\n`;
    continue;
  }

  if (char === ';') {
    const declaration = buffer.trim();
    buffer = '';
    if (declaration) {
      const indent = '  '.repeat(depth);
      out += `${indent}${declaration};\n`;
    }
    continue;
  }

  buffer += char;
}

if (buffer.trim()) out += `${buffer.trim()}\n`;

/** Réécrit les sélecteurs d'at-rules sur une ligne propre. */
out = out
  .replace(/@media([^{]+)\{/g, (_m, query) => `@media ${query.trim()} {\n`)
  .replace(/@supports([^{]+)\{/g, (_m, query) => `@supports ${query.trim()} {\n`)
  .replace(/@keyframes([^{]+)\{/g, (_m, name) => `@keyframes ${name.trim()} {\n`);

/** Supprime les lignes vides en double. */
out = out.replace(/\n{3,}/g, '\n\n');

const header = [
  '/* ==========================================================================',
  '   Vitrine Craftline — feuille de style.',
  '  ',
  '   Ce fichier est importé par `src/styles.css` et par `showcase/src/main.tsx`.',
  '   Il porte l\'entire direction artistique de la vitrine : fond papier, encre,',
  '   rouge d\'atelier, filets d\'un pixel, micro-labels monospace, typographie XXL.',
  '  ',
  '   Organisation :',
  '   1. Socle        — tokens, reset, thème nuit',
  '   2. Navigation   — barre, menu mobile, boutons',
  '   3. Hero        — anneaux, vignettes, titre',
  '   4. Sections    — label, titres, bandeaux',
  '   5. Collection  — index, fiches d\'apps',
  '   6. Preuve      — fiches d\'identité vérifiables',
  '   7. Fabrique    — chaîne de fabrication, rôles par app',
  '   8. Atelier     — contribution, dépôts publics',
  '   9. Final       — appel à l\'action, pied de page',
  '  10. Démonstrations, galerie, visite guidée',
  '   ========================================================================== */',
  '',
  '',
].join('\n');

const result = header + out.trimStart();

const before = braces(source);
const after = braces(result);
if (before.open !== after.open || before.close !== after.close) {
  console.error(
    `✗ le reformatage a changé le nombre de règles (${before.open}/${before.close} → ${after.open}/${after.close})`
  );
  process.exit(1);
}

writeFileSync(file, result);
console.log(
  `✓ ${file} : ${after.open} règles, ${source.length} → ${result.length} octets` +
    (comments.length ? ` (${comments.length} commentaires enlevés)` : '')
);
