import { useEffect, type MutableRefObject } from 'react';
import {
  isTabularClipboard,
  parseClipboardTableText,
  pasteIntoTable,
  setTableCell,
  type TableElement,
} from '@livediagram/diagram';

// The selected-cell INPUT layer for TableView (spec/09 Table): the
// spreadsheet-style keyboard handling while a cell is selected but not
// editing (arrows move the selection, Tab walks cells and appends a row
// off the end, Enter / F2 / type-to-edit open the editor, Backspace
// clears every selected cell, Escape peels back to the table selection)
// plus the capture-phase paste that fills the grid from the selected
// cell. Extracted from TableView as one cohesive slice — everything
// about keys / clipboard aimed at the selected cell lives here.
export function useTableCellInput({
  element,
  rows,
  cols,
  selectedCell,
  setSelectedCell,
  setExtraCells,
  editing,
  setEditing,
  suspended,
  readOnly,
  addRow,
  selectionCells,
  onCommitTable,
  initialTextRef,
  typeToEditRef,
}: {
  element: TableElement;
  rows: number;
  cols: number;
  selectedCell: { r: number; c: number } | null;
  setSelectedCell: (cell: { r: number; c: number } | null) => void;
  // Clears the shift-click multi-cell set (navigation collapses it back
  // to the anchor alone).
  setExtraCells: (cells: Set<string>) => void;
  editing: { r: number; c: number } | null;
  setEditing: (cell: { r: number; c: number } | null) => void;
  // True while the cell context menu is open — it owns the keyboard (its
  // own Escape closes it), so this layer stands down.
  suspended: boolean;
  readOnly: boolean;
  addRow: (index: number) => void;
  // Every selected cell (anchor + shift-clicked extras), for the
  // clear-all key.
  selectionCells: () => { r: number; c: number }[];
  onCommitTable: (id: string, patch: Partial<Pick<TableElement, 'cells'>>) => void;
  // Seed text for the cell editor: the current text on Enter / F2, the
  // pressed key on type-to-edit (with typeToEditRef flagged so the editor
  // places the caret after the seed).
  initialTextRef: MutableRefObject<string>;
  typeToEditRef: MutableRefObject<boolean>;
}) {
  // Selected-cell keyboard layer (spreadsheet-style, spec/09). Handled keys
  // stop propagation so the editor's window-level shortcuts can't double-act
  // on the element. Re-registered per render on purpose: the handler closes
  // over the live element / selection.
  useEffect(() => {
    if (!selectedCell || editing || readOnly || element.locked || suspended) return;
    const { r, c } = selectedCell;
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable))
        return;
      const handled = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === 'Tab') {
        handled();
        setExtraCells(new Set());
        const flat = r * cols + c + (e.shiftKey ? -1 : 1);
        if (flat >= rows * cols) {
          // Tab off the end appends a row (Word / Docs convention) and
          // lands on its first cell.
          addRow(rows);
          setSelectedCell({ r: rows, c: 0 });
        } else if (flat >= 0) {
          setSelectedCell({ r: Math.floor(flat / cols), c: flat % cols });
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.startsWith('Arrow')) {
        const nr = r + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0);
        const nc = c + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
        handled();
        setExtraCells(new Set());
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) setSelectedCell({ r: nr, c: nc });
        return;
      }
      if (e.key === 'Escape') {
        // Step out of the cell, keep the table selected — one Escape peels
        // one layer (the canvas ladder then handles the next press).
        handled();
        setSelectedCell(null);
        setExtraCells(new Set());
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        // Clears EVERY selected cell (the anchor + any shift-clicked
        // extras) in one commit.
        handled();
        let work = element;
        for (const cell of selectionCells()) {
          work = { ...work, ...setTableCell(work, cell.r, cell.c, '') };
        }
        onCommitTable(element.id, { cells: work.cells });
      } else if (e.key === 'Enter' || e.key === 'F2') {
        handled();
        setExtraCells(new Set());
        initialTextRef.current = element.cells[r]?.[c] ?? '';
        setEditing({ r, c });
      } else if (e.key.length === 1) {
        handled();
        setExtraCells(new Set());
        initialTextRef.current = e.key;
        typeToEditRef.current = true;
        setEditing({ r, c });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // Paste into the SELECTED cell without entering the editor: spreadsheet /
  // TSV text fills + grows the grid from that cell, a single value replaces
  // the cell's text. Registered in the CAPTURE phase so it wins over the
  // editor's document-level paste (which would drop copied elements /
  // images on the canvas instead).
  useEffect(() => {
    if (!selectedCell || editing || readOnly || element.locked) return;
    const { r, c } = selectedCell;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      )
        return;
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;
      e.preventDefault();
      e.stopPropagation();
      const grid = parseClipboardTableText(text);
      if (isTabularClipboard(grid)) {
        onCommitTable(element.id, { cells: pasteIntoTable(element, r, c, grid).cells });
      } else {
        onCommitTable(element.id, {
          cells: setTableCell(element, r, c, grid[0]?.[0] ?? '').cells,
        });
      }
    };
    document.addEventListener('paste', onPaste, true);
    return () => document.removeEventListener('paste', onPaste, true);
  }, [selectedCell, editing, readOnly, element, onCommitTable]);
}
