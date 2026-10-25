import { describe, expect, it } from 'vitest';
import {
  APP_ITEMS,
  APP_NAMES,
  APP_SITES,
  appOfSite,
  explorerSwitchHref,
  explorerUrl,
  isAppName,
  PLATFORM_SITE,
  siteOfApp,
} from './index';

describe('the apps, for the liveworkspace Explorer', () => {
  it('names every app site once, with its word for an item and its paths', () => {
    expect(APP_NAMES.map((app) => APP_ITEMS[app].site).sort()).toEqual(
      APP_SITES.map((s) => s.id).sort(),
    );
    for (const app of APP_NAMES) {
      const items = APP_ITEMS[app];
      expect(siteOfApp(app).id).toBe(items.site);
      expect(appOfSite(items.site)).toBe(app);
      expect(items.itemPath).toMatch(/^\/[a-z]+\/$/);
      expect(items.newPath).toBe('/new');
      expect(items.noun).toMatch(/^[A-Z][a-z]+$/);
    }
    expect(appOfSite('liveworkspace.app')).toBeNull();
    expect(isAppName('liveplanner')).toBe(true);
    expect(isAppName('toString')).toBe(false);
  });

  it('builds the Explorer address, keeping the path, query and hash and naming where it came from', () => {
    const origin = 'https://liveworkspace.app';
    expect(explorerUrl('liveplanner', '', '', '', origin)).toBe(
      'https://liveworkspace.app/explorer?from=liveplanner',
    );
    expect(explorerUrl('liveplanner', '/folder', '?id=f1', '#x', origin)).toBe(
      'https://liveworkspace.app/explorer/folder?id=f1&from=liveplanner#x',
    );
    // A stale `from` in the query gives way to the app redirecting.
    expect(explorerUrl('livediagram', 'search', 'q=a+b&from=liveplanner', '', origin)).toBe(
      'https://liveworkspace.app/explorer/search?q=a+b&from=livediagram',
    );
    expect(explorerUrl(null, 'trash', '', '', origin)).toBe(
      'https://liveworkspace.app/explorer/trash',
    );
  });
});

describe("the site switcher's links on an Explorer page", () => {
  const site = (id: string) => [PLATFORM_SITE, ...APP_SITES].find((s) => s.id === id)!;
  const links = (pathname: string, search = '') => {
    const hrefFor = explorerSwitchHref(pathname, search);
    if (!hrefFor) return null;
    return Object.fromEntries([PLATFORM_SITE, ...APP_SITES].map((s) => [s.name, hrefFor(s)]));
  };

  it('is off the Explorer: every other page links each site home', () => {
    expect(explorerSwitchHref('/')).toBeNull();
    expect(explorerSwitchHref('/help/explorer')).toBeNull();
    expect(explorerSwitchHref('/explorers')).toBeNull();
    expect(explorerSwitchHref('/canvas/abc')).toBeNull();
  });

  it("opens each site's Explorer at the same view, keeping the query", () => {
    expect(links('/explorer/timeline')).toEqual({
      liveworkspace: 'https://liveworkspace.app/explorer/timeline',
      livediagram: 'https://www.livediagram.app/explorer/timeline',
      liveplanner: 'https://www.liveplanner.app/explorer/timeline',
      livedocuments: 'https://www.livedocuments.app/explorer/timeline',
      livedesign: 'https://www.livedesign.app/explorer/timeline',
    });
    expect(explorerSwitchHref('/explorer/')!(site('liveplanner.app'))).toBe(
      'https://www.liveplanner.app/explorer',
    );
    // Folders and teams are the account's, so their ids open on every app.
    expect(
      explorerSwitchHref('/explorer/folder', '?id=f1&q=tag%3Ax')!(site('livedesign.app')),
    ).toBe('https://www.livedesign.app/explorer/folder?id=f1&q=tag%3Ax');
    expect(explorerSwitchHref('/explorer/team', 'id=t1&folder=f2')!(PLATFORM_SITE)).toBe(
      'https://liveworkspace.app/explorer/team?id=t1&folder=f2',
    );
  });

  it('drops the query that speaks only on arrival or hands over to one app', () => {
    expect(
      explorerSwitchHref(
        '/explorer/search',
        'q=roadmap&from=livediagram&ended=revoked&trashed=x&title=T&convert=sync&item=i1',
      )!(site('liveplanner.app')),
    ).toBe('https://www.liveplanner.app/explorer/search?q=roadmap');
    expect(explorerSwitchHref('/explorer', '?from=liveplanner')!(PLATFORM_SITE)).toBe(
      'https://liveworkspace.app/explorer',
    );
  });

  it("opens Home where the site's Explorer lacks the view", () => {
    // This Browser is each app's own; liveworkspace.app can't read it.
    expect(links('/explorer/offline')).toMatchObject({
      liveworkspace: 'https://liveworkspace.app/explorer',
      liveplanner: 'https://www.liveplanner.app/explorer/offline',
    });
    // The Library is where the app keeps one.
    expect(links('/explorer/images')).toEqual({
      liveworkspace: 'https://liveworkspace.app/explorer',
      livediagram: 'https://www.livediagram.app/explorer/images',
      liveplanner: 'https://www.liveplanner.app/explorer',
      livedocuments: 'https://www.livedocuments.app/explorer/images',
      livedesign: 'https://www.livedesign.app/explorer/images',
    });
    expect(links('/explorer/shape-libraries')).toMatchObject({
      livediagram: 'https://www.livediagram.app/explorer/shape-libraries',
      liveplanner: 'https://www.liveplanner.app/explorer',
    });
  });
});
