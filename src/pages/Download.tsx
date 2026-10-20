import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DownloadShowcase } from '../components/download/DownloadShowcase';
import { githubProfile } from '../data/apps';
import { setPageMeta } from '../lib/meta';

/**
 * Page « Télécharger » de l’app : la même expérience que la section de la
 * vitrine, mais dans le chrome Séquence, avec l’installation PWA active.
 */
export function Download() {
  useEffect(() => {
    setPageMeta(
      'Télécharger Séquence — macOS, Windows, Linux, Android, iPhone',
      'Installez Séquence comme une application sur macOS, Windows, Linux, Android et iPhone. Sans magasin, sans compte, mise à jour automatique.'
    );
  }, []);

  return (
    <div className="page download-page">
      <div className="download-page__crumb">
        <Link to="/">
          <span aria-hidden>←</span> Accueil
        </Link>
        <span aria-hidden>/</span>
        <span>Installation</span>
      </div>

      <DownloadShowcase
        variant="page"
        appHref="/"
        githubHref={githubProfile}
        Link={({ href, className, children }) => (
          <Link to={href} className={className}>
            {children}
          </Link>
        )}
      />
    </div>
  );
}
