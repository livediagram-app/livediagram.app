import { useEffect, useRef, useState } from 'react';
import {
  addTableColumn,
  addTableRow,
  BORDER_STROKE_PX,
  defaultStrokeColor,
  defaultTextColor,
  PADDING_PX,
  clearCellStyle,
  moveTableColumn,
  moveTableRow,
  pasteIntoTable,
  removeTableColumn,
  removeTableRow,
  setCellStyle,
  setTableCell,
  type TableCellStyle,
  type TableElement,
} from '@livediagram/diagram';
import { isMobileViewportSync } from '@/lib/responsive';
import { track } from '@/lib/telemetry';

// Cell font size per preset (element-space px; the canvas zoom scales
// it like everything else). 'scale' has no per-element basis on a grid,
// so it reads as the medium size.
const CELL_FONT_PX: Record<string, number> = { sm: 11, md: 13, lg: 16, scale: 13 };

const MIN_COL_PX = 30;
const MIN_ROW_PX = 24;

// Build a CSS grid-template track list: an explicit `Npx` for each pinned
// size, `minmax(0, 1fr)` for the rest, so unpinned tracks share the
// remaining space evenly. A missing or short `sizes` array leaves every
// unspecified track flexible. Used for both the column and row templates.
export function gridTrackTemplate(count: number, sizes?: (number | null)[]): string {
  return Array.from({ length: count }, (_, i) => {
    const s = sizes?.[i];
    return s != null ? `${s}px` : 'minmax(0, 1fr)';
  }).join(' ');
}

function ArrowIcon({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) {
  const d = {
    left: 'M11 7H3M3 7l3-3M3 7l3 3',
    right: 'M3 7h8M11 7l-3-3M11 7l-3 3',
    up: 'M7 11V3M7 3l3 3M7 3l-3 3',
    down: 'M7 3v8M7 11l-3-3M7 11l3-3',
  }[dir];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
      <path
        d="M1.5 3l2.5 2.5L6.5 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlignIcon({ dir }: { dir: 'left' | 'center' | 'right' }) {
  const lines =
    dir === 'left'
      ? ['M2 4h10', 'M2 7h6', 'M2 10h8']
      : dir === 'right'
        ? ['M2 4h10', 'M6 7h6', 'M4 10h8']
        : ['M2 4h10', 'M4 7h6', 'M3 10h8'];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      {lines.map((d, i) => (
        <path key={i} d={d} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 4h8M5.5 4V2.8h3V4M4 4l.4 7.2h5.2L10 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Small "⋯" trigger that sits inside the table's top / left edge. Tapping
// it opens the column / row menu. Kept compact but with a 24px+ hit area
// (the padding) so it stays tappable on touch.
function Trigger({
  open,
  vertical,
  onClick,
}: {
  open: boolean;
  vertical?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-table-ui
      aria-label={vertical ? 'Row options' : 'Column options'}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`pointer-events-auto flex items-center justify-center rounded-full border border-slate-200 shadow-sm transition dark:border-slate-700 ${
        open ? 'bg-brand-500 text-white' : 'bg-white text-brand-600 dark:bg-slate-800'
      } ${vertical ? 'h-7 w-5' : 'h-5 w-7'}`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
        {vertical ? (
          <>
            <circle cx="7" cy="3.5" r="1.1" />
            <circle cx="7" cy="7" r="1.1" />
            <circle cx="7" cy="10.5" r="1.1" />
          </>
        ) : (
          <>
            <circle cx="3.5" cy="7" r="1.1" />
            <circle cx="7" cy="7" r="1.1" />
            <circle cx="10.5" cy="7" r="1.1" />
          </>
        )}
      </svg>
    </button>
  );
}

// Large, tappable menu row (icon + label). Min height 36px for touch.
function MenuButton({
  label,
  danger,
  disabled,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-9 w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950'
          : 'text-slate-700 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-slate-700'
      }`}
    >
      <span className="shrink-0">{children}</span>
      {label}
    </button>
  );
}

// Renders a TableElement as an editable grid filling the element box.
// Double-click a cell to edit; per-column / per-row insert + delete live
// in tap-to-open menus on the top / left edge. Columns can be given an
// explicit width by dragging the divider on their right edge; columns
// without an override share the remaining space as 1fr tracks. Cell
// padding follows the element's padding preset. Local UI state only;
// content + structure persist via onCommitCells / onCommitColWidths.
export function TableView({
  element,
  isSelected,
  readOnly,
  onCommitCells,
  onCommitColWidths,
  onCommitRowHeights,
  onCommitCellStyles,
}: {
  element: TableElement;
  isSelected: boolean;
  readOnly: boolean;
  onCommitCells: (id: string, cells: string[][]) => void;
  onCommitColWidths: (id: string, colWidths: (number | null)[]) => void;
  onCommitRowHeights: (id: string, rowHeights: (number | null)[]) => void;
  onCommitCellStyles: (id: string, cellStyles: (TableCellStyle | null)[][]) => void;
}) {
  const rows = element.cells.length;
  const cols = element.cells[0]?.length ?? 0;
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [menu, setMenu] = useState<{ axis: 'col' | 'row'; index: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [cellMenu, setCellMenu] = useState<'text' | 'colours' | 'align' | null>(null);
  // Live widths while dragging a column divider (committed on release).
  const [resizeWidths, setResizeWidths] = useState<(number | null)[] | null>(null);
  const [resizeHeights, setResizeHeights] = useState<(number | null)[] | null>(null);
  // On desktop the column / row ⋯ trigger only shows while hovering
  // that column / row; on touch (no hover) they stay visible.
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const isMobile = isMobileViewportSync();
  const editorRef = useRef<HTMLDivElement>(null);
  const initialTextRef = useRef('');
  const typeToEditRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<(number | null)[] | null>(null);
  const dragRowRef = useRef<(number | null)[] | null>(null);

  useEffect(() => {
    if (editing && (editing.r >= rows || editing.c >= cols)) setEditing(null);
  }, [editing, rows, cols]);

  useEffect(() => {
    if (!isSelected) {
      setMenu(null);
      setSelectedCell(null);
      setCellMenu(null);
    }
  }, [isSelected]);

  // Close the column / row + cell menus on a click anywhere that
  // isn't a table control (the triggers + menus carry data-table-ui).
  useEffect(() => {
    if (!menu && !cellMenu) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t && t.closest('[data-table-ui]')) return;
      setMenu(null);
      setCellMenu(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menu, cellMenu]);

  useEffect(() => {
    if (!editing) return;
    const el = editorRef.current;
    if (!el) return;
    el.textContent = initialTextRef.current;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    // Type-to-edit seeds the first char and puts the caret at the end;
    // a normal edit selects all so the first keystroke replaces.
    if (typeToEditRef.current) range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    typeToEditRef.current = false;
  }, [editing]);

  // Type-to-edit: with a cell selected (not yet editing), a printable
  // key enters edit mode seeded with that char (like shapes); Backspace
  // / Delete clears the cell; Enter / F2 edit the existing text.
  useEffect(() => {
    if (!selectedCell || editing || readOnly || element.locked) return;
    const { r, c } = selectedCell;
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable))
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        onCommitCells(element.id, setTableCell(element, r, c, '').cells);
      } else if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        initialTextRef.current = element.cells[r]?.[c] ?? '';
        setEditing({ r, c });
      } else if (e.key.length === 1) {
        e.preventDefault();
        initialTextRef.current = e.key;
        typeToEditRef.current = true;
        setEditing({ r, c });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedCell, editing, readOnly, element, onCommitCells]);

  const stroke = element.strokeColor ?? defaultStrokeColor(element);
  const textColor = element.textColor ?? defaultTextColor(element);
  // Grid line width + pattern from the Border accordion (default thin
  // solid). 'none' (0px) hides the grid lines entirely.
  const borderW = BORDER_STROKE_PX[element.strokeWidth ?? 'thin'];
  const gridBorder =
    borderW > 0 ? `${borderW}px ${element.strokeStyle ?? 'solid'} ${stroke}` : undefined;
  // 'scale' fits the text to the table: font tracks the row height so
  // it grows / shrinks as the table is resized. Fixed presets use a
  // constant px.
  const rowH = rows > 0 ? element.height / rows : element.height;
  const fontPx =
    element.textSize === 'scale'
      ? Math.max(9, Math.min(40, Math.round(rowH * 0.4)))
      : (CELL_FONT_PX[element.textSize ?? 'md'] ?? 13);
  const cellPad = PADDING_PX[element.padding ?? 'sm'];
  const headerFill = element.headerFill ?? `${stroke}22`;
  const headerTextColor = element.headerTextColor ?? textColor;
  const alignX = element.textAlignX ?? 'center';
  const alignY = element.textAlignY ?? 'middle';
  const alignItems = alignY === 'top' ? 'flex-start' : alignY === 'bottom' ? 'flex-end' : 'center';

  // Explicit px for overridden columns, 1fr for the rest (they share the
  // remaining width).
  const colTemplate = gridTrackTemplate(cols, resizeWidths ?? element.colWidths);
  const rowTemplate = gridTrackTemplate(rows, resizeHeights ?? element.rowHeights);

  const beginEdit = (r: number, c: number) => {
    if (readOnly || element.locked) return;
    initialTextRef.current = element.cells[r]?.[c] ?? '';
    setSelectedCell(null);
    setEditing({ r, c });
  };

  const commitCell = (r: number, c: number, text: string) => {
    onCommitCells(element.id, setTableCell(element, r, c, text).cells);
  };

  // Commit the current cell and jump to (nr, nc), seeding its text.
  const moveTo = (fromR: number, fromC: number, nr: number, nc: number) => {
    commitCell(fromR, fromC, editorRef.current?.textContent ?? '');
    initialTextRef.current = element.cells[nr]?.[nc] ?? '';
    setEditing({ r: nr, c: nc });
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

  const applyCellStyle = (r: number, c: number, patch: Partial<TableCellStyle>) => {
    track('Element', 'Changed', 'TableCell');
    onCommitCellStyles(element.id, setCellStyle(element, r, c, patch).cellStyles ?? []);
  };

  const moveCol = (from: number, to: number) => {
    track('Element', 'Reordered', 'TableColumn');
    const m = moveTableColumn(element, from, to);
    onCommitCells(element.id, m.cells);
    if (m.colWidths) onCommitColWidths(element.id, m.colWidths);
    if (m.cellStyles) onCommitCellStyles(element.id, m.cellStyles);
    setMenu(null);
  };
  const moveRow = (from: number, to: number) => {
    track('Element', 'Reordered', 'TableRow');
    const m = moveTableRow(element, from, to);
    onCommitCells(element.id, m.cells);
    if (m.rowHeights) onCommitRowHeights(element.id, m.rowHeights);
    if (m.cellStyles) onCommitCellStyles(element.id, m.cellStyles);
    setMenu(null);
  };

  const apply = (next: { cells: string[][] }) => {
    onCommitCells(element.id, next.cells);
    setMenu(null);
  };
  const showControls = isSelected && !readOnly && !element.locked;
  const toggle = (axis: 'col' | 'row', index: number) =>
    setMenu((m) => (m && m.axis === axis && m.index === index ? null : { axis, index }));

  // Drag the right divider of column c to pin its width; other columns
  // stay auto and reflow. Reads the live track sizes + the rendered-to-
  // element scale (zoom) off the grid so it works at any zoom.
  const startColResize = (c: number) => (e: React.PointerEvent) => {
    if (!showControls) return;
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const scale = element.width > 0 ? rect.width / element.width : 1;
    const tracks = getComputedStyle(grid)
      .gridTemplateColumns.split(' ')
      .map((t) => parseFloat(t));
    const base: (number | null)[] = Array.from(
      { length: cols },
      (_, i) => element.colWidths?.[i] ?? null,
    );
    const startWidthElem = (tracks[c] ?? rect.width / cols) / scale;
    const startX = e.clientX;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const next = [...base];
      next[c] = Math.max(MIN_COL_PX, Math.round(startWidthElem + dx));
      dragRef.current = next;
      setResizeWidths(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (dragRef.current) onCommitColWidths(element.id, dragRef.current);
      dragRef.current = null;
      setResizeWidths(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startRowResize = (r: number) => (e: React.PointerEvent) => {
    if (!showControls) return;
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const scale = element.height > 0 ? rect.height / element.height : 1;
    const tracks = getComputedStyle(grid)
      .gridTemplateRows.split(' ')
      .map((t) => parseFloat(t));
    const base: (number | null)[] = Array.from(
      { length: rows },
      (_, i) => element.rowHeights?.[i] ?? null,
    );
    const startHeightElem = (tracks[r] ?? rect.height / rows) / scale;
    const startY = e.clientY;
    const onMove = (ev: PointerEvent) => {
      const dy = (ev.clientY - startY) / scale;
      const next = [...base];
      next[r] = Math.max(MIN_ROW_PX, Math.round(startHeightElem + dy));
      dragRowRef.current = next;
      setResizeHeights(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (dragRowRef.current) onCommitRowHeights(element.id, dragRowRef.current);
      dragRowRef.current = null;
      setResizeHeights(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <>
      <div
        ref={gridRef}
        onMouseLeave={() => {
          setHoveredCol(null);
          setHoveredRow(null);
        }}
        role="table"
        aria-label={`Table, ${rows} rows by ${cols} columns`}
        aria-rowcount={rows}
        aria-colcount={cols}
        className="absolute inset-0 grid overflow-hidden"
        style={{
          gridTemplateColumns: colTemplate,
          gridTemplateRows: rowTemplate,
          border: gridBorder,
          color: textColor,
        }}
      >
        {element.cells.map((row, r) => (
          // display:contents keeps the row out of the CSS grid layout
          // while still exposing the table > row > cell ARIA structure.
          <div key={`tr-${r}`} role="row" style={{ display: 'contents' }} aria-rowindex={r + 1}>
            {row.map((cell, c) => {
              const isHeader = (element.headerRow && r === 0) || (element.headerColumn && c === 0);
              const bodyRow = element.headerRow ? r - 1 : r;
              const zebraBg =
                element.zebra && !isHeader && bodyRow >= 0 && bodyRow % 2 === 1
                  ? `${stroke}11`
                  : null;
              const cs = element.cellStyles?.[r]?.[c] ?? null;
              const isSelCell = selectedCell?.r === r && selectedCell?.c === c;
              const cellAlignX = cs?.alignX ?? alignX;
              const cellJustify =
                cellAlignX === 'left'
                  ? 'flex-start'
                  : cellAlignX === 'right'
                    ? 'flex-end'
                    : 'center';
              const cellFontPx = cs?.textSize
                ? cs.textSize === 'scale'
                  ? Math.max(9, Math.min(40, Math.round(rowH * 0.4)))
                  : (CELL_FONT_PX[cs.textSize] ?? fontPx)
                : fontPx;
              const isEditingCell = editing?.r === r && editing?.c === c;
              return (
                <div
                  key={`${r}-${c}`}
                  role={
                    isHeader
                      ? element.headerRow && r === 0
                        ? 'columnheader'
                        : 'rowheader'
                      : 'cell'
                  }
                  aria-colindex={c + 1}
                  onMouseEnter={() => {
                    setHoveredCol(c);
                    setHoveredRow(r);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    beginEdit(r, c);
                  }}
                  onClick={(e) => {
                    if (showControls && !isEditingCell) {
                      e.stopPropagation();
                      setSelectedCell({ r, c });
                      setCellMenu(null);
                    }
                  }}
                  className="min-w-0 overflow-hidden"
                  style={{
                    padding: cellPad,
                    borderRight: c < cols - 1 ? gridBorder : undefined,
                    borderBottom: r < rows - 1 ? gridBorder : undefined,
                    backgroundColor:
                      cs?.bg ??
                      (isHeader ? headerFill : (zebraBg ?? element.fillColor ?? 'transparent')),
                    display: 'flex',
                    justifyContent: cellJustify,
                    alignItems,
                    color: cs?.textColor ?? (isHeader ? headerTextColor : undefined),
                    outline: isSelCell ? '2px solid rgb(14 165 233)' : undefined,
                    outlineOffset: isSelCell ? '-2px' : undefined,
                    fontSize: cellFontPx,
                    fontWeight:
                      (cs?.bold ?? (isHeader || element.textBold)) ? (isHeader ? 700 : 600) : 400,
                    fontStyle: (cs?.italic ?? element.textItalic) ? 'italic' : undefined,
                    textDecoration:
                      [
                        (cs?.underline ?? element.textUnderline) && 'underline',
                        element.textStrikethrough && 'line-through',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined,
                    lineHeight: 1.2,
                  }}
                >
                  {isEditingCell ? (
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
                        const grid = text
                          .replace(/\r/g, '')
                          .split('\n')
                          .map((line) => line.split('\t'));
                        while (
                          grid.length > 1 &&
                          grid[grid.length - 1]!.length === 1 &&
                          grid[grid.length - 1]![0] === ''
                        ) {
                          grid.pop();
                        }
                        const tabular = grid.length > 1 || (grid[0]?.length ?? 0) > 1;
                        e.preventDefault();
                        if (tabular) {
                          // Spreadsheet / TSV paste fills + grows the grid.
                          onCommitCells(element.id, pasteIntoTable(element, r, c, grid).cells);
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
                          if (flat >= 0 && flat < rows * cols)
                            moveTo(r, c, Math.floor(flat / cols), flat % cols);
                          else {
                            commitCell(r, c, editorRef.current?.textContent ?? '');
                            setEditing(null);
                          }
                          return;
                        }
                        const info = caretInfo();
                        if (
                          e.key === 'ArrowDown' &&
                          info.collapsed &&
                          info.lastLine &&
                          r < rows - 1
                        ) {
                          e.preventDefault();
                          moveTo(r, c, r + 1, c);
                        } else if (
                          e.key === 'ArrowUp' &&
                          info.collapsed &&
                          info.firstLine &&
                          r > 0
                        ) {
                          e.preventDefault();
                          moveTo(r, c, r - 1, c);
                        } else if (
                          e.key === 'ArrowRight' &&
                          info.collapsed &&
                          info.atEnd &&
                          c < cols - 1
                        ) {
                          e.preventDefault();
                          moveTo(r, c, r, c + 1);
                        } else if (
                          e.key === 'ArrowLeft' &&
                          info.collapsed &&
                          info.atStart &&
                          c > 0
                        ) {
                          e.preventDefault();
                          moveTo(r, c, r, c - 1);
                        }
                      }}
                      // A contentEditable flex child (not a full-bleed
                      // textarea) so the cell's justify / align centre the
                      // text on BOTH axes and it inherits the cell font —
                      // editing looks identical to the static cell.
                      className="max-w-full whitespace-pre-wrap break-words outline-none"
                      style={{ textAlign: cellAlignX, minWidth: '1ch' }}
                    />
                  ) : (
                    <span className="whitespace-pre-wrap break-words">{cell}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Control layer: a non-clipped sibling so menus can spill past the
          box. Triggers live inside the top / left edge; column-resize
          dividers ride a grid that mirrors the table's column template so
          they sit exactly on each column boundary. */}
      {showControls ? (
        <div className="pointer-events-none absolute inset-0">
          {/* Column-resize dividers (between columns). */}
          <div
            className="pointer-events-none absolute inset-0 grid"
            style={{ gridTemplateColumns: colTemplate }}
          >
            {Array.from({ length: cols }, (_, c) => (
              <div key={`rz-${c}`} className="relative">
                {c < cols - 1 ? (
                  <div
                    onPointerDown={startColResize(c)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onCommitColWidths(
                        element.id,
                        Array.from({ length: cols }, (_, i) =>
                          i === c ? null : (element.colWidths?.[i] ?? null),
                        ),
                      );
                    }}
                    title="Drag to set width · double-click to auto-fit"
                    className="group pointer-events-auto absolute -right-1 bottom-0 top-0 z-20 w-2 cursor-col-resize"
                  >
                    <div className="mx-auto h-full w-0.5 bg-brand-400/0 transition group-hover:bg-brand-400" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* Row-resize dividers (between rows). */}
          <div
            className="pointer-events-none absolute inset-0 grid"
            style={{ gridTemplateRows: rowTemplate }}
          >
            {Array.from({ length: rows }, (_, r) => (
              <div key={`rzr-${r}`} className="relative">
                {r < rows - 1 ? (
                  <div
                    onPointerDown={startRowResize(r)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onCommitRowHeights(
                        element.id,
                        Array.from({ length: rows }, (_, i) =>
                          i === r ? null : (element.rowHeights?.[i] ?? null),
                        ),
                      );
                    }}
                    title="Drag to set height · double-click to auto-fit"
                    className="group pointer-events-auto absolute -bottom-1 left-0 right-0 z-20 h-2 cursor-row-resize"
                  >
                    <div className="my-auto h-0.5 w-full bg-brand-400/0 transition group-hover:bg-brand-400" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* Column triggers laid out on a grid mirroring the column
              template so each stays centred over its column at any width
              (including while a column is being resized). */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0.5 grid"
            style={{ gridTemplateColumns: colTemplate }}
          >
            {Array.from({ length: cols }, (_, c) => {
              const colOn =
                isMobile || hoveredCol === c || (menu?.axis === 'col' && menu.index === c);
              return (
                <div key={`col-${c}`} className="flex min-w-0 justify-center">
                  {colOn ? (
                    <div
                      className="pointer-events-auto relative"
                      onMouseEnter={() => setHoveredCol(c)}
                      onMouseLeave={() => setHoveredCol(null)}
                    >
                      <Trigger
                        open={menu?.axis === 'col' && menu.index === c}
                        onClick={() => toggle('col', c)}
                      />
                      {menu?.axis === 'col' && menu.index === c ? (
                        <div
                          data-table-ui
                          className="pointer-events-auto absolute left-1/2 top-7 z-30 w-36 -translate-x-1/2 animate-pop-in rounded-lg border border-slate-200 bg-white/90 backdrop-blur-sm p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800/90"
                        >
                          <MenuButton
                            label="Insert left"
                            onClick={() => apply(addTableColumn(element, c))}
                          >
                            <ArrowIcon dir="left" />
                          </MenuButton>
                          <MenuButton
                            label="Insert right"
                            onClick={() => apply(addTableColumn(element, c + 1))}
                          >
                            <ArrowIcon dir="right" />
                          </MenuButton>
                          <MenuButton
                            label="Move left"
                            disabled={c === 0}
                            onClick={() => moveCol(c, c - 1)}
                          >
                            <ArrowIcon dir="left" />
                          </MenuButton>
                          <MenuButton
                            label="Move right"
                            disabled={c === cols - 1}
                            onClick={() => moveCol(c, c + 1)}
                          >
                            <ArrowIcon dir="right" />
                          </MenuButton>
                          <MenuButton
                            label="Delete column"
                            danger
                            disabled={cols <= 1}
                            onClick={() => apply(removeTableColumn(element, c))}
                          >
                            <TrashIcon />
                          </MenuButton>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Row triggers along the left edge of the grid. */}
          {Array.from({ length: rows }, (_, r) => {
            const rowOn =
              isMobile || hoveredRow === r || (menu?.axis === 'row' && menu.index === r);
            if (!rowOn) return null;
            return (
              <div
                key={`row-${r}`}
                className="pointer-events-auto absolute left-0.5 -translate-y-1/2"
                style={{ top: `${((r + 0.5) / rows) * 100}%` }}
                onMouseEnter={() => setHoveredRow(r)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <Trigger
                  vertical
                  open={menu?.axis === 'row' && menu.index === r}
                  onClick={() => toggle('row', r)}
                />
                {menu?.axis === 'row' && menu.index === r ? (
                  <div
                    data-table-ui
                    className="pointer-events-auto absolute left-7 top-1/2 z-30 w-36 -translate-y-1/2 animate-pop-in rounded-lg border border-slate-200 bg-white/90 backdrop-blur-sm p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800/90"
                  >
                    <MenuButton label="Insert above" onClick={() => apply(addTableRow(element, r))}>
                      <ArrowIcon dir="up" />
                    </MenuButton>
                    <MenuButton
                      label="Insert below"
                      onClick={() => apply(addTableRow(element, r + 1))}
                    >
                      <ArrowIcon dir="down" />
                    </MenuButton>
                    <MenuButton
                      label="Move up"
                      disabled={r === 0}
                      onClick={() => moveRow(r, r - 1)}
                    >
                      <ArrowIcon dir="up" />
                    </MenuButton>
                    <MenuButton
                      label="Move down"
                      disabled={r === rows - 1}
                      onClick={() => moveRow(r, r + 1)}
                    >
                      <ArrowIcon dir="down" />
                    </MenuButton>
                    <MenuButton
                      label="Delete row"
                      danger
                      disabled={rows <= 1}
                      onClick={() => apply(removeTableRow(element, r))}
                    >
                      <TrashIcon />
                    </MenuButton>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {showControls && selectedCell && !editing ? (
        <div
          className="pointer-events-none absolute inset-0 grid"
          style={{ gridTemplateColumns: colTemplate, gridTemplateRows: rowTemplate }}
        >
          <div
            className="relative"
            style={{ gridColumn: selectedCell.c + 1, gridRow: selectedCell.r + 1 }}
          >
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto absolute left-1/2 top-0 z-40 flex -translate-x-1/2 -translate-y-[calc(100%+4px)] items-center animate-pop-in rounded-lg border border-slate-200 bg-white/90 backdrop-blur-sm p-0.5 shadow-lg dark:border-slate-700 dark:bg-slate-800/90"
            >
              {(() => {
                const sc = element.cellStyles?.[selectedCell.r]?.[selectedCell.c] ?? null;
                const rr = selectedCell.r;
                const cc = selectedCell.c;
                const isHeaderSel =
                  (element.headerRow && rr === 0) || (element.headerColumn && cc === 0);
                const sep = <div className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />;
                const secCls = (active: boolean) =>
                  `flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
                    active
                      ? 'bg-brand-500 text-white'
                      : 'text-slate-600 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`;
                const tog = (on: boolean) =>
                  `flex h-7 w-7 items-center justify-center rounded text-sm ${
                    on
                      ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/30 dark:text-brand-200'
                      : 'text-slate-600 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`;
                const panel =
                  'absolute left-0 top-full z-50 mt-1 animate-pop-in rounded-lg border border-slate-200 bg-white/90 backdrop-blur-sm p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-800/90';
                return (
                  <>
                    {/* Text */}
                    <div className="relative">
                      <button
                        type="button"
                        title="Text formatting"
                        className={secCls(cellMenu === 'text')}
                        onClick={() => setCellMenu((m) => (m === 'text' ? null : 'text'))}
                      >
                        Text <Chevron />
                      </button>
                      {cellMenu === 'text' ? (
                        <div className={`${panel} w-44`}>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              title="Bold"
                              className={tog(
                                sc?.bold ?? (isHeaderSel || (element.textBold ?? false)),
                              )}
                              onClick={() =>
                                applyCellStyle(rr, cc, {
                                  bold: !(sc?.bold ?? (isHeaderSel || element.textBold)),
                                })
                              }
                            >
                              <span className="font-bold">B</span>
                            </button>
                            <button
                              type="button"
                              title="Italic"
                              className={tog(sc?.italic ?? element.textItalic ?? false)}
                              onClick={() =>
                                applyCellStyle(rr, cc, {
                                  italic: !(sc?.italic ?? element.textItalic),
                                })
                              }
                            >
                              <span className="italic">I</span>
                            </button>
                            <button
                              type="button"
                              title="Underline"
                              className={tog(sc?.underline ?? element.textUnderline ?? false)}
                              onClick={() =>
                                applyCellStyle(rr, cc, {
                                  underline: !(sc?.underline ?? element.textUnderline),
                                })
                              }
                            >
                              <span className="underline">U</span>
                            </button>
                          </div>
                          <div className="mt-1.5 grid grid-cols-4 gap-1">
                            {(['sm', 'md', 'lg', 'scale'] as const).map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                title={sz === 'scale' ? 'Scale to fit' : `Size ${sz}`}
                                className={tog((sc?.textSize ?? element.textSize ?? 'md') === sz)}
                                onClick={() => applyCellStyle(rr, cc, { textSize: sz })}
                              >
                                <span style={{ fontSize: sz === 'sm' ? 9 : sz === 'lg' ? 15 : 12 }}>
                                  {sz === 'scale' ? '\u2195' : 'A'}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {sep}
                    {/* Colours */}
                    <div className="relative">
                      <button
                        type="button"
                        title="Cell colours"
                        className={secCls(cellMenu === 'colours')}
                        onClick={() => setCellMenu((m) => (m === 'colours' ? null : 'colours'))}
                      >
                        Colours <Chevron />
                      </button>
                      {cellMenu === 'colours' ? (
                        <div className={`${panel} w-40`}>
                          <label className="flex items-center justify-between gap-2 rounded px-1 py-1 text-[11px] text-slate-600 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-slate-700">
                            Background
                            <span
                              className="relative h-5 w-5 overflow-hidden rounded border border-slate-300"
                              style={{ backgroundColor: sc?.bg ?? '#ffffff' }}
                            >
                              <input
                                type="color"
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                value={sc?.bg ?? '#ffffff'}
                                onChange={(e) => applyCellStyle(rr, cc, { bg: e.target.value })}
                              />
                            </span>
                          </label>
                          <label className="flex items-center justify-between gap-2 rounded px-1 py-1 text-[11px] text-slate-600 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-slate-700">
                            Text
                            <span
                              className="relative h-5 w-5 overflow-hidden rounded border border-slate-300"
                              style={{ backgroundColor: sc?.textColor ?? textColor }}
                            >
                              <input
                                type="color"
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                value={sc?.textColor ?? textColor}
                                onChange={(e) =>
                                  applyCellStyle(rr, cc, { textColor: e.target.value })
                                }
                              />
                            </span>
                          </label>
                        </div>
                      ) : null}
                    </div>
                    {sep}
                    {/* Alignment */}
                    <div className="relative">
                      <button
                        type="button"
                        title="Text alignment"
                        className={secCls(cellMenu === 'align')}
                        onClick={() => setCellMenu((m) => (m === 'align' ? null : 'align'))}
                      >
                        Align <Chevron />
                      </button>
                      {cellMenu === 'align' ? (
                        <div className={`${panel} flex gap-1`}>
                          {(['left', 'center', 'right'] as const).map((al) => (
                            <button
                              key={al}
                              type="button"
                              title={`Align ${al}`}
                              className={tog((sc?.alignX ?? element.textAlignX ?? 'center') === al)}
                              onClick={() => applyCellStyle(rr, cc, { alignX: al })}
                            >
                              <AlignIcon dir={al} />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {sep}
                    <button
                      type="button"
                      title="Clear cell (text + formatting)"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCommitCells(element.id, setTableCell(element, rr, cc, '').cells);
                        onCommitCellStyles(
                          element.id,
                          clearCellStyle(element, rr, cc).cellStyles ?? [],
                        );
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950"
                    >
                      <TrashIcon />
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
