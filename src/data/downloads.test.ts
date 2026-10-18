import { describe, expect, it } from 'vitest';
import { downloadApps, findDownloadApp } from './downloads';

/**
 * La section « Télécharger » promet des choses vérifiables : une icône, des
 * plateformes réelles, et un lien de téléchargement uniquement quand un
 * binaire est publié. Ces tests verrouillent ces promesses.
 */
describe('apps téléchargeables', () => {
  it('décrit chaque app avec une icône et au moins une plateforme', () => {
    expect(downloadApps.length).toBeGreaterThan(1);

    for (const app of downloadApps) {
      expect(app.icon).toMatch(/\.png/);
      expect(app.platforms.length).toBeGreaterThan(0);
      expect(app.facts).toHaveLength(4);
      expect(app.emphasis.length).toBeGreaterThan(0);
    }
  });

  it('garde des identifiants d’app et de plateforme uniques', () => {
    const appIds = downloadApps.map((app) => app.id);
    expect(new Set(appIds).size).toBe(appIds.length);

    for (const app of downloadApps) {
      const platformIds = app.platforms.map((platform) => platform.id);
      expect(new Set(platformIds).size).toBe(platformIds.length);
    }
  });

  it('ne promet un binaire qu’aux apps natives, avec la page des versions', () => {
    for (const app of downloadApps) {
      if (app.mode === 'native') {
        expect(app.releasesHref).toMatch(/^https:\/\/github\.com\/.+\/releases\//);
        expect(app.platforms.every((platform) => platform.file)).toBe(true);
        expect(app.platforms.map((platform) => platform.id)).not.toContain('ios');
      } else {
        // Une web app ne doit pas afficher de bouton de téléchargement natif.
        expect(app.releasesHref).toBeUndefined();
      }
    }
  });

  it('retombe sur la première app pour un identifiant inconnu', () => {
    expect(findDownloadApp('spotifycraft').name).toBe('SpotifyCraft');
    expect(findDownloadApp('inconnue' as never)).toBe(downloadApps[0]);
  });
});
