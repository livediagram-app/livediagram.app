// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createArrow, createShape, type Element, type Tab } from '@livediagram/document';
import { resetDragPreviewForTests } from '@/lib/drag-preview';
import { useEditorDrag } from './useEditorDrag';
import type { EditorDragDeps } from './useEditorDrag.types';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// A person's frame drag carries what an agent's `move` carries (docs/specs/008-canvas/canvas-and-palette.md,
// docs/specs/024-agents/edit-operations.md "Membership"): the centre rule of `containerContents`, driven
// through the real drag machine.

const shape = (kind: 'frame' | 'square', id: string, x: number, y: number, w: number, h: number) =>
  ({ ...createShape(kind, x, y), id, width: w, height: h }) as Element;

// The frame spans 100..300 on both axes.
const BOARD = (): Element[] => [
  shape('frame', 'frame', 100, 100, 200, 200),
  shape('square', 'inside', 130, 130, 40, 40),
  // Centre (290, 150) inside; its right half outside: travels.
  shape('square', 'straddling', 270, 130, 40, 40),
  // Centre (320, 150) outside; its left edge inside: stays.
  shape('square', 'mostly-out', 300, 130, 40, 40),
  // A smaller frame nested inside, with its own member: both travel.
  shape('frame', 'nested', 140, 200, 120, 80),
  shape('square', 'nested-member', 160, 220, 30, 30),
  // A larger frame that only overlaps: stays.
  shape('frame', 'neighbour', 250, 250, 300, 300),
  { ...createArrow(120, 120, 200, 140), id: 'loose' } as Element,
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
    insertGate: { esBoard: false, readOnly: false, tabLocked: false, createBlocked: false },
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

describe('useEditorDrag — a frame carries by the centre rule', () => {
  it('carries what an agent move carries, and leaves the rest', () => {
    const before = BOARD();
    const h = harness(before);
    dragFrame(h, 50, 0);
    const after = h.elements();
    const moved = (id: string) => xOf(after, id)! - xOf(before, id)!;
    expect(moved('frame')).toBe(50);
    expect(moved('inside')).toBe(50);
    expect(moved('straddling')).toBe(50);
    expect(moved('nested')).toBe(50);
    expect(moved('nested-member')).toBe(50);
    expect(moved('loose')).toBe(50);
    expect(moved('mostly-out')).toBe(0);
    expect(moved('neighbour')).toBe(0);
  });
});
