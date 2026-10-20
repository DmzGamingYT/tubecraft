import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { apps, githubProfile } from '../../src/data/apps';
import {
  ShowcaseSite,
  type ShowcaseLinkProps,
} from '../../src/components/ShowcaseSite';
import { formatDuration } from '../../src/lib/format';
import '../../src/styles/showcase.css';
import './site.css';
import { preview } from './preview';

/**
 * Site vitrine autonome (build : `npm run build:showcase`).
 *
 * - `VITE_APP_URL` : URL publique de Séquence. Sans elle, la vitrine renvoie
 *   vers GitHub au lieu de proposer un lien mort.
 * - Les liens internes de la vitrine sont de simples ancres (pas de routeur).
 */
const appUrl =
  (import.meta.env.VITE_APP_URL ?? '').trim() ||
  // en développement, l'app tourne à côté : le bouton doit vraiment lancer quelque chose
  (import.meta.env.DEV ? 'http://127.0.0.1:5183/' : null);

function AnchorLink({ href, className, children }: ShowcaseLinkProps) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ShowcaseSite
      apps={apps}
      preview={preview}
      appHref={appUrl}
      githubHref={githubProfile}
      Link={AnchorLink}
      formatDuration={formatDuration}
    />
  </StrictMode>
);
