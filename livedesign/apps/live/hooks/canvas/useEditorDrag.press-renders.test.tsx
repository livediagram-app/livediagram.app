// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCanvasGesturesForTests } from '@liveworkspace/workbench/lib/canvas-gesture';
import { createShape, type Element, type Tab } from '@livedesign/design';
import { useEditorDrag } from './useEditorDrag';
import type { EditorDragDeps } from './useEditorDrag.types';

// docs/specs/008-canvas/canvas-performance.md "A press re-renders what shows the gesture": the drag is held in a
// store, so the press that starts one and a release where nothing moved render the editor that owns the hook no
// times, while the store follows the gesture.

function harness() {
  const a = createShape('square', 0, 0);
  const elements: Element[] = [a];
  const tick = vi.fn();
  const deps = {
    activeTab: { id: 't', name: 'Tab', kind: 'diagram', elements } as Tab,
    zoomRef: { current: 1 },
    setSelectedId: vi.fn(),
    readSelection: () => ({ selectedId: a.id, multiSelectedIds: new Set<string>() }),
    setMultiSelectedIds: vi.fn(),
    editingId: null,
    isReadOnly: false,
    layerInertIds: new Set<string>(),
    inspectToolActive: false,
    formatSourceId: null,
    applyFormatFromSource: vi.fn(),
    formatToolActive: false,
    setFormatSourceId: vi.fn(),
    connectSourceId: null,
    connectArrowTo: vi.fn(),
    tick,
    commit: vi.fn(),
    markCheckpoint: () => 1,
    cancelToCheckpoint: vi.fn(),
    autoRebindArrowsRef: { current: false },
    alignmentGuidesRef: { current: false },
    isPinchingRef: { current: false },
  } as unknown as EditorDragDeps;
  let renders = 0;
  const view = renderHook(() => {
    renders += 1;
    return useEditorDrag(deps);
  });
  const press = () =>
    act(() => {
      view.result.current.beginDrag(a.id, 'move', {
        clientX: 0,
        clientY: 0,
        button: 0,
        stopPropagation: () => {},
        preventDefault: () => {},
      } as unknown as Parameters<typeof view.result.current.beginDrag>[2]);
    });
  const release = () =>
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 0, clientY: 0 }));
    });
  return { view, press, release, tick, renders: () => renders };
}

afterEach(() => {
  cleanup();
  resetCanvasGesturesForTests();
});

describe('useEditorDrag: a press renders nothing above the gesture', () => {
  it('starts a drag in the store without rendering the editor', () => {
    const h = harness();
    const before = h.renders();
    h.press();
    expect(h.view.result.current.dragStore.get()?.kind).toBe('boxed');
    expect(h.renders()).toBe(before);
  });

  it('ends a drag where nothing moved without rendering the editor or writing', () => {
    const h = harness();
    h.press();
    const before = h.renders();
    h.release();
    expect(h.view.result.current.dragStore.get()).toBeNull();
    expect(h.renders()).toBe(before);
    expect(h.tick).not.toHaveBeenCalled();
  });

  it('follows the next drag after one ends', () => {
    const h = harness();
    h.press();
    h.release();
    h.press();
    expect(h.view.result.current.dragStore.get()?.kind).toBe('boxed');
    h.release();
    expect(h.view.result.current.dragStore.get()).toBeNull();
  });
});
