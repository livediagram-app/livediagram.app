// Real 3D's lettering (docs/specs/008-canvas/3d-engine.md "Room names read in 3D"): a line of text built as geometry,
// so a room's name on its wall and on its Room Sign stays as crisp as the walls round it at every zoom, with no
// texture to blur or mipmap. The line is drawn once in the browser's own bold sans serif on a tall offscreen raster,
// its ink traced row by row with each edge placed to a fraction of a pixel (read from the raster's anti-aliasing), and
// each letter's strokes laid as a few trapezoids whose sides follow the letter's curves and slants, so a big name's
// edges are smooth lines rather than a staircase of pixel steps. The raster is the only DOM it touches (through
// `rasterise`, swapped in tests); everything else is pure.

import type { MeshBuilder, Rgb, Vec3 } from './mesh-builder';
import { shade } from './mesh-builder';

/** How tall the raster's line box is, in raster px: each letter's height is traced in about 90 rows. */
export const TEXT_RASTER_H = 128;

/**
 * A piece of a line's ink in raster px (x right, y down): a trapezoid from its top edge `y0` (running from `l0` to
 * `r0`) down to its bottom edge `y1` (from `l1` to `r1`).
 */
export type InkTrap = readonly [
  y0: number,
  l0: number,
  r0: number,
  y1: number,
  l1: number,
  r1: number,
];

/** A line's ink as trapezoids in raster px, and the raster's size. */
export type TextInk = {
  width: number;
  height: number;
  traps: readonly InkTrap[];
};

/** A line drawn to an alpha raster: `width` by `height`, one alpha byte per pixel. */
export type Raster = { width: number; height: number; alpha: Uint8Array | Uint8ClampedArray };

const FONT_PX = Math.round(TEXT_RASTER_H * 0.62);
const FONT = `700 ${FONT_PX}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
/** A capital letter's height on the raster (about 0.71 of the type size in a sans serif). */
const CAP_PX = FONT_PX * 0.71;

/** The browser's raster: the line in white on a clear canvas. Null where there is no canvas (a test, a worker). */
function domRaster(text: string): Raster | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.font = FONT;
  const width = Math.max(1, Math.ceil(ctx.measureText(text).width) + 8);
  canvas.width = width;
  canvas.height = TEXT_RASTER_H;
  ctx.font = FONT;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 4, TEXT_RASTER_H / 2);
  const data = ctx.getImageData(0, 0, width, TEXT_RASTER_H).data;
  const alpha = new Uint8Array(width * TEXT_RASTER_H);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3]!;
  return { width, height: TEXT_RASTER_H, alpha };
}

let rasterise: (text: string) => Raster | null = domRaster;

/** Swaps the raster (tests draw their own); returns the one it replaced. */
export function setTextRaster(
  next: (text: string) => Raster | null,
): (text: string) => Raster | null {
  const prev = rasterise;
  rasterise = next;
  inkCache.clear();
  return prev;
}

/** How far a run's edges may wander off a straight line, in raster px, and still be laid as one trapezoid side. */
const STRAIGHT = 0.12;

type Run = { x0: number; x1: number; l: number; r: number };
type Strip = { last: Run; pts: [number, number, number][] };

/**
 * A raster's ink as trapezoids: each row's inked runs (alpha at `threshold` or more), their ends placed to a fraction of
 * a pixel from the coverage of the pixels either side; a run carried down while the row below holds exactly one run
 * touching it (and it touches only that one), so a letter's stroke is one strip; and each strip's rows merged while
 * both its sides run straight, so a stem is one quad and a curve a handful.
 */
export function inkTraps(r: Raster, threshold = 110): InkTrap[] {
  const out: InkTrap[] = [];
  const a = (x: number, y: number) => (x < 0 || x >= r.width ? 0 : r.alpha[y * r.width + x]! / 255);
  const close = (s: Strip) => emitStrip(s.pts, out);
  let open: Strip[] = [];
  for (let y = 0; y < r.height; y++) {
    const runs: Run[] = [];
    let x = 0;
    while (x < r.width) {
      if (r.alpha[y * r.width + x]! < threshold) {
        x++;
        continue;
      }
      const x0 = x;
      while (x < r.width && r.alpha[y * r.width + x]! >= threshold) x++;
      // The edge inside the boundary pixels: the ink's coverage of the first pixel in and the last one out.
      const l = x0 + 1 - a(x0, y) - a(x0 - 1, y);
      const rr = x - 1 + a(x - 1, y) + a(x, y);
      runs.push({ x0, x1: x, l: Math.min(l, rr), r: Math.max(l, rr) });
    }
    // Which open strips each run touches, and how many runs touch each strip (both rows sorted by x).
    const touches = (s: Strip, q: Run) => s.last.x0 < q.x1 && q.x0 < s.last.x1;
    const strips = new Map<Strip, number>();
    const mates = runs.map((q) => {
      const hit = open.filter((s) => touches(s, q));
      for (const s of hit) strips.set(s, (strips.get(s) ?? 0) + 1);
      return hit;
    });
    const next: Strip[] = [];
    const carried = new Set<Strip>();
    runs.forEach((q, i) => {
      const hit = mates[i]!;
      const s = hit.length === 1 && strips.get(hit[0]!) === 1 ? hit[0]! : null;
      if (s) {
        s.last = q;
        s.pts.push([y + 0.5, q.l, q.r]);
        carried.add(s);
        next.push(s);
      } else next.push({ last: q, pts: [[y + 0.5, q.l, q.r]] });
    });
    for (const s of open) if (!carried.has(s)) close(s);
    open = next;
  }
  for (const s of open) close(s);
  return out;
}

// A strip's rows (each [y, left, right] at a row's middle) as trapezoids: its top and foot carried half a row on at
// its sides' slant (so a slanted stroke stays one straight side), rows dropped while both its sides stay within
// STRAIGHT of the line from the last kept row.
function emitStrip(rows: [number, number, number][], out: InkTrap[]): void {
  const cap = (
    p: [number, number, number],
    q: [number, number, number] | undefined,
    dy: number,
  ) => {
    let l = q ? p[1] - (q[1] - p[1]) / 2 : p[1];
    let r = q ? p[2] - (q[2] - p[2]) / 2 : p[2];
    if (l > r) l = r = (l + r) / 2;
    return [p[0] + dy, l, r] as [number, number, number];
  };
  const pts = [
    cap(rows[0]!, rows[1], -0.5),
    ...rows,
    cap(rows[rows.length - 1]!, rows[rows.length - 2], 0.5),
  ];
  let from = 0;
  for (let i = 2; i < pts.length; i++) {
    const p0 = pts[from]!;
    const p1 = pts[i]!;
    let straight = true;
    for (let j = from + 1; j < i && straight; j++) {
      const q = pts[j]!;
      const t = (q[0] - p0[0]) / (p1[0] - p0[0]);
      straight =
        Math.abs(p0[1] + (p1[1] - p0[1]) * t - q[1]) <= STRAIGHT &&
        Math.abs(p0[2] + (p1[2] - p0[2]) * t - q[2]) <= STRAIGHT;
    }
    if (straight) continue;
    const end = pts[i - 1]!;
    out.push([p0[0], p0[1], p0[2], end[0], end[1], end[2]]);
    from = i - 1;
  }
  const p0 = pts[from]!;
  const end = pts[pts.length - 1]!;
  out.push([p0[0], p0[1], p0[2], end[0], end[1], end[2]]);
}

// Each line's ink, by text: a Space has a handful of room names, so a small cache keeps every one built once.
const INK_CACHE_MAX = 128;
const inkCache = new Map<string, TextInk | null>();

/** A line's ink, built once per text (bounded), or null where there is no raster. */
export function textInk(text: string): TextInk | null {
  if (inkCache.has(text)) return inkCache.get(text)!;
  const r = rasterise(text);
  const ink = r ? { width: r.width, height: r.height, traps: inkTraps(r) } : null;
  if (inkCache.size >= INK_CACHE_MAX) inkCache.delete(inkCache.keys().next().value!);
  inkCache.set(text, ink);
  return ink;
}

/** The inked extent across a line, in raster px: where its first and last letters start and end. */
function inkSpan(ink: TextInk): { x0: number; x1: number; y0: number; y1: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [ya, la, ra, yb, lb, rb] of ink.traps) {
    x0 = Math.min(x0, la, lb);
    x1 = Math.max(x1, ra, rb);
    y0 = Math.min(y0, ya);
    y1 = Math.max(y1, yb);
  }
  return { x0, x1, y0, y1 };
}

/**
 * Lays `text` on a face: centred on `at`, reading along `right`, up `up`, lit as facing `normal`, its capitals `height`
 * tall and shrunk to fit `maxWidth`. Returns the width it took, or 0 when nothing was drawn.
 */
export function faceText(
  m: MeshBuilder,
  text: string,
  o: {
    at: Vec3;
    right: Vec3;
    up: Vec3;
    normal: Vec3;
    height: number;
    maxWidth: number;
    colour: Rgb;
  },
): number {
  const line = text.trim();
  if (!line) return 0;
  const ink = textInk(line);
  if (!ink || ink.traps.length === 0) return 0;
  const span = inkSpan(ink);
  let k = o.height / CAP_PX;
  const w = (span.x1 - span.x0) * k;
  if (w > o.maxWidth) k *= o.maxWidth / w;
  const cx = (span.x0 + span.x1) / 2;
  // The line's middle (where the raster drew it), so every name sits on the same line whatever its letters.
  const cy = ink.height / 2;
  const rgb = shade(o.colour, 1);
  const n = o.normal;
  const P = (x: number, y: number): Vec3 => {
    const u = (x - cx) * k;
    const v = (cy - y) * k;
    return [
      o.at[0] + o.right[0] * u + o.up[0] * v,
      o.at[1] + o.right[1] * u + o.up[1] * v,
      o.at[2] + o.right[2] * u + o.up[2] * v,
    ];
  };
  for (const [y0, l0, r0, y1, l1, r1] of ink.traps) {
    const a = P(l1, y1);
    const b = P(r1, y1);
    const c = P(r0, y0);
    const d = P(l0, y0);
    m.tri(a, b, c, n, n, n, rgb);
    // A side that closes to a point leaves only the one triangle.
    if (r0 - l0 > 1e-3) m.tri(a, c, d, n, n, n, rgb);
  }
  return (span.x1 - span.x0) * k;
}

/** How wide `text` would be laid with capitals `height` tall, before any shrinking (0 where there is no raster). */
export function textWidth(text: string, height: number): number {
  const ink = textInk(text.trim());
  if (!ink || ink.traps.length === 0) return 0;
  const span = inkSpan(ink);
  return ((span.x1 - span.x0) * height) / CAP_PX;
}
