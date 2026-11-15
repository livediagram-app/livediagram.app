// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createShape, type ArrowElement, type Element, type Tab } from '@livediagram/document';
import { resetDragPreviewForTests } from '@/lib/drag-preview';
import { useEditorDrag } from './useEditorDrag';
import type { EditorDragDeps } from './useEditorDrag.types';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// Shift-chaining (docs/specs/008-canvas/canvas-and-palette.md quick-connect): a Shift release or a Shift
// placing click lands the arrow and starts the next one from the same source.

const source = { ...createShape('square', 0, 0), id: 'src', width: 100, height: 100 } as Element;

function harness(from: Element = source) {
  let current: Element[] = [from];
  let selected: string | null = null;
  const deps = {
    get activeTab() {
      return { id: 't', name: 'Tab', elements: current } as Tab;
    },
    zoomRef: { current: 1 },
    setSelectedId: (id: string | null) => {
      selected = id;
    },
    readSelection: () => ({ selectedId: selected, multiSelectedIds: new Set<string>() }),
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
      current = m(current);
    },
    commit: (m: (els: Element[]) => Element[]) => {
      current = m(current);
    },
    markCheckpoint: () => 1,
    cancelToCheckpoint: vi.fn(),
    styleNewElement: <T,>(el: T) => el,
    autoRebindArrowsRef: { current: false },
    alignmentGuidesRef: { current: false },
    isPinchingRef: { current: false },
    insertGate: { esBoard: false, readOnly: false, tabLocked: false, createBlocked: false },
  } as unknown as EditorDragDeps;
  const view = renderHook(() => useEditorDrag(deps));
  return { ...view, elements: () => current };
}

const ptr = (type: string, x: number, y: number, shiftKey = false) =>
  act(() => {
    window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, shiftKey, bubbles: true }));
  });

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(performance.now()); // wall-clock: a fake frame's timestamp, not a budget
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  resetDragPreviewForTests();
  cleanup();
  vi.unstubAllGlobals();
});

describe('useEditorDrag — Shift-chaining arrows', () => {
  it('lands each arrow and chains the next from the same source, three in a row', () => {
    const h = harness();
    act(() => {
      h.result.current.beginAnchorDrag('src', 'e', {
        clientX: 100,
        clientY: 50,
        button: 0,
        shiftKey: false,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
        currentTarget: document.createElement('div'),
      } as unknown as ReactPointerEvent);
    });
    ptr('pointermove', 300, 50);
    ptr('pointerup', 300, 50, true); // Shift release: chain
    ptr('pointermove', 300, 200);
    ptr('pointerdown', 300, 200, true); // Shift placing click: chain again
    ptr('pointerup', 300, 200, true);
    ptr('pointermove', 300, 350);
    ptr('pointerdown', 300, 350); // plain placing click: done
    ptr('pointerup', 300, 350);
    const arrows = h.elements().filter((e): e is ArrowElement => e.type === 'arrow');
    expect(arrows).toHaveLength(3);
    for (const a of arrows) expect(a.from).toMatchObject({ kind: 'pinned', elementId: 'src' });
    expect(arrows.map((a) => (a.to.kind === 'free' ? [a.to.x, a.to.y] : a.to.kind))).toEqual([
      [300, 50],
      [300, 200],
      [300, 350],
    ]);
  });

  // docs/specs/008-canvas/arrow-anchors.md "In mind maps and flowcharts it is on by default".
  const press = (opts?: { placeOutPx?: number }) => (h: ReturnType<typeof harness>) =>
    act(() => {
      h.result.current.beginAnchorDrag(
        'src',
        'e',
        {
          clientX: 100,
          clientY: 50,
          button: 0,
          shiftKey: false,
          stopPropagation: vi.fn(),
          preventDefault: vi.fn(),
          currentTarget: document.createElement('div'),
        } as unknown as ReactPointerEvent,
        opts,
      );
    });
  const arrowsOf = (h: ReturnType<typeof harness>) =>
    h.elements().filter((e): e is ArrowElement => e.type === 'arrow');

  it('starts every arrow drawn and chained off a mind node at the exact anchor', () => {
    const h = harness({ ...source, shape: 'mind-node' } as Element);
    press()(h);
    ptr('pointermove', 300, 50);
    ptr('pointerup', 300, 50, true); // Shift release: chain
    ptr('pointermove', 300, 200);
    ptr('pointerdown', 300, 200); // plain placing click: done
    ptr('pointerup', 300, 200);
    const arrows = arrowsOf(h);
    expect(arrows).toHaveLength(2);
    for (const a of arrows) expect(a.exactStart).toBe(true);
  });

  it('starts a placed-out arrow off a flowchart step at the exact anchor, and one off a plain box fanned', () => {
    const step = harness({ ...source, shape: 'diamond', flowchartId: 'src' } as Element);
    press({ placeOutPx: 80 })(step);
    expect(arrowsOf(step)[0]!.exactStart).toBe(true);
    const plain = harness();
    press({ placeOutPx: 80 })(plain);
    expect(arrowsOf(plain)[0]!.exactStart).toBeUndefined();
  });
});
