import { describe, expect, it } from 'vitest';
import { samePlanDragTarget, type PlanDragState } from './usePlanCardDrag';

// The board re-renders only when the slot under a dragged card changes, not on every pointer move.
const base: PlanDragState = {
  itemId: 'a',
  clientX: 10,
  clientY: 10,
  offsetX: 0,
  offsetY: 0,
  width: 100,
  height: 40,
  slot: { status: 'todo', laneKey: '', beforeId: null },
  outside: false,
  target: null,
};

describe('samePlanDragTarget', () => {
  it('ignores the pointer moving within the same slot', () => {
    expect(samePlanDragTarget(base, { ...base, clientX: 99, clientY: 70 })).toBe(true);
  });

  it('sees a new slot, a new board, the Trash, or the first move', () => {
    expect(samePlanDragTarget(null, base)).toBe(false);
    expect(samePlanDragTarget(base, { ...base, slot: { ...base.slot!, beforeId: 'b' } })).toBe(
      false,
    );
    expect(samePlanDragTarget(base, { ...base, slot: null })).toBe(false);
    expect(samePlanDragTarget(base, { ...base, outside: true })).toBe(false);
    expect(samePlanDragTarget(base, { ...base, overTrash: true })).toBe(false);
    // A column whose status the card's type leaves out turns red (docs/specs/026-plan/item-types.md).
    expect(samePlanDragTarget(base, { ...base, refused: "Task cards can't be Done" })).toBe(false);
    expect(samePlanDragTarget(base, { ...base, target: { boardId: 'x', accepts: true } })).toBe(
      false,
    );
  });
});
