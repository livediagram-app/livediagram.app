import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BORDER_STROKE_PX,
  clearCellStyle,
  tableTrackSizes,
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
import { useTableAxisResize } from '@/components/canvas/useTableAxisResize';
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
  // Column / row ⋯ menu: axis + index plus the trigger's screen anchor —
  // the menu portals to document.body (fixed positioning) so nothing inside
  // the canvas stacking context can paint over it.
  const [menu, setMenu] = useState<{
    axis: 'col' | 'row';
    index: number;
    x: number;
    y: number;
  } | null>(null);
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
  // On desktop the column / row ⋯ trigger only shows while hovering
  // that column / row; on touch (no hover) they stay visible.
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const isMobile = isMobileViewportSync();
  const editorRef = useRef<HTMLDivElement>(null);
  const initialTextRef = useRef('');
  const typeToEditRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const showControls = isSelected && !readOnly && !element.locked;
  const {
    resizeWidths,
    resizeHeights,
    armedResize,
    armResizeEnter,
    armResizeLeave,
    startColResize,
    startRowResize,
  } = useTableAxisResize({ element, rows, cols, gridRef, enabled: showControls, onCommitTable });
  // The column / row triggers sit OUTSIDE the table edges, so travelling
  // from a cell to a trigger crosses a gap where the grid's mouse-leave
  // fires. Clearing the hover after a short grace (cancelled when the
  // trigger is reached) keeps the trigger mounted for the crossing.
  const hoverClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHoverClear = () => {
    if (hoverClearRef.current) clearTimeout(hoverClearRef.current);
    hoverClearRef.current = null;
  };
  const scheduleHoverClear = () => {
    cancelHoverClear();
    hoverClearRef.current = setTimeout(() => {
      setHoveredCol(null);
      setHoveredRow(null);
    }, 250);
  };
  useEffect(() => cancelHoverClear, []);

  // The cell under the current touch press, recorded by each cell's
  // pointerdown so the grid-level long-press (touch's right-click, below)
  // knows which cell to open the toolbar for.
  // Place the cell context menu BESIDE the selected cells instead of over
  // them (matching the element menus): at the right edge of the selection's
  // screen rect, or the left when the right would spill off the viewport.
  // The rect comes from the grid's live computed tracks (element-space px,
  // like the resize logic) scaled by the rendered-to-element ratio, so it
  // is exact at any zoom / pinned track sizes.
  const menuPositionFor = (cells: { r: number; c: number }[]): { x: number; y: number } => {
    const grid = gridRef.current;
    const fallback = { x: 0, y: 0 };
    if (!grid || cells.length === 0) return fallback;
    const rect = grid.getBoundingClientRect();
    const styles = getComputedStyle(grid);
    const colPx = styles.gridTemplateColumns.split(' ').map(parseFloat);
    const rowPx = styles.gridTemplateRows.split(' ').map(parseFloat);
    const sx = element.width > 0 ? rect.width / element.width : 1;
    const sy = element.height > 0 ? rect.height / element.height : 1;
    const cum = (sizes: number[]) => {
      const out = [0];
      for (const v of sizes) out.push(out[out.length - 1]! + (Number.isFinite(v) ? v : 0));
      return out;
    };
    const xs = cum(colPx);
    const ys = cum(rowPx);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    for (const cell of cells) {
      minX = Math.min(minX, xs[cell.c] ?? 0);
      maxX = Math.max(maxX, xs[cell.c + 1] ?? 0);
      minY = Math.min(minY, ys[cell.r] ?? 0);
    }
    const left = rect.left + minX * sx;
    const right = rect.left + maxX * sx;
    const top = rect.top + minY * sy;
    // ContextMenu is w-56 (224px); keep a small gap. Prefer the right side;
    // fall back to the left when the right would spill off the viewport
    // (the menu's own clamp would otherwise slide it back OVER the cells).
    const MENU_W = 224;
    const GAP = 8;
    const x = right + GAP + MENU_W <= window.innerWidth ? right + GAP : left - GAP - MENU_W;
    return { x: Math.max(8, x), y: Math.max(8, top) };
  };

  const pressedCellRef = useRef<{ r: number; c: number } | null>(null);
  const cellLongPress = useLongPress(() => {
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
    setCellMenuPos(menuPositionFor(inSelection ? selectionCells() : [cell]));
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
  // The table's quick-connect pluses sit on the edge MIDPOINTS (spec/09),
  // right where a centre column / row's ⋯ trigger would land now the
  // triggers live outside the edges. When a trigger's centre falls under
  // the plus, dodge it sideways / downwards by a screen-constant nudge.
  const colSizes = tableTrackSizes(element.width, cols, resizeWidths ?? element.colWidths);
  const rowSizes = tableTrackSizes(element.height, rows, resizeHeights ?? element.rowHeights);
  const trackCentre = (sizes: number[], i: number) => {
    let off = 0;
    for (let k = 0; k < i; k++) off += sizes[k]!;
    return off + (sizes[i] ?? 0) / 2;
  };
  // Clearance / nudge in screen px, converted to element space (the plus is
  // a fixed screen size; the trigger counter-scales too).
  const PLUS_CLEARANCE_PX = 40;
  const dodgesPlus = (centre: number, mid: number) =>
    Math.abs(centre - mid) < PLUS_CLEARANCE_PX * invScale;

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

  const toggle = (axis: 'col' | 'row', index: number, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const anchor =
      axis === 'col'
        ? { x: rect.left + rect.width / 2, y: rect.bottom + 4 }
        : { x: rect.right + 4, y: rect.top + rect.height / 2 };
    setMenu((m) => (m && m.axis === axis && m.index === index ? null : { axis, index, ...anchor }));
  };

  // Drag the right divider of column c to pin its width; other columns
  // stay auto and reflow. Reads the live track sizes + the rendered-to-
  // element scale (zoom) off the grid so it works at any zoom.
  // Column + row resize share one axis-parameterized factory: the two
  // gestures differ only by axis (width / clientX / colWidths / MIN_COL_PX
  // vs height / clientY / rowHeights / MIN_ROW_PX). Keeping them as twin
  // handlers was a standing duplication; this is the single source.
  // Divider resizing (rest-to-arm + drag + commit) — see useTableAxisResize.

  return (
    <>
      <div
        ref={gridRef}
        onMouseLeave={scheduleHoverClear}
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
                    cancelHoverClear();
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
                      // Shift presses were consumed at pointerdown (the
                      // multi-cell toggle); the trailing click must not
                      // collapse the selection it just built.
                      if (e.shiftKey) return;
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
                      // Beside the acting selection (right, else left), never
                      // over it — matching the element menus.
                      setCellMenuPos(menuPositionFor(inSelection ? selectionCells() : [{ r, c }]));
                    }
                  }}
                  onPointerDown={
                    showControls && !isEditingCell
                      ? (e) => {
                          if (e.shiftKey && e.button === 0) {
                            // Shift-click multi-cell select happens HERE, on
                            // pointerdown with the press claimed: the element
                            // layer's own shift handler fires on pointerdown
                            // too and would toggle the whole TABLE into the
                            // canvas multi-select (tearing down the cell
                            // selection) before a click ever arrived.
                            e.stopPropagation();
                            if (!selectedCell) {
                              setSelectedCell({ r, c });
                              return;
                            }
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
                    // Selection outline in the table's own accent (its
                    // stroke, which tracks the theme) rather than a fixed
                    // light blue that clashes on non-default themes. Thin +
                    // softened with transparency so it marks the cell
                    // without shouting over the content.
                    outline: isSelCell
                      ? `1.5px solid color-mix(in srgb, ${stroke} 55%, transparent)`
                      : undefined,
                    outlineOffset: isSelCell ? '-1.5px' : undefined,
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
                      onPointerEnter={() => armResizeEnter('col', c)}
                      onPointerLeave={armResizeLeave}
                      onPointerDown={(e) => {
                        // Only a rested (armed) divider starts a resize —
                        // an instant strip on every border swallowed clicks
                        // mid-edit.
                        if (armedResize?.axis === 'col' && armedResize.index === c)
                          startColResize(c)(e);
                      }}
                      onDoubleClick={(e) => {
                        if (!(armedResize?.axis === 'col' && armedResize.index === c)) return;
                        e.stopPropagation();
                        onCommitTable(element.id, {
                          colWidths: Array.from({ length: cols }, (_, i) =>
                            i === c ? null : (element.colWidths?.[i] ?? null),
                          ),
                        });
                      }}
                      className={`pointer-events-auto absolute -right-1 bottom-0 top-0 z-[var(--z-toolbar)] w-2 ${
                        armedResize?.axis === 'col' && armedResize.index === c
                          ? 'cursor-col-resize'
                          : ''
                      }`}
                    >
                      <div
                        className={`mx-auto h-full w-0.5 transition ${
                          armedResize?.axis === 'col' && armedResize.index === c
                            ? 'bg-brand-400'
                            : 'bg-brand-400/0'
                        }`}
                      />
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
                      onPointerEnter={() => armResizeEnter('row', r)}
                      onPointerLeave={armResizeLeave}
                      onPointerDown={(e) => {
                        if (armedResize?.axis === 'row' && armedResize.index === r)
                          startRowResize(r)(e);
                      }}
                      onDoubleClick={(e) => {
                        if (!(armedResize?.axis === 'row' && armedResize.index === r)) return;
                        e.stopPropagation();
                        onCommitTable(element.id, {
                          rowHeights: Array.from({ length: rows }, (_, i) =>
                            i === r ? null : (element.rowHeights?.[i] ?? null),
                          ),
                        });
                      }}
                      className={`pointer-events-auto absolute -bottom-1 left-0 right-0 z-[var(--z-toolbar)] h-2 ${
                        armedResize?.axis === 'row' && armedResize.index === r
                          ? 'cursor-row-resize'
                          : ''
                      }`}
                    >
                      <div
                        className={`my-auto h-0.5 w-full transition ${
                          armedResize?.axis === 'row' && armedResize.index === r
                            ? 'bg-brand-400'
                            : 'bg-brand-400/0'
                        }`}
                      />
                    </div>
                  </Tooltip>
                ) : null}
              </div>
            ))}
          </div>

          {/* Column triggers laid out on a grid mirroring the column
              template so each stays centred over its column at any width
              (including while a column is being resized). They sit OUTSIDE
              the table's top edge so they never crowd the first row's
              content. */}
          <div
            className="pointer-events-none absolute inset-x-0 -top-7 grid"
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
                      style={{
                        transform: `${
                          dodgesPlus(trackCentre(colSizes, c), element.width / 2)
                            ? `translateX(${34 * invScale}px) `
                            : ''
                        }scale(${invScale})`,
                        transformOrigin: 'bottom center',
                      }}
                      onMouseEnter={() => {
                        cancelHoverClear();
                        setHoveredCol(c);
                      }}
                      onMouseLeave={scheduleHoverClear}
                    >
                      <Trigger
                        open={menu?.axis === 'col' && menu.index === c}
                        onClick={(e) => toggle('col', c, e)}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Row triggers on a grid mirroring the row template (like the
              column triggers above) so each stays centred in its row when
              heights are pinned to non-uniform values. They sit OUTSIDE the
              table's left edge so they never crowd the first column. */}
          <div
            className="pointer-events-none absolute inset-y-0 -left-7 grid"
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
                      style={{
                        transform: `${
                          dodgesPlus(trackCentre(rowSizes, r), element.height / 2)
                            ? `translateY(${34 * invScale}px) `
                            : ''
                        }scale(${invScale})`,
                        transformOrigin: 'center right',
                      }}
                      onMouseEnter={() => {
                        cancelHoverClear();
                        setHoveredRow(r);
                      }}
                      onMouseLeave={scheduleHoverClear}
                    >
                      <Trigger
                        vertical
                        open={menu?.axis === 'row' && menu.index === r}
                        onClick={(e) => toggle('row', r, e)}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {/* The open column / row menu, portalled to <body>: rendered inline it
          sat inside the canvas transform's stacking context, where later
          siblings (other elements, floating chrome) could paint over it. */}
      {menu && showControls
        ? createPortal(
            <div
              data-table-ui
              className={`pointer-events-auto fixed z-[var(--z-overlay)] w-36 animate-pop-in rounded-lg border border-slate-200 bg-white/90 p-1 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/90 ${
                menu.axis === 'col' ? '-translate-x-1/2' : '-translate-y-1/2'
              }`}
              style={{ left: menu.x, top: menu.y }}
            >
              {menu.axis === 'col' ? (
                <TableHeaderMenu
                  axis="col"
                  index={menu.index}
                  count={cols}
                  onAdd={addCol}
                  onMove={moveCol}
                  onDelete={delCol}
                />
              ) : (
                <TableHeaderMenu
                  axis="row"
                  index={menu.index}
                  count={rows}
                  onAdd={addRow}
                  onMove={moveRow}
                  onDelete={delRow}
                />
              )}
            </div>,
            document.body,
          )
        : null}
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
