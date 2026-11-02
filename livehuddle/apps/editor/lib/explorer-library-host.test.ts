// @vitest-environment jsdom
// Import From's sources and hrefs are tested with the shared host (packages/explorer/src/library/app-imports.test.tsx).
import { describe, expect, it } from 'vitest';
import { explorerImports, explorerLibraryHosts } from './explorer-library-host';

describe('explorer library host', () => {
  // livehuddle's platform registration (@liveworkspace/sites APP_ITEMS) lists no Import From sources and no Shape
  // Libraries: its Gallery alone is lent to the Explorer.
  it('offers no Import From sources, as livehuddle registers none', () => {
    expect(explorerImports).toBeUndefined();
  });

  it('lends the Gallery over this site, the same object every time', () => {
    const hosts = explorerLibraryHosts();
    expect(Object.keys(hosts).sort()).toEqual(['gallery']);
    expect(explorerLibraryHosts()).toBe(hosts);
  });
});
