import { describe, expect, it, vi } from 'vitest';
import {
  applyShiftDuplicateSwap,
  type BoxedDragState,
  type ShiftDupSwap,
  type ShiftDuplicateSwapArgs,
} from './shift-duplicate-swap';
import { createArrow, createShape, type Element } from '@livediagram/diagram';

// Real factory output, re-keyed to a readable id: hand-rolled literals drift
// from the Element union the moment a required field is added.
function box(id: string, x = 0, y = 0): Element {
  return { ...createShape('square', x, y), id };
}

// An arrow pinned at both ends. Used to prove the boundary-arrow rule:
// one end inside the dragged set gets a re-pinned copy, both-ends-outside
// is ignored.
function pinnedArrow(id: string, fromId: string, toId: string): Element {
  return {
    ...createArrow(0, 0, 100, 0),
    id,
    from: { kind: 'pinned', elementId: fromId, anchor: 'e' },
    to: { kind: 'pinned', elementId: toId, anchor: 'w' },
  };
}

function boxedDrag(ids: string[], elements: Element[]): BoxedDragState {
  return {
    kind: 'boxed',
    mode: 'move',
    primaryId: ids[0],
    startClientX: 0,
    startClientY: 0,
    startBounds: new Map(ids.map((id) => [id, { x: 0, y: 0, w: 100, h: 60 }])),
    startArrowEnds: new Map(),
    startElements: elements,
  } as unknown as BoxedDragState;
}

function harness(over: Partial<ShiftDuplicateSwapArgs> = {}) {
  const elements = over.elements ?? [box('b1')];
  let els = elements;
  const state = {
    swap: null as ShiftDupSwap | null,
    ghostIds: null as ReadonlySet<string> | null,
    drag: null as BoxedDragState | null,
    selectedId: 'b1' as string | null,
    multi: new Set<string>(),
  };
  const args: ShiftDuplicateSwapArgs = {
    drag: boxedDrag(['b1'], elements),
    shiftKey: true,
    isReadOnly: false,
    dx: 10,
    dy: 10,
    elements,
    swap: state.swap,
    setSwap: (n) => {
      state.swap = n;
    },
    setGhostIds: (n) => {
      state.ghostIds = n;
    },
    setDrag: (n) => {
      state.drag = n;
    },
    selectedId: state.selectedId,
    setSelectedId: (id) => {
      state.selectedId = id;
    },
    multiSelectedIds: state.multi,
    setMultiSelectedIds: (ids) => {
      state.multi = ids;
    },
    tick: (mapper) => {
      els = mapper(els);
    },
    ...over,
  };
  const took = applyShiftDuplicateSwap(args);
  return {
    took,
    state,
    get els() {
      return els;
    },
  };
}

describe('applyShiftDuplicateSwap', () => {
  it('takes over the tick and ghosts a fresh clone set when Shift engages', () => {
    const { took, state, els } = harness();
    expect(took).toBe(true);
    // Original survives with its id (arrows pinned to it must stay put)…
    expect(els.some((el) => el.id === 'b1')).toBe(true);
    // …and a clone was appended and marked as the ghost.
    expect(els.length).toBe(2);
    expect(state.ghostIds?.size).toBe(1);
    expect(state.ghostIds?.has('b1')).toBe(false);
  });

  it('is idempotent — a replayed updater must not append a second clone set', () => {
    // React may re-run a state updater (StrictMode, batched replays). The
    // clones are built once, outside the mapper, precisely so the mapper
    // can no-op when they're already present.
    const elements = [box('b1')];
    let els = elements;
    let mapper: ((e: Element[]) => Element[]) | null = null;
    applyShiftDuplicateSwap({
      drag: boxedDrag(['b1'], elements),
      shiftKey: true,
      isReadOnly: false,
      dx: 5,
      dy: 5,
      elements,
      swap: null,
      setSwap: vi.fn(),
      setGhostIds: vi.fn(),
      setDrag: vi.fn(),
      selectedId: null,
      setSelectedId: vi.fn(),
      multiSelectedIds: new Set<string>(),
      setMultiSelectedIds: vi.fn(),
      tick: (m) => {
        mapper = m;
        els = m(els);
      },
    });
    const afterOnce = els.length;
    els = mapper!(els);
    expect(els.length).toBe(afterOnce);
  });

  it('copies a boundary arrow onto the clone but leaves unrelated arrows alone', () => {
    // b1 is dragged; b2 is not. The arrow between them has exactly one end
    // inside the set, so the clone gets its own copy. The b2->b3 arrow
    // touches nothing dragged and must not be duplicated.
    const elements = [
      box('b1'),
      box('b2', 300, 0),
      box('b3', 600, 0),
      pinnedArrow('a1', 'b2', 'b1'),
      pinnedArrow('a2', 'b2', 'b3'),
    ];
    const { els } = harness({ elements, drag: boxedDrag(['b1'], elements) });
    const arrows = els.filter((el) => el.type === 'arrow');
    // a1 + a2 + one boundary copy of a1.
    expect(arrows.length).toBe(3);
  });

  it('does nothing when the session is read-only', () => {
    const { took, state } = harness({ isReadOnly: true });
    expect(took).toBe(false);
    expect(state.ghostIds).toBeNull();
  });

  it('drops the clones and restores the selection when Shift is released', () => {
    const elements = [box('b1'), box('clone1', 10, 10)];
    const swap: ShiftDupSwap = {
      cloneIds: new Set(['clone1']),
      orig: boxedDrag(['b1'], elements),
      origSelectedId: 'b1',
      origMultiIds: new Set(['b1']),
    };
    const { took, state, els } = harness({
      elements,
      shiftKey: false,
      swap,
      selectedId: 'clone1',
    });
    expect(took).toBe(true);
    expect(els.some((el) => el.id === 'clone1')).toBe(false);
    expect(state.swap).toBeNull();
    expect(state.ghostIds).toBeNull();
    expect(state.selectedId).toBe('b1');
  });

  it('stays out of the way on a plain move with no swap in effect', () => {
    const { took } = harness({ shiftKey: false, swap: null });
    expect(took).toBe(false);
  });
});
