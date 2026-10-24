import { describe, expect, it } from 'vitest';
import {
  APP_ITEMS,
  APP_NAMES,
  APP_SITES,
  appOfSite,
  explorerUrl,
  isAppName,
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
