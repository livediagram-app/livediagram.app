'use client';

// The grid (docs/specs/029-sheets/sheet.md "The grid"; blueprint sheet-element.md "Layout", "Keyboard and focus"): a
// native scroll container over a spacer the size of the whole sheet, with a sticky viewport inside that draws only
// what is in view: the cells, the headers, the selection, the editor. One tab stop; its keys are the grid's while it
// has focus, and Escape hands them back to the canvas.
import { usePlan } from '@/components/plan/PlanContext';
import { cardFieldChoice } from './card-field-options';
import { SheetCardRows } from './SheetCardRows';
import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  cycleInRange,
  displayValue,
  formatA1,
  homeEnd,
  isError,
  pageSelection,
  posRangeOf,
  selectAll,
  selectCols,
  selectRows,
  single,
  SHEET_ROWS_MAX,
} from '@livediagram/sheets';
import { restorePlanElement } from '@/hooks/plan/maximised-plan';
import { useSheetController } from './sheet-controller';
import { SheetCells } from './SheetCells';
import { SheetHeaders } from './SheetHeaders';
import { SheetSelectionLayer, type Outline } from './SheetSelectionLayer';
import { SheetCellEditor } from './SheetCellEditor';
import { useSheetsBridgeContext } from '@/hooks/sheets/useSheetsBridge';
import { ADD_ROWS_PX, SheetAddRows } from './SheetAddRows';
import { cellBox, pageRows, scrollToReveal, totalSize, visibleWindow } from './sheet-geometry';
import { sheetKey } from './sheet-keys';
import { refSpans, spanRange } from './formula-assist';
import { useSheetPointer, type PointRef } from './useSheetPointer';
import { useSheetClipboard } from './useSheetClipboard';
import { sheetPresenceFor } from './sheet-presence-store';
import type { SheetActions } from './useSheetActions';
import type { FormulaInput } from './useFormulaInput';
import type { SheetPeer } from '@/hooks/sheets/useSheetsBridge';

type Props = {
  elementId: string;
  actions: SheetActions;
  input: FormulaInput;
  pointRef: PointRef;
  peers: readonly SheetPeer[];
  fontFamily?: string;
};

// Find's matches: a soft yellow, as a spreadsheet marks them.
const FIND_HIGHLIGHT = '#facc15';

export function SheetGrid({ elementId, actions, input, pointRef, peers, fontFamily }: Props) {
  const bridge = useSheetsBridgeContext();
  const c = useSheetController();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pointer = useSheetPointer(viewportRef, actions, pointRef);
  const clipboard = useSheetClipboard();
  const total = totalSize(c.geometry);
  // Room under the last row for Add Rows, for someone who may edit.
  const footer = c.canEdit && c.sheet.layout.rows.length < SHEET_ROWS_MAX ? ADD_ROWS_PX : 0;
  const window = visibleWindow(c.geometry, c.scroll, {
    width: Math.max(0, c.view.width - c.geometry.headW),
    height: Math.max(0, c.view.height - c.geometry.headH),
  });
  const presence = sheetPresenceFor(c.store);
  const presenceVersion = useSyncExternalStore(
    presence.subscribe,
    presence.getVersion,
    presence.getVersion,
  );

  // The grid's size, for the window; its scroll, for what is drawn.
  useLayoutEffect(() => {
    const el = c.gridEl;
    if (!el) return;
    const measure = () => c.setView({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [c.gridEl, c.setView]); // eslint-disable-line react-hooks/exhaustive-deps

  // The wheel scrolls the grid, not the canvas, while the grid can scroll that way (as a board's body).
  useEffect(() => {
    const el = c.gridEl;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || !c.interactive) return;
      const canY = el.scrollHeight > el.clientHeight;
      const canX = el.scrollWidth > el.clientWidth;
      if ((canY && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) || (canX && e.deltaX !== 0))
        e.stopPropagation();
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, [c.gridEl, c.interactive]);

  // Keep the active cell in view as it moves.
  const { r: ar, c: ac } = c.selection.active;
  useEffect(() => {
    const el = c.gridEl;
    if (!el) return;
    const next = scrollToReveal(c.geometry, ar, ac, c.scroll, {
      width: c.view.width - c.geometry.headW,
      height: c.view.height - c.geometry.headH,
    });
    if (next) el.scrollTo({ top: next.top, left: next.left });
  }, [ar, ac]); // eslint-disable-line react-hooks/exhaustive-deps

  // This person's selection, said to the room (useSheetPresence's store throttles it).
  useEffect(() => {
    const ranges = c.selection.ranges
      .map((g) => {
        const rows = c.sheet.layout.rows;
        const cols = c.sheet.layout.cols;
        return rows[g.r1] && cols[g.c1] && rows[g.r2] && cols[g.c2]
          ? { r1: rows[g.r1]!, c1: cols[g.c1]!, r2: rows[g.r2]!, c2: cols[g.c2]! }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    presence.say({
      kind: 'sheet-presence',
      tabId: c.sheet.tabId,
      sheetId: c.sheet.id,
      ranges,
      editing: !!c.editing,
    });
  }, [c.selection, c.editing, c.sheet, presence]);
  useEffect(
    () => () =>
      presence.say({
        kind: 'sheet-presence',
        tabId: c.sheet.tabId,
        sheetId: c.sheet.id,
        ranges: null,
        editing: false,
      }),
    [presence, c.sheet.id, c.sheet.tabId],
  );

  const outlines = useMemo<Outline[]>(() => {
    const out: Outline[] = [];
    // The references a formula being written names, in their colours.
    if (c.editing?.draft.startsWith('=')) {
      for (const span of refSpans(c.editing.draft)) {
        const r = spanRange(span);
        if (r) out.push({ range: r, color: span.colour, dashed: true });
      }
    }
    // Each peer's selection, in their colour, named.
    const byId = new Map(peers.map((p) => [p.id, p]));
    for (const [id, sel] of presence.on(c.sheet.id)) {
      const peer = byId.get(id);
      if (!peer) continue;
      sel.ranges.forEach((ids, i) => {
        const p = posRangeOf(c.sheet.layout, ids);
        if (!p) return;
        const hover =
          !!pointer.hover &&
          sel.ranges.some((ids) => {
            const g = posRangeOf(c.sheet.layout, ids);
            return (
              !!g &&
              pointer.hover!.r >= g.r1 &&
              pointer.hover!.r <= g.r2 &&
              pointer.hover!.c >= g.c1 &&
              pointer.hover!.c <= g.c2
            );
          });
        out.push({
          range: p,
          color: peer.color,
          thick: sel.editing,
          ...(i === 0 ? { label: peer.name, labelAt: sel.at, labelHover: hover } : {}),
        });
      });
    }
    // Find's matches in view.
    for (const h of c.findHits)
      if (h.r >= window.r1 && h.r <= window.r2 && h.c >= window.c1 && h.c <= window.c2)
        out.push({
          range: { r1: h.r, c1: h.c, r2: h.r, c2: h.c },
          color: FIND_HIGHLIGHT,
          highlight: true,
        });
    return out;
    // `presence` is the store itself (stable); `presenceVersion` says when it moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    c.editing?.draft,
    peers,
    c.sheet.id,
    c.sheet.layout,
    presenceVersion,
    c.findHits,
    window,
    pointer.hover,
  ]);

  // A card table's set-value columns keep room for their dropdown arrow (SheetCardRows).
  const plan = usePlan();
  const tables = c.sheet.layout.cardTables;
  const dropdownCols = useMemo(() => {
    const out = new Set<string>();
    if (!plan || !c.interactive || !c.canEdit) return out;
    for (const t of tables ?? [])
      for (const col of t.cols) if (cardFieldChoice(col.field, plan)) out.add(col.c);
    return out;
  }, [tables, plan, c.interactive, c.canEdit]);

  const filter = useMemo(() => {
    const f = c.sheet.layout.filter;
    const p = f ? posRangeOf(c.sheet.layout, f) : null;
    if (!f || !p) return null;
    const cols = [];
    for (let col = p.c1; col <= p.c2; col++) {
      const colId = c.sheet.layout.cols[col]!;
      cols.push({ c: col, colId, active: !!f.conds[colId] });
    }
    return { r: p.r1, cols };
  }, [c.sheet.layout]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (c.editing || e.target !== e.currentTarget) return;
    // A bare Space is held for Space-drag panning; it types a space on release when no pan used it.
    if (pointer.pan.onKeyDown(e)) return;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      void clipboard.pasteSpecial('values');
      return;
    }
    const cmd = sheetKey(e);
    if (!cmd) return;
    // Copy, cut and paste arrive as clipboard events; undo and redo reach the canvas.
    e.preventDefault();
    e.stopPropagation();
    const sel = c.selectionNow();
    const range = sel.ranges[sel.ranges.length - 1]!;
    const multi = range.r1 !== range.r2 || range.c1 !== range.c2;
    switch (cmd.kind) {
      case 'move':
        return actions.move(cmd.dir, cmd.jump, cmd.extend);
      case 'tab':
        return multi
          ? c.setSelection(cycleInRange(sel, cmd.back ? 'prev-col' : 'next-col'))
          : actions.move(cmd.back ? 'left' : 'right');
      case 'enter':
        if (multi) return c.setSelection(cycleInRange(sel, cmd.back ? 'prev-row' : 'next-row'));
        return cmd.back ? actions.move('up') : actions.startEdit('cell');
      case 'edit':
        return actions.startEdit('cell');
      case 'type':
        return actions.startEdit('type', cmd.text);
      case 'home':
      case 'end': {
        const ext = c.workbook.extent(c.sheet.id);
        return c.setSelection(
          homeEnd(sel, cmd.kind, cmd.toSheet, c.grid, {
            r: Math.max(0, ext.rows - 1),
            c: Math.max(0, ext.cols - 1),
          }),
        );
      }
      case 'page':
        return c.setSelection(
          pageSelection(
            sel,
            (cmd.up ? -1 : 1) * pageRows(c.geometry, c.view.height - c.geometry.headH),
            c.grid,
          ),
        );
      case 'selectAll':
        return c.setSelection(selectAll(sel, c.grid));
      case 'selectRow':
        return c.setSelection(selectRows(range.r1, range.r2, c.grid));
      case 'selectCol':
        return c.setSelection(selectCols(range.c1, range.c2, c.grid));
      case 'clear':
        return c.canEdit ? actions.clear('inputs') : undefined;
      case 'toggle':
        return c.canEdit ? actions.toggle(cmd.flag) : undefined;
      case 'now':
        return c.canEdit ? actions.typeNow(cmd.what) : undefined;
      case 'fill':
        return c.canEdit ? actions.fillEdge(cmd.dir) : undefined;
      case 'numberFormat':
        return c.canEdit ? actions.numberFormat(cmd.nf) : undefined;
      case 'find':
        return c.setFindOpen(cmd.replace && c.canEdit ? 'replace' : 'find');
      case 'menu': {
        const rect = c.gridEl?.getBoundingClientRect();
        const box = cellBox(c.geometry, sel.active.r, sel.active.c, c.scroll);
        if (rect)
          c.setMenu({
            kind: 'cell',
            x: rect.left + c.geometry.headW + box.x,
            y: rect.top + c.geometry.headH + box.y + box.h,
          });
        return;
      }
      case 'escape':
        if (c.marquee) return c.setMarquee(null);
        if (c.findOpen) return c.setFindOpen(null);
        if (c.maximised) return restorePlanElement();
        // Out of the grid: the Sheet element is selected on the canvas, and the canvas has the keys again.
        c.gridEl?.blur();
        bridge?.selectElement(elementId);
        return;
    }
  };

  // The error under the pointer says why (sheet.md "The grid").
  const hovered = pointer.hover;
  const hoverValue = hovered ? c.workbook.value(c.sheet.id, hovered.r, hovered.c) : null;
  const hoverError =
    hovered && isError(hoverValue) ? displayValue(hoverValue, undefined, c.locale).error : null;
  const hoverBox =
    hovered && hoverError ? cellBox(c.geometry, hovered.r, hovered.c, c.scroll) : null;

  const active = formatA1(c.selection.active.r, c.selection.active.c);
  // A callback ref of its own: a property of `c` passed as `ref` would make the whole controller read as a ref.
  const { setGridEl } = c;
  return (
    <div
      ref={setGridEl}
      // Escape first ends an edit, the copied range's marquee or Find; only then does it restore a maximised sheet.
      data-keeps-escape={c.editing || c.marquee || c.findOpen ? '' : undefined}
      role="grid"
      tabIndex={c.interactive ? 0 : -1}
      aria-label={`${c.sheet.title} grid`}
      aria-rowcount={c.sheet.layout.rows.length}
      aria-colcount={c.sheet.layout.cols.length}
      aria-multiselectable
      aria-activedescendant={`${elementId}-${active}`}
      data-sheet-grid
      className={`relative min-h-0 flex-1 outline-none ${c.interactive ? (c.maximised ? 'overflow-auto' : 'overflow-auto touch-none') : 'overflow-hidden'}`}
      onScroll={(e) =>
        c.setScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft })
      }
      onKeyDown={onKeyDown}
      onBlur={() => pointer.pan.releaseSpace()}
      onKeyUp={(e) => {
        if (!c.editing && e.target === e.currentTarget)
          pointer.pan.onKeyUp(e, () => actions.startEdit('type', ' '));
      }}
      onCopy={clipboard.onCopy}
      onCut={clipboard.onCut}
      onPaste={clipboard.onPaste}
    >
      <div
        className="relative"
        style={{
          width: c.geometry.headW + total.width,
          height: c.geometry.headH + total.height + footer,
        }}
      >
        <div
          ref={viewportRef}
          className="sticky left-0 top-0 overflow-hidden"
          style={{ width: c.view.width, height: c.view.height, cursor: pointer.cursor }}
          onPointerDown={pointer.onPointerDown}
          onPointerMove={pointer.onPointerMove}
          onDoubleClick={pointer.onDoubleClick}
          onContextMenu={pointer.onContextMenu}
          onClick={pointer.onClick}
        >
          <div
            className="absolute overflow-hidden"
            style={{ left: c.geometry.headW, top: c.geometry.headH, right: 0, bottom: 0 }}
          >
            <SheetCells
              padEnd={dropdownCols}
              sheet={c.sheet}
              workbook={c.workbook}
              version={c.version}
              geometry={c.geometry}
              window={window}
              scroll={c.scroll}
              palette={c.palette}
              locale={c.locale}
              fontFamily={fontFamily}
            />
            {c.interactive ? (
              <SheetSelectionLayer
                geometry={c.geometry}
                scroll={c.scroll}
                palette={c.palette}
                selection={c.selection}
                showHandle={c.canEdit && !c.editing && c.focused}
                marquee={c.marquee}
                outlines={outlines}
                filter={filter}
                onFilterButton={(colId, at) =>
                  c.setMenu({ kind: 'filter', colId, x: at.x, y: at.y })
                }
                quiet={!c.focused}
              />
            ) : null}
            <SheetCardRows />
            {pointer.preview?.kind === 'fill' ? (
              <SheetSelectionLayer
                geometry={c.geometry}
                scroll={c.scroll}
                palette={c.palette}
                selection={single({ r: pointer.preview.range.r1, c: pointer.preview.range.c1 })}
                showHandle={false}
                marquee={{ range: pointer.preview.range, cut: false }}
                outlines={[]}
                filter={null}
                onFilterButton={null}
              />
            ) : null}
            <span id={`${elementId}-${active}`} role="gridcell" aria-selected className="sr-only">
              {active}{' '}
              {
                displayValue(
                  c.workbook.value(c.sheet.id, c.selection.active.r, c.selection.active.c),
                  undefined,
                  c.locale,
                ).text
              }
            </span>
          </div>
          <div className="absolute" style={{ left: c.geometry.headW, top: c.geometry.headH }}>
            <SheetCellEditor input={input} fontFamily={fontFamily} />
          </div>
          <SheetHeaders
            geometry={c.geometry}
            window={window}
            scroll={c.scroll}
            palette={c.palette}
            selection={c.interactive ? c.selection : null}
            view={c.view}
            onUnhide={c.canEdit ? (axis, from, to) => actions.hide(axis, false, from, to) : null}
          />
          {pointer.preview?.kind === 'resize' || pointer.preview?.kind === 'move' ? (
            <div
              className="pointer-events-none absolute z-[9]"
              style={
                pointer.preview.axis === 'c'
                  ? {
                      left:
                        pointer.preview.kind === 'move'
                          ? c.geometry.headW + pointer.preview.at
                          : pointer.preview.at,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      backgroundColor: c.palette.focus,
                    }
                  : {
                      top:
                        pointer.preview.kind === 'move'
                          ? c.geometry.headH + pointer.preview.at
                          : pointer.preview.at,
                      left: 0,
                      right: 0,
                      height: 2,
                      backgroundColor: c.palette.focus,
                    }
              }
            />
          ) : null}
          {footer && total.height - c.scroll.top < c.view.height ? (
            <SheetAddRows top={total.height - c.scroll.top} onAdd={actions.appendRows} />
          ) : null}
          {hoverError && hoverBox ? (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-[10] max-w-64 rounded-md bg-slate-800 px-2 py-1 text-[11px] text-white shadow"
              style={{
                left: c.geometry.headW + hoverBox.x,
                top: c.geometry.headH + hoverBox.y + hoverBox.h + 2,
              }}
            >
              {hoverError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
