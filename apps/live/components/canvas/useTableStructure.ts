import type { Dispatch, SetStateAction } from 'react';
import {
  addTableColumn,
  addTableRow,
  moveTableColumn,
  moveTableRow,
  removeTableColumn,
  removeTableRow,
  setCellStyle,
  type TableCellStyle,
  type TableElement,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

type TableMenu = { axis: 'col' | 'row'; index: number; x: number; y: number } | null;

type TableStructureDeps = {
  element: TableElement;
  onCommitTable: (
    id: string,
    patch: Partial<Pick<TableElement, 'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'>>,
  ) => void;
  setMenu: Dispatch<SetStateAction<TableMenu>>;
};

// The table structure-mutation handlers: per-cell style application plus the
// insert / delete / reorder of columns and rows, each committing the spliced
// cells together with the realigned colWidths / rowHeights / cellStyles so a
// pinned width or coloured cell can't drift onto the wrong track. Split out of
// TableView; takes the element + commit + menu-state setter it shares.
export function useTableStructure({ element, onCommitTable, setMenu }: TableStructureDeps) {
  const applyCellStyle = (r: number, c: number, patch: Partial<TableCellStyle>) => {
    track('Element', 'Changed', 'TableCell');
    onCommitTable(element.id, { cellStyles: setCellStyle(element, r, c, patch).cellStyles ?? [] });
  };

  const moveCol = (from: number, to: number) => {
    track('Element', 'Reordered', 'TableColumn');
    const m = moveTableColumn(element, from, to);
    const patch: Partial<Pick<TableElement, 'cells' | 'colWidths' | 'cellStyles'>> = {
      cells: m.cells,
    };
    if (m.colWidths) patch.colWidths = m.colWidths;
    if (m.cellStyles) patch.cellStyles = m.cellStyles;
    onCommitTable(element.id, patch);
    setMenu(null);
  };
  const moveRow = (from: number, to: number) => {
    track('Element', 'Reordered', 'TableRow');
    const m = moveTableRow(element, from, to);
    const patch: Partial<Pick<TableElement, 'cells' | 'rowHeights' | 'cellStyles'>> = {
      cells: m.cells,
    };
    if (m.rowHeights) patch.rowHeights = m.rowHeights;
    if (m.cellStyles) patch.cellStyles = m.cellStyles;
    onCommitTable(element.id, patch);
    setMenu(null);
  };

  // Insert / delete row or column. The helper returns the spliced `cells`
  // PLUS the realigned colWidths / rowHeights / cellStyles; commit them
  // all together (only including the ones the helper actually produced)
  // so a pinned width or a coloured cell can't drift onto the wrong
  // track after the structural change.
  const apply = (next: {
    cells: string[][];
    colWidths?: (number | null)[];
    rowHeights?: (number | null)[];
    cellStyles?: (TableCellStyle | null)[][];
  }) => {
    const patch: Partial<Pick<TableElement, 'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'>> =
      { cells: next.cells };
    if (next.colWidths) patch.colWidths = next.colWidths;
    if (next.rowHeights) patch.rowHeights = next.rowHeights;
    if (next.cellStyles) patch.cellStyles = next.cellStyles;
    onCommitTable(element.id, patch);
    setMenu(null);
  };

  // Structural add/remove wrappers around `apply` so each emits its own
  // discrete event, mirroring moveCol/moveRow's telemetry. The `at`/index
  // args match the menu call sites (insert before/after a column or row).
  const addCol = (at: number) => {
    track('Element', 'Added', 'TableColumn');
    apply(addTableColumn(element, at));
  };
  const delCol = (c: number) => {
    track('Element', 'Deleted', 'TableColumn');
    apply(removeTableColumn(element, c));
  };
  const addRow = (at: number) => {
    track('Element', 'Added', 'TableRow');
    apply(addTableRow(element, at));
  };
  const delRow = (r: number) => {
    track('Element', 'Deleted', 'TableRow');
    apply(removeTableRow(element, r));
  };

  return { applyCellStyle, moveCol, moveRow, addCol, delCol, addRow, delRow };
}
