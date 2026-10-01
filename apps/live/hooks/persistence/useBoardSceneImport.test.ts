// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tab } from '@livediagram/document';
import type { SceneItem } from '@/lib/board-scene/scene';
import { boardScene, inkStroke } from '@/lib/board-scene/test-scenes';
import { useBoardSceneImport, type BoardSceneImportDeps } from './useBoardSceneImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
import { track } from '@/lib/telemetry';

// docs/specs/020-import-export/board-import.md "Stages": replace-tab and new-whiteboard-tab.
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

function setup(active: Partial<Tab> = {}) {
  let tabs: Tab[] = [
    { id: 'a', name: 'A', elements: [], ...active } as Tab,
    { id: 'z', name: 'Z', elements: [] } as Tab,
  ];
  const calls = { commits: 0, replaced: [] as Tab[], active: 'a', fit: 0, loaded: [] as string[] };
  let n = 0;
  const deps: BoardSceneImportDeps = {
    tabs,
    activeId: 'a',
    ownerId: 'o',
    documentId: 'd',
    createTab: (name) => ({ id: `new-${++n}`, name, elements: [] }) as Tab,
    commitTabs: (map) => {
      calls.commits += 1;
      tabs = map(tabs);
    },
    markTabLoaded: (id) => calls.loaded.push(id),
    setActiveId: (id) => {
      calls.active = id;
    },
    setSelectedId: () => {},
    setEditingId: () => {},
    setFormatSourceId: () => {},
    replaceActiveTabContent: (t) => calls.replaced.push(t),
    requestFit: () => {
      calls.fit += 1;
    },
    hugText: async (els) => els,
    createImageSession: async () => ({ store: vi.fn() }),
  };
  const { result } = renderHook(() => useBoardSceneImport(deps));
  return { api: result.current, calls, tabs: () => tabs };
}

describe('importScenesAsNewWhiteboards', () => {
  it('opens each board as a whiteboard tab after the active one, in one step', async () => {
    const { api, calls, tabs } = setup();
    const outcome = await api.importScenesAsNewWhiteboards([
      boardScene([square], { title: 'Retro', background: { pattern: 'plain' } }),
      boardScene([square, square]),
    ]);
    expect(calls.commits).toBe(1);
    expect(tabs().map((t) => t.name)).toEqual(['A', 'Retro', 'Whiteboard', 'Z']);
    const [, retro, untitled] = tabs();
    expect(retro).toMatchObject({
      kind: 'whiteboard',
      backgroundPattern: 'blank',
      templateChosen: true,
    });
    expect(untitled!.backgroundPattern).toBe('graph');
    expect(untitled!.elements).toHaveLength(2);
    expect(calls.active).toBe(retro!.id);
    expect(calls.loaded).toEqual([retro!.id, untitled!.id]);
    expect(calls.fit).toBe(1);
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Created', 'Import');
    expect(outcome).toMatchObject({ status: 'done', scene: { landed: { shape: 3 } } });
  });

  it('lands the boards that fit and names the ones that do not', async () => {
    const { api, tabs } = setup();
    const huge = boardScene(
      Array.from({ length: 10_001 }, () => square),
      { title: 'Huge' },
    );
    const outcome = await api.importScenesAsNewWhiteboards([huge, boardScene([square])]);
    expect(tabs()).toHaveLength(3);
    expect(outcome).toMatchObject({
      status: 'done',
      failures: [{ title: 'Huge', message: expect.stringContaining('10,000') }],
    });
    const none = await setup().api.importScenesAsNewWhiteboards([huge]);
    expect(none.status).toBe('error');
  });

  it('counts the images of every board together', async () => {
    const { api } = setup();
    const withImage = boardScene([
      { key: 'i', kind: 'image', x: 0, y: 0, width: 5, height: 5, asset: 'missing' },
    ]);
    const outcome = await api.importScenesAsNewWhiteboards([withImage, withImage]);
    expect(outcome).toMatchObject({ images: { placeholders: { 'missing-bytes': 2 } } });
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

  it('keeps a whiteboard’s own pattern unless the scene names one', async () => {
    const board = setup({ kind: 'whiteboard', backgroundPattern: 'grid' });
    await board.api.importSceneIntoActiveTab(boardScene([square]));
    expect(board.calls.replaced[0]!.backgroundPattern).toBeUndefined();
    expect(board.calls.replaced[0]!.elements[0]).not.toHaveProperty('fillColor');
    const named = setup({ kind: 'whiteboard' });
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
