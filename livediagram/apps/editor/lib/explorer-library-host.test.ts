// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { explorerImports, explorerLibraryHosts, importHref } from './explorer-library-host';

describe('explorer library host', () => {
  it('opens /import for the source, filed in the folder; libraries never take a folder', () => {
    expect(importHref('excalidraw', 'items', 'f1')).toBe(
      '/import?source=excalidraw&what=items&folder=f1',
    );
    expect(importHref('drawio', 'items', null)).toBe('/import?source=drawio&what=items');
    expect(importHref('drawio', 'libraries', 'f1')).toBe('/import?source=drawio&what=libraries');
  });

  it('offers every source livediagram imports, draw.io with its libraries, each with its icon', () => {
    expect(explorerImports.sources.map((s) => [s.id, !!s.icon, !!s.libraries])).toEqual([
      ['microsoft-whiteboard', true, false],
      ['excalidraw', true, false],
      ['drawio', true, true],
    ]);
  });

  it('goes to the /import page on Import', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    explorerImports.onImport(explorerImports.sources[2]!, {
      what: 'items',
      placement: { folderId: 'f2', teamId: null },
    });
    expect(assign).toHaveBeenCalledWith('/import?source=drawio&what=items&folder=f2');
    vi.unstubAllGlobals();
  });

  it('lends the Gallery and Shape Libraries over this site, the same objects every time', () => {
    const hosts = explorerLibraryHosts();
    expect(Object.keys(hosts).sort()).toEqual(['gallery', 'shapeLibraries']);
    expect(explorerLibraryHosts()).toBe(hosts);
  });
});
