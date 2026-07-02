import type { Dispatch, RefObject, SetStateAction } from 'react';
import { addTableRow, setTableCell, type TableElement } from '@livediagram/diagram';

type Cell = { r: number; c: number } | null;

type TableEditingDeps = {
  element: TableElement;
  readOnly: boolean;
  onCommitTable: (
    id: string,
    patch: Partial<Pick<TableElement, 'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'>>,
  ) => void;
  editorRef: RefObject<HTMLDivElement | null>;
  initialTextRef: RefObject<string>;
  setEditing: Dispatch<SetStateAction<Cell>>;
  setSelectedCell: Dispatch<SetStateAction<Cell>>;
};

// The cell text-editing handlers: entering edit mode (seeding the editor with
// the cell's current text), committing on blur, jumping to a neighbouring cell
// on Tab / Enter, and reading the caret position so arrow keys only move cells
// when they wouldn't fight the text caret. Split out of TableView.
export function useTableEditing({
  element,
  readOnly,
  onCommitTable,
  editorRef,
  initialTextRef,
  setEditing,
  setSelectedCell,
}: TableEditingDeps) {
  const beginEdit = (r: number, c: number) => {
    if (readOnly || element.locked) return;
    initialTextRef.current = element.cells[r]?.[c] ?? '';
    setSelectedCell(null);
    setEditing({ r, c });
  };

  const commitCell = (r: number, c: number, text: string) => {
    onCommitTable(element.id, { cells: setTableCell(element, r, c, text).cells });
  };

  // Commit the current cell and jump to (nr, nc), seeding its text.
  const moveTo = (fromR: number, fromC: number, nr: number, nc: number) => {
    commitCell(fromR, fromC, editorRef.current?.textContent ?? '');
    initialTextRef.current = element.cells[nr]?.[nc] ?? '';
    setEditing({ r: nr, c: nc });
  };

  // Tab in the LAST cell (Word / Docs convention): commit the text AND
  // append a fresh row in ONE patch (two commits off the same stale base
  // would drop one of them), then drop into the new row's first cell.
  const commitAndAppendRow = (r: number, c: number, text: string) => {
    const withText = { ...element, ...setTableCell(element, r, c, text) };
    const appended = addTableRow(withText, withText.cells.length);
    onCommitTable(element.id, {
      cells: appended.cells,
      ...(appended.rowHeights ? { rowHeights: appended.rowHeights } : {}),
      ...(appended.cellStyles ? { cellStyles: appended.cellStyles } : {}),
    });
    initialTextRef.current = '';
    setEditing({ r: r + 1, c: 0 });
  };

  // Where the caret sits in the editor, for arrow-key cell navigation
  // (so arrows only move cells when they wouldn't fight the text caret).
  const caretInfo = () => {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0)
      return { collapsed: true, atStart: true, atEnd: true, firstLine: true, lastLine: true };
    const range = sel.getRangeAt(0);
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.endContainer, range.endOffset);
    const offset = pre.toString().length;
    const text = el.textContent ?? '';
    return {
      collapsed: sel.isCollapsed,
      atStart: offset === 0,
      atEnd: offset === text.length,
      firstLine: !text.slice(0, offset).includes('\n'),
      lastLine: !text.slice(offset).includes('\n'),
    };
  };

  return { beginEdit, commitCell, commitAndAppendRow, moveTo, caretInfo };
}
