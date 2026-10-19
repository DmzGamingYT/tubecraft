#!/usr/bin/env node
/**
 * Génère les images de partage (Open Graph / Twitter Card) de la collection.
 *
 * Elles sont dessinées en HTML puis photographiées par Chromium : pas de
 * dépendance à un outil de dessin, et le rendu suit exactement la
 * typographie du site (Inter Tight, Instrument Serif, IBM Plex Mono).
 *
 * Usage : node scripts/make-og.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');

const FONTS = `https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap`;

const MARK = `
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" rx="15" fill="#e5402a"/>
  <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14.25" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="1.5"/>
  <path d="M45 19.5A18 18 0 1 0 45 44.5" fill="none" stroke="#fff8f1" stroke-width="7.5" stroke-linecap="round"/>
  <path d="M34.5 23.5 49 32 34.5 40.5Z" fill="#240607"/>
</svg>`;

const SHELL = (body) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: #f2f0ea; color: #0c0c0d;
    font-family: "Inter Tight", Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .ring {
    position: absolute; border: 1px solid rgba(12,12,13,.13); border-radius: 50%;
  }
  .mono {
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 15px; letter-spacing: .2em; text-transform: uppercase;
  }
  .accent { color: #e5402a; }
  .serif { font-family: "Instrument Serif", Georgia, serif; font-style: italic; font-weight: 400; }
</style>
</head>
<body>${body}</body>
</html>`;

const COLLECTION = SHELL(`
  <div class="ring" style="width:760px;height:760px;right:-210px;top:-330px"></div>
  <div class="ring" style="width:520px;height:520px;right:-110px;top:-210px"></div>

  <div style="position:absolute;inset:64px 72px;display:flex;flex-direction:column;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:16px">
      ${MARK}
      <div style="font-size:30px;font-weight:600;letter-spacing:-.03em">Craftline<span class="accent">.</span></div>
    </div>

    <div style="max-width:900px">
      <div class="mono" style="color:#6d6961;margin-bottom:26px">Collection open source — 2026</div>
      <h1 style="font-size:92px;font-weight:600;line-height:.92;letter-spacing:-.055em">
        Des outils qu’on<br><span class="serif accent">possède</span> vraiment.
      </h1>
    </div>

    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:40px">
      <div style="display:flex;gap:12px">
        ${[
          ['#ff2d46', 'TC'],
          ['#1ed760', 'SP'],
          ['#c9ff3d', 'PC'],
        ]
          .map(
            ([bg, txt]) => `<div style="width:54px;height:54px;border-radius:3px;background:${bg};display:grid;place-items:center;font-size:16px;font-weight:700;color:#0c0c0d">${txt}</div>`
          )
          .join('')}
      </div>
      <div class="mono" style="color:#6d6961;text-align:right">
        TubeCraft · SpotifyCraft · PulseCraft<br>
        <span style="color:#0c0c0d">Open source</span> · Sans compte · Sans télémétrie
      </div>
    </div>
  </div>

  <div style="position:absolute;left:0;right:0;bottom:0;height:6px;background:#e5402a"></div>
`);

const TUBECRAFT = SHELL(`
  <div class="ring" style="width:700px;height:700px;right:-180px;top:-300px"></div>

  <div style="position:absolute;inset:64px 72px;display:flex;flex-direction:column;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:16px">
      ${MARK}
      <div style="font-size:30px;font-weight:600;letter-spacing:-.03em">TubeCraft<span class="accent">.</span></div>
    </div>

    <div style="max-width:900px">
      <div class="mono" style="color:#6d6961;margin-bottom:26px">Client YouTube — React + Tauri</div>
      <h1 style="font-size:92px;font-weight:600;line-height:.92;letter-spacing:-.055em">
        YouTube,<br><span class="serif accent">en open source.</span>
      </h1>
    </div>

    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:40px">
      <div class="mono" style="color:#6d6961">
        Recherche · Lecteur · Shorts · Abonnements<br>
        <span style="color:#0c0c0d">Aucune clé API</span> · Données locales
      </div>
      <div class="mono" style="color:#6d6961;text-align:right">MIT<br>github.com/DmzGamingYT/tubecraft</div>
    </div>
  </div>

  <div style="position:absolute;left:0;right:0;bottom:0;height:6px;background:#e5402a"></div>
`);

const TARGETS = [
  { html: COLLECTION, out: resolve(appRoot, 'showcase/public/og-craftline.png') },
  { html: TUBECRAFT, out: resolve(appRoot, 'public/og-tubecraft.png') },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

for (const target of TARGETS) {
  await page.setContent(target.html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  mkdirSync(dirname(target.out), { recursive: true });
  await page.screenshot({ path: target.out });
  console.log(`✓ ${target.out}`);
}

await browser.close();
