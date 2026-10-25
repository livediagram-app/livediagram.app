'use client';

// Cell comments on the grid (docs/specs/029-sheets/sheet.md "Cell comments"): a small amber triangle in the top-right
// corner of every cell with an open thread, a preview of its first comment while the pointer rests on the cell, and
// the anchor the editor's thread popover sits beside. Ctrl + Alt + M (⌘ ⌥ M) opens the active cell's thread. Nothing
// draws over the frozen rows or columns a cell has scrolled under, nor outside the editor.
import { useEffect } from 'react';
import { formatA1, layoutIndex, single, type SheetLayout } from '@liveplanner/sheets';
import {
  CELL_COMMENT_ANCHOR_ATTR,
  cellCommentAnchor,
  useSheetCellThreads,
  useSheetComments,
} from '@/hooks/sheets/sheet-comments-context';
import { registerCellFocuser, registerCellNamer } from '@/hooks/sheets/sheet-cell-refs';
import { useDelayedReveal } from '@/hooks/ui/useDelayedReveal';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useSheetController, type SheetController } from './sheet-controller';
import { cellBox, mergeAt } from './sheet-geometry';
import {
  CELL_COMMENT_COLOUR,
  CELL_MARKER_PX,
  CELL_PREVIEW_DELAY_MS,
  cellKeyAt,
  cellMarkers,
  cellPreview,
  isCommentShortcut,
  type CellMarker,
} from './sheet-cell-comments';
import { SheetCellSlot } from './SheetCellSlot';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// The key of the cell a position names: a merge's top-left cell for any cell it covers.
export function threadCellAt(c: SheetController, r: number, col: number): string | null {
  const m = mergeAt(c.geometry, r, col);
  return cellKeyAt(c.sheet.layout, m ? m.r1 : r, m ? m.c1 : col);
}

export function SheetCellComments({ hover }: { hover: { r: number; c: number } | null }) {
  const c = useSheetController();
  const comments = useSheetComments();
  const own = useSheetCellThreads();
  const markers = cellMarkers(own?.threads, c.sheet.layout);
  const hovered =
    hover && !c.editing
      ? (markers.find((m) => {
          const span = mergeAt(c.geometry, m.r, m.c);
          return span
            ? hover.r >= span.r1 && hover.r <= span.r2 && hover.c >= span.c1 && hover.c <= span.c2
            : hover.r === m.r && hover.c === m.c;
        }) ?? null)
      : null;
  const reveal = useDelayedReveal(CELL_PREVIEW_DELAY_MS, hovered !== null);

  // Ctrl + Alt + M on the grid opens the active cell's thread (the grid's own keys leave it alone).
  const elementId = own?.elementId;
  const open = comments?.open;
  useEffect(() => {
    const el = c.gridEl;
    if (!el || !open || !elementId || !c.interactive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== el || !isCommentShortcut(e)) return;
      const { r, c: col } = c.selectionNow().active;
      const cell = threadCellAt(c, r, col);
      if (!cell) return;
      e.preventDefault();
      e.stopPropagation();
      open(elementId, cell);
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
    // `c` changes every render; what the listener reads of it is read when the key lands.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [c.gridEl, open, elementId, c.interactive]);

  // The Comments panel names this Sheet's cell threads by A1, and asks it to bring one into view.
  const layout = c.sheet.layout;
  useEffect(() => {
    if (!elementId) return;
    return registerCellNamer(elementId, (cell) => {
      const at = positionIn(layout, cell);
      return at ? formatA1(at.r, at.c) : null;
    });
  }, [elementId, layout]);
  const latest = useLatest(c);
  useEffect(() => {
    if (!elementId) return;
    return registerCellFocuser(elementId, (cell) => {
      const now = latest.current;
      const at = positionIn(now.sheet.layout, cell);
      if (at) now.setSelection(single(at));
    });
  }, [elementId, latest]);

  if (!own || !comments) return null;
  const g = c.geometry;
  const viewW = c.view.width - g.headW;
  const viewH = c.view.height - g.headH;
  // The box a thread's marker and anchor sit on: its merge's when merged; null when out of view, hidden, or
  // scrolled under the frozen lines.
  const boxOf = (r: number, col: number) => {
    if (g.hiddenRow(r) || g.hiddenCol(col)) return null;
    const box = cellBox(g, r, col, c.scroll, mergeAt(g, r, col));
    if (c.view.height > 0 && (box.y + box.h <= 0 || box.y >= viewH)) return null;
    if (c.view.width > 0 && (box.x + box.w <= 0 || box.x >= viewW)) return null;
    if (r >= g.frozenRows && g.frozenRows > 0 && box.y < g.frozenHeight) return null;
    if (col >= g.frozenCols && g.frozenCols > 0 && box.x < g.frozenWidth) return null;
    return box;
  };
  const openHere = comments.openCell?.elementId === own.elementId ? comments.openCell.cell : null;
  const openPos = openHere ? positionIn(c.sheet.layout, openHere) : null;
  const anchorBox = openPos ? boxOf(openPos.r, openPos.c) : null;
  const previewBox = hovered && reveal ? boxOf(hovered.r, hovered.c) : null;
  return (
    <>
      {markers.map((m) => {
        const box = boxOf(m.r, m.c);
        if (!box) return null;
        const a1 = formatA1(m.r, m.c);
        return (
          <SheetCellSlot key={m.cell} r={m.r} c={m.c}>
            <button
              type="button"
              data-comment-trigger
              aria-label={`Show Comments on ${a1}`}
              disabled={!c.interactive}
              className="absolute z-[7] cursor-pointer p-0 disabled:cursor-default"
              style={{
                left: box.x + box.w - CELL_MARKER_PX,
                top: box.y,
                width: CELL_MARKER_PX,
                height: CELL_MARKER_PX,
                background: `linear-gradient(to bottom left, ${CELL_COMMENT_COLOUR} 50%, transparent 50%)`,
              }}
              onPointerDown={stop}
              onDoubleClick={stop}
              onClick={() => comments.open(own.elementId, m.cell)}
            />
          </SheetCellSlot>
        );
      })}
      {anchorBox && openHere ? (
        <div
          aria-hidden
          {...{ [CELL_COMMENT_ANCHOR_ATTR]: cellCommentAnchor(own.elementId, openHere) }}
          className="pointer-events-none absolute"
          style={{ left: anchorBox.x, top: anchorBox.y, width: anchorBox.w, height: anchorBox.h }}
        />
      ) : null}
      {previewBox && hovered && hovered.cell !== openHere ? (
        <SheetCellSlot r={hovered.r} c={hovered.c}>
          <CellPreview marker={hovered} box={previewBox} />
        </SheetCellSlot>
      ) : null}
    </>
  );
}

// Where a cell key sits now, or null when its row or column is gone.
function positionIn(layout: SheetLayout, cell: string): { r: number; c: number } | null {
  const ix = layoutIndex(layout);
  const i = cell.indexOf(':');
  const r = ix.rowPos.get(cell.slice(0, i));
  const col = ix.colPos.get(cell.slice(i + 1));
  return r === undefined || col === undefined ? null : { r, c: col };
}

function CellPreview({
  marker,
  box,
}: {
  marker: CellMarker;
  box: { x: number; y: number; w: number; h: number };
}) {
  const { author, text, more } = cellPreview(marker);
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-[10] w-56 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      style={{ left: box.x + box.w + 4, top: box.y }}
    >
      <p className="font-semibold text-slate-900 dark:text-slate-100">{author}</p>
      <p className="mt-0.5 whitespace-pre-wrap break-words">{text}</p>
      {more ? <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{more}</p> : null}
    </div>
  );
}
