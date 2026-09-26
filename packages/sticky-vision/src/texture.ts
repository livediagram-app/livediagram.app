import { rgbToHsv, type ImageBuffer } from './colour';

// What the SURFACE inside a box looks like (docs/specs/021-event-storming/event-storming.md Phase 9), for telling a
// sticky from the things that share its colour: cardboard, masking tape, a
// patch of kraft between two notes. Paper is smooth and ends in a crisp edge
// on every side; cardboard is grained and printed, and a patch of wall has no
// edge of its own at all.
//
// Every measure is RELATIVE to the box's own brightness, so the same paper in
// the shade and in the sun reads the same.

type Box = { x: number; y: number; w: number; h: number };

// How far in from the box's edge the interior starts, as a share of its short
// side: the box is fitted to the paper only roughly, and its rim is the edge.
const INTERIOR_INSET = 0.12;
// A pixel this much darker than the paper's median brightness is ink (or a
// shadow on the paper), not the paper's own texture.
const INK_LUMA_RATIO = 0.8;
// Pixels this close to ink are left out too: a stroke's antialiased rim is
// a gradient that belongs to the handwriting, not to the surface.
const INK_MARGIN_PX = 2;
// LBP's comparison dead-band, in grey levels: below it, a neighbour counts as
// equal, so JPEG noise on flat paper does not read as texture.
const LBP_DEADBAND = 2;
// How deep the strips either side of an edge reach, as a share of the short
// side, and how far out from the box's own edge the outside strip starts.
const EDGE_STRIP = 0.12;
// The interior `valueSpreadOf` samples: the box's rim is its edge and shadow.
const SPREAD_INSET = 0.15;
// A box varying less than this share of the frame's median box is blank.
// Measured on the eight labelled walls: the least-written real note sits at
// 0.39 of its frame's median, window panes and bare kraft at 0.01 to 0.3;
// every value from 0.25 to 0.38 keeps every note, and 0.3 sits in the middle.
// Fitted leave-one-wall-out, the threshold lands between 0.30 and 0.40.
const BLANK_SPREAD_RATIO = 0.3;
// Below this median spread a frame's notes show no writing to compare
// against. Real walls sit at 0.07 (small notes on a whiteboard) to 0.15.
const MIN_WRITTEN_SPREAD = 0.03;
// A blank box whose weakest side differs from beyond it by less than this
// (largest channel, share of full scale) has no edge of its own. Measured:
// blank junk sits at 0.002 to 0.03 (one at 0.06), an unwritten note on a wall
// at 0.08 or more; 0.04 to 0.07 all score the same on the eight walls.
const BLANK_EDGE_CONTRAST = 0.05;
// Below this brightness and above this roughness a box is dark grain, not
// paper. Measured on the eight labelled walls: no note is both, anywhere in
// roughness 0.03 to 0.035 and brightness 0.4 to 0.55 (the notes' roughness
// p90 is 0.04, but only where they are lit); fitted leave-one-wall-out, the
// pair lands at 0.023 to 0.026 and 0.48 to 0.55 on every wall and costs no
// note on any of them.
const DARK_GRAIN_BRIGHTNESS = 0.5;
const DARK_GRAIN_ROUGHNESS = 0.03;

const lumaAt = (image: ImageBuffer, x: number, y: number): number => {
  const i = (y * image.width + x) * 4;
  return 0.299 * image.data[i]! + 0.587 * image.data[i + 1]! + 0.114 * image.data[i + 2]!;
};

// The interior's luma, and which of its pixels are clear of ink, as one grid
// in box-interior coordinates. Shared by every texture measure.
type Interior = {
  x0: number;
  y0: number;
  w: number;
  h: number;
  luma: Float32Array;
  clear: Uint8Array;
  median: number;
};

function interiorOf(image: ImageBuffer, box: Box): Interior | null {
  const inset = Math.max(1, Math.round(Math.min(box.w, box.h) * INTERIOR_INSET));
  const x0 = Math.max(0, box.x + inset);
  const y0 = Math.max(0, box.y + inset);
  const x1 = Math.min(image.width, box.x + box.w - inset);
  const y1 = Math.min(image.height, box.y + box.h - inset);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 5 || h < 5) return null;
  const luma = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) luma[y * w + x] = lumaAt(image, x0 + x, y0 + y);
  }
  const sorted = Float32Array.from(luma).sort();
  const median = Math.max(1, sorted[sorted.length >> 1]!);
  const ink = new Uint8Array(w * h);
  for (let p = 0; p < luma.length; p += 1) if (luma[p]! < median * INK_LUMA_RATIO) ink[p] = 1;
  // Clear = no ink within the margin, and far enough from the rim for a 3x3
  // operator to stay inside.
  const clear = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      let near = 0;
      for (let dy = -INK_MARGIN_PX; dy <= INK_MARGIN_PX && !near; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -INK_MARGIN_PX; dx <= INK_MARGIN_PX; dx += 1) {
          const xx = x + dx;
          if (xx >= 0 && xx < w && ink[yy * w + xx]) {
            near = 1;
            break;
          }
        }
      }
      if (!near) clear[y * w + x] = 1;
    }
  }
  return { x0, y0, w, h, luma, clear, median };
}

// Mean Sobel gradient magnitude over the ink-free interior, divided by the
// paper's own brightness. Smooth paper sits near zero; grained cardboard and
// printed packaging do not.
export function roughnessOf(image: ImageBuffer, box: Box): number {
  const inner = interiorOf(image, box);
  if (!inner) return 0;
  const { w, h, luma, clear, median } = inner;
  let sum = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const p = y * w + x;
      if (!clear[p]) continue;
      const gx =
        luma[p - w + 1]! +
        2 * luma[p + 1]! +
        luma[p + w + 1]! -
        luma[p - w - 1]! -
        2 * luma[p - 1]! -
        luma[p + w - 1]!;
      const gy =
        luma[p + w - 1]! +
        2 * luma[p + w]! +
        luma[p + w + 1]! -
        luma[p - w - 1]! -
        2 * luma[p - w]! -
        luma[p - w + 1]!;
      sum += Math.hypot(gx, gy) / 8;
      n += 1;
    }
  }
  return n === 0 ? 0 : sum / n / median;
}

// Entropy of the 8-neighbour local binary patterns over the ink-free
// interior, as a share of the 8 bits it could be. Flat paper repeats one
// pattern; a grain uses them all.
export function lbpEntropyOf(image: ImageBuffer, box: Box): number {
  const inner = interiorOf(image, box);
  if (!inner) return 0;
  const { w, h, luma, clear } = inner;
  const counts = new Uint32Array(256);
  const offsets = [-w - 1, -w, -w + 1, 1, w + 1, w, w - 1, -1];
  let n = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const p = y * w + x;
      if (!clear[p]) continue;
      const c = luma[p]! + LBP_DEADBAND;
      let code = 0;
      for (let k = 0; k < 8; k += 1) if (luma[p + offsets[k]!]! > c) code |= 1 << k;
      counts[code]! += 1;
      n += 1;
    }
  }
  if (n === 0) return 0;
  let entropy = 0;
  for (const c of counts) {
    if (c === 0) continue;
    const q = c / n;
    entropy -= q * Math.log2(q);
  }
  return entropy / 8;
}

// How different the paper just inside each side is from what lies just
// outside it, per side, weakest first (sides off the frame are left out). The
// difference is the largest channel's, as a share of full scale, taken at the
// median along the side so handwriting or a neighbour at one end does not
// decide it.
export function edgeSidesOf(image: ImageBuffer, box: Box): number[] {
  const depth = Math.max(1, Math.round(Math.min(box.w, box.h) * EDGE_STRIP));
  const mean = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): [number, number, number] | null => {
    const xa = Math.max(0, x0);
    const ya = Math.max(0, y0);
    const xb = Math.min(image.width, x1);
    const yb = Math.min(image.height, y1);
    if (xb <= xa || yb <= ya) return null;
    const sum: [number, number, number] = [0, 0, 0];
    let n = 0;
    for (let y = ya; y < yb; y += 1) {
      for (let x = xa; x < xb; x += 1) {
        const i = (y * image.width + x) * 4;
        sum[0] += image.data[i]!;
        sum[1] += image.data[i + 1]!;
        sum[2] += image.data[i + 2]!;
        n += 1;
      }
    }
    return [sum[0] / n, sum[1] / n, sum[2] / n];
  };
  const differ = (a: [number, number, number] | null, b: [number, number, number] | null) =>
    a && b ? Math.max(...a.map((v, c) => Math.abs(v - b[c]!))) / 255 : null;
  const { x, y, w, h } = box;
  const segments = 6;
  const side = (
    inner: (t0: number, t1: number) => [number, number, number] | null,
    outer: (t0: number, t1: number) => [number, number, number] | null,
  ): number | null => {
    const diffs: number[] = [];
    for (let s = 0; s < segments; s += 1) {
      const d = differ(
        inner(s / segments, (s + 1) / segments),
        outer(s / segments, (s + 1) / segments),
      );
      if (d !== null) diffs.push(d);
    }
    if (diffs.length < segments / 2) return null;
    diffs.sort((a, b) => a - b);
    return diffs[diffs.length >> 1]!;
  };
  const along = (from: number, span: number, t: number) => Math.round(from + span * t);
  const sides = [
    // top
    side(
      (a, b) => mean(along(x, w, a), y, along(x, w, b), y + depth),
      (a, b) => (y - depth < 0 ? null : mean(along(x, w, a), y - depth, along(x, w, b), y)),
    ),
    // bottom
    side(
      (a, b) => mean(along(x, w, a), y + h - depth, along(x, w, b), y + h),
      (a, b) =>
        y + h + depth > image.height
          ? null
          : mean(along(x, w, a), y + h, along(x, w, b), y + h + depth),
    ),
    // left
    side(
      (a, b) => mean(x, along(y, h, a), x + depth, along(y, h, b)),
      (a, b) => (x - depth < 0 ? null : mean(x - depth, along(y, h, a), x, along(y, h, b))),
    ),
    // right
    side(
      (a, b) => mean(x + w - depth, along(y, h, a), x + w, along(y, h, b)),
      (a, b) =>
        x + w + depth > image.width
          ? null
          : mean(x + w, along(y, h, a), x + w + depth, along(y, h, b)),
    ),
  ].filter((d): d is number => d !== null);
  return sides.sort((a, b) => a - b);
}

// The weakest side's contrast: a note differs from what is round it on every
// side, a patch of wall between two notes on none of its own.
export function edgeContrastOf(image: ImageBuffer, box: Box): number {
  const sides = edgeSidesOf(image, box);
  return sides.length === 0 ? Number.POSITIVE_INFINITY : sides[0]!;
}

// How much brightness varies inside a box: the standard deviation of HSV
// value over its interior (inset 15%, every second pixel). Writing is dark on
// light paper, so a written note varies; a window pane, a patch of bare wall
// or the strip of ceiling above the paper does not.
export function valueSpreadOf(image: ImageBuffer, box: Box, insetShare = SPREAD_INSET): number {
  const inset = Math.max(1, Math.round(Math.min(box.w, box.h) * insetShare));
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (
    let y = Math.max(0, box.y + inset);
    y < Math.min(image.height, box.y + box.h - inset);
    y += 2
  ) {
    for (
      let x = Math.max(0, box.x + inset);
      x < Math.min(image.width, box.x + box.w - inset);
      x += 2
    ) {
      const i = (y * image.width + x) * 4;
      const { v } = rgbToHsv({ r: image.data[i]!, g: image.data[i + 1]!, b: image.data[i + 2]! });
      sum += v;
      sumSq += v * v;
      n += 1;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
}

// Drops the boxes that are BLANK against the frame's own notes AND have no
// edge of their own: a box whose brightness varies less than
// BLANK_SPREAD_RATIO of the frame's median box, and whose weakest side is
// barely different from what lies beyond it. Blank alone is not enough: an
// unwritten sticky is still a note, and still ends in an edge on every side;
// a window pane or a patch of bare kraft runs on past the box.
// Judged against the frame because how much writing shows depends on how
// near the camera was and how sharp the photo is; a whiteboard of small
// notes shows half the spread of a close-up kraft wall. A frame whose median
// box shows no writing at all (blank notes, a drawn wall) has nothing to
// judge against, and keeps every box.
export function dropBlank<T extends Box>(image: ImageBuffer, boxes: T[]): T[] {
  if (boxes.length === 0) return boxes;
  const spreads = boxes.map((b) => valueSpreadOf(image, b));
  const sorted = [...spreads].sort((a, b) => a - b);
  const typical = sorted[sorted.length >> 1]!;
  if (typical < MIN_WRITTEN_SPREAD) return boxes;
  return boxes.filter(
    (box, i) =>
      spreads[i]! >= typical * BLANK_SPREAD_RATIO ||
      edgeContrastOf(image, box) >= BLANK_EDGE_CONTRAST,
  );
}

// The median brightness (HSV value) of a box's interior.
export function brightnessOf(image: ImageBuffer, box: Box): number {
  const inset = Math.max(1, Math.round(Math.min(box.w, box.h) * SPREAD_INSET));
  const values: number[] = [];
  for (
    let y = Math.max(0, box.y + inset);
    y < Math.min(image.height, box.y + box.h - inset);
    y += 2
  ) {
    for (
      let x = Math.max(0, box.x + inset);
      x < Math.min(image.width, box.x + box.w - inset);
      x += 2
    ) {
      const i = (y * image.width + x) * 4;
      values.push(Math.max(image.data[i]!, image.data[i + 1]!, image.data[i + 2]!) / 255);
    }
  }
  if (values.length === 0) return 1;
  values.sort((a, b) => a - b);
  return values[values.length >> 1]!;
}

// Is the box DARK AND GRAINED: cardboard, furniture, a window frame at night?
// Paper is smooth once its writing is set aside, lit or shaded; a surface
// that is both below half brightness and grained is something in the room.
// Grain alone is not enough (lit paper photographed sharply shows its
// fibre), and dark alone is not either (a note in deep shade).
export function isDarkGrain(image: ImageBuffer, box: Box): boolean {
  return (
    brightnessOf(image, box) < DARK_GRAIN_BRIGHTNESS &&
    roughnessOf(image, box) > DARK_GRAIN_ROUGHNESS
  );
}

export const TEXTURE_CALIBRATION = {
  INTERIOR_INSET,
  INK_LUMA_RATIO,
  INK_MARGIN_PX,
  LBP_DEADBAND,
  EDGE_STRIP,
  SPREAD_INSET,
  BLANK_SPREAD_RATIO,
  MIN_WRITTEN_SPREAD,
  BLANK_EDGE_CONTRAST,
  DARK_GRAIN_BRIGHTNESS,
  DARK_GRAIN_ROUGHNESS,
} as const;
