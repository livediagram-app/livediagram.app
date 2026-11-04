import { describe, expect, it } from 'vitest';
import {
  COLUMN_DRAG_START_PX,
  clampColumnOffset,
  columnDropIndex,
  columnEdgeMessage,
  columnMoveKey,
  columnMovedMessage,
  columnShift,
  pastColumnDragStart,
} from './column-drag';

// docs/specs/026-plan/plan-board.md "Drag a column": the geometry of a column carried by its head.

// Four columns 200 px wide with 12 px between them; the third one a collapsed strip (40 px).
const SPANS = [
  { left: 0, width: 200 },
  { left: 212, width: 200 },
  { left: 424, width: 40 },
  { left: 476, width: 200 },
];

describe('starting a drag', () => {
  it('stays a press under the threshold and becomes a drag at it', () => {
    expect(pastColumnDragStart(COLUMN_DRAG_START_PX - 1, 0)).toBe(false);
    expect(pastColumnDragStart(0, -COLUMN_DRAG_START_PX)).toBe(true);
    expect(pastColumnDragStart(3, 3)).toBe(true);
  });
});

describe('where a carried column lands', () => {
  it('stays put until its middle passes a neighbour’s', () => {
    expect(columnDropIndex(SPANS, 0, 0)).toBe(0);
    expect(columnDropIndex(SPANS, 0, 211)).toBe(0);
    expect(columnDropIndex(SPANS, 0, 213)).toBe(1);
  });

  it('passes a collapsed strip at the strip’s own middle, and reaches the last place', () => {
    expect(columnDropIndex(SPANS, 0, 345)).toBe(2);
    expect(columnDropIndex(SPANS, 0, 600)).toBe(3);
  });

  it('moves left as well', () => {
    expect(columnDropIndex(SPANS, 3, -100)).toBe(3);
    expect(columnDropIndex(SPANS, 3, -140)).toBe(2);
    expect(columnDropIndex(SPANS, 3, -480)).toBe(0);
  });

  it('keeps an unknown column where it is', () => {
    expect(columnDropIndex(SPANS, 9, 500)).toBe(9);
  });
});

describe('the neighbours stepping aside', () => {
  it('steps the columns it passes toward the place it left, by its width and a gap', () => {
    expect([0, 1, 2, 3].map((j) => columnShift(j, 0, 2, 212))).toEqual([0, -212, -212, 0]);
    expect([0, 1, 2, 3].map((j) => columnShift(j, 3, 1, 212))).toEqual([0, 212, 212, 0]);
    expect([0, 1, 2, 3].map((j) => columnShift(j, 1, 1, 212))).toEqual([0, 0, 0, 0]);
  });
});

describe('keeping it on the board', () => {
  it('never carries a column past the grid’s edges', () => {
    expect(clampColumnOffset(-50, SPANS, 0, 676)).toBe(0);
    expect(clampColumnOffset(900, SPANS, 0, 676)).toBe(476);
    expect(clampColumnOffset(-900, SPANS, 3, 676)).toBe(-476);
    expect(clampColumnOffset(120, SPANS, 1, 676)).toBe(120);
    expect(clampColumnOffset(10, SPANS, 7, 676)).toBe(0);
  });
});

describe('the keyboard and what is said', () => {
  const key = (k: string, over: Partial<Parameters<typeof columnMoveKey>[0]> = {}) =>
    columnMoveKey({
      key: k,
      altKey: true,
      shiftKey: true,
      ctrlKey: false,
      metaKey: false,
      ...over,
    });

  it('takes Alt+Shift+Left and Right only', () => {
    expect(key('ArrowLeft')).toBe(-1);
    expect(key('ArrowRight')).toBe(1);
    expect(key('ArrowUp')).toBeNull();
    expect(key('ArrowLeft', { shiftKey: false })).toBeNull();
    expect(key('ArrowLeft', { altKey: false })).toBeNull();
    expect(key('ArrowLeft', { metaKey: true })).toBeNull();
    expect(key('ArrowRight', { ctrlKey: true })).toBeNull();
  });

  it('announces the new place, or why it cannot move', () => {
    expect(columnMovedMessage('In Progress', 2, 5)).toBe('Moved In Progress to position 3 of 5');
    expect(columnEdgeMessage('To Do', -1)).toBe('To Do is already the first column');
    expect(columnEdgeMessage('Done', 1)).toBe('Done is already the last column');
  });
});
