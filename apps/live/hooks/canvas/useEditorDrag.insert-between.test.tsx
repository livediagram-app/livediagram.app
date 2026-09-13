// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Element, StickyElement, Tab } from '@livediagram/diagram';
import { getInsertionSlot, setInsertionSlot } from '@/lib/insertion-preview';
import { useEditorDrag } from './useEditorDrag';
import type { EditorDragDeps } from './useEditorDrag.types';

// Dragging a note ALREADY on the board into a gap (spec/139), driven through
// the real drag machine rather than its parts: the gate, the live preview, the
// single-undo drop and the hostile paths are all properties of the wiring, not
// of the pure resolver (that is note-insertion-drag.test.ts).

function note(id: string, x: number, y = 0): StickyElement {
  return { id, type: 'sticky', x, y, width: 200, height: 200, label: id } as StickyElement;
}

// a: 0..200, b: 272..472, c: 544..744; `drag` parked clear of the row.
const BOARD = (): Element[] => [note('a', 0), note('b', 272), note('c', 544), note('drag', 1200)];

// Move `drag`'s CENTRE (1300, 100) into the a|b gap at (236, 100).
const INTO_GAP = { dx: 236 - 1300, dy: 0 };

type Harness = ReturnType<typeof harness>;

function harness(opts: { elements?: Element[]; esBoard?: boolean; readOnly?: boolean } = {}) {
  let elements = opts.elements ?? BOARD();
  // The editor's real semantics, minimally: `tick` writes without a history
  // entry, `markCheckpoint` snapshots, `cancelToCheckpoint` restores the last
  // snapshot and discards it. One checkpoint per gesture is the whole claim.
  const history: Element[][] = [];
  const deps = {
    get activeTab() {
      return { id: 't', name: 'Tab', elements } as Tab;
    },
    zoomRef: { current: 1 },
    selectedId: 'drag',
    setSelectedId: vi.fn(),
    soloSelectedId: null,
    setSoloSelectedId: vi.fn(),
    multiSelectedIds: new Set<string>(),
    setMultiSelectedIds: vi.fn(),
    editingId: null,
    isReadOnly: opts.readOnly === true,
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
      elements = m(elements);
    },
    commit: (m: (els: Element[]) => Element[]) => {
      history.push(elements);
      elements = m(elements);
    },
    markCheckpoint: () => {
      history.push(elements);
      return history.length;
    },
    cancelToCheckpoint: () => {
      elements = history.pop() ?? elements;
    },
    scheduleElementChangeLog: vi.fn(),
    autoRebindArrowsRef: { current: false },
    alignmentGuidesRef: { current: true },
    isPinchingRef: { current: false },
    insertGate: {
      esBoard: opts.esBoard !== false,
      readOnly: opts.readOnly === true,
      tabLocked: false,
      createBlocked: false,
    },
  } as unknown as EditorDragDeps;

  const view = renderHook(() => useEditorDrag(deps));
  return {
    ...view,
    get elements() {
      return elements;
    },
    // Undo steps taken during the gesture. One is the contract: a whole drag,
    // insertion and all, collapses into a single history entry.
    get checkpoints() {
      return history.length;
    },
    xOf: (id: string) => (elements.find((el) => el.id === id) as StickyElement | undefined)?.x,
    yOf: (id: string) => (elements.find((el) => el.id === id) as StickyElement | undefined)?.y,
  };
}

function press(h: Harness, id: string, clientX = 1300, clientY = 100) {
  act(() => {
    h.result.current.beginDrag(id, 'move', {
      clientX,
      clientY,
      button: 0,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      currentTarget: document.createElement('div'),
    } as unknown as ReactPointerEvent);
  });
}

function move(h: Harness, dx: number, dy: number, mods: { alt?: boolean; shift?: boolean } = {}) {
  act(() => {
    window.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: 1300 + dx,
        clientY: 100 + dy,
        altKey: mods.alt === true,
        shiftKey: mods.shift === true,
      }),
    );
  });
}

function release(h: Harness, dx: number, dy: number, mods: { alt?: boolean } = {}) {
  act(() => {
    window.dispatchEvent(
      new MouseEvent('pointerup', {
        clientX: 1300 + dx,
        clientY: 100 + dy,
        altKey: mods.alt === true,
      }),
    );
  });
}

function key(type: 'keydown' | 'keyup', k: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
  });
}

beforeEach(() => {
  setInsertionSlot(null);
});
afterEach(() => {
  setInsertionSlot(null);
  vi.restoreAllMocks();
});

describe('useEditorDrag — inserting a note already on the board (spec/139)', () => {
  it('opens a slot while Alt is held over a gap', () => {
    const h = harness();
    press(h, 'drag');
    move(h, INTO_GAP.dx, INTO_GAP.dy, { alt: true });
    const slot = getInsertionSlot();
    expect(slot?.leftId).toBe('a');
    expect(slot?.rightId).toBe('b');
    // The dragged note sits IN the slot, so what you see is what you get.
    expect(h.xOf('drag')).toBe(slot!.atX);
    // ...while every other note is only standing aside at RENDER time: the
    // document must be untouched until the drop.
    expect(h.xOf('b')).toBe(272);
    expect(h.xOf('c')).toBe(544);
  });

  // THE regression guard: this is what the Alt gesture exists to protect.
  it('does nothing at all without Alt — the plain move of before', () => {
    const h = harness();
    press(h, 'drag');
    move(h, INTO_GAP.dx, INTO_GAP.dy);
    expect(getInsertionSlot()).toBeNull();
    // The note follows the pointer, and nothing else on the board stirs.
    expect(h.xOf('drag')).toBe(1200 + INTO_GAP.dx);
    expect(h.xOf('b')).toBe(272);
    release(h, INTO_GAP.dx, INTO_GAP.dy);
    expect(h.xOf('b')).toBe(272);
    expect(h.xOf('c')).toBe(544);
  });

  it('commits the ripple and the note in one undoable step', () => {
    const h = harness();
    press(h, 'drag');
    move(h, INTO_GAP.dx, INTO_GAP.dy, { alt: true });
    const slot = getInsertionSlot()!;
    release(h, INTO_GAP.dx, INTO_GAP.dy, { alt: true });
    expect(h.xOf('drag')).toBe(272);
    expect(h.xOf('b')).toBe(272 + slot.shiftDx);
    expect(h.xOf('c')).toBe(544 + slot.shiftDx);
    // Notes LEFT of the insertion point never move...
    expect(h.xOf('a')).toBe(0);
    // ...and the whole gesture is one history entry, so a single undo puts
    // the board back exactly as it was.
    expect(h.checkpoints).toBe(1);
    // Nothing is left standing aside once the drop has landed.
    expect(getInsertionSlot()).toBeNull();
  });

  it('leaves a hole where the note came from', () => {
    // A fourth note sits to the RIGHT of the one being dragged. Nothing
    // closes UP behind a moved note: the board opens at the destination, and
    // the source gap is the author's to tidy. Predictable beats clever.
    const h = harness({ elements: [...BOARD(), note('after', 1500)] });
    press(h, 'drag');
    move(h, INTO_GAP.dx, INTO_GAP.dy, { alt: true });
    const slot = getInsertionSlot()!;
    release(h, INTO_GAP.dx, INTO_GAP.dy, { alt: true });
    // `after` travelled with the rest of the board's right-hand side — it did
    // NOT slide left into the vacated space.
    expect(h.xOf('after')).toBe(1500 + slot.shiftDx);
    // Nobody moved left, anywhere: that is the whole claim.
    for (const [id, before] of [
      ['a', 0],
      ['b', 272],
      ['c', 544],
      ['after', 1500],
    ] as const) {
      expect(h.xOf(id)!).toBeGreaterThanOrEqual(before);
    }
  });

  it('opens and unwinds the moment Alt moves, with the hand held still', () => {
    const h = harness();
    press(h, 'drag');
    move(h, INTO_GAP.dx, INTO_GAP.dy);
    expect(getInsertionSlot()).toBeNull();
    key('keydown', 'Alt');
    expect(getInsertionSlot()?.rightId).toBe('b');
    key('keyup', 'Alt');
    expect(getInsertionSlot()).toBeNull();
    // Placement is handed straight back to the ordinary move.
    expect(h.xOf('drag')).toBe(1200 + INTO_GAP.dx);
  });

  it('restores everything on Escape, preview included', () => {
    const h = harness();
    press(h, 'drag');
    move(h, INTO_GAP.dx, INTO_GAP.dy, { alt: true });
    expect(getInsertionSlot()).not.toBeNull();
    key('keydown', 'Escape');
    expect(getInsertionSlot()).toBeNull();
    expect(h.xOf('drag')).toBe(1200);
    expect(h.xOf('b')).toBe(272);
  });

  it('strands no preview when the drag ends away from any gap', () => {
    const h = harness();
    press(h, 'drag');
    move(h, INTO_GAP.dx, INTO_GAP.dy, { alt: true });
    move(h, 0, 600, { alt: true });
    expect(getInsertionSlot()).toBeNull();
    release(h, 0, 600, { alt: true });
    expect(getInsertionSlot()).toBeNull();
    expect(h.xOf('b')).toBe(272);
  });

  describe('hostile paths', () => {
    it('does nothing on an ordinary board, Alt or no Alt', () => {
      const h = harness({ esBoard: false });
      press(h, 'drag');
      move(h, INTO_GAP.dx, INTO_GAP.dy, { alt: true });
      expect(getInsertionSlot()).toBeNull();
      release(h, INTO_GAP.dx, INTO_GAP.dy, { alt: true });
      expect(h.xOf('b')).toBe(272);
    });

    it('does nothing for a read-only session', () => {
      const h = harness({ readOnly: true });
      press(h, 'drag');
      move(h, INTO_GAP.dx, INTO_GAP.dy, { alt: true });
      expect(getInsertionSlot()).toBeNull();
    });

    // Shift is already spoken for by drag-duplicate (spec/80).
    it('yields to a drag-duplicate when Shift joins in', () => {
      const h = harness();
      press(h, 'drag');
      move(h, INTO_GAP.dx, INTO_GAP.dy, { alt: true, shift: true });
      expect(getInsertionSlot()).toBeNull();
    });

    it('does nothing when a non-sticky is dragged', () => {
      const shape = {
        id: 'drag',
        type: 'shape',
        shape: 'square',
        x: 1200,
        y: 0,
        width: 200,
        height: 200,
      } as Element;
      const h = harness({ elements: [note('a', 0), note('b', 272), note('c', 544), shape] });
      press(h, 'drag');
      move(h, INTO_GAP.dx, INTO_GAP.dy, { alt: true });
      expect(getInsertionSlot()).toBeNull();
    });

    it('reorders within its own row without double-counting its own width', () => {
      // Drag c back between a and b. c's centre starts at 644.
      const h = harness({ elements: [note('a', 0), note('b', 272), note('c', 544)] });
      press(h, 'c', 644, 100);
      act(() => {
        window.dispatchEvent(
          new MouseEvent('pointermove', { clientX: 236, clientY: 100, altKey: true }),
        );
      });
      const slot = getInsertionSlot()!;
      expect(slot.rightId).toBe('b');
      // One note plus one gap, not two notes' worth.
      expect(slot.shiftDx).toBe(272);
      act(() => {
        window.dispatchEvent(
          new MouseEvent('pointerup', { clientX: 236, clientY: 100, altKey: true }),
        );
      });
      expect(h.xOf('a')).toBe(0);
      expect(h.xOf('c')).toBe(272);
      expect(h.xOf('b')).toBe(272 + 272);
    });
  });
});
