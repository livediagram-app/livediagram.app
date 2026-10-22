import { describe, expect, it } from 'vitest';
import { keepOnScreenShift } from './useKeepOnScreen';

// docs/specs/026-plan/plan-board.md "On a phone": a board's header buttons slide left to stay on screen.
describe('keepOnScreenShift', () => {
  it('stays put while the group is on screen', () => {
    expect(keepOnScreenShift({ left: 100, right: 200 }, 300, 0, 1)).toBe(0);
  });

  it('moves left by the overrun, in the group’s own px', () => {
    expect(keepOnScreenShift({ left: 400, right: 500 }, 300, 0, 1)).toBe(-200);
    expect(keepOnScreenShift({ left: 400, right: 500 }, 300, 0, 2)).toBe(-100);
  });

  it('never moves past the board’s left edge', () => {
    expect(keepOnScreenShift({ left: 400, right: 500 }, 300, 350, 1)).toBe(-50);
    expect(keepOnScreenShift({ left: 400, right: 500 }, 300, 450, 1)).toBe(0);
    expect(keepOnScreenShift({ left: 400, right: 500 }, 300, 0, 0)).toBe(0);
  });
});
