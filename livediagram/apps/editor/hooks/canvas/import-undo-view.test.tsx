// @vitest-environment jsdom

// docs/specs/008-canvas/canvas-and-palette.md "Undoing an import brings its view back" (Work Tracker 1247): the real
// history, the real import and the real view store, with a canvas of a fixed size.

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import {
  computeFitToScreen,
  computeViewportCanvasRect,
} from '@liveworkspace/workbench/lib/viewport';
import { useDocumentHistory } from './useDocumentHistory';
import { useImportUndoView } from '@liveworkspace/workbench/hooks/canvas/useImportUndoView';
import { useTabImport } from '@/hooks/persistence/useTabImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const CANVAS = { width: 1000, height: 800 };

const shape = (id: string, x: number, y: number) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: 200, height: 100, label: id }) as Element;

// The bounding box of a tab's boxed elements.
const boxOf = (elements: readonly Element[]) => {
  const boxed = elements.filter((e) => 'width' in e) as (Element & {
    x: number;
    y: number;
    width: number;
    height: number;
  })[];
  const x = Math.min(...boxed.map((e) => e.x));
  const y = Math.min(...boxed.map((e) => e.y));
  return {
    x,
    y,
    width: Math.max(...boxed.map((e) => e.x + e.width)) - x,
    height: Math.max(...boxed.map((e) => e.y + e.height)) - y,
  };
};

// Whether any of the content's box is on screen at the store's view.
const inView = (viewport: ReturnType<typeof createViewportStore>, elements: readonly Element[]) => {
  const { zoom, offset } = viewport.get();
  const seen = computeViewportCanvasRect(CANVAS, offset, zoom);
  const b = boxOf(elements);
  return (
    b.x < seen.x + seen.width &&
    b.x + b.width > seen.x &&
    b.y < seen.y + seen.height &&
    b.y + b.height > seen.y
  );
};

function setup(tabs: Tab[] = [{ id: 't1', name: 'One', elements: [shape('old', -5000, -5000)] }]) {
  const viewport = createViewportStore(1);
  const fit = (elements: readonly Element[]) => {
    const view = computeFitToScreen(CANVAS, boxOf(elements));
    viewport.setZoom(view.zoom);
    viewport.setOffset(view.offset);
  };
  let active = 't1';
  // The tabs of the latest render (renderHook's result updates only after this render's effects have run).
  let rendered = tabs;
  // Stable, as the editor's are; they frame what the active tab holds when they run.
  const activeNow = () => rendered.find((t) => t.id === active)!;
  const landOnTab = vi.fn(() => fit(activeNow().elements));
  // The import's own fit runs a frame after the render that carries it (useTabEntryEffects); `frame` stands in.
  const requestFit = vi.fn();
  const frame = () => act(() => fit(activeNow().elements));
  const { result, rerender } = renderHook(() => {
    const history = useDocumentHistory(tabs);
    rendered = history.tabs;
    const activeTab = history.tabs.find((t) => t.id === active)!;
    const view = useImportUndoView({
      tabs: history.tabs,
      activeId: active,
      viewport,
      land: landOnTab,
    });
    const tabImport = useTabImport({
      tabs: history.tabs,
      createTab: (name) => ({ id: crypto.randomUUID(), name, elements: [] }),
      markTabLoaded: vi.fn(),
      ownerId: 'owner-1',
      documentId: 'doc-1',
      activeId: active,
      commitTabs: history.commit,
      setSelectedId: vi.fn(),
      setEditingId: vi.fn(),
      setFormatSourceId: vi.fn(),
      setImportError: vi.fn(),
      requestFit,
      noteImport: view.noteImport,
      importScene: vi.fn(),
    });
    return { history, view, tabImport, activeTab };
  });
  const undo = () =>
    act(() => {
      result.current.view.beforeStep();
      result.current.history.undo();
    });
  const redo = () =>
    act(() => {
      result.current.view.beforeStep();
      result.current.history.redo();
    });
  const switchTo = (id: string) => {
    active = id;
    rerender();
  };
  // The view the person had before importing: framed on the old content.
  fit(result.current.activeTab.elements);
  return { result, viewport, undo, redo, switchTo, landOnTab, frame, requestFit };
}

afterEach(() => vi.clearAllMocks());

const importMermaid = async ({ result, frame, requestFit }: ReturnType<typeof setup>) => {
  await act(async () => {
    await result.current.tabImport.importTextIntoActiveTab('mermaid', 'flowchart LR\nA-->B');
  });
  expect(requestFit).toHaveBeenCalledOnce();
  frame();
};

describe('undoing an import', () => {
  it('imports, undoes, and has the restored content in view at the view from before the import', async () => {
    const editor = setup();
    const { result, viewport, undo } = editor;
    const before = viewport.get();
    const old = result.current.activeTab.elements;
    expect(inView(viewport, old)).toBe(true);

    await importMermaid(editor);
    const imported = result.current.activeTab.elements;
    expect(imported.some((e) => e.id === 'old')).toBe(false);
    // The import framed its content, far from the old content.
    expect(inView(viewport, imported)).toBe(true);
    expect(inView(viewport, old)).toBe(false);

    undo();
    expect(result.current.activeTab.elements.map((e) => e.id)).toEqual(['old']);
    expect(inView(viewport, result.current.activeTab.elements)).toBe(true);
    expect(viewport.get().zoom).toBe(before.zoom);
    expect(viewport.get().offset).toEqual(before.offset);
  });

  it('lands on the import again when it is redone', async () => {
    const editor = setup();
    const { result, viewport, undo, redo, landOnTab } = editor;
    await importMermaid(editor);
    undo();
    redo();
    expect(landOnTab).toHaveBeenCalledOnce();
    expect(inView(viewport, result.current.activeTab.elements)).toBe(true);
  });

  it('leaves the view alone when an undo only takes back an edit made after the import', async () => {
    const editor = setup();
    const { result, viewport, undo, landOnTab } = editor;
    await importMermaid(editor);
    act(() =>
      result.current.history.commit((ts) =>
        ts.map((t) => ({ ...t, elements: [...t.elements, shape('added', 9000, 9000)] })),
      ),
    );
    const view = viewport.get();
    undo();
    expect(result.current.activeTab.elements.some((e) => e.id === 'added')).toBe(false);
    expect(viewport.get()).toEqual(view);
    expect(landOnTab).not.toHaveBeenCalled();
  });

  it('leaves the view alone for an ordinary undo when nothing was imported', () => {
    const { result, viewport, undo } = setup();
    act(() =>
      result.current.history.commit((ts) =>
        ts.map((t) => ({ ...t, elements: [...t.elements, shape('added', 9000, 9000)] })),
      ),
    );
    const view = viewport.get();
    undo();
    expect(viewport.get()).toEqual(view);
  });

  it("leaves this tab's view alone when the undone import was on another tab", async () => {
    const editor = setup([
      { id: 't1', name: 'One', elements: [shape('old', -5000, -5000)] },
      { id: 't2', name: 'Two', elements: [shape('other', 3000, 3000)] },
    ]);
    const { viewport, undo, switchTo, landOnTab } = editor;
    await importMermaid(editor);
    switchTo('t2');
    const view = viewport.get();
    undo();
    expect(viewport.get()).toEqual(view);
    expect(landOnTab).not.toHaveBeenCalled();
  });
});
