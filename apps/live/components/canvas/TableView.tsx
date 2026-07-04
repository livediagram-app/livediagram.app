import { useEffect, useRef, useState } from 'react';
import {
  BORDER_STROKE_PX,
  tableTrackSizes,
  defaultStrokeColor,
  defaultTextColor,
  PADDING_PX,
  type ElementLink,
  type TableElement,
} from '@livediagram/diagram';
import { isMobileViewportSync } from '@/lib/responsive';
import { nearestCssBorderStyle } from '@/components/canvas/border-css';
import {
  TableAxisMenuPortal,
  TableAxisTriggers,
  TableResizeDividers,
} from '@/components/canvas/TableAxisControls';
import {
  CELL_FONT_PX,
  scaleCellFontPx,
  TableCellView,
  type TableCellCtx,
} from '@/components/canvas/TableCellView';
import { TableCellMenu } from '@/components/canvas/TableCellMenu';
import { useTableStructure } from '@/components/canvas/useTableStructure';
import { useTableEditing } from '@/components/canvas/useTableEditing';
import { useTableCellInput } from '@/components/canvas/useTableCellInput';
import { useTableAxisResize } from '@/components/canvas/useTableAxisResize';
import { useTableCellSelection } from '@/components/canvas/useTableCellSelection';

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
  // Multi-cell selection + the per-cell context menu (spec/09) — anchor,
  // shift-click extras, menu position, long-press opener, and the
  // whole-selection style / clear commits — live in useTableCellSelection.
  const {
    selectedCell,
    setSelectedCell,
    extraCells,
    setExtraCells,
    cellMenuPos,
    setCellMenuPos,
    menuPositionFor,
    selectionCells,
    pressedCellRef,
    cellLongPress,
    applyStyleToSelection,
    clearSelectionCells,
  } = useTableCellSelection({
    element,
    rows,
    cols,
    gridRef,
    editing,
    isSelected,
    disabled: readOnly || element.locked === true,
    onCommitTable,
  });
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

  useEffect(() => {
    // A stale edit target can point past the grid after a row/column
    // delete; the selection clamps live in useTableCellSelection.
    if (editing && (editing.r >= rows || editing.c >= cols)) setEditing(null);
  }, [editing, rows, cols]);

  useEffect(() => {
    if (!isSelected) setMenu(null);
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

  // Selected-cell keyboard layer + capture-phase paste — see
  // useTableCellInput.
  useTableCellInput({
    element,
    rows,
    cols,
    selectedCell,
    setSelectedCell,
    setExtraCells,
    editing,
    setEditing,
    suspended: cellMenuPos !== null,
    readOnly: readOnly || element.locked === true,
    addRow,
    selectionCells,
    onCommitTable,
    initialTextRef,
    typeToEditRef,
  });

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

  // Shared per-render bundle for TableCellView — see TableCellCtx.
  const cellCtx: TableCellCtx = {
    element,
    rows,
    cols,
    showControls,
    selectedCell,
    extraCells,
    editing,
    editorRef,
    cellPad,
    gridBorder,
    headerFill,
    headerTextColor,
    alignItems,
    alignX,
    fontPx,
    rowH,
    stroke,
    tabSummaries,
    onFollowLink,
    beginEdit,
    setSelectedCell,
    setExtraCells,
    setCellMenuPos,
    menuPositionFor,
    selectionCells,
    pressedCellRef,
    cellLongPress,
    cancelHoverClear,
    setHoveredCol,
    setHoveredRow,
    commitCell,
    commitAndAppendRow,
    moveTo,
    caretInfo,
    setEditing,
    onCommitTable,
  };

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
            {row.map((cell, c) => (
              <TableCellView key={`${r}-${c}`} r={r} c={c} text={cell} ctx={cellCtx} />
            ))}
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
          <TableResizeDividers
            element={element}
            rows={rows}
            cols={cols}
            colTemplate={colTemplate}
            rowTemplate={rowTemplate}
            armedResize={armedResize}
            armResizeEnter={armResizeEnter}
            armResizeLeave={armResizeLeave}
            startColResize={startColResize}
            startRowResize={startRowResize}
            onCommitTable={onCommitTable}
          />

          <TableAxisTriggers
            cols={cols}
            rows={rows}
            colTemplate={colTemplate}
            rowTemplate={rowTemplate}
            colSizes={colSizes}
            rowSizes={rowSizes}
            elementWidth={element.width}
            elementHeight={element.height}
            invScale={invScale}
            isMobile={isMobile}
            hoveredCol={hoveredCol}
            hoveredRow={hoveredRow}
            onHoverCol={(c) => {
              cancelHoverClear();
              setHoveredCol(c);
            }}
            onHoverRow={(r) => {
              cancelHoverClear();
              setHoveredRow(r);
            }}
            onHoverLeave={scheduleHoverClear}
            menu={menu}
            onToggle={toggle}
          />
        </div>
      ) : null}
      {menu && showControls ? (
        <TableAxisMenuPortal
          menu={menu}
          cols={cols}
          rows={rows}
          addCol={addCol}
          moveCol={moveCol}
          delCol={delCol}
          addRow={addRow}
          moveRow={moveRow}
          delRow={delRow}
        />
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
