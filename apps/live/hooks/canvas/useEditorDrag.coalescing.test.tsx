// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, StickyElement, Tab } from '@livediagram/diagram';
import { useEditorDrag } from './useEditorDrag';
import type { EditorDragDeps } from './useEditorDrag.types';

// Dragging an element coalesces its commits to one per animation frame, the
// way panning already did.
//
// The cost this removes is per EVENT, not per element: a trackpad delivers
// pointermove well above the frame rate, and every one of them was paying a
// commit. Measured over a realistic drag (180 events across ~90 frames) it
// cuts DOM writes by ~18%; it has NOT been shown to fix any particular
// reported slowness, and the claim here is only that redundant commits go.
//
// Two properties are worth pinning, because both are easy to lose in a later
// refactor and neither is visible in a passing feature test:
//
//  1. N moves inside one frame produce ONE commit, not N.
//  2. The element still lands on the LAST position of a burst. Dropping
//     intermediate events must be lossless, which it is because
//     every branch computes from the gesture's anchor rather than by
//     accumulating deltas.

const NOTE = (id: string, x: number): Element =>
  ({ id, type: 'sticky', x, y: 0, width: 100, height: 60, label: id }) as Element;

function harness() {
  let elements: Element[] = [NOTE('drag', 0)];
  let ticks = 0;
  const deps = {
    get activeTab() {
      return { id: 't', name: 'Tab', elements } as Tab;
    },
    zoomRef: { current: 1 },
    selectedId: 'drag',
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
    // Every positional write of a drag goes through `tick`, so counting them
    // counts the work the coalescing is meant to collapse.
    tick: (m: (els: Element[]) => Element[]) => {
      ticks += 1;
      elements = m(elements);
    },
    commit: (m: (els: Element[]) => Element[]) => {
      elements = m(elements);
    },
    markCheckpoint: () => 1,
    cancelToCheckpoint: vi.fn(),
    scheduleElementChangeLog: vi.fn(),
    autoRebindArrowsRef: { current: false },
    alignmentGuidesRef: { current: false },
    isPinchingRef: { current: false },
    insertGate: { esBoard: false, readOnly: false, tabLocked: false, createBlocked: false },
  } as unknown as EditorDragDeps;

  const view = renderHook(() => useEditorDrag(deps));
  return {
    ...view,
    get ticks() {
      return ticks;
    },
    xOf: (id: string) => (elements.find((el) => el.id === id) as StickyElement | undefined)?.x,
  };
}

// rAF callbacks queued by the hook, run only when a test says so, which is
// what lets a test hold several moves inside one "frame".
let frame: FrameRequestCallback[] = [];
function stubFrames() {
  frame = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frame.push(cb);
    return frame.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
}
function runFrame() {
  const queued = frame;
  frame = [];
  act(() => {
    for (const cb of queued) cb(performance.now());
  });
}

function press(h: ReturnType<typeof harness>) {
  act(() => {
    h.result.current.beginDrag('drag', 'move', {
      clientX: 0,
      clientY: 0,
      button: 0,
      stopPropagation: () => {},
      preventDefault: () => {},
    } as unknown as Parameters<typeof h.result.current.beginDrag>[2]);
  });
}

function move(x: number) {
  act(() => {
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: 0 }));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('useEditorDrag coalescing', () => {
  it('collapses a burst of moves in one frame into a single commit', () => {
    stubFrames();
    const h = harness();
    press(h);
    for (let i = 1; i <= 10; i++) move(i * 10);
    // Nothing has been written yet: the frame has not run.
    expect(h.ticks).toBe(0);
    runFrame();
    expect(h.ticks).toBe(1);
  });

  it('lands on the LAST position of the burst, not an intermediate one', () => {
    // Dropping events is only acceptable because it is lossless: every branch
    // computes from the gesture anchor plus the event's absolute position.
    stubFrames();
    const h = harness();
    press(h);
    move(40);
    move(250);
    runFrame();
    expect(h.xOf('drag')).toBe(250);
  });

  it('schedules again on the next frame, so a drag keeps tracking', () => {
    stubFrames();
    const h = harness();
    press(h);
    move(50);
    runFrame();
    expect(h.ticks).toBe(1);
    move(120);
    runFrame();
    expect(h.ticks).toBe(2);
    expect(h.xOf('drag')).toBe(120);
  });

  it('flushes a pending move on release, so a fast let-go loses no pixels', () => {
    stubFrames();
    const h = harness();
    press(h);
    move(300);
    // Release arrives in the same frame as the move: without the flush in
    // onUp the element would finish where the last painted frame left it.
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 300, clientY: 0 }));
    });
    expect(h.xOf('drag')).toBe(300);
  });
});
