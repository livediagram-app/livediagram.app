// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Element, Tab } from '@livediagram/document';
import type { ImportImageSession } from '@/lib/import-images';
import type { BoardScene, SceneItem } from '@/lib/board-scene/scene';
import { boardScene, inkStroke, sceneText } from '@/lib/board-scene/test-scenes';
import { useBoardSceneInsert, type BoardSceneInsertDeps } from './useBoardSceneInsert';

// docs/specs/020-import-export/board-scene.md "In the editor": a paste lands in one commit,
// selected, at the pointer or the middle of the view, its images first, its text hugging.
const square = (key: string, x: number): SceneItem => ({
  key,
  kind: 'shape',
  shape: 'rectangle',
  x,
  y: 0,
  width: 100,
  height: 50,
  stroke: inkStroke(),
});

function setup(over: Partial<BoardSceneInsertDeps> = {}, drawMode = true) {
  const state = {
    elements: [] as Element[],
    commits: 0,
    selectedId: null as string | null,
    multi: new Set<string>(),
  };
  const deps: BoardSceneInsertDeps = {
    activeTab: { id: 'tab', name: 'Board', elements: [] } as unknown as Tab,
    drawMode,
    editsBlocked: false,
    commit: (map) => {
      state.commits += 1;
      state.elements = map(state.elements);
    },
    setSelectedId: (id) => {
      state.selectedId = id;
    },
    setMultiSelectedIds: (ids) => {
      state.multi = ids;
    },
    canvasPointerRef: { current: { x: 500, y: 500 } },
    getViewportCenter: () => ({ x: 0, y: 0 }),
    ownerId: 'owner',
    documentId: 'doc',
    hugText: async (els) => els.map((el) => (el.type === 'text' ? { ...el, width: 42 } : el)),
    ...over,
  };
  const hook = renderHook((props: BoardSceneInsertDeps) => useBoardSceneInsert(props), {
    initialProps: deps,
  });
  return { state, hook, deps };
}

async function insert(hook: ReturnType<typeof setup>['hook'], scene: BoardScene) {
  let out = false;
  await act(async () => {
    out = await hook.result.current.insertScene(scene);
  });
  return out;
}

describe('useBoardSceneInsert', () => {
  it('lands everything in one commit at the pointer, selected', async () => {
    const { state, hook } = setup();
    expect(await insert(hook, boardScene([square('a', 0), square('b', 200)]))).toBe(true);
    expect(state.commits).toBe(1);
    expect(state.elements).toHaveLength(2);
    // The scene's bounds (0..300 x 0..50) centred on the pointer (500, 500).
    expect(state.elements[0]).toMatchObject({ x: 350, y: 475 });
    expect(state.selectedId).toBeNull();
    expect([...state.multi]).toEqual(state.elements.map((e) => e.id));
    expect(hook.result.current.notice).toBeNull();
  });

  it('lands at the middle of the view off the canvas, and selects a single element alone', async () => {
    const { state, hook } = setup({ canvasPointerRef: { current: null } });
    await insert(hook, boardScene([square('a', 0)]));
    expect(state.elements[0]).toMatchObject({ x: -50, y: -25 });
    expect(state.selectedId).toBe(state.elements[0]!.id);
    expect(state.multi.size).toBe(0);
  });

  it('lands at a given point before the pointer', async () => {
    const { state, hook } = setup();
    await act(async () => {
      await hook.result.current.insertScene(boardScene([square('a', 0)]), { x: 50, y: 25 });
    });
    expect(state.elements[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('hugs text boxes on a whiteboard only', async () => {
    const text: SceneItem = {
      key: 't',
      kind: 'text',
      x: 0,
      y: 0,
      width: 300,
      height: 20,
      autoWidth: true,
      text: sceneText('Hi'),
    };
    const board = setup();
    await insert(board.hook, boardScene([text]));
    expect(board.state.elements[0]).toMatchObject({ width: 42, type: 'text' });
    const diagram = setup({}, false);
    await insert(diagram.hook, boardScene([text]));
    expect(diagram.state.elements[0]).toMatchObject({ width: 300 });
  });

  it('stores images first, then lands them filled, still one commit', async () => {
    const store = vi.fn<ImportImageSession['store']>(async () => ({
      ok: true,
      imageId: 'img-1',
      width: 10,
      height: 10,
      kind: 'uploaded',
    }));
    const { state, hook } = setup({ createImageSession: async () => ({ store }) });
    await insert(
      hook,
      boardScene([{ key: 'i', kind: 'image', x: 0, y: 0, width: 10, height: 10, asset: 'f' }], {
        assets: [{ key: 'f', source: { kind: 'data-url', dataUrl: 'data:image/png;base64,AA' } }],
      }),
    );
    expect(store).toHaveBeenCalledTimes(1);
    expect(state.commits).toBe(1);
    expect(state.elements[0]).toMatchObject({ type: 'image', imageId: 'img-1' });
    expect(hook.result.current.notice).toBeNull();
  });

  it('leaves a notice when anything degraded, skipped or became a placeholder', async () => {
    const { hook } = setup({ createImageSession: async () => ({ store: vi.fn() }) });
    await insert(
      hook,
      boardScene([{ key: 'i', kind: 'image', x: 0, y: 0, width: 10, height: 10, asset: 'gone' }], {
        notes: [{ rule: 'Groups were dropped', count: 2 }],
      }),
    );
    const notice = hook.result.current.notice;
    expect(notice).toMatchObject({
      kind: 'report',
      source: 'excalidraw',
      report: { degraded: [{ rule: 'Groups were dropped', count: 2 }] },
      images: { placeholders: { 'missing-bytes': 1 } },
    });
    act(() => hook.result.current.dismissNotice());
    expect(hook.result.current.notice).toBeNull();
  });

  it('refuses a scene the tab has no room for, landing nothing', async () => {
    const { state, hook } = setup({
      activeTab: {
        id: 'tab',
        name: 'Board',
        elements: Array.from({ length: 10_000 }, (_, i) => ({ id: `e${i}` })),
      } as unknown as Tab,
    });
    expect(await insert(hook, boardScene([square('a', 0)]))).toBe(false);
    expect(state.commits).toBe(0);
    expect(hook.result.current.notice).toMatchObject({ kind: 'refused' });
  });

  it('does nothing when edits are blocked or the tab is locked', async () => {
    const blocked = setup({ editsBlocked: true });
    expect(await insert(blocked.hook, boardScene([square('a', 0)]))).toBe(false);
    const locked = setup({
      activeTab: { id: 'tab', name: 'B', elements: [], locked: true } as Tab,
    });
    expect(await insert(locked.hook, boardScene([square('a', 0)]))).toBe(false);
    expect(blocked.state.commits + locked.state.commits).toBe(0);
  });

  it('clears the notice when the tab changes', async () => {
    const { hook, deps } = setup();
    await insert(hook, boardScene([], { notes: [{ rule: 'Groups were dropped', count: 1 }] }));
    expect(hook.result.current.notice).not.toBeNull();
    hook.rerender({ ...deps, activeTab: { ...deps.activeTab, id: 'other' } });
    expect(hook.result.current.notice).toBeNull();
  });
});
