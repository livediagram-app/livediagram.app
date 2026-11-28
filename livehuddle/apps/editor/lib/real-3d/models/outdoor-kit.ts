// Real 3D's outdoor models' shared kit (docs/specs/008-canvas/3d-engine.md "Block models"): the drawings' named
// colours, the round painted layers (dials, dartboards, a leafy ball) and the wall boards' face details, for
// outdoor.ts and its boards (outdoor-boards.ts) and games tables (outdoor-games.ts).
import { shade, type Rgb } from '../mesh-builder';
import type { Builder } from './kit';

// The drawings' named colours.
export const LEAF_DARK = 0x2f6e38;
export const LEAF = 0x428c46;
export const LEAF_LIGHT = 0x63ad5c;
export const TERRACOTTA = 0xc96a3f;
export const TERRACOTTA_DARK = 0xa3522e;
export const SOIL = 0x5b3a1f;
export const OAK = 0xc2894b;
export const OAK_DARK = 0x86431a;
export const LOG = 0x8e5f1a;
export const GOLD = 0xd6ad3c;
export const STONE = 0xe7e5e4;
export const STONE_DARK = 0xa8a29e;
export const FELT = 0x20994d;
export const FELT_DARK = 0x166534;
export const PITCH = 0x29be60;
export const WHITE = 0xf8fafc;
export const INK = 0x1c1917;
export const RED = 0xd23030;
export const BLUE = 0x386ad8;
export const FLAME = 0xdb7834;
export const FLAME_CORE = 0xdcba33;
export const CURTAIN = 0xb02525;
export const CURTAIN_DARK = 0x7f1d1d;
export const CURTAIN_GOLD = 0xcea424;
export const CLOCK_RIM = 0x4a2c17;
export const CLOCK_CREAM = 0xf7efdc;

/** Where the Clock's middle hangs on its wall, as built (risen by RISE): above a character's head. */
export const CLOCK_Z = 82;

/** A cell's paint, by where its middle sits in the grid: u across, v along, each -1..1. */
export type Paint = (u: number, v: number) => Rgb | null;

/** A repeatable 0..1 from a point, for the ragged edge of a canopy. */
export function hash(u: number, v: number, seed: number): number {
  const s = Math.sin(u * 127.1 + v * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Whether a cell lies in the grid's oval (or one `r` of its size). */
export const inOval = (u: number, v: number, r = 1) => u * u + v * v <= r * r;

/** A paint of one colour over the grid's oval, less an inner oval when `hole` is given. */
export const oval =
  (c: Rgb, hole = 0): Paint =>
  (u, v) =>
    inOval(u, v) && !inOval(u, v, hole) ? c : null;

/** Which of `n` wedges round the middle a cell sits in. */
export const wedge = (u: number, v: number, n: number) =>
  Math.floor(((Math.atan2(v, u) + Math.PI) / (2 * Math.PI)) * n + 0.5) % n;

/**
 * A round layer: the oval `2rx` x `2ry` about (cx, cy), painted by `paint` (rings, wedges, a hole), built smooth in
 * rings and wedges so its rim is round, not stepped. On the floor plan (x, y) and `w0..w1` high; or, with `wall`,
 * standing in the x-z plane (cy is the height of its middle) and `w0..w1` deep. `cell` is kept for the callers' sake.
 */
export function pixels(
  m: Builder,
  o: {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    cell: number;
    w0: number;
    w1: number;
    paint: Paint;
    lit?: (c: Rgb) => Rgb;
    wall?: boolean;
  },
): void {
  const R = Math.max(4, Math.min(16, Math.round(Math.max(o.rx, o.ry) / 3)));
  const W = Math.max(24, Math.min(64, Math.round(Math.max(o.rx, o.ry) * 1.2)));
  const P = (r: number, t: number, w: number): [number, number, number] => {
    const u = o.cx + Math.cos(t) * r * o.rx;
    const v = o.cy + Math.sin(t) * r * o.ry;
    return o.wall ? [u, w, v] : [u, v, w];
  };
  const N = (x: number, y: number, z: number): [number, number, number] =>
    o.wall ? [x, z, y] : [x, y, z];
  const cellAt = (i: number, j: number): Rgb | null => {
    if (i < 0 || i >= R) return null;
    const r = (i + 0.5) / R;
    const t = (((((j % W) + W) % W) + 0.5) / W) * Math.PI * 2;
    return o.paint(Math.cos(t) * r, Math.sin(t) * r);
  };
  const up = N(0, 0, 1);
  const down = N(0, 0, -1);
  for (let i = 0; i < R; i++)
    for (let j = 0; j < W; j++) {
      const c = cellAt(i, j);
      if (c === null) continue;
      const r0 = i / R;
      const r1 = (i + 1) / R;
      const t0 = (j / W) * Math.PI * 2;
      const t1 = ((j + 1) / W) * Math.PI * 2;
      const lit = o.lit?.(c) ?? c;
      const topRgb = shade(lit, 1);
      const sideRgb = shade(c, 1);
      // Its face and its back.
      m.tri(P(r0, t0, o.w1), P(r1, t0, o.w1), P(r1, t1, o.w1), up, up, up, topRgb);
      if (r0 > 0) m.tri(P(r0, t0, o.w1), P(r1, t1, o.w1), P(r0, t1, o.w1), up, up, up, topRgb);
      m.tri(P(r0, t0, o.w0), P(r1, t1, o.w0), P(r1, t0, o.w0), down, down, down, sideRgb);
      if (r0 > 0)
        m.tri(P(r0, t0, o.w0), P(r0, t1, o.w0), P(r1, t1, o.w0), down, down, down, sideRgb);
      // Its rim, outward and inward, where it meets nothing; smooth round.
      const band = (r: number, sgn: 1 | -1) => {
        const n0 = N((sgn * Math.cos(t0)) / o.rx, (sgn * Math.sin(t0)) / o.ry, 0);
        const n1 = N((sgn * Math.cos(t1)) / o.rx, (sgn * Math.sin(t1)) / o.ry, 0);
        const a = P(r, t0, o.w0);
        const b = P(r, t1, o.w0);
        const cc = P(r, t1, o.w1);
        const d = P(r, t0, o.w1);
        m.tri(a, b, cc, n0, n1, n1, sideRgb);
        m.tri(a, cc, d, n0, n1, n0, sideRgb);
      };
      if (cellAt(i + 1, j) === null) band(r1, 1);
      if (i > 0 && cellAt(i - 1, j) === null) band(r0, -1);
      // A wedge's cut side, where its neighbour round is empty.
      const cut = (t: number, nb: Rgb | null, sgn: 1 | -1) => {
        if (nb !== null) return;
        const n = N(-Math.sin(t) * sgn, Math.cos(t) * sgn, 0);
        m.tri(P(r0, t, o.w0), P(r1, t, o.w0), P(r1, t, o.w1), n, n, n, sideRgb);
        m.tri(P(r0, t, o.w0), P(r1, t, o.w1), P(r0, t, o.w1), n, n, n, sideRgb);
      };
      cut(t1, cellAt(i, j + 1), 1);
      cut(t0, cellAt(i, j - 1), -1);
    }
}

/** A smooth round slab on the floor plan, one colour, its top lit. */
export function disc(
  m: Builder,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  z0: number,
  z1: number,
  c: Rgb,
  top?: Rgb,
  _cell = 6,
): void {
  m.cylinder(cx, cy, z0, z1, 1, 1, c, { top, sx: rx, sy: ry, segments: 40 });
}

/**
 * A tier of foliage: a clump of leafy balls round an oval, `z0..z1` high, the upper balls a lighter leaf where the
 * sun catches them. Placed by `seed`, so each tree is the same for everyone.
 */
export function foliage(
  m: Builder,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  z0: number,
  z1: number,
  c: Rgb,
  top: Rgb,
  seed: number,
  _cell = 6,
): void {
  const h = z1 - z0;
  const zc = (z0 + z1) / 2;
  m.sphere(cx, cy, zc, rx * 0.78, ry * 0.78, h * 0.62, c, { segments: 18, rings: 9 });
  const n = Math.max(5, Math.round((rx + ry) / 9));
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2 + hash(k, seed, 1) * 0.6;
    const rr = 0.62 + hash(k, seed, 2) * 0.22;
    const br = Math.min(rx, ry) * (0.38 + hash(k, seed, 3) * 0.16);
    const bz = zc + (hash(k, seed, 4) - 0.35) * h * 0.55;
    m.sphere(
      cx + Math.cos(t) * rx * rr,
      cy + Math.sin(t) * ry * rr,
      bz,
      br,
      br * (ry / rx),
      Math.min(br, h * 0.6),
      hash(k, seed, 5) > 0.55 ? top : c,
      { segments: 14, rings: 7 },
    );
  }
}

/** The back of a wall piece's frame, where its board hangs. */
export const wallY = (D: number) => -D / 2;

/** A board's thickness off the wall. */
export const BOARD = 4;

/** A thin detail on a board's face, from x0..x1 and z0..z1, standing `out` proud of the board at `y`. */
export function onFace(
  m: Builder,
  y: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  c: Rgb,
  out = 0.8,
): void {
  m.b(x0, y, z0, x1, y + out, z1, c, { bare: true });
}
