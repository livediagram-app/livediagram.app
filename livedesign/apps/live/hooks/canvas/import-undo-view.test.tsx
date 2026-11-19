// @vitest-environment jsdom

// docs/specs/008-canvas/canvas-and-palette.md "Undoing an import brings its view back" (Work Tracker 1247): this
// editor's real history and import, the shared view hook and the real view store, with a canvas of a fixed size.

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSticky, type Element, type Tab } from '@livedesign/design';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import {
  computeFitToScreen,
  computeViewportCanvasRect,
} from '@liveworkspace/workbench/lib/viewport';
import { useImportUndoView } from '@liveworkspace/workbench/hooks/canvas/useImportUndoView';
import { useDesignHistory } from '@/hooks/canvas/useDesignHistory';
import { useTabImport } from '@/hooks/persistence/useTabImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const CANVAS = { width: 1000, height: 800 };

const sticky = (id: string, x: number, y: number) =>
  ({ ...createSticky(x, y), id, label: id }) as Element;

// The bounding box of a tab's boxed elements.
const boxOf = (elements: readonly Element[]) => {
  const boxed = elements as unknown as { x: number; y: number; width: number; height: number }[];
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

function setup() {
  const tabs: Tab[] = [{ id: 't1', name: 'One', elements: [sticky('old', -5000, -5000)] }];
  const viewport = createViewportStore(1);
  const fit = (elements: readonly Element[]) => {
    const view = computeFitToScreen(CANVAS, boxOf(elements));
    viewport.setZoom(view.zoom);
    viewport.setOffset(view.offset);
  };
  // The tabs of the latest render (renderHook's result updates only after this render's effects have run).
  let rendered = tabs;
  const activeNow = () => rendered.find((t) => t.id === 't1')!;
  // The import's own fit runs a frame after the render that carries it; `frame` stands in, and `land` is the same fit.
  const requestFit = vi.fn();
  const land = vi.fn(() => fit(activeNow().elements));
  const frame = () => act(() => fit(activeNow().elements));
  const { result } = renderHook(() => {
    const history = useDesignHistory(tabs);
    rendered = history.tabs;
    const view = useImportUndoView({ tabs: history.tabs, activeId: 't1', viewport, land });
    const tabImport = useTabImport({
      tabs: history.tabs,
      activeId: 't1',
      commitTabs: history.commit,
      setSelectedId: vi.fn(),
      setEditingId: vi.fn(),
      setFormatSourceId: vi.fn(),
      setImportError: vi.fn(),
      requestFit,
      noteImport: view.noteImport,
    });
    return { history, view, tabImport };
  });
  const step = (which: 'undo' | 'redo') =>
    act(() => {
      result.current.view.beforeStep();
      result.current.history[which]();
    });
  // The view the person had before importing: framed on the old content.
  fit(activeNow().elements);
  return { result, viewport, step, land, frame, requestFit, activeNow };
}

afterEach(() => vi.clearAllMocks());

describe('undoing an import', () => {
  it('imports, undoes, and has the restored content in view at the view from before the import', () => {
    const { result, viewport, step, frame, requestFit, activeNow } = setup();
    const before = viewport.get();
    const old = activeNow().elements;
    expect(inView(viewport, old)).toBe(true);

    act(() =>
      result.current.tabImport.replaceActiveTabContent({
        id: 'imported',
        name: 'Imported',
        elements: [sticky('a', 0, 0), sticky('b', 400, 0)],
      }),
    );
    expect(requestFit).toHaveBeenCalledOnce();
    frame();
    const imported = activeNow().elements;
    expect(imported.map((e) => (e as { label?: string }).label)).toEqual(['a', 'b']);
    expect(inView(viewport, imported)).toBe(true);
    expect(inView(viewport, old)).toBe(false);

    step('undo');
    expect(activeNow().elements.map((e) => e.id)).toEqual(['old']);
    expect(inView(viewport, activeNow().elements)).toBe(true);
    expect(viewport.get()).toEqual(before);

    step('redo');
    expect(inView(viewport, activeNow().elements)).toBe(true);
  });

  it('leaves the view alone when an undo only takes back an edit made after the import', () => {
    const { result, viewport, step, frame, land } = setup();
    act(() =>
      result.current.tabImport.replaceActiveTabContent({
        id: 'imported',
        name: 'Imported',
        elements: [sticky('a', 0, 0)],
      }),
    );
    frame();
    act(() =>
      result.current.history.commit((ts) =>
        ts.map((t) => ({ ...t, elements: [...t.elements, sticky('added', 9000, 9000)] })),
      ),
    );
    const view = viewport.get();
    step('undo');
    expect(viewport.get()).toEqual(view);
    expect(land).not.toHaveBeenCalled();
  });
});
