import { describe, expect, it } from 'vitest';
import { cellMenuLabels } from './sheet-cell-menu-labels';

// docs/specs/029-sheets/sheet.md "Cell menu": each row names what it will do to the selection.

describe('cellMenuLabels', () => {
  it('names one cell in the singular', () => {
    expect(cellMenuLabels({ r1: 3, c1: 1, r2: 3, c2: 1 })).toEqual({
      title: 'B4',
      count: '1 Cell',
      insertAbove: 'Insert Row Above',
      insertBelow: 'Insert Row Below',
      insertLeft: 'Insert Column Left',
      insertRight: 'Insert Column Right',
      deleteRows: 'Delete Row 4',
      deleteCols: 'Delete Column B',
      hideRows: 'Hide Row 4',
      hideCols: 'Hide Column B',
    });
  });

  it('counts a range and names its spans', () => {
    expect(cellMenuLabels({ r1: 1, c1: 1, r2: 3, c2: 2 })).toEqual({
      title: 'B2:C4',
      count: '6 Cells',
      insertAbove: 'Insert 3 Rows Above',
      insertBelow: 'Insert 3 Rows Below',
      insertLeft: 'Insert 2 Columns Left',
      insertRight: 'Insert 2 Columns Right',
      deleteRows: 'Delete Rows 2 to 4',
      deleteCols: 'Delete Columns B to C',
      hideRows: 'Hide Rows 2 to 4',
      hideCols: 'Hide Columns B to C',
    });
  });

  it('groups the thousands of a large selection, and names columns past Z', () => {
    const all = cellMenuLabels({ r1: 0, c1: 0, r2: 9999, c2: 27 });
    expect(all.count).toBe('280,000 Cells');
    expect(all.deleteCols).toBe('Delete Columns A to AB');
  });
});
