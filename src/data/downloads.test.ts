import { describe, expect, it } from 'vitest';
import { downloadApps, findDownloadApp } from './downloads';

/**
 * La section « Télécharger » promet des choses vérifiables : une icône, des
 * plateformes réelles, cinq voies d’installation pour une web app, et un lien
 * de téléchargement seulement quand un binaire est publié. Ces tests
 * verrouillent ces promesses.
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

  it('couvre les cinq plateformes pour chaque web app', () => {
    const webApps = downloadApps.filter((app) => app.mode === 'web');
    expect(webApps.length).toBeGreaterThan(1);

    for (const app of webApps) {
      expect(app.platforms.map((platform) => platform.id)).toEqual([
        'macos',
        'windows',
        'linux',
        'android',
        'ios',
      ]);
      // une web app ne se télécharge pas : elle s’installe depuis le navigateur
      expect(app.releasesHref).toBeUndefined();
      expect(app.platforms.every((platform) => platform.steps.length === 3)).toBe(true);
    }
  });

  it('donne son adresse à une web app servie hors de ce dépôt', () => {
    for (const app of downloadApps) {
      if (app.mode !== 'web' || app.self) continue;
      expect(app.launchHref).toMatch(/^https?:\/\//);
    }
  });

  it('ne promet un binaire qu’aux apps natives publiées', () => {
    for (const app of downloadApps) {
      if (app.mode !== 'native') continue;

      expect(app.releasesHref).toMatch(/^https:\/\/github\.com\/.+\/releases/);
      expect(app.platforms.every((platform) => platform.file)).toBe(true);
      expect(app.platforms.map((platform) => platform.id)).not.toContain('ios');

      if (app.releaseState === 'pending') {
        // rien de publié : ni version annoncée, ni lien direct vers une release
        expect(app.version).toBeUndefined();
        expect(app.releasesHref).not.toMatch(/\/latest$/);
      } else {
        expect(app.version).toBeTruthy();
        expect(app.platforms.every((platform) => platform.trust)).toBe(true);
      }
    }
  });

  it('retombe sur la première app pour un identifiant inconnu', () => {
    expect(findDownloadApp('spotifycraft').name).toBe('SpotifyCraft');
    expect(findDownloadApp('pulsecraft').name).toBe('PulseCraft');
    expect(findDownloadApp('inconnue' as never)).toBe(downloadApps[0]);
  });
});
