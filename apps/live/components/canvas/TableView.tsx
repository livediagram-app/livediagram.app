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
  type ElementLink,
  type TableCellStyle,
  type TableElement,
} from '@livediagram/diagram';
import { isMobileViewportSync } from '@/lib/responsive';
import { track } from '@/lib/telemetry';
import { nearestCssBorderStyle } from '@/components/canvas/border-css';
import { Tooltip } from '@/components/primitives/Tooltip';
import {
  AlignIcon,
  ArrowIcon,
  CellLinkIcon,
  Chevron,
  TrashIcon,
} from '@/components/canvas/table-icons';
import { MenuButton, Trigger } from '@/components/canvas/table-menu-controls';
import { describeLink } from '@/lib/link-label';

// Cell font size per preset (element-space px; the canvas zoom scales
// it like everything else). 'scale' has no per-element basis on a grid,
// so it reads as the medium size.
const CELL_FONT_PX: Record<string, number> = { sm: 11, md: 13, lg: 16, scale: 13 };

// 'scale' cell text tracks the row height (≈40%), clamped to a legible range,
// so it grows / shrinks as the table is resized. Shared by the table-wide
// default and the per-cell override so the two can't drift.
const scaleCellFontPx = (rowH: number): number => Math.max(9, Math.min(40, Math.round(rowH * 0.4)));

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

// Renders a TableElement as an editable grid filling the element box.
// Double-click a cell to edit; per-column / per-row insert + delete live
// in tap-to-open menus on the top / left edge. Columns can be given an
// explicit width by dragging the divider on their right edge; columns
// without an override share the remaining space as 1fr tracks. Cell
// padding follows the element's padding preset. Local UI state only;
// content + structure persist via onCommitTable (one combined patch).
export function TableView({
  element,
  isSelected,
  readOnly,
  tabSummaries,
  onCommitTable,
  onLinkCell,
  onFollowLink,
  fontFamily,
  zoom,
}: {
  element: TableElement;
  isSelected: boolean;
  readOnly: boolean;
  // This diagram's tabs (id + name), so a linked cell's tooltip can
  // name the tab/element it points at (spec/09).
  tabSummaries: { id: string; name: string }[];
  // Resolved CSS font-family for the table's text (spec/28). Set on the
  // grid root so every cell + the cell editor inherit it.
  fontFamily?: string;
  // One combined commit for every table field. Structural ops touch
  // `cells` plus the parallel colWidths / rowHeights / cellStyles arrays;
  // committing them together (not as separate commits off a stale base)
  // keeps the side arrays aligned and avoids clobbering.
  onCommitTable: (
    id: string,
    patch: Partial<Pick<TableElement, 'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'>>,
  ) => void;
  // Open the shared link picker for a cell (spec/09). Undefined for
  // read-only viewers (no editing).
  onLinkCell?: (tableId: string, r: number, c: number) => void;
  // Follow a cell's link when its badge is clicked (tab / diagram / url).
  onFollowLink?: (link: ElementLink) => void;
  // Canvas zoom, so the floating UI (per-cell toolbar + column / row header
  // controls) can counter-scale (1/zoom) and stay a fixed on-screen size like
  // every other toolbar, instead of ballooning / shrinking with the table.
  zoom: number;
}) {
  const rows = element.cells.length;
  const cols = element.cells[0]?.length ?? 0;
  // Counter-scale factor so floating chrome stays a fixed on-screen size
  // under canvas zoom (applied with a transform-origin anchored to the edge
  // each control hangs from).
  const invScale = 1 / zoom;
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
    // After a row/column delete a stale selection can point past the
    // grid — the per-cell toolbar would then float over a non-existent
    // CSS track and target an out-of-range cell. Clamp it (which also
    // hides the toolbar) so it can't act on a cell that no longer exists.
    setSelectedCell((s) => (s && (s.r >= rows || s.c >= cols) ? null : s));
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
        onCommitTable(element.id, { cells: setTableCell(element, r, c, '').cells });
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
  }, [selectedCell, editing, readOnly, element, onCommitTable]);

  const stroke = element.strokeColor ?? defaultStrokeColor(element);
  const textColor = element.textColor ?? defaultTextColor(element);
  // Grid line width + pattern from the Border accordion (default thin
  // solid). 'none' (0px) hides the grid lines entirely.
  const borderW = BORDER_STROKE_PX[element.strokeWidth ?? 'thin'];
  // Cell borders are CSS, which can't draw the composite dash patterns,
  // so map to the nearest CSS border-style (long-dash/dash-dot degrade to
  // dashed, dash-dot-dot to dotted) rather than rendering nothing.
  const gridBorder =
    borderW > 0
      ? `${borderW}px ${nearestCssBorderStyle(element.strokeStyle ?? 'solid')} ${stroke}`
      : undefined;
  // 'scale' fits the text to the table: font tracks the row height so
  // it grows / shrinks as the table is resized. Fixed presets use a
  // constant px.
  const rowH = rows > 0 ? element.height / rows : element.height;
  const fontPx =
    element.textSize === 'scale'
      ? scaleCellFontPx(rowH)
      : (CELL_FONT_PX[element.textSize ?? 'md'] ?? 13);
  const cellPad = PADDING_PX[element.padding ?? 'sm'];
  // Default header band: an OPAQUE tint of the grid stroke (the theme
  // accent) over the cell base, so it reads as a solid header that stands
  // out from the body cells rather than the old `${stroke}22` (~13% alpha)
  // translucent wash that let the canvas show through. color-mix keeps it
  // theme-appropriate regardless of the stroke's colour format.
  const headerFill =
    element.headerFill ?? `color-mix(in srgb, ${stroke} 18%, ${element.fillColor ?? '#ffffff'})`;
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
    onCommitTable(element.id, { cells: setTableCell(element, r, c, text).cells });
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
      if (dragRef.current) onCommitTable(element.id, { colWidths: dragRef.current });
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
      if (dragRowRef.current) onCommitTable(element.id, { rowHeights: dragRowRef.current });
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
          fontFamily,
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
                  ? scaleCellFontPx(rowH)
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
                  className="relative min-w-0 overflow-hidden"
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
                  {/* Linked-cell badge: a small link glyph in the corner.
                      Clicking it follows the link (works in view + edit
                      sessions) without selecting / editing the cell. */}
                  {cs?.link && !isEditingCell ? (
                    <Tooltip title="Follow link" description={describeLink(cs.link, tabSummaries)}>
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (cs.link) onFollowLink?.(cs.link);
                        }}
                        aria-label="Follow cell link"
                        className="pointer-events-auto absolute right-0.5 top-0.5 z-[var(--z-panel)] flex h-4 w-4 items-center justify-center rounded text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15"
                      >
                        <CellLinkIcon />
                      </button>
                    </Tooltip>
                  ) : null}
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
        // z-[var(--z-toolbar)] keeps the row / column header controls (and their menus) ABOVE
        // the per-cell toolbar layer (z-[var(--z-panel)] below), so an open insert/delete
        // menu isn't hidden behind the cell toolbar.
        <div className="pointer-events-none absolute inset-0 z-[var(--z-toolbar)]">
          {/* Column-resize dividers (between columns). */}
          <div
            className="pointer-events-none absolute inset-0 grid"
            style={{ gridTemplateColumns: colTemplate }}
          >
            {Array.from({ length: cols }, (_, c) => (
              <div key={`rz-${c}`} className="relative">
                {c < cols - 1 ? (
                  <Tooltip
                    title="Resize column"
                    description="Drag to set a fixed column width, or double-click to auto-fit."
                  >
                    <div
                      onPointerDown={startColResize(c)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onCommitTable(element.id, {
                          colWidths: Array.from({ length: cols }, (_, i) =>
                            i === c ? null : (element.colWidths?.[i] ?? null),
                          ),
                        });
                      }}
                      className="group pointer-events-auto absolute -right-1 bottom-0 top-0 z-[var(--z-toolbar)] w-2 cursor-col-resize"
                    >
                      <div className="mx-auto h-full w-0.5 bg-brand-400/0 transition group-hover:bg-brand-400" />
                    </div>
                  </Tooltip>
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
                  <Tooltip
                    title="Resize row"
                    description="Drag to set a fixed row height, or double-click to auto-fit."
                  >
                    <div
                      onPointerDown={startRowResize(r)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onCommitTable(element.id, {
                          rowHeights: Array.from({ length: rows }, (_, i) =>
                            i === r ? null : (element.rowHeights?.[i] ?? null),
                          ),
                        });
                      }}
                      className="group pointer-events-auto absolute -bottom-1 left-0 right-0 z-[var(--z-toolbar)] h-2 cursor-row-resize"
                    >
                      <div className="my-auto h-0.5 w-full bg-brand-400/0 transition group-hover:bg-brand-400" />
                    </div>
                  </Tooltip>
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
                      style={{ transform: `scale(${invScale})`, transformOrigin: 'top center' }}
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
                          className="pointer-events-auto absolute left-1/2 top-7 z-[var(--z-chrome)] w-36 -translate-x-1/2 animate-pop-in rounded-lg border border-slate-200 bg-white/90 backdrop-blur-sm p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800/90"
                        >
                          <MenuButton label="Insert left" onClick={() => addCol(c)}>
                            <ArrowIcon dir="left" />
                          </MenuButton>
                          <MenuButton label="Insert right" onClick={() => addCol(c + 1)}>
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
                            onClick={() => delCol(c)}
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
                className="pointer-events-auto absolute left-0.5"
                style={{
                  top: `${((r + 0.5) / rows) * 100}%`,
                  transform: `translateY(-50%) scale(${invScale})`,
                  transformOrigin: 'left center',
                }}
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
                    className="pointer-events-auto absolute left-7 top-1/2 z-[var(--z-chrome)] w-36 -translate-y-1/2 animate-pop-in rounded-lg border border-slate-200 bg-white/90 backdrop-blur-sm p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800/90"
                  >
                    <MenuButton label="Insert above" onClick={() => addRow(r)}>
                      <ArrowIcon dir="up" />
                    </MenuButton>
                    <MenuButton label="Insert below" onClick={() => addRow(r + 1)}>
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
                      onClick={() => delRow(r)}
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
          className="pointer-events-none absolute inset-0 z-[var(--z-panel)] grid"
          style={{ gridTemplateColumns: colTemplate, gridTemplateRows: rowTemplate }}
        >
          <div
            className="relative"
            style={{ gridColumn: selectedCell.c + 1, gridRow: selectedCell.r + 1 }}
          >
            <div
              data-table-ui
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto absolute bottom-0 left-1/2 z-[var(--z-overlay)] flex items-center animate-pop-in rounded-lg border border-slate-200 bg-white/90 backdrop-blur-sm p-0.5 shadow-lg dark:border-slate-700 dark:bg-slate-800/90"
              style={{
                transform: `translate(-50%, calc(100% + 4px)) scale(${invScale})`,
                transformOrigin: 'top center',
              }}
            >
              {/* Title line, below the bar — the cell toolbar always sits below
                  its cell (so it never clashes with the element toolbar, which
                  floats above the selection), so the caption sits on the far
                  side, beneath the bar. */}
              <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-700 dark:text-white dark:ring-0">
                Selected Cell
              </span>
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
                  'absolute left-0 top-full z-[var(--z-modal)] mt-1 animate-pop-in rounded-lg border border-slate-200 bg-white/90 backdrop-blur-sm p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-800/90';
                return (
                  <>
                    {/* Text */}
                    <div className="relative">
                      <Tooltip
                        title="Text formatting"
                        description="Open bold, italic, underline, and text-size options for this cell."
                      >
                        <button
                          type="button"
                          className={secCls(cellMenu === 'text')}
                          onClick={() => setCellMenu((m) => (m === 'text' ? null : 'text'))}
                        >
                          Text <Chevron />
                        </button>
                      </Tooltip>
                      {cellMenu === 'text' ? (
                        <div className={`${panel} w-44`}>
                          <div className="flex gap-1">
                            <Tooltip title="Bold" description="Toggle bold text for this cell.">
                              <button
                                type="button"
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
                            </Tooltip>
                            <Tooltip title="Italic" description="Toggle italic text for this cell.">
                              <button
                                type="button"
                                className={tog(sc?.italic ?? element.textItalic ?? false)}
                                onClick={() =>
                                  applyCellStyle(rr, cc, {
                                    italic: !(sc?.italic ?? element.textItalic),
                                  })
                                }
                              >
                                <span className="italic">I</span>
                              </button>
                            </Tooltip>
                            <Tooltip
                              title="Underline"
                              description="Toggle underlined text for this cell."
                            >
                              <button
                                type="button"
                                className={tog(sc?.underline ?? element.textUnderline ?? false)}
                                onClick={() =>
                                  applyCellStyle(rr, cc, {
                                    underline: !(sc?.underline ?? element.textUnderline),
                                  })
                                }
                              >
                                <span className="underline">U</span>
                              </button>
                            </Tooltip>
                          </div>
                          <div className="mt-1.5 grid grid-cols-4 gap-1">
                            {(['sm', 'md', 'lg', 'scale'] as const).map((sz) => (
                              <Tooltip
                                key={sz}
                                title={sz === 'scale' ? 'Scale to fit' : `Size ${sz}`}
                                description={
                                  sz === 'scale'
                                    ? 'Scale the cell text to fit the row height.'
                                    : `Set this cell's text to the ${sz} size.`
                                }
                              >
                                <button
                                  type="button"
                                  className={tog((sc?.textSize ?? element.textSize ?? 'md') === sz)}
                                  onClick={() => applyCellStyle(rr, cc, { textSize: sz })}
                                >
                                  <span
                                    style={{ fontSize: sz === 'sm' ? 9 : sz === 'lg' ? 15 : 12 }}
                                  >
                                    {sz === 'scale' ? '\u2195' : 'A'}
                                  </span>
                                </button>
                              </Tooltip>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {sep}
                    {/* Colours */}
                    <div className="relative">
                      <Tooltip
                        title="Cell colours"
                        description="Set the background and text colour for this cell."
                      >
                        <button
                          type="button"
                          className={secCls(cellMenu === 'colours')}
                          onClick={() => setCellMenu((m) => (m === 'colours' ? null : 'colours'))}
                        >
                          Colours <Chevron />
                        </button>
                      </Tooltip>
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
                      <Tooltip
                        title="Text alignment"
                        description="Align this cell's text to the left, centre, or right."
                      >
                        <button
                          type="button"
                          className={secCls(cellMenu === 'align')}
                          onClick={() => setCellMenu((m) => (m === 'align' ? null : 'align'))}
                        >
                          Align <Chevron />
                        </button>
                      </Tooltip>
                      {cellMenu === 'align' ? (
                        <div className={`${panel} flex gap-1`}>
                          {(['left', 'center', 'right'] as const).map((al) => (
                            <Tooltip
                              key={al}
                              title={`Align ${al}`}
                              description={`Align this cell's text to the ${al}.`}
                            >
                              <button
                                type="button"
                                className={tog(
                                  (sc?.alignX ?? element.textAlignX ?? 'center') === al,
                                )}
                                onClick={() => applyCellStyle(rr, cc, { alignX: al })}
                              >
                                <AlignIcon dir={al} />
                              </button>
                            </Tooltip>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {sep}
                    {onLinkCell ? (
                      <Tooltip
                        title={sc?.link ? 'Edit cell link' : 'Link cell'}
                        description="Jump to a tab, another diagram, or a web address."
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLinkCell(element.id, rr, cc);
                          }}
                          className={
                            sc?.link
                              ? 'flex h-7 w-7 items-center justify-center rounded bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
                              : 'flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }
                        >
                          <CellLinkIcon />
                        </button>
                      </Tooltip>
                    ) : null}
                    {onLinkCell ? sep : null}
                    <Tooltip
                      title="Clear cell"
                      description="Remove the text and all formatting from this cell."
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Text + formatting in ONE commit: separate commits
                          // both read the same stale `element`, so the second
                          // overwrote the first and the text reappeared.
                          onCommitTable(element.id, {
                            cells: setTableCell(element, rr, cc, '').cells,
                            cellStyles: clearCellStyle(element, rr, cc).cellStyles ?? [],
                          });
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950"
                      >
                        <TrashIcon />
                      </button>
                    </Tooltip>
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
