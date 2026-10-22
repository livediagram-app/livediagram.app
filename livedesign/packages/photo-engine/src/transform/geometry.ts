// Turning, flipping and sizing a photo's canvas (docs/specs/031-photo/photo-pages.md "Changing the
// size"): the rasters' parts, and where a layer's offset goes when the canvas around it changes.
import { createRaster, type Raster } from '../raster/raster';

export type QuarterTurn = 90 | 180 | 270;

/** The raster turned clockwise by a quarter turn, two or three. */
export function rotateQuarter(src: Raster, turn: QuarterTurn): Raster {
  const { width: w, height: h, data: d } = src;
  const out = turn === 180 ? createRaster(w, h) : createRaster(h, w);
  const o = out.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let nx: number;
      let ny: number;
      if (turn === 90) {
        nx = h - 1 - y;
        ny = x;
      } else if (turn === 180) {
        nx = w - 1 - x;
        ny = h - 1 - y;
      } else {
        nx = y;
        ny = w - 1 - x;
      }
      const si = (y * w + x) * 4;
      const di = (ny * out.width + nx) * 4;
      o[di] = d[si]!;
      o[di + 1] = d[si + 1]!;
      o[di + 2] = d[si + 2]!;
      o[di + 3] = d[si + 3]!;
    }
  return out;
}

export function flipRaster(src: Raster, horizontal: boolean): Raster {
  const { width: w, height: h, data: d } = src;
  const out = createRaster(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const nx = horizontal ? w - 1 - x : x;
      const ny = horizontal ? y : h - 1 - y;
      out.data.set(d.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), (ny * w + nx) * 4);
    }
  return out;
}

export type Anchor =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'centre'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

export const ANCHORS: readonly Anchor[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'centre',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
];

/** How far the existing pixels move when the canvas becomes `w` x `h`, held at `anchor`. */
export function canvasShift(
  from: { width: number; height: number },
  to: { width: number; height: number },
  anchor: Anchor,
): { dx: number; dy: number } {
  const i = ANCHORS.indexOf(anchor);
  const col = i % 3;
  const row = Math.floor(i / 3);
  const dw = to.width - from.width;
  const dh = to.height - from.height;
  return { dx: Math.round((dw * col) / 2), dy: Math.round((dh * row) / 2) };
}

/** Where a point of the photo goes when the whole photo turns by a quarter turn, two or three. */
export function rotatePoint(
  x: number,
  y: number,
  size: { width: number; height: number },
  turn: QuarterTurn,
): { x: number; y: number } {
  if (turn === 90) return { x: size.height - y, y: x };
  if (turn === 180) return { x: size.width - x, y: size.height - y };
  return { x: y, y: size.width - x };
}
