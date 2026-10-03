// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { localPreview, resetDragPreviewForTests } from '@/lib/drag-preview';
import { useEditorDrag } from './useEditorDrag';
import type { EditorDragDeps } from './useEditorDrag.types';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/008-canvas/drag-preview.md: a gesture draws from a preview and writes the document once,
// on release; a cancelled gesture writes nothing.

const BOX = (id: string, x: number): Element =>
  ({ id, type: 'shape', shape: 'square', x, y: 0, width: 100, height: 60 }) as Element;

function harness() {
  let elements: Element[] = [BOX('a', 0), BOX('b', 400)];
  const calls = { tick: 0, commit: 0, checkpoint: 0, cancel: 0, log: 0 };
  const deps = {
    get activeTab() {
      return { id: 't', name: 'Tab', elements } as Tab;
    },
    zoomRef: { current: 1 },
    selectedId: 'a',
    setSelectedId: vi.fn(),
    multiSelectedIds: new Set<string>(),
    setMultiSelectedIds: vi.fn(),
    editingId: null,
    isReadOnly: false,
    layerInertIds: new Set<string>(),
    formatSourceId: null,
    applyFormatFromSource: vi.fn(),
    formatToolActive: false,
    setFormatSourceId: vi.fn(),
    connectSourceId: null,
    connectArrowTo: vi.fn(),
    tick: (m: (els: Element[]) => Element[]) => {
      calls.tick += 1;
      elements = m(elements);
    },
    commit: (m: (els: Element[]) => Element[]) => {
      calls.commit += 1;
      elements = m(elements);
    },
    markCheckpoint: () => {
      calls.checkpoint += 1;
      return 1;
    },
    cancelToCheckpoint: () => {
      calls.cancel += 1;
    },
    scheduleElementChangeLog: () => {
      calls.log += 1;
    },
    styleNewElement: <T,>(el: T) => el,
    autoRebindArrowsRef: { current: false },
    alignmentGuidesRef: { current: false },
    isPinchingRef: { current: false },
    insertGate: { esBoard: false, readOnly: false, tabLocked: false, createBlocked: false },
  } as unknown as EditorDragDeps;
  const view = renderHook(() => useEditorDrag(deps));
  const press = () =>
    act(() => {
      view.result.current.beginDrag('a', 'move', {
        clientX: 50,
        clientY: 30,
        button: 0,
        stopPropagation: () => {},
        preventDefault: () => {},
      } as unknown as Parameters<typeof view.result.current.beginDrag>[2]);
    });
  const pointer = (type: 'pointermove' | 'pointerup', x: number) =>
    act(() => {
      window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 30 }));
    });
  const key = (k: string) =>
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    });
  const xOf = (id: string) => (elements.find((e) => e.id === id) as { x: number }).x;
  const drawFromAnchor = () =>
    act(() => {
      view.result.current.beginAnchorDrag('a', 'e', {
        clientX: 100,
        clientY: 30,
        button: 0,
        stopPropagation: () => {},
        preventDefault: () => {},
      } as unknown as Parameters<typeof view.result.current.beginAnchorDrag>[2]);
    });
  const arrow = () =>
    elements.find((e) => e.type === 'arrow') as Extract<Element, { type: 'arrow' }>;
  return { view, press, pointer, key, calls, xOf, drawFromAnchor, arrow };
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(performance.now());
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetDragPreviewForTests();
});

describe('a drag draws from a preview', () => {
  it('writes nothing while the selection moves, and shows the move in the preview', () => {
    const h = harness();
    h.press();
    h.pointer('pointermove', 100);
    h.pointer('pointermove', 150);
    expect(h.calls).toEqual({ tick: 0, commit: 0, checkpoint: 0, cancel: 0, log: 0 });
    expect(h.xOf('a')).toBe(0);
    expect((localPreview()?.changed.get('a') as { x: number } | undefined)?.x).toBe(100);
  });

  it('writes once on release: one checkpoint, one tick, one log entry', () => {
    const h = harness();
    h.press();
    h.pointer('pointermove', 100);
    h.pointer('pointermove', 150);
    h.pointer('pointerup', 150);
    expect(h.calls.checkpoint).toBe(1);
    expect(h.calls.tick).toBe(1);
    expect(h.calls.log).toBe(1);
    expect(h.xOf('a')).toBe(100);
    expect(h.xOf('b')).toBe(400);
    expect(localPreview()).toBeNull();
  });

  it('writes nothing for a click', () => {
    const h = harness();
    h.press();
    h.pointer('pointerup', 50);
    expect(h.calls).toEqual({ tick: 0, commit: 0, checkpoint: 0, cancel: 0, log: 0 });
    expect(localPreview()).toBeNull();
  });

  it('writes nothing when Escape cancels, and the element stays where it was', () => {
    const h = harness();
    h.press();
    h.pointer('pointermove', 150);
    h.key('Escape');
    h.pointer('pointerup', 150);
    expect(h.calls.tick + h.calls.commit + h.calls.checkpoint + h.calls.cancel).toBe(0);
    expect(h.xOf('a')).toBe(0);
    expect(localPreview()).toBeNull();
  });

  it('writes nothing when the canvas goes mid-drag', () => {
    const h = harness();
    h.press();
    h.pointer('pointermove', 150);
    h.view.unmount();
    expect(h.calls.tick + h.calls.commit).toBe(0);
    expect(localPreview()).toBeNull();
  });
});

// A quick-connect arrow (drag a box's plus to another box): its end lands where it was dropped. The
// collision bow a fresh arrow gets is folded into the one write on release; written afterwards
// through `commit`, which reads the document as last rendered, it put the end back at the start.
describe('drawing a quick-connect arrow', () => {
  it('lands its end where it was dropped, in the one write on release', () => {
    const h = harness();
    h.drawFromAnchor();
    // The arrow is created by the press: one commit.
    expect(h.calls.commit).toBe(1);
    h.pointer('pointermove', 250);
    h.pointer('pointermove', 300);
    h.pointer('pointerup', 300);
    // Nothing else goes through commit after the release's single tick.
    expect(h.calls.commit).toBe(1);
    expect(h.calls.tick).toBe(1);
    const to = h.arrow().to;
    expect(to.kind === 'free' ? to.x : to.kind).not.toBe(100);
    expect(to.kind === 'free' ? to.x : 300).toBe(300);
  });
});
