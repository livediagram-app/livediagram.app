// Selecting by colour (docs/specs/031-photo/photo-tools.md "Selecting", "Fills and gradients"): the
// Magic Wand, the Paint Bucket's region, Grow, and Colour Range all ask which pixels are like a
// colour within a tolerance, touching or anywhere.
import { createMask, type Mask8 } from '../raster/mask';
import type { Raster } from '../raster/raster';

/** Whether the pixel at `i` (byte offset) is within `tolerance` of the colour, by its largest
 *  channel difference, alpha included. */
function like(d: Uint8ClampedArray, i: number, c: readonly number[], tolerance: number): boolean {
  return (
    Math.abs(d[i]! - c[0]!) <= tolerance &&
    Math.abs(d[i + 1]! - c[1]!) <= tolerance &&
    Math.abs(d[i + 2]! - c[2]!) <= tolerance &&
    Math.abs(d[i + 3]! - c[3]!) <= tolerance
  );
}

/** The pixels like the one at (x, y): touching it (`contiguous`) or anywhere. The mask covers the
 *  whole raster (its origin the raster's, at `at`). */
export function floodSelect(
  r: Raster,
  x: number,
  y: number,
  {
    tolerance = 32,
    contiguous = true,
    at = { x: 0, y: 0 },
  }: { tolerance?: number; contiguous?: boolean; at?: { x: number; y: number } } = {},
): Mask8 {
  const m = createMask({ x: at.x, y: at.y, width: r.width, height: r.height });
  if (x < 0 || y < 0 || x >= r.width || y >= r.height) return m;
  const d = r.data;
  const seed = (y * r.width + x) * 4;
  const c = [d[seed]!, d[seed + 1]!, d[seed + 2]!, d[seed + 3]!];
  if (!contiguous) {
    for (let p = 0; p < r.width * r.height; p++) if (like(d, p * 4, c, tolerance)) m.data[p] = 255;
    return m;
  }
  // Scanline flood: fill a run, then queue the runs above and below it.
  const w = r.width;
  const h = r.height;
  const stack: number[] = [x, y];
  while (stack.length) {
    const sy = stack.pop()!;
    const sx = stack.pop()!;
    let lx = sx;
    const row = sy * w;
    if (m.data[row + lx] || !like(d, (row + lx) * 4, c, tolerance)) continue;
    while (lx > 0 && !m.data[row + lx - 1] && like(d, (row + lx - 1) * 4, c, tolerance)) lx--;
    let rx = sx;
    while (rx < w - 1 && !m.data[row + rx + 1] && like(d, (row + rx + 1) * 4, c, tolerance)) rx++;
    for (let i = lx; i <= rx; i++) m.data[row + i] = 255;
    for (const ny of [sy - 1, sy + 1]) {
      if (ny < 0 || ny >= h) continue;
      const nrow = ny * w;
      let inRun = false;
      for (let i = lx; i <= rx; i++) {
        const ok = !m.data[nrow + i] && like(d, (nrow + i) * 4, c, tolerance);
        if (ok && !inRun) {
          stack.push(i, ny);
          inRun = true;
        } else if (!ok) inRun = false;
      }
    }
  }
  return m;
}

/** A hard mask's edge softened over one pixel (the Anti-alias option): each edge pixel the mean of
 *  its 3 x 3 neighbourhood. */
export function antiAliasEdge(m: Mask8): Mask8 {
  const out: Mask8 = { ...m, data: new Uint8Array(m.data) };
  const w = m.width;
  const h = m.height;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = m.data[y * w + x]!;
      let sum = 0;
      let n = 0;
      let edge = false;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const xx = x + i;
          const yy = y + j;
          const s = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : m.data[yy * w + xx]!;
          if (s !== v) edge = true;
          sum += s;
          n++;
        }
      if (edge) out.data[y * w + x] = Math.round((sum / n + v) / 2);
    }
  return out;
}

/** Colour Range: every pixel by its closeness to any of the picked colours, soft within
 *  `fuzziness` (0..200, as the dialog's; full in at a distance of 0, out past the fuzziness). */
export function colourRange(
  r: Raster,
  colours: readonly (readonly number[])[],
  fuzziness: number,
  at = { x: 0, y: 0 },
): Mask8 {
  const m = createMask({ x: at.x, y: at.y, width: r.width, height: r.height });
  if (colours.length === 0) return m;
  const d = r.data;
  const f = Math.max(1, fuzziness);
  for (let p = 0; p < r.width * r.height; p++) {
    const i = p * 4;
    if (d[i + 3] === 0) continue;
    let best = Infinity;
    for (const c of colours) {
      const dist = Math.max(
        Math.abs(d[i]! - c[0]!),
        Math.abs(d[i + 1]! - c[1]!),
        Math.abs(d[i + 2]! - c[2]!),
      );
      if (dist < best) best = dist;
    }
    m.data[p] = best >= f ? 0 : Math.round((1 - best / f) * 255);
  }
  return m;
}
