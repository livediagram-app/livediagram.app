import { describe, expect, it } from 'vitest';
import { keptPlanDropSlot, samePlanDragTarget, type PlanDragState } from './usePlanCardDrag';

// docs/specs/026-plan/plan-board.md "A steady drag": crossing ground that is no cell (a gutter, a column head) keeps
// the last slot, so the gap never closes and reopens on the way to the next column.
const state = (over: Partial<PlanDragState> = {}): PlanDragState => ({
  itemId: 'i1',
  clientX: 0,
  clientY: 0,
  offsetX: 0,
  offsetY: 0,
  width: 200,
  height: 56,
  slot: { status: 'todo', laneKey: '', beforeId: 'i2' },
  outside: false,
  target: null,
  ...over,
});

describe('keptPlanDropSlot', () => {
  it('keeps the last slot on the same board, and its refusal', () => {
    expect(keptPlanDropSlot(state(), false, null)).toEqual({
      slot: { status: 'todo', laneKey: '', beforeId: 'i2' },
    });
    const refused = state({
      slot: { status: 'done', laneKey: '', beforeId: null },
      refused: 'Task cards can’t be Done',
    });
    expect(keptPlanDropSlot(refused, false, null)).toEqual({
      slot: { status: 'done', laneKey: '', beforeId: null },
      refused: 'Task cards can’t be Done',
    });
  });

  it('keeps another board’s slot only while over that same accepting board', () => {
    const there = state({ outside: true, target: { boardId: 'b2', accepts: true } });
    expect(keptPlanDropSlot(there, true, 'b2')?.slot).toEqual(there.slot);
    expect(keptPlanDropSlot(there, true, 'b3')).toBeNull();
    expect(keptPlanDropSlot(there, true, null)).toBeNull();
    // Back on its own board from another: nothing kept from there.
    expect(keptPlanDropSlot(there, false, null)).toBeNull();
  });

  it('keeps nothing off every board, on the Trash, or before any slot', () => {
    expect(keptPlanDropSlot(state(), true, null)).toBeNull();
    expect(keptPlanDropSlot(state({ slot: null }), false, null)).toBeNull();
    expect(keptPlanDropSlot(null, false, null)).toBeNull();
  });

  // The hot path: a kept slot is the same target, so the board does not re-render as the pointer crosses a gutter.
  it('reads as the same target, so a gutter crossing renders nothing', () => {
    const prev = state({ clientX: 100 });
    const kept = keptPlanDropSlot(prev, false, null)!;
    expect(samePlanDragTarget(prev, state({ clientX: 140, slot: { ...kept.slot } }))).toBe(true);
  });
});
