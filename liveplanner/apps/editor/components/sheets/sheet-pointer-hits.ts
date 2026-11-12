// What a point on the grid hits, for the grid's pointer (useSheetPointer.ts): a cell, the fill handle (or a touch
// screen's grip), the frozen edge's bar and where a freeze dropped there lands, a validation rule's drawing. Each
// reads the controller as it stands when it is called, so the handlers a render makes see the grid of the moment.
import {
  cellKey,
  displayValue,
  validationRuleAt,
  SHEET_FREEZE_COLS_MAX,
  SHEET_FREEZE_ROWS_MAX,
} from '@liveplanner/sheets';
import { cellBox, hitTest, mergeAt, totalSize, type Hit } from './sheet-geometry';
import { fontPx } from './SheetCells';
import { ruleHitAt } from './rules/sheet-rule-draw';
import { FILL_HANDLE_PX, fillHandleAt } from './SheetSelectionLayer';
import { TOUCH_GRIP_HIT_PX } from './useSheetTouch';
import type { SheetController } from './sheet-controller';

// How close to the frozen edge's bar a press grabs it.
const FREEZE_GRAB_PX = 3;
// The most lines a drag freezes (the freeze limits, docs/specs/029-sheets/blueprints/DEFAULTS.md).
const FREEZE_MAX = { r: SHEET_FREEZE_ROWS_MAX, c: SHEET_FREEZE_COLS_MAX };

export function sheetPointerHits(latest: { readonly current: SheetController }) {
  const hitAt = (x: number, y: number): Hit =>
    hitTest(latest.current.geometry, x, y, latest.current.scroll);

  // The fill handle under a mouse; on a touch screen the same corner is the selection's grip (useSheetTouch), which
  // anyone who can select may drag, with a finger's reach.
  const onHandle = (x: number, y: number, grip = false) => {
    const cc = latest.current;
    if (cc.editing || (grip ? !cc.focused : !cc.canEdit)) return false;
    const reach = grip ? TOUCH_GRIP_HIT_PX : FILL_HANDLE_PX;
    const h = fillHandleAt(cc.geometry, cc.selectionNow(), cc.scroll);
    return (
      Math.abs(x - latest.current.geometry.headW - h.x) <= reach &&
      Math.abs(y - latest.current.geometry.headH - h.y) <= reach
    );
  };

  // The frozen edge's bar, on the headers (or the corner's edges when nothing is frozen): dragged to change the
  // freeze (docs/specs/029-sheets/sheet.md "Freeze").
  const freezeEdgeAt = (x: number, y: number): 'r' | 'c' | null => {
    const cc = latest.current;
    if (!cc.canEdit) return null;
    const g = cc.geometry;
    const fx = latest.current.geometry.headW + g.frozenWidth;
    const fy = latest.current.geometry.headH + g.frozenHeight;
    if (y < latest.current.geometry.headH && Math.abs(x - fx) <= FREEZE_GRAB_PX) return 'c';
    if (x < latest.current.geometry.headW && Math.abs(y - fy) <= FREEZE_GRAB_PX) return 'r';
    return null;
  };

  // How many lines a freeze dropped at a point keeps: up to the line boundary nearest the point.
  const freezeCountAt = (axis: 'r' | 'c', x: number, y: number): number => {
    const cc = latest.current;
    const g = cc.geometry;
    const offs = axis === 'c' ? g.cols : g.rows;
    const p = axis === 'c' ? x - latest.current.geometry.headW : y - latest.current.geometry.headH;
    const frozen = axis === 'c' ? g.frozenWidth : g.frozenHeight;
    const at = p < frozen ? p : p + (axis === 'c' ? cc.scroll.left : cc.scroll.top);
    let best = 0;
    for (let i = 0; i < offs.length; i++)
      if (Math.abs(offs[i]! - at) < Math.abs(offs[best]! - at)) best = i;
    return Math.min(best, FREEZE_MAX[axis]);
  };

  // What a press on a cell hits of its validation rule's drawing (a box, a chip, an arrow), if anything.
  const ruleAtPress = (r: number, col: number, x: number, y: number) => {
    const cc = latest.current;
    if (!cc.sheet.layout.rules?.length) return null;
    const rule = validationRuleAt(cc.sheet.layout, r, col);
    if (!rule) return null;
    const g = cc.geometry;
    const m = mergeAt(g, r, col);
    const rowId = cc.sheet.layout.rows[r]!;
    const colId = cc.sheet.layout.cols[col]!;
    const f = cc.sheet.cells.get(cellKey(rowId, colId))?.format;
    const shown = displayValue(cc.workbook.value(cc.sheet.id, r, col), f, cc.locale).text;
    const active = cc.selectionNow().active;
    return ruleHitAt(
      {
        rule,
        box: cellBox(g, r, col, cc.scroll, m),
        shown,
        px: fontPx(f),
        active: active.r === r && active.c === col,
      },
      x - g.headW,
      y - g.headH,
    );
  };

  // The cell under a point, clamped to the grid (a drag past the edge keeps the edge's cell).
  const cellAt = (x: number, y: number): { r: number; c: number } => {
    const cc = latest.current;
    // Past the last row or column (a grid smaller than its frame), the drag keeps the edge's cell.
    const total = totalSize(cc.geometry);
    const right = latest.current.geometry.headW + total.width - cc.scroll.left - 1;
    const bottom = latest.current.geometry.headH + total.height - cc.scroll.top - 1;
    const hx = Math.max(latest.current.geometry.headW + 1, Math.min(x, cc.view.width - 2, right));
    const hy = Math.max(latest.current.geometry.headH + 1, Math.min(y, cc.view.height - 2, bottom));
    const h = hitAt(hx, hy);
    if (h.kind === 'cell') return { r: h.r, c: h.c };
    return cc.selectionNow().active;
  };

  return { hitAt, onHandle, freezeEdgeAt, freezeCountAt, ruleAtPress, cellAt };
}
