import { afterEach, describe, expect, it, vi } from 'vitest';
import { siteOfApp } from '@liveworkspace/sites';
import { importHref, importsHost } from './imports';

afterEach(() => vi.unstubAllGlobals());

describe('Import from on liveworkspace.app', () => {
  it('offers livediagram’s sources, draw.io also as libraries', () => {
    const host = importsHost('livediagram')!;
    expect(host.sources.map((s) => s.id)).toEqual(['microsoft-whiteboard', 'excalidraw', 'drawio']);
    expect(host.sources.filter((s) => s.libraries).map((s) => s.id)).toEqual(['drawio']);
    expect(host.sources.every((s) => Boolean(s.icon))).toBe(true);
    expect(importsHost('livediagram')).toBe(host);
  });

  it('offers nothing for an app that imports nothing', () => {
    expect(importsHost('liveplanner')).toBeUndefined();
  });

  it('opens the app’s /import page for the source, into the folder', () => {
    const url = siteOfApp('livediagram').url;
    expect(importHref('livediagram', 'excalidraw', 'items', 'f1')).toBe(
      `${url}/import?source=excalidraw&what=items&folder=f1`,
    );
    expect(importHref('livediagram', 'drawio', 'libraries', 'f1')).toBe(
      `${url}/import?source=drawio&what=libraries`,
    );
    expect(importHref('liveplanner', 'drawio', 'items', null)).toBeNull();
  });

  it('goes there on import', () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    const host = importsHost('livediagram')!;
    host.onImport(host.sources[0]!, { what: 'items', placement: { folderId: null, teamId: null } });
    expect(assign).toHaveBeenCalledWith(
      `${siteOfApp('livediagram').url}/import?source=microsoft-whiteboard&what=items`,
    );
  });
});
