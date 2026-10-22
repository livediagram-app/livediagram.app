// A selection (docs/specs/031-photo/photo-tools.md "Domain language"): a soft mask, one byte a pixel
// (0 outside, 255 fully in), over a rect of the photo; everything outside its rect is outside the
// selection. Each person's own, never stored.
import type { Rect } from './raster';

export type Mask8 = { x: number; y: number; width: number; height: number; data: Uint8Array };

export function createMask(rect: Rect, fill = 0): Mask8 {
  const data = new Uint8Array(rect.width * rect.height);
  if (fill) data.fill(fill);
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, data };
}

export function maskAt(m: Mask8, x: number, y: number): number {
  const mx = x - m.x;
  const my = y - m.y;
  if (mx < 0 || my < 0 || mx >= m.width || my >= m.height) return 0;
  return m.data[my * m.width + mx]!;
}

export function maskRect(m: Mask8): Rect {
  return { x: m.x, y: m.y, width: m.width, height: m.height };
}

/** The mask over `rect`: its values inside, zero elsewhere. */
export function maskOver(m: Mask8, rect: Rect): Mask8 {
  const out = createMask(rect);
  const x0 = Math.max(rect.x, m.x);
  const y0 = Math.max(rect.y, m.y);
  const x1 = Math.min(rect.x + rect.width, m.x + m.width);
  const y1 = Math.min(rect.y + rect.height, m.y + m.height);
  for (let y = y0; y < y1; y++) {
    const s = (y - m.y) * m.width + (x0 - m.x);
    const o = (y - rect.y) * rect.width + (x0 - rect.x);
    out.data.set(m.data.subarray(s, s + Math.max(0, x1 - x0)), o);
  }
  return out;
}

/** The smallest rect holding every selected pixel, or null when nothing is selected. */
export function maskBounds(m: Mask8): Rect | null {
  let minX = m.width;
  let minY = m.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < m.height; y++) {
    const row = y * m.width;
    for (let x = 0; x < m.width; x++) {
      if (m.data[row + x] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0
    ? null
    : { x: m.x + minX, y: m.y + minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** The mask cut down to its selected bounds (null when empty). */
export function trimMask(m: Mask8): Mask8 | null {
  const b = maskBounds(m);
  return b ? maskOver(m, b) : null;
}

export type MaskCombine = 'new' | 'add' | 'subtract' | 'intersect';

/** `next` combined into `current` by the selection modifier. */
export function combineMasks(current: Mask8 | null, next: Mask8, how: MaskCombine): Mask8 | null {
  if (how === 'new' || !current) {
    if (how === 'subtract' || how === 'intersect') return how === 'intersect' ? null : current;
    return trimMask(next);
  }
  const x0 = Math.min(current.x, next.x);
  const y0 = Math.min(current.y, next.y);
  const x1 = Math.max(current.x + current.width, next.x + next.width);
  const y1 = Math.max(current.y + current.height, next.y + next.height);
  const rect = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  const a = maskOver(current, rect);
  const b = maskOver(next, rect);
  const out = createMask(rect);
  for (let i = 0; i < out.data.length; i++) {
    const p = a.data[i]!;
    const q = b.data[i]!;
    out.data[i] =
      how === 'add' ? Math.max(p, q) : how === 'subtract' ? Math.min(p, 255 - q) : Math.min(p, q);
  }
  return trimMask(out);
}

/** Everything in `bounds` that is not selected. */
export function invertMask(m: Mask8 | null, bounds: Rect): Mask8 {
  const out = createMask(bounds, 255);
  if (!m) return out;
  const over = maskOver(m, bounds);
  for (let i = 0; i < out.data.length; i++) out.data[i] = 255 - over.data[i]!;
  return out;
}

/** How many pixels are selected at all. */
export function selectedCount(m: Mask8): number {
  let n = 0;
  for (const v of m.data) if (v > 0) n++;
  return n;
}
