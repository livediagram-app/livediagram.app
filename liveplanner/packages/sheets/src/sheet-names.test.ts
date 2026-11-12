import { describe, expect, it } from 'vitest';
import { sheetNamesFrom } from './sheet-names';

// A cell thread's names outside the grid (docs/specs/029-sheets/sheet.md "Cell comments" "Inbox"): the stored title
// and the cell's A1, by store id.

const names = sheetNamesFrom([
  { id: 's1', title: '  Budget ', layout: { rows: ['row1', 'row2'], cols: ['cola', 'colb'] } },
  { id: 's2', title: '   ', layout: { rows: [], cols: [] } },
]);

describe('sheetNamesFrom', () => {
  it('names a stored sheet by its title, and none for a blank title or an unknown sheet', () => {
    expect(names.title('s1')).toBe('Budget');
    expect(names.title('s2')).toBeUndefined();
    expect(names.title('nope')).toBeUndefined();
  });

  it('gives a cell its A1, null once its row or column is gone, undefined on an unknown sheet', () => {
    expect(names.cellRef('s1', 'row2:colb')).toBe('B2');
    expect(names.cellRef('s1', 'row9:colb')).toBeNull();
    expect(names.cellRef('s1', 'row1:colz')).toBeNull();
    expect(names.cellRef('nope', 'row1:cola')).toBeUndefined();
  });
});
