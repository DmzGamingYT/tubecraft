import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { videos } from '../data';
import { apps, githubProfile } from '../data/apps';
import { formatDuration } from '../lib/format';
import { setPageMeta } from '../lib/meta';
import {
  ShowcaseSite,
  type ShowcaseLinkProps,
} from '../components/ShowcaseSite';

/** Liens internes de l'app : navigation client sans rechargement. */
function RouterLink({ href, className, children }: ShowcaseLinkProps) {
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

/**
 * La vitrine dans l'application (`/apps`).
 * Le même contenu est compilé en site autonome par `npm run build:showcase`.
 */
export function Showcase() {
  useEffect(() => {
    setPageMeta(
      'Craftline — mes apps open source',
      'Craftline, une collection d’applications open source qui refusent l’abonnement et la télémétrie. La première : TubeCraft, un client YouTube complet.'
    );

    // La favicon de TubeCraft n’a rien à faire sur la vitrine de la collection.
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const previous = icon?.getAttribute('href');
    icon?.setAttribute('href', `${import.meta.env.BASE_URL}craftline.svg`);
    return () => {
      if (previous) icon?.setAttribute('href', previous);
    };
  }, []);

  return (
    <ShowcaseSite
      apps={apps}
      preview={videos.slice(0, 4)}
      appHref="/"
      githubHref={githubProfile}
      Link={RouterLink}
      formatDuration={formatDuration}
    />
  );
}
