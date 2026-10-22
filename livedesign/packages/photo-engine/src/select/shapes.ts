// Selections drawn as shapes (docs/specs/031-photo/photo-tools.md "Selecting"): a rectangle, an
// ellipse, and a polygon (the lassos), each anti-aliased by its coverage of the pixel unless asked
// not to be.
import { createMask, type Mask8 } from '../raster/mask';
import type { Rect } from '../raster/raster';

type P = { x: number; y: number };

/** A rectangle, its edges in photo coordinates (fractional edges cover pixels in part). */
export function rectMask(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  antiAlias = true,
): Mask8 | null {
  const l = Math.min(x0, x1);
  const r = Math.max(x0, x1);
  const t = Math.min(y0, y1);
  const b = Math.max(y0, y1);
  if (!antiAlias) {
    const rl = Math.round(l);
    const rt = Math.round(t);
    const w = Math.round(r) - rl;
    const h = Math.round(b) - rt;
    if (w <= 0 || h <= 0) return null;
    return createMask({ x: rl, y: rt, width: w, height: h }, 255);
  }
  const rect: Rect = {
    x: Math.floor(l),
    y: Math.floor(t),
    width: Math.ceil(r) - Math.floor(l),
    height: Math.ceil(b) - Math.floor(t),
  };
  if (rect.width <= 0 || rect.height <= 0) return null;
  const m = createMask(rect);
  for (let y = 0; y < rect.height; y++) {
    const py = rect.y + y;
    const cy = Math.max(0, Math.min(py + 1, b) - Math.max(py, t));
    for (let x = 0; x < rect.width; x++) {
      const px = rect.x + x;
      const cx = Math.max(0, Math.min(px + 1, r) - Math.max(px, l));
      m.data[y * rect.width + x] = Math.round(cx * cy * 255);
    }
  }
  return m;
}

// Samples a side of a pixel for coverage.
const SS = 4;

/** An ellipse inscribed in the box from (x0, y0) to (x1, y1). */
export function ellipseMask(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  antiAlias = true,
): Mask8 | null {
  const l = Math.min(x0, x1);
  const r = Math.max(x0, x1);
  const t = Math.min(y0, y1);
  const b = Math.max(y0, y1);
  const rx = (r - l) / 2;
  const ry = (b - t) / 2;
  if (rx <= 0 || ry <= 0) return null;
  const cx = l + rx;
  const cy = t + ry;
  const rect: Rect = {
    x: Math.floor(l),
    y: Math.floor(t),
    width: Math.ceil(r) - Math.floor(l),
    height: Math.ceil(b) - Math.floor(t),
  };
  const m = createMask(rect);
  const inside = (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (let y = 0; y < rect.height; y++)
    for (let x = 0; x < rect.width; x++) {
      const px = rect.x + x;
      const py = rect.y + y;
      if (!antiAlias) {
        m.data[y * rect.width + x] = inside(px + 0.5, py + 0.5) ? 255 : 0;
        continue;
      }
      let hits = 0;
      for (let j = 0; j < SS; j++)
        for (let i = 0; i < SS; i++) if (inside(px + (i + 0.5) / SS, py + (j + 0.5) / SS)) hits++;
      m.data[y * rect.width + x] = Math.round((hits / (SS * SS)) * 255);
    }
  return m;
}

/** A closed polygon (the lassos), by the even-odd rule, its coverage sampled on a 4 x 4 grid a pixel
 *  (a scanline per sub-row). */
export function polygonMask(points: readonly P[], antiAlias = true): Mask8 | null {
  if (points.length < 3) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const rect: Rect = {
    x: Math.floor(Math.min(...xs)),
    y: Math.floor(Math.min(...ys)),
    width: Math.ceil(Math.max(...xs)) - Math.floor(Math.min(...xs)),
    height: Math.ceil(Math.max(...ys)) - Math.floor(Math.min(...ys)),
  };
  if (rect.width <= 0 || rect.height <= 0) return null;
  const m = createMask(rect);
  const sub = antiAlias ? SS : 1;
  const acc = new Uint16Array(rect.width);
  const n = points.length;
  const crossings: number[] = [];
  for (let y = 0; y < rect.height; y++) {
    acc.fill(0);
    for (let j = 0; j < sub; j++) {
      const sy = rect.y + y + (j + 0.5) / sub;
      crossings.length = 0;
      for (let k = 0; k < n; k++) {
        const a = points[k]!;
        const c = points[(k + 1) % n]!;
        if ((a.y <= sy && c.y > sy) || (c.y <= sy && a.y > sy)) {
          crossings.push(a.x + ((sy - a.y) / (c.y - a.y)) * (c.x - a.x));
        }
      }
      crossings.sort((p, q) => p - q);
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const from = crossings[k]! - rect.x;
        const to = crossings[k + 1]! - rect.x;
        // Each sub-column whose centre is inside the span counts.
        const i0 = Math.max(0, Math.ceil(from * sub - 0.5));
        const i1 = Math.min(rect.width * sub - 1, Math.floor(to * sub - 0.5));
        for (let i = i0; i <= i1; i++) acc[Math.floor(i / sub)]!++;
      }
    }
    for (let x = 0; x < rect.width; x++)
      m.data[y * rect.width + x] = Math.round((acc[x]! / (sub * sub)) * 255);
  }
  return m;
}
