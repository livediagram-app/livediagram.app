import { describe, expect, it } from 'vitest';
import { PLAN_COLUMN_MIN_PX } from '@liveplanner/items';
import {
  COLLAPSED_COLUMN_PX,
  MAXIMISED_BOARD_SLOTS,
  PHONE_COLUMN_PEEK_PX,
  SLOT_COLUMN_MIN_PX,
  boardColumnTemplate,
} from './plan-board-columns';

// docs/specs/026-plan/plan-board.md "Maximised board": five slots across, then a sideways scroll.
describe('boardColumnTemplate', () => {
  it('shares the width on the canvas, never under the floor', () => {
    expect(boardColumnTemplate([{}, { width: 2 }], 'canvas')).toBe(
      `minmax(${PLAN_COLUMN_MIN_PX}px, 1fr) minmax(${PLAN_COLUMN_MIN_PX * 2}px, 2fr)`,
    );
  });

  it('gives a maximised slot a fifth of the body, a wide column its slots and gaps, the floor winning', () => {
    expect(MAXIMISED_BOARD_SLOTS).toBe(5);
    const [one, two] = boardColumnTemplate([{}, { width: 2 }], 'maximised').split(') minmax');
    expect(one).toBe('minmax(max(220px, calc((100cqw - 48px) / 5 * 1 + 0px)), 1fr');
    expect(two).toBe('(max(440px, calc((100cqw - 48px) / 5 * 2 + 12px)), 2fr)');
  });

  // docs/specs/026-plan/plan-tabs.md "A board in a slot is simplified": compact, before slot-board.ts measures it.
  it('gives a slot board compact shares, a wide column its units', () => {
    expect(SLOT_COLUMN_MIN_PX).toBe(160);
    expect(boardColumnTemplate([{}, { width: 2 }], 'slot')).toBe(
      'minmax(160px, 1fr) minmax(320px, 2fr)',
    );
  });

  it('gives every column on a phone the body less a peek of the next, whatever its width', () => {
    expect(PHONE_COLUMN_PEEK_PX).toBe(64);
    expect(boardColumnTemplate([{}, { width: 3 }], 'phone')).toBe(
      'max(220px, calc(100cqw - 64px)) max(220px, calc(100cqw - 64px))',
    );
  });

  // docs/specs/026-plan/plan-board.md "Collapse Column": a strip, the open columns sharing the rest.
  it('draws a collapsed column as a strip on the canvas, the others sharing the rest', () => {
    expect(COLLAPSED_COLUMN_PX).toBe(40);
    const columns = [{ id: 'a' }, { id: 'b', width: 2 as const }, {}];
    expect(boardColumnTemplate(columns, 'canvas', new Set(['a']))).toBe(
      `40px minmax(${PLAN_COLUMN_MIN_PX * 2}px, 2fr) minmax(${PLAN_COLUMN_MIN_PX}px, 1fr)`,
    );
  });

  it("measures a maximised board's five slots from what its strips leave", () => {
    const [strip, open] = boardColumnTemplate(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      'maximised',
      new Set(['a', 'c']),
    ).split(' minmax');
    expect(strip).toBe('40px');
    expect(open).toBe('(max(220px, calc((100cqw - 104px - 48px) / 5 * 1 + 0px)), 1fr) 40px');
  });

  it('draws every column open on a phone and in a slot, collapsed or not', () => {
    const shut = new Set(['a']);
    expect(boardColumnTemplate([{ id: 'a' }], 'phone', shut)).toBe(
      'max(220px, calc(100cqw - 64px))',
    );
    expect(boardColumnTemplate([{ id: 'a' }], 'slot', shut)).toBe('minmax(160px, 1fr)');
  });
});
