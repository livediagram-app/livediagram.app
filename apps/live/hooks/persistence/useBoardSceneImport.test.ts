// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tab } from '@livediagram/document';
import type { SceneItem } from '@/lib/board-scene/scene';
import { boardScene, inkStroke } from '@/lib/board-scene/test-scenes';
import { UNREADABLE_DATES_RULE } from '@/lib/board-scene/board-document';
import {
  useBoardSceneImport,
  type BoardSceneImportDeps,
  type NewBoardDocument,
} from './useBoardSceneImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/offline/offline-store', () => ({
  isOfflineId: vi.fn(async (id: string) => id.startsWith('offline-')),
  offlineCreateDocument: vi.fn(),
}));
import { track } from '@/lib/telemetry';

// docs/specs/020-import-export/board-import.md "Stages": replace-tab and new-document.
const square: SceneItem = {
  key: 's',
  kind: 'shape',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  stroke: inkStroke(),
};

function setup(active: Partial<Tab> = {}, over: Partial<BoardSceneImportDeps> = {}) {
  const calls = {
    replaced: [] as Tab[],
    created: [] as NewBoardDocument[],
    refreshed: 0,
  };
  const deps: BoardSceneImportDeps = {
    tabs: [{ id: 'a', name: 'A', elements: [], ...active } as Tab],
    activeId: 'a',
    drawMode: false,
    ownerId: 'o',
    documentId: 'doc-1',
    replaceActiveTabContent: (t) => calls.replaced.push(t),
    onDocumentsCreated: () => {
      calls.refreshed += 1;
    },
    hugText: async (els) => els,
    createImageSession: async () => ({ store: vi.fn() }),
    createDocument: async (doc) => {
      calls.created.push(doc);
    },
    ...over,
  };
  const { result } = renderHook(() => useBoardSceneImport(deps));
  return { api: result.current, calls };
}

describe('importScenesAsNewDocuments', () => {
  it('makes each board its own document, named and dated as the board', async () => {
    const { api, calls } = setup();
    const outcome = await api.importScenesAsNewDocuments([
      boardScene([square], {
        title: 'Retro',
        createdAt: '2020-08-14T12:00:00Z',
        modifiedAt: '2021-02-03T09:30:00Z',
        background: { pattern: 'plain' },
      }),
      boardScene([square, square], { createdAt: '2019-03-05T12:00:00Z' }),
    ]);
    expect(calls.created.map((d) => d.name)).toEqual(['Retro', 'Whiteboard, 5 Mar 2019']);
    const [retro, untitled] = calls.created;
    expect(retro).toMatchObject({
      createdAt: Date.UTC(2020, 7, 14, 12),
      savedAt: Date.UTC(2021, 1, 3, 9, 30),
    });
    expect(untitled!.savedAt).toBeUndefined();
    expect(retro!.tabs).toHaveLength(1);
    expect(retro!.tabs[0]).toMatchObject({
      name: 'Whiteboard',
      opensIn: 'draw',
      backgroundPattern: 'blank',
      templateChosen: true,
    });
    expect(untitled!.tabs[0]!.elements).toHaveLength(2);
    expect(calls.refreshed).toBe(1);
    expect(track).toHaveBeenCalledWith('Document', 'Created', 'Cloud');
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Created', 'Import');
    expect(outcome).toMatchObject({
      status: 'done',
      documents: [
        { id: retro!.id, name: 'Retro' },
        { id: untitled!.id, name: 'Whiteboard, 5 Mar 2019' },
      ],
      scene: { landed: { shape: 3 } },
    });
  });

  it('dates a board with broken dates today, and says so', async () => {
    const { api, calls } = setup();
    const outcome = await api.importScenesAsNewDocuments([
      boardScene([square], { createdAt: 'not a date' }),
    ]);
    expect(calls.created[0]!.createdAt).toBeUndefined();
    expect(calls.created[0]!.name).toBe('Whiteboard');
    expect(outcome).toMatchObject({
      scene: { degraded: [{ rule: UNREADABLE_DATES_RULE, count: 1 }] },
    });
  });

  it('lands the boards that fit and names the ones that do not', async () => {
    let n = 0;
    const { api, calls } = setup(
      {},
      {
        createDocument: async (doc) => {
          n += 1;
          if (n === 2) throw new Error('offline');
          calls.created.push(doc);
        },
      },
    );
    const huge = boardScene(
      Array.from({ length: 10_001 }, () => square),
      { title: 'Huge' },
    );
    const outcome = await api.importScenesAsNewDocuments([
      huge,
      boardScene([square], { title: 'One' }),
      boardScene([square], { title: 'Two' }),
    ]);
    expect(calls.created.map((d) => d.name)).toEqual(['One']);
    expect(outcome).toMatchObject({
      status: 'done',
      failures: [
        { title: 'Huge', message: expect.stringContaining('10,000') },
        { title: 'Two', message: "The document couldn't be created. Try again." },
      ],
    });
    const none = await setup().api.importScenesAsNewDocuments([huge]);
    expect(none.status).toBe('error');
  });

  it('counts the images of every board together', async () => {
    const { api } = setup();
    const withImage = boardScene([
      { key: 'i', kind: 'image', x: 0, y: 0, width: 5, height: 5, asset: 'missing' },
    ]);
    const outcome = await api.importScenesAsNewDocuments([withImage, withImage]);
    expect(outcome).toMatchObject({ images: { placeholders: { 'missing-bytes': 2 } } });
  });

  it('makes Offline Mode documents from an Offline Mode document', async () => {
    const { offlineCreateDocument } = await import('@/lib/offline/offline-store');
    const { api } = setup({}, { documentId: 'offline-doc', createDocument: undefined });
    await api.importScenesAsNewDocuments([
      boardScene([square], { title: 'Local', createdAt: '2020-08-14T12:00:00Z' }),
    ]);
    expect(offlineCreateDocument).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Local' }),
      expect.any(Number),
      { createdAt: Date.UTC(2020, 7, 14, 12), savedAt: undefined, folderId: null },
    );
    expect(track).toHaveBeenCalledWith('Document', 'Created', 'Offline');
  });
});

describe('importSceneIntoActiveTab', () => {
  it('replaces a diagram tab in the diagram profile with the scene’s background', async () => {
    const { api, calls } = setup();
    const outcome = await api.importSceneIntoActiveTab(
      boardScene([square], { background: { colour: { hex: '#fff9db' } } }),
    );
    expect(outcome).toMatchObject({ status: 'done', scene: { landed: { shape: 1 } } });
    expect(calls.replaced[0]).toMatchObject({ id: 'a', name: 'A', backgroundColor: '#fff9db' });
    expect(calls.replaced[0]!.elements[0]).toMatchObject({ fillColor: 'transparent' });
  });

  it('keeps the tab’s own pattern in Draw mode unless the scene names one', async () => {
    const board = setup({ backgroundPattern: 'grid' }, { drawMode: true });
    await board.api.importSceneIntoActiveTab(boardScene([square]));
    expect(board.calls.replaced[0]!.backgroundPattern).toBeUndefined();
    expect(board.calls.replaced[0]!.elements[0]).not.toHaveProperty('fillColor');
    const named = setup({}, { drawMode: true });
    await named.api.importSceneIntoActiveTab(
      boardScene([square], { background: { pattern: 'dots' } }),
    );
    expect(named.calls.replaced[0]!.backgroundPattern).toBe('grid');
  });

  it('refuses a locked tab', async () => {
    const { api, calls } = setup({ locked: true });
    expect((await api.importSceneIntoActiveTab(boardScene([square]))).status).toBe('error');
    expect(calls.replaced).toHaveLength(0);
  });
});
