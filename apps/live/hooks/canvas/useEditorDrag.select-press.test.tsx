// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DragMode } from '@/lib/canvas';
import { canvasGestureNow, resetCanvasGesturesForTests } from '@/lib/canvas-gesture';
import { createShape, type Element, type Tab } from '@livediagram/document';
import { useEditorDrag } from './useEditorDrag';
import type { EditorDragDeps } from './useEditorDrag.types';

// docs/specs/008-canvas/canvas-and-palette.md "Marquee box-select": only Shift adds to a
// selection, so a plain press on an element outside the multi-selection selects it alone.

function harness(multi: string[]) {
  const a = createShape('square', 0, 0);
  const b = createShape('square', 200, 0);
  const c = createShape('square', 400, 0);
  const elements: Element[] = [a, b, c];
  const setSelectedId = vi.fn();
  const setMultiSelectedIds = vi.fn();
  const ids: Record<string, string> = { a: a.id, b: b.id, c: c.id };
  const deps = {
    activeTab: { id: 't', name: 'Tab', kind: 'diagram', elements } as Tab,
    zoomRef: { current: 1 },
    setSelectedId,
    readSelection: () => ({
      selectedId: null,
      multiSelectedIds: new Set(multi.map((k) => ids[k]!)),
    }),
    setMultiSelectedIds,
    editingId: null,
    isReadOnly: false,
    layerInertIds: new Set<string>(),
    formatSourceId: null,
    applyFormatFromSource: vi.fn(),
    formatToolActive: false,
    setFormatSourceId: vi.fn(),
    connectSourceId: null,
    connectArrowTo: vi.fn(),
    tick: vi.fn(),
    commit: vi.fn(),
    markCheckpoint: () => 1,
    cancelToCheckpoint: vi.fn(),
    autoRebindArrowsRef: { current: false },
    alignmentGuidesRef: { current: false },
    isPinchingRef: { current: false },
    insertGate: { esBoard: false, readOnly: false, tabLocked: false, createBlocked: false },
  } as unknown as EditorDragDeps;
  const view = renderHook(() => useEditorDrag(deps));
  const press = (key: string, mode: DragMode = 'move') =>
    act(() => {
      view.result.current.beginDrag(ids[key]!, mode, {
        clientX: 0,
        clientY: 0,
        button: 0,
        stopPropagation: () => {},
        preventDefault: () => {},
      } as unknown as Parameters<typeof view.result.current.beginDrag>[2]);
    });
  const pointer = (type: 'pointermove' | 'pointerup', x: number) =>
    act(() => {
      window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 0 }));
    });
  return {
    press,
    move: (x: number) => pointer('pointermove', x),
    release: (x: number) => pointer('pointerup', x),
    unmount: view.unmount,
    ids,
    setSelectedId,
    setMultiSelectedIds,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetCanvasGesturesForTests();
});

describe('a plain press on a boxed element', () => {
  it('selects a non-member of a multi-selection alone', () => {
    const h = harness(['a', 'b']);
    h.press('c');
    expect(h.setSelectedId).toHaveBeenCalledWith(h.ids.c);
    expect(h.setMultiSelectedIds).toHaveBeenCalledWith(new Set());
  });

  it('keeps the multi-selection when it presses a member, so a drag moves them all', () => {
    const h = harness(['a', 'b']);
    h.press('a');
    expect(h.setMultiSelectedIds).not.toHaveBeenCalled();
  });

  it('leaves an empty multi-selection alone', () => {
    const h = harness([]);
    h.press('a');
    expect(h.setSelectedId).toHaveBeenCalledWith(h.ids.a);
    expect(h.setMultiSelectedIds).not.toHaveBeenCalled();
  });
});

// docs/specs/008-canvas/canvas-performance.md: a drag opens the canvas gesture the Map and the
// selection chrome stand down for.
describe('the gesture a drag opens', () => {
  const syncFrames = () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(performance.now());
      return 0;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  };

  it('opens a move only once the press travels far enough to be a drag', () => {
    syncFrames();
    const h = harness([]);
    h.press('a');
    h.move(2);
    expect(canvasGestureNow()).toBe('idle');
    h.move(20);
    expect(canvasGestureNow()).toBe('move');
    h.release(20);
    expect(canvasGestureNow()).toBe('idle');
  });

  it('opens a resize on the press itself', () => {
    syncFrames();
    const h = harness([]);
    h.press('a', 'resize-se');
    expect(canvasGestureNow()).toBe('resize');
    h.release(0);
    expect(canvasGestureNow()).toBe('idle');
  });

  it('opens nothing for a click', () => {
    syncFrames();
    const h = harness([]);
    h.press('a');
    h.release(0);
    expect(canvasGestureNow()).toBe('idle');
  });

  it('closes the gesture when the editor unmounts mid-drag', () => {
    syncFrames();
    const h = harness([]);
    h.press('a', 'resize-se');
    h.unmount();
    expect(canvasGestureNow()).toBe('idle');
  });
});
