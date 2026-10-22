// Red Eye (docs/specs/031-photo/photo-tools.md "Retouching"): a press on a red pupil darkens the red
// around it: the red pixels joined to the press, within a radius set by the Pupil Size, made a dark
// neutral, their edge feathered.
import type { Raster } from '../raster/raster';

/** How red a pixel is: its red over the mean of its green and blue, 0 when not red. */
function redness(d: Uint8ClampedArray, i: number): number {
  const r = d[i]!;
  const gb = (d[i + 1]! + d[i + 2]!) / 2;
  return r > 60 && r > gb * 1.4 ? Math.min(1, (r - gb) / (r + 1)) : 0;
}

/** Darkens the red pupil at (x, y) in `r` in place. `pupil` 0..1 (the share of the search radius
 *  the pupil may span), `darken` 0..1. `radius` px is how far to look. Answers how many pixels
 *  changed. */
export function removeRedEye(
  r: Raster,
  x: number,
  y: number,
  { pupil = 0.5, darken = 0.5, radius = 40 } = {},
): number {
  const reach = Math.max(2, radius * (0.4 + pupil * 0.6));
  const w = r.width;
  const h = r.height;
  const d = r.data;
  const seen = new Uint8Array(w * h);
  const sx = Math.floor(x);
  const sy = Math.floor(y);
  // Start from the reddest pixel near the press.
  let start = -1;
  let best = 0;
  for (let j = -3; j <= 3; j++)
    for (let i = -3; i <= 3; i++) {
      const px = sx + i;
      const py = sy + j;
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const v = redness(d, (py * w + px) * 4);
      if (v > best) {
        best = v;
        start = py * w + px;
      }
    }
  if (start < 0) return 0;
  const queue = [start];
  seen[start] = 1;
  let changed = 0;
  while (queue.length) {
    const p = queue.pop()!;
    const px = p % w;
    const py = (p - px) / w;
    const i = p * 4;
    const red = redness(d, i);
    if (red <= 0) continue;
    const dist = Math.hypot(px - sx, py - sy);
    // Feather the last fifth of the reach.
    const edge = Math.min(1, Math.max(0, (reach - dist) / (reach * 0.2)));
    const k = Math.min(1, red * 1.5) * edge;
    const target = ((d[i + 1]! + d[i + 2]!) / 2) * (1 - darken);
    d[i] = d[i]! + (target - d[i]!) * k;
    d[i + 1] = d[i + 1]! * (1 - darken * k * 0.5);
    d[i + 2] = d[i + 2]! * (1 - darken * k * 0.5);
    changed++;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = px + dx;
      const ny = py + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (seen[n] || Math.hypot(nx - sx, ny - sy) > reach) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  return changed;
}
