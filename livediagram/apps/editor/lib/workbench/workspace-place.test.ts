import { describe, expect, it } from 'vitest';
import {
  appHrefOfPlace,
  explorerRouteOfFrame,
  framePathOfAppHref,
  isNewDocumentHref,
  placeView,
  workspaceFramePath,
  workspacePlaceOf,
  type WorkspacePlace,
} from './workspace-place';

const place = (path: string) => {
  const url = new URL(path, 'https://live.test');
  return workspacePlaceOf(url.pathname, url.searchParams);
};

describe('workspaceFramePath', () => {
  it.each<[WorkspacePlace, string]>([
    [{ kind: 'explorer', node: { kind: 'home' } }, '/embed/workbench/explorer'],
    [
      { kind: 'explorer', node: { kind: 'folder', id: 'f 1' } },
      '/embed/workbench/explorer/folder/f%201',
    ],
    [{ kind: 'explorer', node: { kind: 'recent' } }, '/embed/workbench/explorer/recent'],
    [
      { kind: 'explorer', node: { kind: 'team', id: 't1' } },
      '/embed/workbench/explorer/team?id=t1',
    ],
    [
      { kind: 'document', documentId: 'doc-1', tabId: null, shareCode: null },
      '/embed/workbench/document/doc-1',
    ],
    [
      { kind: 'document', documentId: 'doc-1', tabId: 't1', shareCode: 'CODE2345' },
      '/embed/workbench/document/doc-1?s=CODE2345&tab=t1',
    ],
  ])('places %o at %s', (at, path) => {
    expect(workspaceFramePath(at)).toBe(path);
  });
});

describe('workspacePlaceOf', () => {
  it('reads every frame path back to its place', () => {
    const places: WorkspacePlace[] = [
      { kind: 'explorer', node: { kind: 'home' } },
      { kind: 'explorer', node: { kind: 'folder', id: 'f 1' } },
      { kind: 'explorer', node: { kind: 'recent' } },
      { kind: 'explorer', node: { kind: 'trash' } },
      { kind: 'explorer', node: { kind: 'team', id: 't1' } },
      { kind: 'document', documentId: 'doc-1', tabId: 't1', shareCode: 'CODE2345' },
    ];
    for (const at of places) expect(place(workspaceFramePath(at))).toEqual(at);
  });

  it('reads a trailing slash, an unknown view and a document path with no id as Home', () => {
    expect(place('/embed/workbench/explorer/')).toEqual({
      kind: 'explorer',
      node: { kind: 'home' },
    });
    expect(place('/embed/workbench/explorer/nowhere')).toEqual({
      kind: 'explorer',
      node: { kind: 'home' },
    });
    expect(place('/embed/workbench/document/')).toEqual({
      kind: 'explorer',
      node: { kind: 'home' },
    });
  });
});

describe('explorerRouteOfFrame', () => {
  it('hands the Explorer the app route a frame path stands for, its query kept', () => {
    const route = (path: string) => {
      const url = new URL(path, 'https://live.test');
      const r = explorerRouteOfFrame(url.pathname, url.searchParams);
      return r && `${r.pathname}?${r.search.toString()}`;
    };
    expect(route('/embed/workbench/explorer?q=kind%3Aplan')).toBe('/explorer/home?q=kind%3Aplan');
    expect(route('/embed/workbench/explorer/folder/f1?q=x')).toBe('/explorer/folder?q=x&id=f1');
    expect(route('/embed/workbench/explorer/team?id=t1&folder=f2')).toBe(
      '/explorer/team?id=t1&folder=f2',
    );
    expect(route('/explorer/recent')).toBeNull();
  });
});

describe('framePathOfAppHref', () => {
  it.each([
    ['/explorer/home', '/embed/workbench/explorer'],
    ['/explorer', '/embed/workbench/explorer'],
    ['/explorer/recent?q=x', '/embed/workbench/explorer/recent?q=x'],
    ['/explorer/folder?id=f1', '/embed/workbench/explorer/folder/f1'],
    ['/explorer/folder?id=f1&q=x', '/embed/workbench/explorer/folder/f1?q=x'],
    ['/explorer/team?id=t1&folder=f2', '/embed/workbench/explorer/team?id=t1&folder=f2'],
    ['/document/doc-1', '/embed/workbench/document/doc-1'],
    ['/document/doc-1?s=CODE2345', '/embed/workbench/document/doc-1?s=CODE2345'],
    ['https://live.test/document/doc-1?tab=t1', '/embed/workbench/document/doc-1?tab=t1'],
    ['/embed/workbench/explorer/trash', '/embed/workbench/explorer/trash'],
  ])('moves %s inside the frame as %s', (href, path) => {
    expect(framePathOfAppHref(href, 'https://live.test')).toBe(path);
  });

  it.each([
    '/new',
    '/help/workbenches',
    '/sign-in/',
    'https://elsewhere.example/explorer/home',
    '/document/placeholder',
    '/document/',
  ])('leaves %s to the frame’s other paths', (href) => {
    expect(framePathOfAppHref(href, 'https://live.test')).toBeNull();
  });
});

describe('isNewDocumentHref', () => {
  it('knows the new-document wizard by its path, query or not', () => {
    expect(isNewDocumentHref('/new', 'https://live.test')).toBe(true);
    expect(isNewDocumentHref('/new?folder=f1', 'https://live.test')).toBe(true);
    expect(isNewDocumentHref('/new/', 'https://live.test')).toBe(true);
    expect(isNewDocumentHref('/newsletter', 'https://live.test')).toBe(false);
    expect(isNewDocumentHref('https://elsewhere.example/new', 'https://live.test')).toBe(false);
  });
});

describe('appHrefOfPlace and placeView', () => {
  it('opens the same place in a full tab, and names it for the workbench', () => {
    expect(appHrefOfPlace({ kind: 'explorer', node: { kind: 'folder', id: 'f1' } })).toBe(
      '/explorer/folder?id=f1',
    );
    expect(
      appHrefOfPlace({ kind: 'document', documentId: 'd1', tabId: 't1', shareCode: 'CODE2345' }),
    ).toBe('/document/d1?s=CODE2345');
    expect(placeView({ kind: 'explorer', node: { kind: 'recent' } })).toBe('recent');
    expect(placeView({ kind: 'document', documentId: 'd1', tabId: null, shareCode: null })).toBe(
      'document',
    );
  });
});
