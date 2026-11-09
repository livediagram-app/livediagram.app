// How big an image export's canvas may be: every product's PNG and PDF draw a tab on one canvas, and a canvas past
// what the browser draws comes out blank.

// The largest canvas side every browser draws (Safari and Firefox stop at 16384 px; Chrome 32767).
export const MAX_EXPORT_CANVAS_SIDE = 16384;

// The most pixels a canvas may hold in all: iOS Safari draws nothing on a bigger one (4096 x 4096), however
// short its sides, so a big tab under the side cap (8000 x 6000 at 2x was 195.6 MP) exported blank there, and the
// PDF path's pixel read of it took about 0.8 GB.
export const MAX_EXPORT_CANVAS_AREA = 16_777_216;

/** The scale an image export draws at: `wanted`, lowered so neither side of a `w` x `h` drawing
 *  passes MAX_EXPORT_CANVAS_SIDE and its whole-pixel canvas holds no more than MAX_EXPORT_CANVAS_AREA. */
export function exportScale(wanted: number, w: number, h: number): number {
  const longest = Math.max(w, h, 1);
  const bySide = Math.min(wanted, MAX_EXPORT_CANVAS_SIDE / longest);
  const wh = w * h;
  if (!(wh > 0)) return bySide;
  // Each side rounds up to a whole pixel (under one more), so solve (w*s + 1)(h*s + 1) <= area for s.
  const b = w + h;
  const byArea = (-b + Math.sqrt(b * b + 4 * wh * (MAX_EXPORT_CANVAS_AREA - 1))) / (2 * wh);
  return Math.min(bySide, byArea);
}
