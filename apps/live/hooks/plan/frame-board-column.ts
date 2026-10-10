// A tap on a board column's header on a phone frames that column (docs/specs/026-plan/plan-board.md "On a
// phone"), as a tap on a page does in Illustrate: the view glides to fit the column, header to the board's foot,
// below the top strip. The column's box is read off the screen and turned into canvas coordinates through the
// board element's own place and size (the board is never rotated), then fitted as a page is (computeFitBelow).
import { computeFitBelow } from '@/lib/viewport';
import { glideViewport } from '@/lib/viewport-glide';
import { topStripInset } from '@/lib/top-strip-inset';
import { debugLog } from '@/lib/debug-log';
import type { ViewportStore } from '@/lib/viewport-store';

type Box = { left: number; top: number; width: number; height: number };

// The column's box in canvas coordinates: `column` and `board` as on screen, `element` the board's canvas box.
export function columnCanvasBox(
  column: Box,
  board: Box,
  element: { x: number; y: number; width: number },
): { x: number; y: number; width: number; height: number } | null {
  const scale = board.width / element.width;
  if (!(scale > 0)) return null;
  return {
    x: element.x + (column.left - board.left) / scale,
    y: element.y + (column.top - board.top) / scale,
    width: column.width / scale,
    height: column.height / scale,
  };
}

// Glides the view to the column whose header is `header`, on the board drawn by `boardEl` (canvas box
// `element`). Returns false when there is nothing to frame (no canvas, an unmeasured board).
export function frameBoardColumn(
  header: HTMLElement,
  boardEl: HTMLElement,
  element: { id: string; x: number; y: number; width: number },
  store: ViewportStore,
): boolean {
  const main = boardEl.closest('main');
  if (!main) return false;
  const h = header.getBoundingClientRect();
  const b = boardEl.getBoundingClientRect();
  // The column runs from its header down to the board's foot.
  const box = columnCanvasBox(
    { left: h.left, top: h.top, width: h.width, height: b.bottom - h.top },
    b,
    element,
  );
  if (!box) return false;
  const target = computeFitBelow(
    { width: main.offsetWidth, height: main.offsetHeight },
    box,
    topStripInset(main),
  );
  glideViewport(store.get(), target, { zoom: store.setZoom, offset: store.setOffset });
  debugLog('[plan] column.framed', { boardId: element.id, zoom: target.zoom });
  return true;
}
