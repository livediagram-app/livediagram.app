// @vitest-environment jsdom
// Import From's sources and hrefs are tested with the shared host (packages/explorer/src/library/app-imports.test.tsx).
import { describe, expect, it } from 'vitest';
import { explorerImports, explorerLibraryHosts } from './explorer-library-host';

describe('explorer library host', () => {
  // livehuddle's platform registration (@liveworkspace/sites APP_ITEMS) lists no Import From sources and no Shape
  // Libraries (gone, Work Tracker #423 part 4), so only the Gallery is lent to it.
  it('offers no Import From sources, as livehuddle registers none', () => {
    expect(explorerImports).toBeUndefined();
  });

  it('lends the Gallery alone over this site, the same object every time', () => {
    const hosts = explorerLibraryHosts();
    expect(Object.keys(hosts)).toEqual(['gallery']);
    expect(explorerLibraryHosts()).toBe(hosts);
  });
});
