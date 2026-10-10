import { describe, expect, it } from 'vitest';
import { PLAN_COLUMN_MIN_PX } from '@livediagram/items';
import { MAXIMISED_BOARD_SLOTS, boardColumnTemplate } from './plan-board-columns';

// docs/specs/026-plan/plan-board.md "Maximised board": five slots across, then a sideways scroll.
describe('boardColumnTemplate', () => {
  it('shares the width on the canvas, never under the floor', () => {
    expect(boardColumnTemplate([{}, { width: 2 }], false)).toBe(
      `minmax(${PLAN_COLUMN_MIN_PX}px, 1fr) minmax(${PLAN_COLUMN_MIN_PX * 2}px, 2fr)`,
    );
  });

  it('gives a maximised slot a fifth of the body, a wide column its slots and gaps, the floor winning', () => {
    expect(MAXIMISED_BOARD_SLOTS).toBe(5);
    const [one, two] = boardColumnTemplate([{}, { width: 2 }], true).split(') minmax');
    expect(one).toBe('minmax(max(220px, calc((100cqw - 48px) / 5 * 1 + 0px)), 1fr');
    expect(two).toBe('(max(440px, calc((100cqw - 48px) / 5 * 2 + 12px)), 2fr)');
  });
});
