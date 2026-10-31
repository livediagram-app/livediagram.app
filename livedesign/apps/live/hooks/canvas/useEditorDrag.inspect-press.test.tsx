// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DragMode } from '@/lib/canvas';
import { canvasGestureNow, resetCanvasGesturesForTests } from '@/lib/canvas-gesture';
import { createShape, type Element, type Tab } from '@livedesign/design';
import { useEditorDrag } from './useEditorDrag';
import type { EditorDragDeps } from './useEditorDrag.types';

// docs/specs/007-editor/wireframe-pages.md "Inspect": while Inspect is on, a press selects the element alone to read
// it, for an Editor too, and a drag moves nothing.

function harness(multi: string[], inert: string[] = []) {
  const a = createShape('square', 0, 0);
  const b = createShape('square', 200, 0);
  const c = createShape('square', 400, 0);
  const elements: Element[] = [a, b, c];
  const setSelectedId = vi.fn();
  const setMultiSelectedIds = vi.fn();
  const tick = vi.fn();
  const commit = vi.fn();
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
    inspectToolActive: true,
    formatSourceId: null,
    applyFormatFromSource: vi.fn(),
    formatToolActive: false,
    setFormatSourceId: vi.fn(),
    connectSourceId: null,
    connectArrowTo: vi.fn(),
    tick,
    commit,
    markCheckpoint: () => 1,
    cancelToCheckpoint: vi.fn(),
    autoRebindArrowsRef: { current: false },
    alignmentGuidesRef: { current: false },
    isPinchingRef: { current: false },
  } as unknown as EditorDragDeps;
  for (const k of inert) deps.layerInertIds.add(ids[k]!);
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
    tick,
    commit,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetCanvasGesturesForTests();
});

describe('a press while inspecting', () => {
  it('selects the element alone, even a member of a multi-selection', () => {
    const h = harness(['a', 'b']);
    h.press('a');
    expect(h.setSelectedId).toHaveBeenCalledWith(h.ids.a);
    expect(h.setMultiSelectedIds).toHaveBeenCalledWith(new Set());
  });

  it('moves nothing however far it travels', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(performance.now());
      return 0;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const h = harness([]);
    h.press('a');
    h.move(80);
    h.release(80);
    expect(canvasGestureNow()).toBe('idle');
    expect(h.tick).not.toHaveBeenCalled();
    expect(h.commit).not.toHaveBeenCalled();
  });

  it('passes over an element its layer makes inert', () => {
    const h = harness([], ['a']);
    h.press('a');
    expect(h.setSelectedId).not.toHaveBeenCalled();
  });

  it('resizes nothing from a handle', () => {
    const h = harness([]);
    h.press('a', 'resize-se');
    h.move(80);
    h.release(80);
    expect(h.commit).not.toHaveBeenCalled();
  });
});
