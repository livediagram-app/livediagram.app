import { useEffect, useRef, useState } from 'react';
import {
  BORDER_STROKE_PX,
  clearCellStyle,
  defaultStrokeColor,
  defaultTextColor,
  isTabularClipboard,
  PADDING_PX,
  parseClipboardTableText,
  pasteIntoTable,
  setCellStyle,
  setTableCell,
  type ElementLink,
  type TableCellStyle,
  type TableElement,
} from '@livediagram/diagram';
import { isMobileViewportSync } from '@/lib/responsive';
import { nearestCssBorderStyle } from '@/components/canvas/border-css';
import { Tooltip } from '@/components/primitives/Tooltip';
import { CellLinkIcon } from '@/components/canvas/table-icons';
import { TableHeaderMenu, Trigger } from '@/components/canvas/table-menu-controls';
import { TableCellMenu } from '@/components/canvas/TableCellMenu';
import { useTableStructure } from '@/components/canvas/useTableStructure';
import { useTableEditing } from '@/components/canvas/useTableEditing';
import { useLongPress } from '@/hooks/ui/useLongPress';
import { describeLink } from '@/lib/link-label';
import { track } from '@/lib/telemetry';

// Cell font size per preset (element-space px; the canvas zoom scales
// it like everything else). 'scale' has no per-element basis on a grid,
// so it reads as the medium size.
const CELL_FONT_PX: Record<string, number> = { sm: 11, md: 13, lg: 16, scale: 13 };

// 'scale' cell text tracks the row height (≈40%), clamped to a legible range,
// so it grows / shrinks as the table is resized. Shared by the table-wide
// default and the per-cell override so the two can't drift.
const scaleCellFontPx = (rowH: number): number => Math.max(9, Math.min(40, Math.round(rowH * 0.4)));

// Key for the shift-click multi-cell selection set.
const cellKey = (r: number, c: number): string => `${r}:${c}`;

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
  // Shift-click multi-cell selection (spec/09): extra cells beyond the
  // anchor `selectedCell`, keyed "r:c". Styling / clearing acts on the
  // whole set; keyboard navigation and plain clicks collapse it back to
  // the anchor alone.
  const [extraCells, setExtraCells] = useState<Set<string>>(new Set());
  // The per-cell CONTEXT MENU (spec/09): right-click a cell on desktop,
  // long-press on touch, opens the accordion menu at the pointer (screen
  // coords — it portals out of the transformed canvas). A plain click only
  // selects the cell.
  const [cellMenuPos, setCellMenuPos] = useState<{ x: number; y: number } | null>(null);
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
  // The cell under the current touch press, recorded by each cell's
  // pointerdown so the grid-level long-press (touch's right-click, below)
  // knows which cell to open the toolbar for.
  const pressedCellRef = useRef<{ r: number; c: number } | null>(null);
  const cellLongPress = useLongPress((clientX, clientY) => {
    const cell = pressedCellRef.current;
    if (!cell || readOnly || element.locked) return;
    // Long-press on a cell already in the multi-selection keeps the set (the
    // menu then acts on all of it); elsewhere it re-anchors to that cell.
    const inSelection =
      (selectedCell && selectedCell.r === cell.r && selectedCell.c === cell.c) ||
      extraCells.has(cellKey(cell.r, cell.c));
    if (!inSelection) {
      setExtraCells(new Set());
      setSelectedCell(cell);
    }
    setCellMenuPos({ x: clientX, y: clientY });
  });

  useEffect(() => {
    if (editing && (editing.r >= rows || editing.c >= cols)) setEditing(null);
    // After a row/column delete a stale selection can point past the
    // grid — the per-cell toolbar would then float over a non-existent
    // CSS track and target an out-of-range cell. Clamp it (which also
    // hides the toolbar) so it can't act on a cell that no longer exists.
    setSelectedCell((s) => (s && (s.r >= rows || s.c >= cols) ? null : s));
    setExtraCells((prev) => {
      const next = new Set(
        [...prev].filter((k) => {
          const [r, c] = k.split(':').map(Number);
          return (r ?? rows) < rows && (c ?? cols) < cols;
        }),
      );
      return next.size === prev.size ? prev : next;
    });
  }, [editing, rows, cols]);

  // The cell menu belongs to its opening gesture: editing or losing the
  // anchor closes it rather than leaving it over a stale cell. Editing also
  // collapses the shift-click extras — a double-click edit targets one cell.
  useEffect(() => {
    if (!selectedCell || editing) setCellMenuPos(null);
    if (editing) setExtraCells((prev) => (prev.size ? new Set() : prev));
  }, [selectedCell, editing]);

  useEffect(() => {
    if (!isSelected) {
      setMenu(null);
      setSelectedCell(null);
      setExtraCells(new Set());
      setCellMenuPos(null);
    }
  }, [isSelected]);

  // Close the column / row menus on a click anywhere that isn't a table
  // control (the triggers + menus carry data-table-ui). The cell context
  // menu manages its own outside-close (the shared ContextMenu does).
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t && t.closest('[data-table-ui]')) return;
      setMenu(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menu]);

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

  const { beginEdit, commitCell, commitAndAppendRow, moveTo, caretInfo } = useTableEditing({
    element,
    readOnly,
    onCommitTable,
    editorRef,
    initialTextRef,
    setEditing,
    setSelectedCell,
  });

  const { moveCol, moveRow, addCol, delCol, addRow, delRow } = useTableStructure({
    element,
    onCommitTable,
    setMenu,
  });
  // Selected-cell keyboard layer (spreadsheet-style, spec/09). With a cell
  // selected (not yet editing): arrows move the selection, Tab / Shift+Tab
  // walk cells (Tab in the very last cell appends a row), Escape steps back
  // out to the plain table selection, Backspace / Delete clears the cell,
  // Enter / F2 edit, and a printable key type-to-edits. Every handled key
  // stops propagation so the editor's window-level shortcuts (arrow-key
  // element nudge, Backspace element delete, Escape deselect) never
  // double-handle a keystroke that was aimed at the cell — Backspace used
  // to clear the cell AND delete the whole table.
  useEffect(() => {
    // While the cell context menu is open it owns the keyboard (its own
    // Escape closes it), so the selection layer stands down.
    if (!selectedCell || editing || readOnly || element.locked || cellMenuPos) return;
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

  // Every selected cell — the anchor first, then the shift-clicked extras
  // (spec/09 multi-cell selection). The keyboard clear, the context menu's
  // styling, and Clear Cells all act on this set.
  const selectionCells = (): { r: number; c: number }[] => {
    if (!selectedCell) return [];
    const out = [selectedCell];
    for (const key of extraCells) {
      const [er, ec] = key.split(':').map(Number);
      if (er !== undefined && ec !== undefined && !(er === selectedCell.r && ec === selectedCell.c))
        out.push({ r: er, c: ec });
    }
    return out;
  };

  // Apply one style patch to EVERY selected cell in a single commit —
  // sequential commits would each read the same stale element and clobber
  // one another.
  const applyStyleToSelection = (patch: Partial<TableCellStyle>) => {
    const cells = selectionCells();
    if (cells.length === 0) return;
    let work = element;
    for (const cell of cells) {
      work = { ...work, cellStyles: setCellStyle(work, cell.r, cell.c, patch).cellStyles ?? [] };
    }
    track('Element', 'Changed', 'TableCell');
    onCommitTable(element.id, { cellStyles: work.cellStyles ?? [] });
  };

  // Clear text + formatting of every selected cell, one commit.
  const clearSelectionCells = () => {
    let work = element;
    for (const cell of selectionCells()) {
      work = { ...work, ...setTableCell(work, cell.r, cell.c, '') };
      work = { ...work, cellStyles: clearCellStyle(work, cell.r, cell.c).cellStyles ?? [] };
    }
    onCommitTable(element.id, { cells: work.cells, cellStyles: work.cellStyles ?? [] });
  };

  const showControls = isSelected && !readOnly && !element.locked;
  const toggle = (axis: 'col' | 'row', index: number) =>
    setMenu((m) => (m && m.axis === axis && m.index === index ? null : { axis, index }));

  // Drag the right divider of column c to pin its width; other columns
  // stay auto and reflow. Reads the live track sizes + the rendered-to-
  // element scale (zoom) off the grid so it works at any zoom.
  // Column + row resize share one axis-parameterized factory: the two
  // gestures differ only by axis (width / clientX / colWidths / MIN_COL_PX
  // vs height / clientY / rowHeights / MIN_ROW_PX). Keeping them as twin
  // handlers was a standing duplication; this is the single source.
  const startAxisResize = (axis: 'col' | 'row') => (index: number) => (e: React.PointerEvent) => {
    if (!showControls) return;
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const isCol = axis === 'col';
    const elemSize = isCol ? element.width : element.height;
    const rectSize = isCol ? rect.width : rect.height;
    const scale = elemSize > 0 ? rectSize / elemSize : 1;
    const count = isCol ? cols : rows;
    const tracks = getComputedStyle(grid)
      [isCol ? 'gridTemplateColumns' : 'gridTemplateRows'].split(' ')
      .map((t) => parseFloat(t));
    const baseSizes = isCol ? element.colWidths : element.rowHeights;
    const base: (number | null)[] = Array.from({ length: count }, (_, i) => baseSizes?.[i] ?? null);
    // Computed-style track sizes are already element-space px (ancestor
    // transforms don't reach computed style), so they must NOT be divided
    // by the render scale — only the rect-derived fallback is screen-space.
    const startSizeElem = Number.isFinite(tracks[index]!)
      ? tracks[index]!
      : rectSize / count / scale;
    const startPos = isCol ? e.clientX : e.clientY;
    const minPx = isCol ? MIN_COL_PX : MIN_ROW_PX;
    const ref = isCol ? dragRef : dragRowRef;
    const setResize = isCol ? setResizeWidths : setResizeHeights;
    const onMove = (ev: PointerEvent) => {
      const delta = ((isCol ? ev.clientX : ev.clientY) - startPos) / scale;
      const next = [...base];
      next[index] = Math.max(minPx, Math.round(startSizeElem + delta));
      ref.current = next;
      setResize(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (ref.current) {
        if (isCol) onCommitTable(element.id, { colWidths: ref.current });
        else onCommitTable(element.id, { rowHeights: ref.current });
      }
      ref.current = null;
      setResize(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  const startColResize = startAxisResize('col');
  const startRowResize = startAxisResize('row');

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
              const isSelCell =
                (selectedCell?.r === r && selectedCell?.c === c) || extraCells.has(cellKey(r, c));
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
                      if (e.shiftKey && selectedCell) {
                        // Shift-click builds a multi-cell selection (spec/09):
                        // toggle this cell in the extra set, anchor unchanged
                        // (toggling the anchor itself is a no-op).
                        if (r === selectedCell.r && c === selectedCell.c) return;
                        setExtraCells((prev) => {
                          const next = new Set(prev);
                          const key = cellKey(r, c);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        });
                        return;
                      }
                      setSelectedCell({ r, c });
                      setExtraCells(new Set());
                    }
                  }}
                  onContextMenu={(e) => {
                    // Right-click opens the per-cell context menu (spec/09) —
                    // the explicit gesture on desktop; touch long-presses
                    // instead (cellLongPress). Swallowed so the element
                    // context menu doesn't also open over it. On a cell
                    // already in the multi-selection the set is kept (the
                    // menu acts on all of it); elsewhere it re-anchors.
                    if (showControls && !isEditingCell) {
                      e.preventDefault();
                      e.stopPropagation();
                      const inSelection =
                        (selectedCell?.r === r && selectedCell?.c === c) ||
                        extraCells.has(cellKey(r, c));
                      if (!inSelection) {
                        setSelectedCell({ r, c });
                        setExtraCells(new Set());
                      }
                      setCellMenuPos({ x: e.clientX, y: e.clientY });
                    }
                  }}
                  onPointerDown={
                    showControls && !isEditingCell
                      ? (e) => {
                          pressedCellRef.current = { r, c };
                          cellLongPress.onPointerDown(e);
                        }
                      : undefined
                  }
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
                          if (flat >= 0 && flat < rows * cols)
                            moveTo(r, c, Math.floor(flat / cols), flat % cols);
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

          {/* One-click append (spec/09): a slim + pill centred on the bottom /
              right edge adds a row / column without the hover ⋯ menu dance —
              the single most common structural edit. Counter-scaled like the
              other floating chrome. */}
          <Tooltip title="Add row" description="Append a row at the bottom.">
            <button
              type="button"
              data-table-ui
              onClick={() => addRow(rows)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Add row"
              className="pointer-events-auto absolute -bottom-3 left-1/2 z-[var(--z-toolbar)] flex h-5 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
              style={{
                transform: `translateX(-50%) scale(${invScale})`,
                transformOrigin: 'top center',
              }}
            >
              <PlusGlyph />
            </button>
          </Tooltip>
          <Tooltip title="Add column" description="Append a column on the right.">
            <button
              type="button"
              data-table-ui
              onClick={() => addCol(cols)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Add column"
              className="pointer-events-auto absolute -right-3 top-1/2 z-[var(--z-toolbar)] flex h-9 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
              style={{
                transform: `translateY(-50%) scale(${invScale})`,
                transformOrigin: 'center left',
              }}
            >
              <PlusGlyph />
            </button>
          </Tooltip>

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
                          <TableHeaderMenu
                            axis="col"
                            index={c}
                            count={cols}
                            onAdd={addCol}
                            onMove={moveCol}
                            onDelete={delCol}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Row triggers along the left edge, on a grid mirroring the row
              template (like the column triggers above) so each stays centred
              in its row when heights are pinned to non-uniform values —
              uniform percentage math put a trigger visually inside the
              wrong row once any row was resized. */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0.5 grid"
            style={{ gridTemplateRows: rowTemplate }}
          >
            {Array.from({ length: rows }, (_, r) => {
              const rowOn =
                isMobile || hoveredRow === r || (menu?.axis === 'row' && menu.index === r);
              return (
                <div key={`row-${r}`} className="flex min-h-0 items-center">
                  {rowOn ? (
                    <div
                      className="pointer-events-auto relative"
                      style={{ transform: `scale(${invScale})`, transformOrigin: 'left center' }}
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
                          <TableHeaderMenu
                            axis="row"
                            index={r}
                            count={rows}
                            onAdd={addRow}
                            onMove={moveRow}
                            onDelete={delRow}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {cellMenuPos && selectedCell && showControls && !editing ? (
        <TableCellMenu
          element={element}
          cells={selectionCells()}
          anchor={selectedCell}
          position={cellMenuPos}
          onClose={() => setCellMenuPos(null)}
          applyStyle={applyStyleToSelection}
          onClear={clearSelectionCells}
          onLinkCell={onLinkCell}
          textColor={textColor}
        />
      ) : null}
    </>
  );
}

function PlusGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
