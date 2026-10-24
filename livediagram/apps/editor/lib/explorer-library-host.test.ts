// @vitest-environment jsdom
// Import From's sources and hrefs are tested with the shared host (packages/explorer/src/library/app-imports.test.tsx).
import { describe, expect, it } from 'vitest';
import { explorerImports, explorerLibraryHosts } from './explorer-library-host';

describe('explorer library host', () => {
  it('offers livediagram’s Import From sources, on this site’s own /import page', () => {
    expect(explorerImports?.sources.map((s) => s.id)).toEqual([
      'microsoft-whiteboard',
      'excalidraw',
      'drawio',
    ]);
  });

  it('lends the Gallery and Shape Libraries over this site, the same objects every time', () => {
    const hosts = explorerLibraryHosts();
    expect(Object.keys(hosts).sort()).toEqual(['gallery', 'shapeLibraries']);
    expect(explorerLibraryHosts()).toBe(hosts);
  });
});
