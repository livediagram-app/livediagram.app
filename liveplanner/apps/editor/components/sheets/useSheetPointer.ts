'use client';

// The grid's pointer (docs/specs/029-sheets/sheet.md "Selection", "Fill", "Rows and columns", "Writing formulas";
// blueprint sheet-element.md "Pointer"): select, extend and add ranges; drag the fill handle; resize, select and
// move rows and columns by their headers; point at cells while writing a formula; open the menus. Drags run on
// window listeners so they keep going outside the grid, and auto-scroll near its edges.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addRange,
  extendTo,
  normaliseRange,
  selectAllCells,
  selectCols,
  selectRows,
  single,
  cellKey,
  displayValue,
  validationRuleAt,
  type GridRange,
  SHEET_FREEZE_COLS_MAX,
  SHEET_FREEZE_ROWS_MAX,
} from '@liveplanner/sheets';
import { useAssignRef, useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { pointingTargetFor } from './sheet-pointing';
import { useSheetController } from './sheet-controller';
import { cellBox, hitTest, mergeAt, totalSize, type Hit } from './sheet-geometry';
import { fontPx } from './SheetCells';
import { ruleHitAt } from './rules/sheet-rule-draw';
import { FILL_HANDLE_PX, fillHandleAt } from './SheetSelectionLayer';
import type { SheetActions } from './useSheetActions';
import { useSheetPan } from './useSheetPan';
import { openHyperlink } from '@/lib/open-hyperlink';
import { TOUCH_GRIP_HIT_PX, useSheetTouch } from './useSheetTouch';

const DRAG_START_PX = 4;
const AUTOSCROLL_EDGE_PX = 24;
// How close to the frozen edge's bar a press grabs it.
const FREEZE_GRAB_PX = 3;
// The most lines a drag freezes (the freeze limits, docs/specs/029-sheets/blueprints/DEFAULTS.md).
const FREEZE_MAX = { r: SHEET_FREEZE_ROWS_MAX, c: SHEET_FREEZE_COLS_MAX };

type Drag =
  | { kind: 'select'; additive: boolean }
  | { kind: 'fill'; source: GridRange; target: GridRange; copy: boolean }
  | { kind: 'resize'; axis: 'r' | 'c'; index: number; start: number; size: number; px: number }
  | { kind: 'axisSelect'; axis: 'r' | 'c'; from: number }
  | {
      kind: 'axisMove';
      axis: 'r' | 'c';
      from: number;
      to: number;
      drop: number;
      armed: boolean;
      x0: number;
      y0: number;
    }
  | { kind: 'point'; from: { r: number; c: number }; sheet?: string }
  | { kind: 'freeze'; axis: 'r' | 'c'; count: number };

// A cell or range pointed at while a formula is written; `sheet` names another sheet of the tab it is on.
export type PointRef = (
  from: { r: number; c: number },
  to: { r: number; c: number },
  sheet?: string,
) => boolean;

export function useSheetPointer(
  viewportRef: React.RefObject<HTMLDivElement | null>,
  actions: SheetActions,
  pointRef: PointRef,
) {
  const c = useSheetController();
  const latest = useLatest(c);
  const drag = useRef<Drag | null>(null);
  const pan = useSheetPan(() => latest.current.gridEl);
  const [cursor, setCursor] = useState<string>('cell');
  // A preview of a drag in progress: the fill's target, a resize's line, a move's drop line.
  const [preview, setPreview] = useState<
    | { kind: 'fill'; range: GridRange }
    | { kind: 'resize'; axis: 'r' | 'c'; at: number }
    | { kind: 'move'; axis: 'r' | 'c'; at: number }
    | null
  >(null);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // The window's listeners during a drag: stable functions that call this render's handlers.
  const onMove = useRef<(e: PointerEvent) => void>(() => {});
  const onUp = useRef<(e: PointerEvent) => void>(() => {});
  const listeners = useMemo(
    () => ({
      move: (e: PointerEvent) => onMove.current(e),
      up: (e: PointerEvent) => onUp.current(e),
    }),
    [],
  );

  const local = useCallback(
    (clientX: number, clientY: number) => {
      const el = viewportRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const scale = el.offsetWidth ? rect.width / el.offsetWidth : 1;
      return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
    },
    [viewportRef],
  );

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

  const step = () => {
    const d = drag.current;
    const cc = latest.current;
    if (!d) return;
    const { x, y } = pointer.current;
    if (d.kind === 'select' || d.kind === 'point') {
      const at = cellAt(x, y);
      if (d.kind === 'point') {
        if (d.sheet) pointingTargetFor(cc.sheet.id, cc.sheet.tabId)?.point(d.from, at, d.sheet);
        else pointRef(d.from, at);
      } else cc.setSelection(extendTo(cc.selectionNow(), at, cc.grid));
    } else if (d.kind === 'fill') {
      const at = cellAt(x, y);
      const s = d.source;
      // The fill grows the source in the one direction the pointer has gone furthest from it.
      const down = at.r - s.r2;
      const up = s.r1 - at.r;
      const right = at.c - s.c2;
      const left = s.c1 - at.c;
      const best = Math.max(down, up, right, left);
      let target = s;
      if (best > 0) {
        if (best === down) target = { ...s, r2: at.r };
        else if (best === up) target = { ...s, r1: at.r };
        else if (best === right) target = { ...s, c2: at.c };
        else target = { ...s, c1: at.c };
      } else if (at.r >= s.r1 && at.r < s.r2 && at.c >= s.c1 && at.c <= s.c2)
        target = { ...s, r2: at.r };
      else if (at.c >= s.c1 && at.c < s.c2 && at.r >= s.r1 && at.r <= s.r2)
        target = { ...s, c2: at.c };
      d.target = target;
      setPreview({ kind: 'fill', range: target });
    } else if (d.kind === 'resize') {
      const delta = (d.axis === 'c' ? x : y) - d.start;
      d.px = Math.max(d.axis === 'c' ? 24 : 18, Math.round(d.size + delta));
      setPreview({ kind: 'resize', axis: d.axis, at: d.axis === 'c' ? x : y });
    } else if (d.kind === 'freeze') {
      d.count = freezeCountAt(d.axis, x, y);
      const g = cc.geometry;
      const offs = d.axis === 'c' ? g.cols : g.rows;
      const frozen = d.axis === 'c' ? g.frozenWidth : g.frozenHeight;
      const line =
        offs[d.count]! -
        (offs[d.count]! < frozen ? 0 : d.axis === 'c' ? cc.scroll.left : cc.scroll.top);
      setPreview({ kind: 'move', axis: d.axis, at: line });
    } else if (d.kind === 'axisSelect') {
      const h = hitAt(
        d.axis === 'c' ? x : latest.current.geometry.headW - 1,
        d.axis === 'r' ? y : latest.current.geometry.headH - 1,
      );
      if (h.kind === 'col' && d.axis === 'c') cc.setSelection(selectCols(d.from, h.c, cc.grid));
      if (h.kind === 'row' && d.axis === 'r') cc.setSelection(selectRows(d.from, h.r, cc.grid));
    } else if (d.kind === 'axisMove') {
      if (!d.armed && Math.hypot(x - d.x0, y - d.y0) < DRAG_START_PX) return;
      d.armed = true;
      const g = cc.geometry;
      const h = hitAt(
        d.axis === 'c' ? x : latest.current.geometry.headW - 1,
        d.axis === 'r' ? y : latest.current.geometry.headH - 1,
      );
      const i = h.kind === 'col' ? h.c : h.kind === 'row' ? h.r : d.drop;
      const offs = d.axis === 'c' ? g.cols : g.rows;
      const mid = (offs[i]! + offs[i + 1]!) / 2 - (d.axis === 'c' ? cc.scroll.left : cc.scroll.top);
      const p =
        d.axis === 'c' ? x - latest.current.geometry.headW : y - latest.current.geometry.headH;
      d.drop = p > mid ? i + 1 : i;
      const lineAt = offs[d.drop]! - (d.axis === 'c' ? cc.scroll.left : cc.scroll.top);
      setPreview({ kind: 'move', axis: d.axis, at: lineAt });
    }
  };

  // Near an edge while dragging, the grid scrolls (faster the closer), and the drag follows.
  const autoscroll = () => {
    const el = latest.current.gridEl;
    const d = drag.current;
    if (!el || !d || d.kind === 'resize') return;
    const { x, y } = pointer.current;
    const { width, height } = latest.current.view;
    const dx =
      x < latest.current.geometry.headW + AUTOSCROLL_EDGE_PX
        ? -1
        : x > width - AUTOSCROLL_EDGE_PX
          ? 1
          : 0;
    const dy =
      y < latest.current.geometry.headH + AUTOSCROLL_EDGE_PX
        ? -1
        : y > height - AUTOSCROLL_EDGE_PX
          ? 1
          : 0;
    if (!dx && !dy) return;
    el.scrollBy({ left: dx * 24, top: dy * 24 });
    step();
  };
  const onTick = useRef<() => void>(() => {});
  useAssignRef(onTick, autoscroll);

  // A drag's end: what it made, applied once.
  const finish = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPreview(null);
    window.removeEventListener('pointermove', listeners.move);
    window.removeEventListener('pointerup', listeners.up);
    window.removeEventListener('pointercancel', listeners.up);
    const cc = latest.current;
    if (!d) return;
    // Paint Format: the range just selected takes the held formats (sheet.md "Paint Format").
    if (d.kind === 'select' && cc.rules.paint) {
      const ranges = cc.selectionNow().ranges;
      actions.paintApply(ranges[ranges.length - 1]!);
    }
    // Pointing leaves the caret in the formula being written (this sheet's, or another's).
    if (d.kind === 'point') {
      if (d.sheet) pointingTargetFor(cc.sheet.id, cc.sheet.tabId)?.refocus();
      return;
    }
    if (d.kind === 'fill') {
      const t = d.target;
      if (
        t.r1 !== d.source.r1 ||
        t.r2 !== d.source.r2 ||
        t.c1 !== d.source.c1 ||
        t.c2 !== d.source.c2
      ) {
        actions.fill(d.source, t, d.copy || e.ctrlKey || e.altKey);
        const s = d.source;
        // Dragged back inside the source, what is left stays selected; otherwise the source and its fill.
        const inside = t.r1 >= s.r1 && t.r2 <= s.r2 && t.c1 >= s.c1 && t.c2 <= s.c2;
        const grown = inside
          ? t
          : {
              r1: Math.min(t.r1, s.r1),
              c1: Math.min(t.c1, s.c1),
              r2: Math.max(t.r2, s.r2),
              c2: Math.max(t.c2, s.c2),
            };
        cc.setSelection({
          ranges: [grown],
          active: cc.selectionNow().active,
          anchor: { r: grown.r1, c: grown.c1 },
        });
      }
    } else if (d.kind === 'resize') {
      const sel = cc.selectionNow().ranges[cc.selectionNow().ranges.length - 1]!;
      const whole =
        d.axis === 'c'
          ? sel.r1 === 0 && sel.r2 >= cc.grid.rows - 1
          : sel.c1 === 0 && sel.c2 >= cc.grid.cols - 1;
      const [a, b] = d.axis === 'c' ? [sel.c1, sel.c2] : [sel.r1, sel.r2];
      // Several selected headers resize together.
      const positions = whole && d.index >= a && d.index <= b ? range(a, b) : [d.index];
      actions.resize(d.axis, positions, d.px);
    } else if (d.kind === 'freeze') {
      const now = d.axis === 'c' ? cc.geometry.frozenCols : cc.geometry.frozenRows;
      if (d.count !== now) {
        if (d.axis === 'c') actions.freeze(undefined, d.count);
        else actions.freeze(d.count);
      }
    } else if (d.kind === 'axisMove' && d.armed) {
      if (d.drop < d.from || d.drop > d.to + 1) actions.moveAxis(d.axis, d.from, d.to, d.drop);
    }
    cc.focusGrid();
  };
  const follow = (e: PointerEvent) => {
    pointer.current = local(e.clientX, e.clientY);
    step();
  };
  useAssignRef(onMove, follow);
  useAssignRef(onUp, finish);

  // A cancelled pointer (the browser took the gesture) ends the drag where it last was.
  const begin = (d: Drag, e: { clientX: number; clientY: number }) => {
    drag.current = d;
    pointer.current = local(e.clientX, e.clientY);
    window.addEventListener('pointermove', listeners.move);
    window.addEventListener('pointerup', listeners.up);
    window.addEventListener('pointercancel', listeners.up);
    timer.current = setInterval(() => onTick.current(), 50);
  };

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', listeners.move);
      window.removeEventListener('pointerup', listeners.up);
      window.removeEventListener('pointercancel', listeners.up);
      if (timer.current) clearInterval(timer.current);
    },
    [listeners],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const cc = latest.current;
    if (!cc.interactive) return;
    // A finger pans, holds or drags the grip (useSheetTouch).
    if (e.pointerType === 'touch') return touch.onTouchDown(e);
    // Panning the cells (useSheetPan): the middle or right button, Space with the left.
    if (pan.begin(e, { maximised: cc.maximised })) return;
    e.stopPropagation();
    if (e.button === 2) return;
    const { x, y } = local(e.clientX, e.clientY);
    if (onHandle(x, y)) {
      e.preventDefault();
      const source = cc.selectionNow().ranges[cc.selectionNow().ranges.length - 1]!;
      begin({ kind: 'fill', source, target: source, copy: e.ctrlKey || e.altKey }, e);
      return;
    }
    const h = hitAt(x, y);
    if (h.kind === 'cell') {
      // Another sheet of the tab is writing a formula: this sheet's cell goes in it (the editor keeps the caret).
      const into = cc.editing ? null : pointingTargetFor(cc.sheet.id, cc.sheet.tabId);
      if (into?.point({ r: h.r, c: h.c }, { r: h.r, c: h.c }, cc.sheet.title)) {
        e.preventDefault();
        begin({ kind: 'point', from: { r: h.r, c: h.c }, sheet: cc.sheet.title }, e);
        return;
      }
      // While a formula is written, a click on a cell where a reference can go puts it there.
      if (cc.editing && pointRef({ r: h.r, c: h.c }, { r: h.r, c: h.c })) {
        e.preventDefault();
        begin({ kind: 'point', from: { r: h.r, c: h.c } }, e);
        return;
      }
      if (cc.editing) {
        const r = actions.commitEdit('none');
        if (!r.ok) return;
      }
      e.preventDefault();
      cc.focusGrid();
      // Ctrl/⌘ and a click on a HYPERLINK opens it in a new tab (formulas.md "Text"); on any other cell it adds to
      // the selection as before, and a plain click on a link only selects it.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !cc.rules.paint) {
        const link = cc.workbook.hyperlinkOf(cc.sheet.id, h.r, h.c);
        if (link) {
          openHyperlink(link);
          return;
        }
      }
      // A press on a checkbox's box toggles it; on a chip or a dropdown's arrow, opens its options
      // (data-validation.md "Using a dropdown", "Using a checkbox"). Paint Format paints instead.
      const ruleHit =
        e.shiftKey || e.metaKey || e.ctrlKey || cc.rules.paint ? null : ruleAtPress(h.r, h.c, x, y);
      if (ruleHit) {
        cc.setSelection(single({ r: h.r, c: h.c }));
        if (ruleHit === 'box') actions.toggleCheckboxes([{ r1: h.r, c1: h.c, r2: h.r, c2: h.c }]);
        else actions.openDropdown({ r: h.r, c: h.c });
        return;
      }
      if (e.shiftKey) cc.setSelection(extendTo(cc.selectionNow(), { r: h.r, c: h.c }, cc.grid));
      else if (e.metaKey || e.ctrlKey)
        cc.setSelection(addRange(cc.selectionNow(), { r: h.r, c: h.c }, cc.grid));
      else cc.setSelection(extendTo(single({ r: h.r, c: h.c }), { r: h.r, c: h.c }, cc.grid));
      begin({ kind: 'select', additive: e.metaKey || e.ctrlKey }, e);
      return;
    }
    const freezeAxis = freezeEdgeAt(x, y);
    if (freezeAxis) {
      e.preventDefault();
      cc.focusGrid();
      const count = freezeAxis === 'c' ? cc.geometry.frozenCols : cc.geometry.frozenRows;
      begin({ kind: 'freeze', axis: freezeAxis, count }, e);
      return;
    }
    if (h.kind === 'corner') {
      cc.setSelection(selectAllCells(cc.grid));
      cc.focusGrid();
      return;
    }
    if (h.kind === 'col' || h.kind === 'row') {
      e.preventDefault();
      cc.focusGrid();
      const axis = h.kind === 'col' ? 'c' : 'r';
      const index = h.kind === 'col' ? h.c : h.r;
      if (h.edge && cc.canEdit) {
        begin(
          {
            kind: 'resize',
            axis,
            index,
            start: axis === 'c' ? x : y,
            size: actions.sizeOf(axis, index),
            px: actions.sizeOf(axis, index),
          },
          e,
        );
        return;
      }
      const sel = cc.selectionNow().ranges[cc.selectionNow().ranges.length - 1]!;
      const whole =
        axis === 'c'
          ? sel.r1 === 0 && sel.r2 >= cc.grid.rows - 1
          : sel.c1 === 0 && sel.c2 >= cc.grid.cols - 1;
      const [a, b] = axis === 'c' ? [sel.c1, sel.c2] : [sel.r1, sel.r2];
      if (whole && index >= a && index <= b && cc.canEdit && !e.shiftKey) {
        begin(
          { kind: 'axisMove', axis, from: a, to: b, drop: index, armed: false, x0: x, y0: y },
          e,
        );
        return;
      }
      const from = e.shiftKey
        ? axis === 'c'
          ? cc.selectionNow().anchor.c
          : cc.selectionNow().anchor.r
        : index;
      cc.setSelection(
        axis === 'c' ? selectCols(from, index, cc.grid) : selectRows(from, index, cc.grid),
      );
      begin({ kind: 'axisSelect', axis, from }, e);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current || !latest.current.interactive) return;
    const { x, y } = local(e.clientX, e.clientY);
    if (onHandle(x, y)) return setCursor('crosshair');
    const freezeAxis = freezeEdgeAt(x, y);
    if (freezeAxis) return setCursor(freezeAxis === 'c' ? 'ew-resize' : 'ns-resize');
    const h = hitAt(x, y);
    setCursor(
      h.kind === 'col' && h.edge && latest.current.canEdit
        ? 'col-resize'
        : h.kind === 'row' && h.edge && latest.current.canEdit
          ? 'row-resize'
          : h.kind === 'cell'
            ? latest.current.rules.paint
              ? 'copy'
              : 'cell'
            : 'default',
    );
    setHover(h.kind === 'cell' ? { r: h.r, c: h.c } : null);
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const cc = latest.current;
    if (!cc.interactive) return;
    e.stopPropagation();
    const { x, y } = local(e.clientX, e.clientY);
    if (onHandle(x, y)) {
      // Fill down as far as the column beside the selection is filled.
      const s = cc.selectionNow().ranges[cc.selectionNow().ranges.length - 1]!;
      const beside = s.c1 > 0 ? s.c1 - 1 : s.c2 + 1;
      let r = s.r2;
      while (r + 1 < cc.grid.rows && cc.grid.filled(r + 1, beside)) r++;
      if (r > s.r2) actions.fill(s, { ...s, r2: r }, false);
      return;
    }
    const h = hitAt(x, y);
    if (h.kind === 'cell' && cc.canEdit) actions.startEdit('cell');
    if ((h.kind === 'col' || h.kind === 'row') && h.edge && cc.canEdit) {
      const axis = h.kind === 'col' ? 'c' : 'r';
      actions.autofit(axis, [h.kind === 'col' ? h.c : h.r]);
    }
  };

  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    const cc = latest.current;
    if (!cc.interactive) return;
    e.preventDefault();
    e.stopPropagation();
    // A finger's long press opens the menu on its release, unmoved (useSheetTouch), not on the browser's own.
    if ((e.nativeEvent as PointerEvent).pointerType === 'touch') return;
    // A right drag that panned opens nothing; a right press still deciding (the menu arrives on press on a Mac)
    // opens the menu when it is released unmoved.
    if (pan.swallowContextMenu()) return;
    const { clientX, clientY } = e;
    if (pan.rightPending()) {
      pan.afterRightClick(() => openMenu(clientX, clientY));
      return;
    }
    openMenu(clientX, clientY);
  };

  // What a menu (or a held finger) acts on: the cell or header under it, unless the selection already holds it.
  const selectFor = (h: Hit) => {
    const cc = latest.current;
    if (h.kind === 'cell') {
      const inSel = cc
        .selectionNow()
        .ranges.some((g) => h.r >= g.r1 && h.r <= g.r2 && h.c >= g.c1 && h.c <= g.c2);
      if (!inSel) cc.setSelection(single({ r: h.r, c: h.c }));
    } else if (h.kind === 'col' || h.kind === 'row') {
      const axis = h.kind === 'col' ? 'c' : 'r';
      const index = h.kind === 'col' ? h.c : h.r;
      const sel = cc.selectionNow().ranges[cc.selectionNow().ranges.length - 1]!;
      const [a, b] = axis === 'c' ? [sel.c1, sel.c2] : [sel.r1, sel.r2];
      // The selection stays only when it is whole lines of this axis holding the header (a column's cells are not
      // rows: right-clicking row 3 with column D selected selects row 3).
      const whole =
        axis === 'c'
          ? sel.r1 === 0 && sel.r2 >= cc.grid.rows - 1
          : sel.c1 === 0 && sel.c2 >= cc.grid.cols - 1;
      if (!whole || index < a || index > b)
        cc.setSelection(
          axis === 'c' ? selectCols(index, index, cc.grid) : selectRows(index, index, cc.grid),
        );
    }
  };

  const openMenu = (clientX: number, clientY: number) => {
    const cc = latest.current;
    const { x, y } = local(clientX, clientY);
    const h = hitAt(x, y);
    selectFor(h);
    if (h.kind === 'cell') cc.setMenu({ kind: 'cell', x: clientX, y: clientY });
    else if (h.kind === 'col' || h.kind === 'row')
      cc.setMenu({
        kind: 'header',
        axis: h.kind === 'col' ? 'c' : 'r',
        index: h.kind === 'col' ? h.c : h.r,
        x: clientX,
        y: clientY,
      });
  };

  const touch = useSheetTouch({
    interactive: c.interactive,
    maximised: c.maximised,
    pan,
    local,
    hitAt,
    onGrip: (x, y) => onHandle(x, y, true),
    grab: (h) => {
      if (latest.current.editing) actions.commitEdit('none');
      selectFor(h);
    },
    extend: (from, clientX, clientY) => {
      const cc = latest.current;
      cc.focusGrid();
      if (from === 'grip') {
        // The grip drags the range's far corner: its top left stays put.
        const now = cc.selectionNow();
        const last = now.ranges[now.ranges.length - 1]!;
        cc.setSelection({ ...now, anchor: { r: last.r1, c: last.c1 } });
        begin({ kind: 'select', additive: false }, { clientX, clientY });
      } else if (from.kind === 'cell') {
        cc.setSelection(single({ r: from.r, c: from.c }));
        begin({ kind: 'select', additive: false }, { clientX, clientY });
      } else {
        const axis = from.kind === 'col' ? 'c' : 'r';
        const index = from.kind === 'col' ? from.c : from.r;
        cc.setSelection(
          axis === 'c' ? selectCols(index, index, cc.grid) : selectRows(index, index, cc.grid),
        );
        begin({ kind: 'axisSelect', axis, from: index }, { clientX, clientY });
      }
    },
    openMenu,
  });

  // A tap on a touch screen selects the cell, row or column under it, or the whole sheet from the corner (a finger's
  // drag pans the cells, useSheetPan, or scrolls them maximised).
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const cc = latest.current;
    if (!cc.interactive || (e.nativeEvent as PointerEvent).pointerType !== 'touch') return;
    e.stopPropagation();
    if (pan.swallowClick() || touch.swallowTap()) return;
    const { x, y } = local(e.clientX, e.clientY);
    const h = hitAt(x, y);
    if (h.kind === 'none') return;
    if (cc.editing) actions.commitEdit('none');
    if (h.kind === 'cell') cc.setSelection(single({ r: h.r, c: h.c }));
    else if (h.kind === 'col') cc.setSelection(selectCols(h.c, h.c, cc.grid));
    else if (h.kind === 'row') cc.setSelection(selectRows(h.r, h.r, cc.grid));
    else cc.setSelection(selectAllCells(cc.grid));
    cc.focusGrid();
  };

  return {
    pan,
    onPointerDown,
    onPointerMove,
    onDoubleClick,
    onContextMenu,
    onClick,
    cursor,
    preview,
    hover,
    ring: touch.ring,
    normaliseRange,
  };
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}
