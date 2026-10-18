import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Site vitrine autonome (`/apps` sorti de l'application).
 *
 * `base: './'` rend `dist-showcase/` portable : le dossier peut être déposé à
 * la racine d'un domaine ou dans un sous-dossier (GitHub Pages de projet,
 * Netlify Drop, Cloudflare Pages…) sans rebuild ni variable de chemin.
 *
 * Le site partage le composant et les styles de l'app, mais pas son routeur ni
 * son catalogue : le bundle reste celui d'une page de présentation.
 */
export default defineConfig({
  root: 'showcase',
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    // 5184 est déjà pris par SpotifyCraft en développement (`src/data/apps.ts`).
    port: 5185,
  },
  preview: {
    host: '127.0.0.1',
    port: 5185,
  },
  build: {
    outDir: '../dist-showcase',
    emptyOutDir: true,
  },
});
