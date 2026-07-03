import type { RefObject } from 'react';
import {
  isTabularClipboard,
  parseClipboardTableText,
  pasteIntoTable,
  type TableElement,
} from '@livediagram/diagram';

// The in-cell contentEditable editor (spec/09 Table), lifted out of
// TableView's cell render: the spreadsheet-style keyboard layer (Enter
// commits + moves down, Tab walks the grid and grows it off the last
// cell, caret-aware arrow navigation), the tabular-clipboard paste that
// fills + grows the grid, and the blur commit. TableView owns the
// editing state and the commit / move helpers (useTableEditing); this
// component just wires them to the editable node.
export function TableCellEditor({
  editorRef,
  element,
  r,
  c,
  rows,
  cols,
  alignX,
  onCommitTable,
  commitCell,
  commitAndAppendRow,
  moveTo,
  caretInfo,
  setEditing,
}: {
  editorRef: RefObject<HTMLDivElement | null>;
  element: TableElement;
  r: number;
  c: number;
  rows: number;
  cols: number;
  // The cell's resolved horizontal alignment, so the editing text sits
  // exactly where the static cell renders it.
  alignX: 'left' | 'center' | 'right';
  onCommitTable: (id: string, patch: Partial<Pick<TableElement, 'cells'>>) => void;
  commitCell: (r: number, c: number, text: string) => void;
  commitAndAppendRow: (r: number, c: number, text: string) => void;
  moveTo: (fromR: number, fromC: number, toR: number, toC: number) => void;
  // Where the caret sits in the editor, for arrow-key cell navigation
  // (so arrows only move cells when they wouldn't fight the text caret).
  caretInfo: () => {
    collapsed: boolean;
    atStart: boolean;
    atEnd: boolean;
    firstLine: boolean;
    lastLine: boolean;
  };
  setEditing: (next: { r: number; c: number } | null) => void;
}) {
  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      onPointerDown={(e) => e.stopPropagation()}
      onPaste={(e) => {
        const text = e.clipboardData.getData('text/plain');
        if (!text) return;
        const grid = parseClipboardTableText(text);
        e.preventDefault();
        if (isTabularClipboard(grid)) {
          // Spreadsheet / TSV paste fills + grows the grid.
          onCommitTable(element.id, {
            cells: pasteIntoTable(element, r, c, grid).cells,
          });
          setEditing(null);
        } else {
          // Single value: insert as PLAIN text (strip any
          // pasted rich formatting).
          document.execCommand('insertText', false, grid[0]?.[0] ?? '');
        }
      }}
      onBlur={() => {
        commitCell(r, c, editorRef.current?.textContent ?? '');
        setEditing(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          setEditing(null);
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          // Enter commits + moves DOWN (spreadsheet style);
          // Shift+Enter inserts a newline.
          e.preventDefault();
          if (r < rows - 1) moveTo(r, c, r + 1, c);
          else {
            commitCell(r, c, editorRef.current?.textContent ?? '');
            setEditing(null);
          }
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          const flat = r * cols + c + (e.shiftKey ? -1 : 1);
          if (flat >= 0 && flat < rows * cols) moveTo(r, c, Math.floor(flat / cols), flat % cols);
          else if (!e.shiftKey) {
            // Tab off the last cell appends a row and keeps
            // typing (Word / Docs convention).
            commitAndAppendRow(r, c, editorRef.current?.textContent ?? '');
          } else {
            commitCell(r, c, editorRef.current?.textContent ?? '');
            setEditing(null);
          }
          return;
        }
        const info = caretInfo();
        if (e.key === 'ArrowDown' && info.collapsed && info.lastLine && r < rows - 1) {
          e.preventDefault();
          moveTo(r, c, r + 1, c);
        } else if (e.key === 'ArrowUp' && info.collapsed && info.firstLine && r > 0) {
          e.preventDefault();
          moveTo(r, c, r - 1, c);
        } else if (e.key === 'ArrowRight' && info.collapsed && info.atEnd && c < cols - 1) {
          e.preventDefault();
          moveTo(r, c, r, c + 1);
        } else if (e.key === 'ArrowLeft' && info.collapsed && info.atStart && c > 0) {
          e.preventDefault();
          moveTo(r, c, r, c - 1);
        }
      }}
      // A contentEditable flex child (not a full-bleed
      // textarea) so the cell's justify / align centre the
      // text on BOTH axes and it inherits the cell font —
      // editing looks identical to the static cell.
      className="max-w-full whitespace-pre-wrap break-words outline-none"
      style={{ textAlign: alignX, minWidth: '1ch' }}
    />
  );
}
