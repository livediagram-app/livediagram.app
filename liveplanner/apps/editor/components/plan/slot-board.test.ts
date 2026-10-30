import { describe, expect, it } from 'vitest';
import { presetSetup } from '@liveplanner/items';
import { SLOT_COLUMN_MIN_PX } from './plan-board-columns';
import { slotCardSize, slotColumnTemplate, slotColumnUnit, slotSetup } from './slot-board';

// docs/specs/026-plan/plan-tabs.md "A board in a slot is simplified": plain columns, compact and scaling.
const five = [{}, {}, {}, {}, {}];

describe('a slot board’s set-up', () => {
  it('draws no swimlanes, and leaves a board without them as it is', () => {
    const plain = presetSetup('kanban');
    expect(slotSetup(plain)).toBe(plain);
    const laned = { ...plain, swimlaneBy: 'priority' as const };
    expect(slotSetup(laned).swimlaneBy).toBe('none');
    expect(slotSetup(laned).columns).toBe(plain.columns);
  });

  it('keeps an All Cards board’s rows by status', () => {
    const all = { ...presetSetup('kanban'), allCards: true, swimlaneBy: 'status' as const };
    expect(slotSetup(all)).toBe(all);
    expect(slotSetup({ ...all, swimlaneBy: 'assignee' }).swimlaneBy).toBe('none');
  });
});

describe('a slot board’s columns', () => {
  it('shares a wide body evenly', () => {
    // 1000 less 24 padding less 4 gaps of 8, by 5.
    expect(slotColumnUnit(1000, five)).toBeCloseTo((1000 - 24 - 32) / 5);
    expect(slotColumnTemplate(1000, five)).toBe(Array(5).fill('minmax(160px, 1fr)').join(' '));
  });

  it('fits whole columns and a peek of the next when narrow', () => {
    // 600: room 576; four and a peek are under the floor, so three whole and a peek: (576 - 24) / 3.4.
    const unit = slotColumnUnit(600, five)!;
    expect(unit).toBeCloseTo(552 / 3.4);
    expect(unit).toBeGreaterThanOrEqual(SLOT_COLUMN_MIN_PX);
    expect(slotColumnTemplate(600, five)).toBe(
      Array(5)
        .fill(`${Math.floor(unit)}px`)
        .join(' '),
    );
  });

  it('gives a wide column its units and the gaps between them', () => {
    const unit = slotColumnUnit(600, [{ width: 2 }, {}, {}])!;
    expect(slotColumnTemplate(600, [{ width: 2 }, {}, {}]).split(' ')[0]).toBe(
      `${Math.floor(unit * 2 + 8)}px`,
    );
  });

  it('holds the floor when not even one column and a peek fit', () => {
    expect(slotColumnUnit(120, five)).toBe(SLOT_COLUMN_MIN_PX);
  });

  it('is unmeasured with no body or no columns', () => {
    expect(slotColumnUnit(null, five)).toBeNull();
    expect(slotColumnUnit(800, [])).toBeNull();
    expect(slotColumnTemplate(null, five)).toBe(Array(5).fill('minmax(160px, 1fr)').join(' '));
  });
});

describe('a slot board’s cards', () => {
  it('keep the board’s size in wide columns and turn Minimal in narrow ones', () => {
    expect(slotCardSize('detailed', 240)).toBe('detailed');
    expect(slotCardSize(undefined, 240)).toBeUndefined();
    expect(slotCardSize('detailed', 180)).toBe('minimal');
    expect(slotCardSize(undefined, 180)).toBe('minimal');
    expect(slotCardSize('minimal', 400)).toBe('minimal');
    expect(slotCardSize('detailed', null)).toBe('detailed');
  });
});
