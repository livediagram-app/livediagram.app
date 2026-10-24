// Import From for an app's items: the registry's sources with their buttons, and the app's /import page on Import.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appImportHref, appImportsHost } from './app-imports';

afterEach(() => vi.unstubAllGlobals());

describe('Import From for an app', () => {
  it('offers every source livediagram imports, draw.io with its libraries, each with its icon', () => {
    const host = appImportsHost('livediagram')!;
    expect(host.sources.map((s) => [s.id, !!s.icon, !!s.libraries])).toEqual([
      ['microsoft-whiteboard', true, false],
      ['excalidraw', true, false],
      ['drawio', true, true],
    ]);
  });

  it('is the same host for each app and origin', () => {
    expect(appImportsHost('livediagram')).toBe(appImportsHost('livediagram'));
    expect(appImportsHost('livediagram', 'https://app.test')).not.toBe(
      appImportsHost('livediagram'),
    );
  });

  it('offers nothing for an app that imports nothing', () => {
    expect(appImportsHost('liveplanner')).toBeUndefined();
    expect(appImportHref('liveplanner', 'drawio', 'items', null)).toBeNull();
  });

  it('opens /import for the source, filed in the folder; libraries never take a folder', () => {
    expect(appImportHref('livediagram', 'excalidraw', 'items', 'f1')).toBe(
      '/import?source=excalidraw&what=items&folder=f1',
    );
    expect(appImportHref('livediagram', 'drawio', 'items', null)).toBe(
      '/import?source=drawio&what=items',
    );
    expect(appImportHref('livediagram', 'drawio', 'libraries', 'f1', 'https://app.test')).toBe(
      'https://app.test/import?source=drawio&what=libraries',
    );
  });

  it('goes to the app’s /import page on Import', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const host = appImportsHost('livediagram', 'https://app.test')!;
    host.onImport(host.sources[2]!, { what: 'items', placement: { folderId: 'f2', teamId: null } });
    expect(assign).toHaveBeenCalledWith(
      'https://app.test/import?source=drawio&what=items&folder=f2',
    );
  });
});
