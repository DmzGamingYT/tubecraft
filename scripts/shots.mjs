#!/usr/bin/env node
/**
 * Captures de la vitrine Craftline.
 *
 * Utilise le Chromium de Playwright (déjà téléchargé) pour photographier la
 * page par sections, dans les deux thèmes, sans toucher au projet.
 *
 * Usage : node scripts/shots.mjs <url> <dossier> [largeurs…]
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** Playwright peut venir du projet ou d'un cache global : on accepte les deux. */
async function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      return await import(name);
    } catch {
      /* on essaie le suivant */
    }
  }
  throw new Error('Playwright introuvable — `npm i -D playwright` puis `npx playwright install chromium`');
}

const { chromium } = await loadPlaywright();

const url = process.argv[2] ?? 'http://127.0.0.1:5199/';
const outDir = resolve(process.argv[3] ?? './shots');
const widths = (process.argv.slice(4).length ? process.argv.slice(4) : ['1440', '390']).map(Number);

/** Les hauteurs d'écran usuelles, pour juger la page comme on la voit. */
const HEIGHTS = { 1440: 900, 1280: 800, 834: 1112, 390: 844 };

/** Les points de la page qui méritent une photo. */
const STOPS = [
  { name: 'hero', selector: '.sc-hero' },
  { name: 'collection', selector: '#collection' },
  { name: 'manifeste', selector: '#manifeste' },
  { name: 'capot', selector: '#capot' },
  { name: 'telecharger', selector: '#telecharger' },
  { name: 'etude', selector: '#etude' },
  { name: 'final', selector: '.sc-final' },
];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

for (const width of widths) {
  const height = HEIGHTS[width] ?? 900;
  for (const theme of ['paper', 'night']) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      locale: 'fr-FR',
    });
    const page = await context.newPage();

    // Le thème est mémorisé dans localStorage : on le pose avant le premier rendu.
    await page.addInitScript((value) => {
      try {
        window.localStorage.setItem('atelier.theme', value);
      } catch {
        /* stockage indisponible */
      }
    }, theme);

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    for (const stop of STOPS) {
      const target = page.locator(stop.selector).first();
      if ((await target.count()) === 0) continue;
      await target.scrollIntoViewIfNeeded();
      // On remonte un peu : le sujet se détache du bord haut.
      await page.evaluate((offset) => window.scrollBy(0, -offset), height * 0.12);
      await page.waitForTimeout(700);

      const file = `${outDir}/${width}-${theme}-${stop.name}.png`;
      await page.screenshot({ path: file });
      console.log(`✓ ${file}`);
    }

    await context.close();
  }
}

await browser.close();
console.log(`\ncaptures dans ${outDir}`);
