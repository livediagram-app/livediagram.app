import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  clearCellStyle,
  setCellStyle,
  setTableCell,
  type TableCellStyle,
  type TableElement,
} from '@livediagram/diagram';
import { cellKey } from '@/components/canvas/TableCellView';
import { useLongPress } from '@/hooks/ui/useLongPress';
import { track } from '@/lib/telemetry';

// The cell-selection slice (spec/09 multi-cell selection + the per-cell
// context menu), lifted out of TableView: the anchor + shift-click
// extras, the menu's screen position, the long-press that opens it on
// touch, the whole-selection style / clear commits, and the effects
// that clamp or close the selection as the grid changes. TableView
// mounts the returned state into its cell context and control layer.
export function useTableCellSelection({
  element,
  rows,
  cols,
  gridRef,
  editing,
  isSelected,
  disabled,
  onCommitTable,
}: {
  element: TableElement;
  rows: number;
  cols: number;
  gridRef: RefObject<HTMLDivElement | null>;
  editing: { r: number; c: number } | null;
  isSelected: boolean;
  // readOnly viewers and locked tables never select cells or open the menu.
  disabled: boolean;
  onCommitTable: (id: string, patch: Partial<Pick<TableElement, 'cells' | 'cellStyles'>>) => void;
}) {
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

  // The cell under the current touch press, recorded by each cell's
  // pointerdown so the grid-level long-press (touch's right-click) knows
  // which cell to open the toolbar for.
  const pressedCellRef = useRef<{ r: number; c: number } | null>(null);
  const cellLongPress = useLongPress(() => {
    const cell = pressedCellRef.current;
    if (!cell || disabled) return;
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
  }, [rows, cols]);

  // The cell menu belongs to its opening gesture: editing or losing the
  // anchor closes it rather than leaving it over a stale cell. Editing also
  // collapses the shift-click extras — a double-click edit targets one cell.
  useEffect(() => {
    if (!selectedCell || editing) setCellMenuPos(null);
    if (editing) setExtraCells((prev) => (prev.size ? new Set() : prev));
  }, [selectedCell, editing]);

  useEffect(() => {
    if (!isSelected) {
      setSelectedCell(null);
      setExtraCells(new Set());
      setCellMenuPos(null);
    }
  }, [isSelected]);

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

  return {
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
  };
}
