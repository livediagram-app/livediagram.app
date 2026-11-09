import { describe, expect, it } from 'vitest';
import { changedInputs } from './changed-inputs';
import { cellKey, NOBODY, type Cell, type Sheet } from './sheet';

const sheetOf = (cells: Record<string, Cell>): Sheet => ({
  id: 'sheet0001',
  tabId: 'tab1',
  title: 'Sheet 1',
  layout: { rows: ['row1', 'row2'], cols: ['col1', 'col2'] },
  cells: new Map(Object.entries(cells)),
  rev: 0,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: NOBODY,
});

describe('changedInputs', () => {
  const a = cellKey('row1', 'col1');
  const b = cellKey('row1', 'col2');
  const c = cellKey('row2', 'col1');

  it('keeps the touched cells whose input changed, by value, and leaves out formats', () => {
    const before = sheetOf({ [a]: { input: { n: 1 } }, [b]: { input: { s: 'x' } } });
    const after = sheetOf({
      // The same input in a new object: unchanged.
      [a]: { input: { n: 1 }, format: { b: true } },
      [b]: { input: { s: 'y' } },
      [c]: { input: { b: true } },
    });
    expect(changedInputs(before, after, [a, b, c])).toEqual([b, c]);
  });

  it('counts a cell emptied, and passes over one empty on both sides', () => {
    const before = sheetOf({ [a]: { input: { n: 1 } } });
    const after = sheetOf({ [c]: { format: { i: true } } });
    expect(changedInputs(before, after, [a, c])).toEqual([a]);
    expect(changedInputs(before, before, [a])).toEqual([]);
  });
});
