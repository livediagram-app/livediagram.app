import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { balanceColumns, weightOf } from './CardColumns';

// CardColumns' placement (spec/22): cards go biggest first into the shorter
// column, so one tall ranking doesn't pile onto an already-long column.

describe('balanceColumns', () => {
  it('gives a card as tall as the rest a column of its own', () => {
    // Palette's shape: Shapes, Collaborate, Tools, Devices, Icons.
    expect(balanceColumns([10, 8, 31, 6, 6])).toEqual([[2], [0, 1, 3, 4]]);
  });

  it('keeps source order between equal cards, so the layout is stable', () => {
    expect(balanceColumns([5, 5, 5, 5])).toEqual([
      [0, 2],
      [1, 3],
    ]);
  });
});

describe('weightOf', () => {
  const card = (props: Record<string, unknown>) => createElement('div', props);

  it('weighs a ranking by its rows plus its header', () => {
    expect(weightOf(card({ items: [1, 2, 3, 4] }))).toBe(7);
  });

  it('weighs an empty ranking as its placeholder panel, not as nothing', () => {
    expect(weightOf(card({ items: [] }))).toBeGreaterThan(weightOf(card({ items: [1, 2] })));
  });

  it('takes an explicit weight when a card has one', () => {
    expect(weightOf(card({ weight: 12 }))).toBe(12);
  });
});
