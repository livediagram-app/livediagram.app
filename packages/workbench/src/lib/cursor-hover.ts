// Which remote cursors sit under (or near) this screen's own pointer
// (docs/specs/012-collaboration/collaborator-enhancements.md "Cursors Step Aside"), so the layer can fade them out
// of the way. Pure arithmetic on numbers the layer already has: the canvas origin on screen (one rect read per
// frame at most), the zoom, and each cursor's canvas point. Nothing reads a cursor's own layout.

/** A cursor as the hit test needs it: its canvas point, and what its pill holds. */
export type HoverCursor = { id: string; name: string; x: number; y: number; picture?: string };

/** Where canvas (0, 0) sits on screen, and the pointer, both in client pixels. */
export type ClientPoint = { x: number; y: number };

// The cursor's drawing in screen pixels (RemoteCursor): a 16 px arrow, then the pill 12 px right of and below its
// tip, 10 px semibold text with 6 px of padding a side, 18 px tall, and a 14 px picture with a 4 px gap when there is one.
const ARROW_PX = 16;
const PILL_OFFSET_PX = 12;
const PILL_HEIGHT_PX = 18;
const PILL_PADDING_PX = 12;
const PILL_PICTURE_PX = 18;
// An average glyph of 10 px Inter semibold, a little wide so a long name is never undercounted.
const PILL_CHAR_PX = 6.5;
/** How near the pointer has to come, in screen pixels, for a cursor to step aside. */
export const CURSOR_NEAR_PX = 8;

/** The pill's width as drawn, from its name's length: no layout read. */
export function pillWidth(name: string, picture?: string): number {
  return Math.ceil(name.length * PILL_CHAR_PX) + PILL_PADDING_PX + (picture ? PILL_PICTURE_PX : 0);
}

/** Whether the pointer is over, or within CURSOR_NEAR_PX of, the cursor's arrow or its pill. */
export function pointerNearCursor(
  cursor: HoverCursor,
  pointer: ClientPoint,
  origin: ClientPoint,
  zoom: number,
): boolean {
  const left = origin.x + cursor.x * zoom - CURSOR_NEAR_PX;
  const top = origin.y + cursor.y * zoom - CURSOR_NEAR_PX;
  const right =
    origin.x +
    cursor.x * zoom +
    Math.max(ARROW_PX, PILL_OFFSET_PX + pillWidth(cursor.name, cursor.picture)) +
    CURSOR_NEAR_PX;
  const bottom = origin.y + cursor.y * zoom + PILL_OFFSET_PX + PILL_HEIGHT_PX + CURSOR_NEAR_PX;
  return pointer.x >= left && pointer.x <= right && pointer.y >= top && pointer.y <= bottom;
}

/** The ids of the cursors near the pointer, as one comparable key (`''` for none). */
export function cursorsNearKey(
  cursors: readonly HoverCursor[],
  pointer: ClientPoint | null,
  origin: ClientPoint,
  zoom: number,
): string {
  if (!pointer) return '';
  let key = '';
  for (const c of cursors) {
    if (pointerNearCursor(c, pointer, origin, zoom)) key = key ? `${key}\n${c.id}` : c.id;
  }
  return key;
}
