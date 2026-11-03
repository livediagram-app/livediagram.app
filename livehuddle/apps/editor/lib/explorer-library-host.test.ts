// @vitest-environment jsdom
// Import From's sources and hrefs are tested with the shared host (packages/explorer/src/library/app-imports.test.tsx).
import { describe, expect, it } from 'vitest';
import { explorerImports, explorerLibraryHosts } from './explorer-library-host';

describe('explorer library host', () => {
  // livehuddle's platform registration (@liveworkspace/sites APP_ITEMS) lists no Import From sources, and its Shape
  // Libraries are managed in the Explorer as livediagram's are, so the Gallery and Shape Libraries are lent to it.
  it('offers no Import From sources, as livehuddle registers none', () => {
    expect(explorerImports).toBeUndefined();
  });

  it('lends the Gallery and Shape Libraries over this site, the same objects every time', () => {
    const hosts = explorerLibraryHosts();
    expect(Object.keys(hosts).sort()).toEqual(['gallery', 'shapeLibraries']);
    expect(explorerLibraryHosts()).toBe(hosts);
  });
});
