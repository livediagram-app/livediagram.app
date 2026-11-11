// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createShape, type Element, type Tab } from '@livehuddle/document';
import { storedArrow } from '@/test/retired-elements';
import { resetDragPreviewForTests } from '@/lib/drag-preview';
import { useEditorDrag } from './useEditorDrag';
import type { EditorDragDeps } from './useEditorDrag.types';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// Nothing holds (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3): a stored boundary
// draws the placeholder, and dragging it moves it alone, whatever sits on it. Driven through the real drag machine.

const shape = (kind: 'boundary' | 'room', id: string, x: number, y: number, w: number, h: number) =>
  ({ ...createShape('room', x, y), shape: kind, id, width: w, height: h }) as unknown as Element;

// The boundary spans 100..300 on both axes.
const BOARD = (): Element[] => [
  shape('boundary', 'frame', 100, 100, 200, 200),
  shape('room', 'inside', 130, 130, 40, 40),
  // Centre (290, 150) inside; its right half outside: travels.
  shape('room', 'straddling', 270, 130, 40, 40),
  // Centre (320, 150) outside; its left edge inside: stays.
  shape('room', 'mostly-out', 300, 130, 40, 40),
  // A smaller boundary nested inside, with its own member: both travel.
  shape('boundary', 'nested', 140, 200, 120, 80),
  shape('room', 'nested-member', 160, 220, 30, 30),
  // A larger boundary that only overlaps: stays.
  shape('boundary', 'neighbour', 250, 250, 300, 300),
  storedArrow('loose', { x: 120, y: 120 }, { x: 200, y: 140 }),
];

function harness(elements: Element[]) {
  let current = elements;
  const history: Element[][] = [];
  const deps = {
    get activeTab() {
      return { id: 't', name: 'Tab', elements: current } as Tab;
    },
    zoomRef: { current: 1 },
    setSelectedId: vi.fn(),
    soloSelectedId: null,
    setSoloSelectedId: vi.fn(),
    readSelection: () => ({ selectedId: 'frame', multiSelectedIds: new Set<string>() }),
    setMultiSelectedIds: vi.fn(),
    editingId: null,
    isReadOnly: false,
    layerInertIds: new Set<string>(),
    formatSourceId: null,
    applyFormatFromSource: vi.fn(),
    formatToolActive: false,
    setFormatSourceId: vi.fn(),
    groupSourceId: null,
    completeGrouping: vi.fn(),
    connectSourceId: null,
    connectArrowTo: vi.fn(),
    tick: (m: (els: Element[]) => Element[]) => {
      current = m(current);
    },
    commit: (m: (els: Element[]) => Element[]) => {
      history.push(current);
      current = m(current);
    },
    markCheckpoint: () => {
      history.push(current);
      return history.length;
    },
    cancelToCheckpoint: () => {
      current = history.pop() ?? current;
    },
    autoRebindArrowsRef: { current: false },
    alignmentGuidesRef: { current: false },
    isPinchingRef: { current: false },
  } as unknown as EditorDragDeps;
  const view = renderHook(() => useEditorDrag(deps));
  return { ...view, elements: () => current };
}

const START = { x: 500, y: 500 };

function dragFrame(h: ReturnType<typeof harness>, dx: number, dy: number) {
  act(() => {
    h.result.current.beginDrag('frame', 'move', {
      clientX: START.x,
      clientY: START.y,
      button: 0,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      currentTarget: document.createElement('div'),
    } as unknown as ReactPointerEvent);
  });
  act(() => {
    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: START.x + dx, clientY: START.y + dy }),
    );
  });
  act(() => {
    window.dispatchEvent(
      new MouseEvent('pointerup', { clientX: START.x + dx, clientY: START.y + dy }),
    );
  });
}

const xOf = (els: Element[], id: string) => {
  const el = els.find((e) => e.id === id);
  if (!el) return undefined;
  return el.type === 'arrow' ? (el.from.kind === 'free' ? el.from.x : undefined) : el.x;
};

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(performance.now());
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  resetDragPreviewForTests();
  cleanup();
  vi.unstubAllGlobals();
});

describe('useEditorDrag: a stored boundary carries nothing', () => {
  it('moves the boundary alone, leaving what sits on it', () => {
    const before = BOARD();
    const h = harness(before);
    dragFrame(h, 50, 0);
    const after = h.elements();
    const moved = (id: string) => xOf(after, id)! - xOf(before, id)!;
    expect(moved('frame')).toBe(50);
    for (const id of [
      'inside',
      'straddling',
      'nested',
      'nested-member',
      'loose',
      'mostly-out',
      'neighbour',
    ])
      expect(moved(id), id).toBe(0);
  });
});

// A pointer the system took back ends with pointercancel and no pointerup: the drag is cancelled, never
// left live to commit on a later, unrelated release.
describe('useEditorDrag — a cancelled pointer', () => {
  it('cancels the drag, leaving everything where it started', () => {
    const before = BOARD();
    const h = harness(before);
    act(() => {
      h.result.current.beginDrag('frame', 'move', {
        clientX: START.x,
        clientY: START.y,
        button: 0,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
        currentTarget: document.createElement('div'),
      } as unknown as ReactPointerEvent);
    });
    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', { clientX: START.x + 50, clientY: START.y }),
      );
    });
    act(() => {
      window.dispatchEvent(new Event('pointercancel'));
    });
    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointerup', { clientX: START.x + 90, clientY: START.y }),
      );
    });
    expect(xOf(h.elements(), 'frame')).toBe(xOf(before, 'frame'));
    expect(xOf(h.elements(), 'inside')).toBe(xOf(before, 'inside'));
  });
});
