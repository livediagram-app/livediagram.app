// The cell menu's words (docs/specs/029-sheets/sheet.md "Cell menu"): each row names what it will do to this
// selection, so nothing has to be guessed ("Insert 3 Rows Above", "Delete Columns B to C"). Pure.
import { columnLetters, formatA1, formatRange, type GridRange } from '@livediagram/sheets';

export type CellMenuLabels = {
  // The header: the selection, and how many cells it covers.
  title: string;
  count: string;
  insertAbove: string;
  insertBelow: string;
  insertLeft: string;
  insertRight: string;
  deleteRows: string;
  deleteCols: string;
  hideRows: string;
  hideCols: string;
};

const many = (n: number, one: string, more: string) => (n === 1 ? one : `${n} ${more}`);

export function cellMenuLabels(g: GridRange): CellMenuLabels {
  const rows = g.r2 - g.r1 + 1;
  const cols = g.c2 - g.c1 + 1;
  const rowSpan = rows === 1 ? `Row ${g.r1 + 1}` : `Rows ${g.r1 + 1} to ${g.r2 + 1}`;
  const colSpan =
    cols === 1
      ? `Column ${columnLetters(g.c1)}`
      : `Columns ${columnLetters(g.c1)} to ${columnLetters(g.c2)}`;
  const cells = rows * cols;
  return {
    title: cells === 1 ? formatA1(g.r1, g.c1) : formatRange(g),
    count: `${cells.toLocaleString('en-GB')} ${cells === 1 ? 'Cell' : 'Cells'}`,
    insertAbove: `Insert ${many(rows, 'Row', 'Rows')} Above`,
    insertBelow: `Insert ${many(rows, 'Row', 'Rows')} Below`,
    insertLeft: `Insert ${many(cols, 'Column', 'Columns')} Left`,
    insertRight: `Insert ${many(cols, 'Column', 'Columns')} Right`,
    deleteRows: `Delete ${rowSpan}`,
    deleteCols: `Delete ${colSpan}`,
    hideRows: `Hide ${rowSpan}`,
    hideCols: `Hide ${colSpan}`,
  };
}
