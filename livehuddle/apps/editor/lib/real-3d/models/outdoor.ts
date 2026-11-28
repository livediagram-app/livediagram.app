// Real 3D's outdoor and recreation models (docs/specs/008-canvas/3d-engine.md "Block models"): plants and trees,
// the wall boards (hung at eye height against the back of their frame), the games tables, fires, the umbrella, the
// fountain, the bike rack, the stage curtains, pillars, columns, the signpost and the pet bed. Each in its drawing's
// colours (packages/document office*.ts), round things built smooth (cylinders, turned shapes, leafy balls).
import { shade, type Rgb } from '../mesh-builder';
import type { Builder } from './kit';
import { KIND_HEIGHT, METAL_DARK, mix, RISE, WOOD_DARK, type ModelTable } from './kit';

// The drawings' named colours.
const LEAF_DARK = 0x2f6e38;
const LEAF = 0x428c46;
const LEAF_LIGHT = 0x63ad5c;
const TERRACOTTA = 0xc96a3f;
const TERRACOTTA_DARK = 0xa3522e;
const SOIL = 0x5b3a1f;
const OAK = 0xc2894b;
const OAK_DARK = 0x86431a;
const LOG = 0x8e5f1a;
const GOLD = 0xd6ad3c;
const STONE = 0xe7e5e4;
const STONE_DARK = 0xa8a29e;
const FELT = 0x20994d;
const FELT_DARK = 0x166534;
const PITCH = 0x29be60;
const WHITE = 0xf8fafc;
const INK = 0x1c1917;
const RED = 0xd23030;
const BLUE = 0x386ad8;
const FLAME = 0xdb7834;
const FLAME_CORE = 0xdcba33;
const CURTAIN = 0xb02525;
const CURTAIN_DARK = 0x7f1d1d;
const CURTAIN_GOLD = 0xcea424;
const CLOCK_RIM = 0x4a2c17;
const CLOCK_CREAM = 0xf7efdc;

/** Where the Clock's middle hangs on its wall, as built (risen by RISE): above a character's head. */
export const CLOCK_Z = 82;

/** A cell's paint, by where its middle sits in the grid: u across, v along, each -1..1. */
type Paint = (u: number, v: number) => Rgb | null;

/** A repeatable 0..1 from a point, for the ragged edge of a canopy. */
export function hash(u: number, v: number, seed: number): number {
  const s = Math.sin(u * 127.1 + v * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Whether a cell lies in the grid's oval (or one `r` of its size). */
const inOval = (u: number, v: number, r = 1) => u * u + v * v <= r * r;

/** A paint of one colour over the grid's oval, less an inner oval when `hole` is given. */
const oval =
  (c: Rgb, hole = 0): Paint =>
  (u, v) =>
    inOval(u, v) && !inOval(u, v, hole) ? c : null;

/** Which of `n` wedges round the middle a cell sits in. */
const wedge = (u: number, v: number, n: number) =>
  Math.floor(((Math.atan2(v, u) + Math.PI) / (2 * Math.PI)) * n + 0.5) % n;

/**
 * A round layer: the oval `2rx` x `2ry` about (cx, cy), painted by `paint` (rings, wedges, a hole), built smooth in
 * rings and wedges so its rim is round, not stepped. On the floor plan (x, y) and `w0..w1` high; or, with `wall`,
 * standing in the x-z plane (cy is the height of its middle) and `w0..w1` deep. `cell` is kept for the callers' sake.
 */
function pixels(
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
function disc(
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
const wallY = (D: number) => -D / 2;

/** A board's thickness off the wall. */
const BOARD = 4;

/** A thin detail on a board's face, from x0..x1 and z0..z1, standing `out` proud of the board at `y`. */
function onFace(
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

export const OUTDOOR_MODELS: ModelTable = {
  plant: (m, { f }) => {
    // A terracotta pot with a rim and soil, and spiky leaves fanning up and out from it on every side.
    const { y0, y1 } = f.foot;
    const cy = (y0 + y1) / 2;
    m.c(0, cy, 16, 13, 0, 4, TERRACOTTA_DARK);
    m.c(0, cy, 20, 16, 4, 14, TERRACOTTA);
    m.c(0, cy, 23, 19, 14, 17, TERRACOTTA_DARK, { top: TERRACOTTA });
    m.c(0, cy, 18, 14, 17, 17.6, SOIL, { bare: true });
    m.c(0, cy, 4, 4, 17, 52, LEAF, { top: LEAF_LIGHT });
    const steps: [number, number, number][] = [
      [3.5, 17, 34],
      [7.5, 28, 42],
      [11.5, 38, 47],
    ];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      for (const [k, z0, z1] of steps)
        m.c(dx * k, cy + dy * k, 4, 4, z0, z1, k > 5 ? LEAF : LEAF_DARK, { top: LEAF_LIGHT });
    for (const [dx, dy] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ] as const) {
      m.c(dx * 4.5, cy + dy * 4.5, 3.5, 3.5, 17, 30, LEAF_DARK, { top: LEAF_LIGHT });
      m.c(dx * 8, cy + dy * 8, 3.5, 3.5, 26, 36, LEAF, { top: LEAF_LIGHT });
    }
  },

  'outdoor-plant': (m, { f }) => {
    // A stone planter with a lit rim, a round flowering bush spilling over it, pink and yellow flowers all round.
    const { y0, y1 } = f.foot;
    const cy = (y0 + y1) / 2;
    const body = mix(0xdedad3, 0xa39d94, 0.45);
    m.c(0, cy, 26, 14, 0, 4, 0xa39d94);
    m.c(0, cy, 32, 16, 4, 12, body);
    m.c(0, cy, 40, 20, 12, 16, 0xdedad3);
    foliage(m, 0, cy, 23, 15, 16, 26, LEAF, LEAF_LIGHT, 1, 4);
    foliage(m, 0, cy, 18, 12, 26, 34, LEAF, LEAF_LIGHT, 2, 4);
    disc(m, 0, cy, 10, 7, 34, 40, LEAF_LIGHT, LEAF_LIGHT, 4);
    const flowers: [number, number, number, Rgb][] = [
      [-14, cy + 11, 21, 0xe58fb0],
      [6, cy + 13, 23, 0xdfc05a],
      [16, cy + 7, 28, 0xe58fb0],
      [-6, cy + 9, 31, 0xdfc05a],
      [-18, cy - 4, 25, 0xdfc05a],
      [12, cy - 11, 22, 0xe58fb0],
      [-9, cy - 10, 30, 0xe58fb0],
      [3, cy - 3, 40, 0xdfc05a],
      [19, cy - 2, 23, 0xdfc05a],
    ];
    for (const [x, y, z, c] of flowers) m.c(x, y, 3, 3, z, z + 3, c, { bare: true });
  },

  'notice-board': (m, { f }) => {
    // A cork board in a wooden frame with a brass plate on top, a few pinned notes.
    const y = wallY(f.D);
    const hw = f.W / 2 - 4;
    const z0 = 46;
    const z1 = z0 + KIND_HEIGHT['notice-board']!;
    m.b(-hw, y, z0, hw, y + BOARD, z1, 0x8b5a2b);
    m.b(-hw + 6, y + BOARD, z0 + 5, hw - 6, y + BOARD + 0.6, z1 - 5, 0xd9a866, { bare: true });
    m.b(-10, y + BOARD, z1 - 2, 10, y + BOARD + 1.2, z1 + 3, GOLD);
    const notes: [number, number, Rgb, Rgb][] = [
      [-hw + 18, z1 - 30, 0xfef9c3, RED],
      [-8, z1 - 26, 0xffffff, BLUE],
      [hw - 34, z1 - 34, 0xdbeafe, 0x22aa9b],
    ];
    for (const [x, z, c, pin] of notes) {
      onFace(m, y + BOARD + 0.6, x, z, x + 16, z + 18, c, 0.6);
      onFace(m, y + BOARD + 1.2, x + 7, z + 14, x + 9.5, z + 16.5, pin, 0.8);
    }
  },

  'world-clock': (m, { f, clock }) => {
    // The Clock (social-pieces.md "Clock"): a classic round wall clock hung flat on its wall (scene-pieces.ts
    // hungFrame), a dark wooden rim round a cream face, twelve marks, the hour and minute hands at the viewer's own
    // time and a brass pin, hung from a nail. Round as seen: its height in z is built under RISE. Its size is the box's
    // smaller side less a margin, kept between 16 and 48 px, so a box saved at the old World Clock's 168 x 72 still
    // shows one round clock.
    const y = wallY(f.D);
    const r = Math.max(8, Math.min(24, (Math.min(f.W, f.D) - 8) / 2));
    const k = 1 / RISE;
    const zc = CLOCK_Z;
    const rimDepth = 3;
    const face = y + rimDepth + 0.4;
    const n: [number, number, number] = [0, 1, 0];
    const disc = (rx: number, w0: number, w1: number, c: Rgb) =>
      pixels(m, { cx: 0, cy: zc, rx, ry: rx * k, cell: 3, w0, w1, wall: true, paint: oval(c) });
    disc(r, y, y + rimDepth, CLOCK_RIM);
    disc(r * 0.9, y + rimDepth, y + rimDepth + 0.2, OAK_DARK);
    disc(r * 0.84, y + rimDepth + 0.2, face, CLOCK_CREAM);
    // The twelve marks: the twelve, three, six and nine longer, all on the face's ring, round as seen.
    const ring = r * 0.72;
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      const x = Math.sin(a) * ring;
      const z = zc + Math.cos(a) * ring * k;
      const big = h % 3 === 0;
      const along = (big ? r * 0.16 : r * 0.07) / 2;
      const across = (big ? r * 0.06 : r * 0.05) / 2;
      // A quarter mark lies along its radius: tall at twelve and six, wide at three and nine.
      const [hx, hz] =
        h % 6 === 0 ? [across, along] : h % 3 === 0 ? [along, across] : [across, across];
      onFace(m, face, x - hx, z - hz * k, x + hx, z + hz * k, INK, 0.3);
    }
    // A hand from the middle, `len` long and `w` wide (as seen), turned `a` clockwise from twelve.
    const hand = (a: number, len: number, w: number, lift: number) => {
      const dx = Math.sin(a);
      const dz = Math.cos(a) * k;
      const px = (Math.cos(a) * w) / 2;
      const pz = ((-Math.sin(a) * w) / 2) * k;
      const yy = face + lift;
      const tail = r * 0.12;
      const bl: [number, number, number] = [-px - dx * tail, yy, zc - pz - dz * tail];
      const br: [number, number, number] = [px - dx * tail, yy, zc + pz - dz * tail];
      const tr: [number, number, number] = [px + dx * len, yy, zc + pz + dz * len];
      const tl: [number, number, number] = [-px + dx * len, yy, zc - pz + dz * len];
      m.tri(bl, br, tr, n, n, n, shade(INK, 1));
      m.tri(bl, tr, tl, n, n, n, shade(INK, 1));
    };
    if (clock) {
      hand((((clock.hour % 12) + clock.minute / 60) / 12) * Math.PI * 2, r * 0.46, r * 0.11, 0.3);
      hand((clock.minute / 60) * Math.PI * 2, r * 0.7, r * 0.07, 0.5);
    }
    const pin = r * 0.06;
    onFace(m, face + 0.6, -pin, zc - pin * k, pin, zc + pin * k, GOLD, 0.4);
    // Its nail, just over the rim.
    m.b(-1.2, y, zc + r * k + 0.5, 1.2, y + 1.5, zc + r * k + 2.5, GOLD, { bare: true });
  },

  dartboard: (m, { f }) => {
    // A square wooden backboard with the round board on it: a black ring, cream and black wedges, the red and
    // green doubles round the edge, the bull, and three darts in it.
    const y = wallY(f.D);
    const zc = 72;
    const yb = y + BOARD;
    m.b(-24, y, zc - 24, 24, yb, zc + 24, OAK_DARK);
    pixels(m, {
      cx: 0,
      cy: zc,
      rx: 21,
      ry: 21,
      cell: 3,
      w0: yb,
      w1: yb + 2,
      wall: true,
      paint: oval(INK),
    });
    pixels(m, {
      cx: 0,
      cy: zc,
      rx: 16.5,
      ry: 16.5,
      cell: 3,
      w0: yb + 2,
      w1: yb + 2.6,
      wall: true,
      paint: (u, v) => {
        const r = u * u + v * v;
        if (r > 1) return null;
        const odd = wedge(u, v, 10) % 2 === 1;
        if (r > 0.7) return odd ? RED : 0x1a7b3e;
        return odd ? 0xf5e6c8 : INK;
      },
    });
    onFace(m, yb + 2.6, -3, zc - 3, 3, zc + 3, 0x1a7b3e, 0.5);
    onFace(m, yb + 3.1, -1.5, zc - 1.5, 1.5, zc + 1.5, RED, 0.5);
    const darts: [number, number, Rgb][] = [
      [5, 6, 0xdb7834],
      [-7, 2, 0x37c3d9],
      [2, -8, 0xa0d843],
    ];
    for (const [x, z, c] of darts) {
      m.b(x - 0.5, yb + 2.6, zc + z - 0.5, x + 0.5, yb + 7, zc + z + 0.5, 0x475569, { bare: true });
      m.b(x - 1.6, yb + 6, zc + z - 1.6, x + 1.6, yb + 8, zc + z + 1.6, c, { bare: true });
    }
    // Its nail.
    m.b(-2, y, zc + 26, 2, y + 2, zc + 29, GOLD, { bare: true });
  },

  'calendar-wall': (m, { f }) => {
    // A white wall planner: a red header on two binder rings, a strip for the day names and a grid of days.
    const y = wallY(f.D);
    const hw = f.W / 2 - 4;
    const z0 = 46;
    const z1 = z0 + KIND_HEIGHT['calendar-wall']!;
    const yb = y + BOARD;
    m.b(-hw, y, z0, hw, yb, z1, 0xffffff);
    m.b(-hw, y, z1 - 14, hw, yb + 0.8, z1, 0xde5555);
    for (const x of [-hw * 0.5, hw * 0.5])
      m.b(x - 2, y + 0.5, z1 - 4, x + 2, yb + 1.5, z1 + 5, 0x94a3b8);
    const gx0 = -hw + 5;
    const gx1 = hw - 5;
    const gz0 = z0 + 4;
    const gz1 = z1 - 22;
    onFace(m, yb, gx0, gz1 + 2, gx1, gz1 + 6, 0xe2e8f0, 0.4);
    // The grid: seven columns, five rows, in thin rule lines.
    for (let i = 0; i <= 7; i++) {
      const x = gx0 + ((gx1 - gx0) * i) / 7;
      onFace(m, yb, x - 0.6, gz0, x + 0.6, gz1, 0x94a3b8, 0.5);
    }
    for (let j = 0; j <= 5; j++) {
      const z = gz0 + ((gz1 - gz0) * j) / 5;
      onFace(m, yb, gx0, z - 0.6, gx1, z + 0.6, 0x94a3b8, 0.5);
    }
  },

  'photo-wall': (m, { f }) => {
    // A wooden frame round a cream board of eight framed portraits, two rows of four, with a brass plate.
    const y = wallY(f.D);
    const hw = f.W / 2 - 4;
    const z0 = 46;
    const z1 = z0 + KIND_HEIGHT['photo-wall']!;
    const yb = y + BOARD;
    m.b(-hw, y, z0, hw, yb, z1, 0xa3734a);
    m.b(-hw + 5, yb, z0 + 5, hw - 5, yb + 0.5, z1 - 6, 0xf5efe6, { bare: true });
    m.b(-12, yb, z1 - 3, 12, yb + 1.2, z1 + 3, GOLD);
    const cols = 4;
    const slot = (2 * hw - 10) / cols;
    const rowH = (z1 - z0 - 13) / 2;
    for (let r = 0; r < 2; r++)
      for (let i = 0; i < cols; i++) {
        const cx = -hw + 5 + slot * (i + 0.5);
        const cz = z0 + 5 + rowH * (r + 0.5);
        const w = slot * 0.36;
        const h = rowH * 0.42;
        m.b(cx - w, yb + 0.5, cz - h, cx + w, yb + 1.7, cz + h, 0x5b3a1e);
        onFace(m, yb + 1.7, cx - w + 2.5, cz - h + 2.5, cx + w - 2.5, cz + h - 2.5, WHITE, 0.3);
        onFace(m, yb + 2, cx - 2.6, cz + 1, cx + 2.6, cz + 6.2, 0xcbd5e1, 0.3);
        onFace(m, yb + 2, cx - 6, cz - h + 2.5, cx + 6, cz - 1, 0xcbd5e1, 0.3);
      }
  },

  'hand-dryer': (m, { f, t }) => {
    // A box on the wall at hand height: a grille on its face, a green light, the nozzle underneath.
    const y = wallY(f.D);
    const z0 = 36;
    const z1 = z0 + KIND_HEIGHT['hand-dryer']!;
    m.b(-13, y, z0, 13, y + 11, z1, t.face, { top: t.top, front: t.top });
    for (let k = 0; k < 3; k++)
      onFace(
        m,
        y + 11,
        -7,
        z1 - 6 - k * 3.5,
        7,
        z1 - 4.8 - k * 3.5,
        mix(t.face, 0x000000, 0.3),
        0.4,
      );
    onFace(m, y + 11, 8, z1 - 5, 10.5, z1 - 2.5, 0x29be60, 0.5);
    m.b(-5, y + 3, z0 - 4, 5, y + 9, z0, mix(t.face, 0x000000, 0.2));
  },

  'ping-pong-table': (m) => {
    // A green table on dark legs, its white edge lines and centre line, the net across the middle, a red and a
    // black bat lying on either half.
    const H = KIND_HEIGHT['ping-pong-table']!;
    const hw = 62;
    const hd = 34;
    m.legs(-hw + 10, -hd + 6, hw - 10, hd - 6, H - 3, 3, METAL_DARK);
    m.b(-hw + 12, -1, H - 8, hw - 12, 1, H - 6, METAL_DARK, { bare: true });
    m.b(-hw, -hd, H - 3, hw, hd, H, FELT_DARK, { top: FELT });
    const z = H + 0.25;
    m.b(-hw, -hd, H, hw, -hd + 1.5, z, WHITE, { bare: true });
    m.b(-hw, hd - 1.5, H, hw, hd, z, WHITE, { bare: true });
    m.b(-hw, -hd, H, -hw + 1.5, hd, z, WHITE, { bare: true });
    m.b(hw - 1.5, -hd, H, hw, hd, z, WHITE, { bare: true });
    m.b(-hw, -0.6, H, hw, 0.6, z, WHITE, { bare: true });
    // The net, on its two posts.
    m.b(-0.8, -hd - 2, H, 0.8, hd + 2, H + 6, WHITE, { top: 0xe2e8f0 });
    for (const yy of [-hd - 3, hd + 1])
      m.b(-1.2, yy, H - 2, 1.2, yy + 2, H + 6.5, 0x1f2937, { bare: true });
    // The bats.
    m.c(-34, -12, 8, 8, H, H + 1.2, RED);
    m.c(-29, -7, 4, 2, H, H + 1, WOOD_DARK);
    m.c(36, 12, 8, 8, H, H + 1.2, 0x1f2937);
    m.c(31, 7, 4, 2, H, H + 1, WOOD_DARK);
  },

  'pool-table': (m, { f }) => {
    // Chunky wooden legs, a wooden body and rails round green felt, six black pockets, a rack of balls, the cue ball
    // and a cue lying on the felt.
    const H = KIND_HEIGHT['pool-table']!;
    const { x0, y0, x1, y1 } = f.foot;
    const cy = (y0 + y1) / 2;
    const hw = (x1 - x0) / 2;
    const hd = (y1 - y0) / 2;
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        m.c(sx * (hw - 16), cy + sy * (hd - 12), 11, 11, 0, 3, OAK_DARK);
        m.c(sx * (hw - 16), cy + sy * (hd - 12), 8, 8, 3, 16, OAK_DARK);
      }
    m.b(-hw + 4, cy - hd + 4, 14, hw - 4, cy + hd - 4, H - 4, OAK);
    const r = 8;
    m.b(-hw, cy - hd, H - 4, hw, cy - hd + r, H, OAK);
    m.b(-hw, cy + hd - r, H - 4, hw, cy + hd, H, OAK);
    m.b(-hw, cy - hd + r, H - 4, -hw + r, cy + hd - r, H, OAK);
    m.b(hw - r, cy - hd + r, H - 4, hw, cy + hd - r, H, OAK);
    m.b(-hw + r, cy - hd + r, H - 4, hw - r, cy + hd - r, H - 2, FELT_DARK, {
      top: FELT,
      bare: true,
    });
    // Cushions inside the rails.
    m.b(-hw + r, cy - hd + r, H - 2, hw - r, cy - hd + r + 2, H - 1, FELT_DARK, { bare: true });
    m.b(-hw + r, cy + hd - r - 2, H - 2, hw - r, cy + hd - r, H - 1, FELT_DARK, { bare: true });
    m.b(-hw + r, cy - hd + r, H - 2, -hw + r + 2, cy + hd - r, H - 1, FELT_DARK, { bare: true });
    m.b(hw - r - 2, cy - hd + r, H - 2, hw - r, cy + hd - r, H - 1, FELT_DARK, { bare: true });
    // Pockets at the corners and the middles of the long sides.
    for (const x of [-hw + 5, 0, hw - 5])
      for (const yy of [cy - hd + 5, cy + hd - 5])
        m.c(x, yy, 7, 7, H, H + 0.4, INK, { bare: true });
    // Sights on the long rails.
    for (const x of [-hw * 0.5, -hw * 0.25, hw * 0.25, hw * 0.5])
      for (const yy of [cy - hd + 3, cy + hd - 3])
        m.c(x, yy, 1.6, 1.6, H, H + 0.3, 0xeedd99, { bare: true });
    // The rack of balls and the cue ball.
    const z = H - 2;
    const rx = hw * 0.42;
    const rack: [number, number, Rgb][] = [
      [rx, 0, 0xdcba33],
      [rx + 4, -2.2, RED],
      [rx + 4, 2.2, BLUE],
      [rx + 8, -4.4, 0x804bdc],
      [rx + 8, 0, 0x111827],
      [rx + 8, 4.4, FLAME],
    ];
    for (const [x, dy, c] of rack) m.c(x, cy + dy, 3.4, 3.4, z, z + 3.4, c, { bare: true });
    m.c(-hw * 0.35, cy + 4, 3.4, 3.4, z, z + 3.4, WHITE, { bare: true });
    // The cue, a stepped line from the butt to its blue tip.
    const n = 9;
    for (let k = 0; k < n; k++) {
      const x = -hw * 0.75 + k * 7;
      const yy = cy + 14 - k * 1.3;
      m.c(x, yy, 7.2, 1.6, z, z + 1.6, k < 3 ? OAK_DARK : 0xe5c48d, { bare: true });
    }
    m.c(-hw * 0.75 + n * 7 - 2.5, cy + 14 - n * 1.3, 2, 1.6, z, z + 1.6, 0x50b4e0, { bare: true });
  },

  'foosball-table': (m, { f }) => {
    // A wooden cabinet on legs, a green pitch inside its walls with its white markings and goals, six rods across
    // it with their red and blue players, each team's handles out of the side it plays from.
    const H = KIND_HEIGHT['foosball-table']!;
    const { x0, y0, x1, y1 } = f.foot;
    const cy = (y0 + y1) / 2;
    const hw = (x1 - x0) / 2 - 2;
    const hd = (y1 - y0) / 2 - 4;
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) m.c(sx * (hw - 10), cy + sy * (hd - 7), 8, 8, 0, 14, OAK_DARK);
    const wall = 5;
    m.b(-hw, cy - hd, 12, hw, cy + hd, 17, OAK);
    m.b(-hw, cy - hd, 17, hw, cy - hd + wall, H, OAK);
    m.b(-hw, cy + hd - wall, 17, hw, cy + hd, H, OAK);
    m.b(-hw, cy - hd + wall, 17, -hw + wall, cy + hd - wall, H, OAK);
    m.b(hw - wall, cy - hd + wall, 17, hw, cy + hd - wall, H, OAK);
    const px = hw - wall;
    const py = hd - wall;
    m.b(-px, cy - py, 17, px, cy + py, 19, PITCH, { bare: true });
    const zl = 19.2;
    const line = (a: number, b: number, c: number, d: number) =>
      m.b(a, cy + b, 19, c, cy + d, zl, WHITE, { bare: true });
    line(-0.6, -py, 0.6, py);
    line(-5, -5, 5, -4);
    line(-5, 4, 5, 5);
    line(-5, -5, -4, 5);
    line(4, -5, 5, 5);
    for (const sx of [-1, 1]) {
      const a = sx * px;
      const b = sx * (px - 10);
      line(Math.min(a, b), -9, Math.max(a, b), -8);
      line(Math.min(a, b), 8, Math.max(a, b), 9);
      line(Math.min(b, b + sx), -9, Math.max(b, b + sx), 9);
      // The goal mouth through the end wall.
      m.b(sx * (hw - wall - 0.5), cy - 6, 17, sx * (hw + 0.5), cy + 6, 24, INK, { bare: true });
    }
    const counts = [1, 2, 3, 3, 2, 1];
    const zr = H - 3;
    counts.forEach((n, i) => {
      const x = -px + ((2 * px) / counts.length) * (i + 0.5);
      const red = i % 2 === 0;
      const c = red ? RED : BLUE;
      m.b(x - 0.8, cy - hd - 4, zr, x + 0.8, cy + hd + 4, zr + 1.6, 0x475569);
      const hy = red ? cy + hd + 4 : cy - hd - 10;
      m.b(x - 1.6, hy, zr - 0.8, x + 1.6, hy + 6, zr + 2.4, INK);
      for (let k = 0; k < n; k++) {
        const yy = cy - py + ((2 * py) / n) * (k + 0.5);
        m.c(x, yy, 3, 3.4, 19, zr + 2.5, c, { top: mix(c, 0xffffff, 0.2) });
      }
    });
  },

  fireplace: (m, { f }) => {
    // A brick fireplace on a stone hearth: a dark arched firebox with logs and a fire in it, mortar lines, a wooden
    // mantel shelf and the darker chimney breast above it.
    const { y0, y1 } = f.foot;
    const H = KIND_HEIGHT.fireplace!;
    const brick = 0xc2593a;
    const mortar = 0x8f3a1d;
    m.b(-62, y0, 0, 62, y1 + 4, 4, STONE_DARK, { top: 0xc4bfba });
    const hw = 54;
    const ow = 20;
    const oz = 32;
    m.b(-hw, y0, 4, -ow, y1, 54, brick);
    m.b(ow, y0, 4, hw, y1, 54, brick);
    m.b(-ow, y0, oz, ow, y1, 54, brick);
    m.b(-ow, y0, 4, ow, y0 + 8, oz, brick);
    m.b(-ow, y0 + 8, 4, ow, y1 - 2, oz, 0x292524, { bare: true });
    // The arch's shoulders.
    m.b(-ow, y1 - 4, oz - 5, -ow + 5, y1, oz, brick, { bare: true });
    m.b(ow - 5, y1 - 4, oz - 5, ow, y1, oz, brick, { bare: true });
    for (const z of [14, 24, 44]) {
      const spans: [number, number][] =
        z > oz
          ? [[-hw, hw]]
          : [
              [-hw, -ow],
              [ow, hw],
            ];
      for (const [a, b] of spans) onFace(m, y1, a, z, b, z + 1, mortar, 0.4);
    }
    const joints: [number, number, number][] = [
      [-38, 4, 14],
      [36, 14, 24],
      [-30, 24, oz],
      [28, 4, 14],
      [-10, 44, 54],
      [14, oz, 44],
    ];
    for (const [x, z0, z1] of joints) onFace(m, y1, x, z0, x + 1, z1, mortar, 0.4);
    // The fire on its logs.
    const fy = y1 - 6;
    m.b(-13, fy - 3, 4, 13, fy + 1, 7, OAK_DARK);
    m.b(-8, fy - 4, 6, 9, fy, 9, LOG, { bare: true });
    m.b(-9, fy - 3, 9, 9, fy + 1, 15, FLAME, { bare: true });
    m.b(-6, fy - 2.5, 15, 6, fy + 0.5, 21, FLAME, { bare: true });
    m.b(-3, fy - 2, 21, 3, fy, 26, FLAME, { bare: true });
    m.b(-5, fy, 9, 5, fy + 1.5, 15, FLAME_CORE, { bare: true });
    m.b(-2.5, fy, 15, 2.5, fy + 1.2, 20, FLAME_CORE, { bare: true });
    m.b(-62, y0 - 2, 54, 62, y1 + 3, 58, OAK, { top: 0xd29a5c });
    m.b(-40, y0, 58, 40, y0 + 12, H, mortar, { top: brick });
  },

  campfire: (m, { f }) => {
    // A ring of pale and grey stones, two logs crossed in it, and a stepped orange flame with a yellow heart.
    const { y0, y1 } = f.foot;
    const cy = (y0 + y1) / 2;
    const rx = 26;
    const ry = (y1 - y0) / 2 - 1;
    const n = 10;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      m.c(
        Math.cos(a) * rx,
        cy + Math.sin(a) * ry,
        9,
        6,
        0,
        k % 3 === 0 ? 5 : 4,
        k % 2 === 0 ? STONE : STONE_DARK,
      );
    }
    m.c(0, cy, 34, 4, 0, 4, OAK_DARK);
    m.c(0, cy, 4, 20, 2, 6, LOG);
    m.c(0, cy, 18, 12, 5, 9, FLAME, { bare: true });
    m.c(0, cy, 12, 8, 9, 12, FLAME, { bare: true });
    m.c(0, cy, 5, 4, 12, 15, FLAME, { bare: true });
    m.c(0, cy, 9, 14, 6, 9, FLAME_CORE, { bare: true });
    m.c(0, cy, 14, 5, 6, 10.5, FLAME_CORE, { bare: true });
  },

  'garden-umbrella': (m, { f }) => {
    // A stone foot and a slate pole holding up a big round canopy of red and white wedges, a brass finial on top;
    // its rim is above a character's head.
    const { y0, y1 } = f.foot;
    const cy = (y0 + y1) / 2;
    const H = KIND_HEIGHT['garden-umbrella']!;
    disc(m, 0, cy, 11, 6, 0, 2, STONE_DARK, undefined, 3);
    m.c(0, cy, 10, 6, 2, 4, STONE_DARK);
    m.c(0, cy, 3, 3, 4, 74, 0x475569);
    const stripes: Paint = (u, v) =>
      inOval(u, v) ? (wedge(u, v, 8) % 2 === 0 ? 0xde5555 : 0xffffff) : null;
    pixels(m, { cx: 0, cy, rx: 52, ry: 52, cell: 8, w0: 72, w1: 77, paint: stripes });
    pixels(m, { cx: 0, cy, rx: 40, ry: 40, cell: 8, w0: 77, w1: 84, paint: stripes });
    pixels(m, { cx: 0, cy, rx: 26, ry: 26, cell: 6.5, w0: 84, w1: 92, paint: stripes });
    pixels(m, { cx: 0, cy, rx: 12, ry: 12, cell: 6, w0: 92, w1: 98, paint: stripes });
    m.c(0, cy, 4, 4, 98, H, GOLD);
  },

  fountain: (m, { f }) => {
    // A round stone basin of water on a grey footing, a pedestal in the middle with a little bowl, and the spout
    // splashing into it.
    const { y0, y1 } = f.foot;
    const cy = (y0 + y1) / 2 - 2;
    const lit = 0xf5f5f4;
    disc(m, 0, cy, 60, 31, 0, 3, STONE_DARK);
    pixels(m, {
      cx: 0,
      cy,
      rx: 58,
      ry: 29,
      cell: 5,
      w0: 3,
      w1: 12,
      paint: oval(STONE, 0.78),
      lit: () => lit,
    });
    disc(m, 0, cy, 48, 23, 3, 9, 0x8ecdeb, 0x8ecdeb, 5);
    for (const [x, yy] of [
      [-20, 4],
      [16, -6],
      [28, 6],
    ] as const)
      m.b(x, cy + yy, 9, x + 8, cy + yy + 0.8, 9.3, 0xffffff, { bare: true });
    m.c(0, cy, 8, 8, 9, 25, STONE, { top: lit });
    pixels(m, {
      cx: 0,
      cy,
      rx: 16,
      ry: 11,
      cell: 3,
      w0: 25,
      w1: 29,
      paint: oval(STONE, 0.7),
      lit: () => lit,
    });
    disc(m, 0, cy, 12, 8, 25, 28, 0x50b4e0, 0x50b4e0, 3);
    m.c(0, cy, 4, 4, 28, 33, STONE);
    // The jets, rising and falling into the bowl on every side.
    m.c(0, cy, 2, 2, 33, 37, 0x8ecdeb, { bare: true });
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      m.c(dx * 3.5, cy + dy * 3.5, 3, 3, 35, 37, 0x8ecdeb, { bare: true });
      m.c(dx * 7, cy + dy * 6, 2, 2, 29, 35, 0x50b4e0, { bare: true });
    }
  },

  'bike-rack': (m, { f }) => {
    // A concrete strip with two light hoops, a red and a teal bike parked against them side on.
    const { x0, y0, x1, y1 } = f.foot;
    const cy = (y0 + y1) / 2;
    const hw = (x1 - x0) / 2;
    m.b(-hw, y0 + 1, 0, hw, y1 - 1, 3, 0xd6d3d1);
    const hoopY = cy - 6;
    for (const bx of [-hw / 2, hw / 2]) {
      for (const sx of [-1, 1])
        m.b(bx + sx * 16 - 1.2, hoopY - 1.2, 3, bx + sx * 16 + 1.2, hoopY + 1.2, 18, 0xcbd5e1);
      m.b(bx - 17.2, hoopY - 1.2, 18, bx + 17.2, hoopY + 1.2, 20.4, 0xcbd5e1);
    }
    const bikes: [number, Rgb][] = [
      [-hw / 2, 0xde5555],
      [hw / 2, 0x22aa9b],
    ];
    const by = cy + 2;
    const t = 1.6;
    const tyre = 0x1f2937;
    const r = 6;
    const zw = 3 + r;
    for (const [bx, c] of bikes) {
      for (const wx of [bx - 12, bx + 12]) {
        m.b(wx - r + 2, by - t / 2, zw - r, wx + r - 2, by + t / 2, zw - r + 1.6, tyre, {
          bare: true,
        });
        m.b(wx - r + 2, by - t / 2, zw + r - 1.6, wx + r - 2, by + t / 2, zw + r, tyre, {
          bare: true,
        });
        m.b(wx - r, by - t / 2, zw - r + 2, wx - r + 1.6, by + t / 2, zw + r - 2, tyre, {
          bare: true,
        });
        m.b(wx + r - 1.6, by - t / 2, zw - r + 2, wx + r, by + t / 2, zw + r - 2, tyre, {
          bare: true,
        });
        m.b(wx - r + 1.4, by - t / 2, zw - r + 1.4, wx - r + 2.2, by + t / 2, zw + r - 1.4, tyre, {
          bare: true,
        });
        m.b(wx + r - 2.2, by - t / 2, zw - r + 1.4, wx + r - 1.4, by + t / 2, zw + r - 1.4, tyre, {
          bare: true,
        });
        m.c(wx, by, 2, 2.4, zw - 1, zw + 1, 0x94a3b8, { bare: true });
      }
      const tube = (a: number, z0: number, b: number, z1: number) =>
        m.b(bx + a, by - 0.7, z0, bx + b, by + 0.7, z1, c, { bare: true });
      tube(-12, zw - 0.7, 0, zw + 0.7);
      tube(-6, zw + 5, 8, zw + 6.4);
      tube(-1, zw, 1.4, zw + 6);
      tube(1.4, zw + 2, 5, zw + 4);
      tube(-7, zw, -5.6, zw + 9);
      tube(8, zw, 9.4, zw + 10);
      m.b(bx - 9.5, by - 1.6, zw + 9, bx - 3.5, by + 1.6, zw + 10.4, tyre);
      m.b(bx + 7, by - 4, zw + 10, bx + 10, by + 4, zw + 11.4, tyre);
    }
  },

  'stage-curtains': (m, { f }) => {
    // A dark red pelmet with a gold band and a scalloped skirt, and a red drape gathered to each side by a gold
    // tie-back, its folds in darker red; the stage between them open.
    const { x0, y0, y1 } = f.foot;
    const H = KIND_HEIGHT['stage-curtains']!;
    const hw = -x0;
    const ya = y0 + 2;
    const yb = y1 - 6;
    m.b(-hw, ya, 140, hw, yb + 2, H, CURTAIN_DARK);
    m.b(-hw, ya, 136, hw, yb + 2.6, 140, CURTAIN_GOLD, { bare: true });
    m.b(-hw, ya, 128, hw, yb + 2, 136, CURTAIN);
    const n = 12;
    for (let k = 0; k < n; k++) {
      const x = -hw + ((2 * hw) / n) * (k + 0.5);
      m.b(x - 10, ya + 1, 123, x + 10, yb + 1.6, 128, CURTAIN, { bare: true });
      if (k < n - 1)
        m.b(x + 14, yb + 1.6, 125, x + 16, yb + 2.4, 128, CURTAIN_GOLD, { bare: true });
    }
    // Each drape in bands: full at the top, gathered at the tie-back, flaring to the floor.
    const bands: [number, number, number][] = [
      [104, 128, 72],
      [84, 104, 52],
      [62, 84, 36],
      [52, 62, 28],
      [30, 52, 34],
      [14, 30, 46],
      [0, 14, 58],
    ];
    for (const sx of [-1, 1]) {
      for (const [z0, z1, w] of bands) m.b(sx * hw, ya, z0, sx * (hw - w), yb, z1, CURTAIN);
      for (const k of [6, 15, 23])
        m.b(sx * (hw - k), yb, 0, sx * (hw - k - 2), yb + 0.6, 128, CURTAIN_DARK, { bare: true });
      for (const k of [40, 58])
        m.b(sx * (hw - k), yb, 104, sx * (hw - k - 2), yb + 0.6, 128, CURTAIN_DARK, { bare: true });
      m.b(sx * hw, ya - 1, 54, sx * (hw - 30), yb + 1.6, 60, CURTAIN_GOLD);
      m.c(sx * (hw - 30), yb + 1, 4, 3, 46, 54, CURTAIN_GOLD);
    }
  },

  pillar: (m, { f, t }) => {
    // A square pillar to the ceiling in its material: a base and a capital wider than the shaft, a channel down
    // each face.
    const { y1 } = f.foot;
    const H = KIND_HEIGHT.pillar!;
    const hw = f.W / 2;
    const ya = y1 - 32;
    const dark = mix(t.face, t.stroke, 0.35);
    m.b(-hw, ya, 0, hw, y1, 8, t.face, { top: t.top });
    m.b(-hw + 2, ya + 2, 8, hw - 2, y1 - 2, 11, t.face, { top: t.top });
    m.b(-hw + 5, ya + 4, 11, hw - 5, y1 - 4, H - 14, t.top);
    m.b(-hw + 2, ya + 2, H - 14, hw - 2, y1 - 2, H - 11, t.face, { top: t.top });
    m.b(-hw, ya, H - 11, hw, y1, H, t.face, { top: t.top });
    const sh = hw - 5;
    for (const x of [-sh + 6, sh - 7.5]) {
      m.b(x, y1 - 4, 16, x + 1.5, y1 - 3.4, H - 19, dark, { bare: true });
      m.b(x, ya + 3.4, 16, x + 1.5, ya + 4, H - 19, dark, { bare: true });
    }
    for (const yy of [ya + 10, y1 - 11.5]) {
      m.b(-sh - 0.6, yy, 16, -sh, yy + 1.5, H - 19, dark, { bare: true });
      m.b(sh, yy, 16, sh + 0.6, yy + 1.5, H - 19, dark, { bare: true });
    }
  },

  column: (m, { f }) => {
    // A classical column: a stepped plinth, a round fluted shaft, and an Ionic capital with its scrolls at the
    // sides, all in pale stone.
    const { y1 } = f.foot;
    const H = KIND_HEIGHT.column!;
    const stone = 0xece7df;
    const flute = 0xd6cfc4;
    const lit = 0xf6f2ec;
    const cy = y1 - 18;
    m.c(0, cy, 56, 38, 0, 6, flute, { top: stone });
    m.c(0, cy, 48, 33, 6, 11, stone, { top: lit });
    disc(m, 0, cy, 19, 15, 11, 16, stone, lit, 4);
    pixels(m, {
      cx: 0,
      cy,
      rx: 14,
      ry: 12,
      cell: 4,
      w0: 16,
      w1: 136,
      paint: (u, v) => (inOval(u, v) ? (wedge(u, v, 10) % 2 === 0 ? stone : flute) : null),
      lit: () => lit,
    });
    disc(m, 0, cy, 19, 15, 136, 142, stone, lit, 4);
    m.c(0, cy, 56, 36, 142, H, stone, { top: lit });
    for (const sx of [-1, 1]) {
      m.c(sx * 25, cy, 8, 36, 135, 145, flute, { top: stone });
      for (const sy of [-1, 1])
        m.b(sx * 25 - 2, cy + sy * 18, 138, sx * 25 + 2, cy + sy * 18.6, 142, STONE_DARK, {
          bare: true,
        });
    }
  },

  signpost: (m, { f }) => {
    // A wooden post in a tuft of grass with a pointed cap, three boards across it, each held by a nail.
    const { y0, y1 } = f.foot;
    const cy = (y0 + y1) / 2;
    const H = KIND_HEIGHT.signpost!;
    pixels(m, {
      cx: 0,
      cy,
      rx: 18,
      ry: 9,
      cell: 3,
      w0: 0,
      w1: 2,
      paint: oval(0x8ee7ae),
      lit: () => 0xa7f0c2,
    });
    for (const [x, yy] of [
      [-12, 4],
      [10, 5],
      [-4, -7],
      [13, -3],
    ] as const)
      m.c(x, cy + yy, 2, 2, 2, 5, 0x5fbf83, { bare: true });
    m.c(0, cy, 6, 6, 0, H - 6, OAK);
    m.c(0, cy, 8, 8, H - 6, H - 3, OAK_DARK);
    m.c(0, cy, 4, 4, H - 3, H, OAK_DARK);
    for (const z of [62, 46, 30]) {
      m.b(-40, cy + 3, z, 40, cy + 7, z + 10, 0xc89a64, { front: 0xe0b07a, top: 0xe0b07a });
      m.b(-1, cy + 7, z + 4, 1, cy + 7.6, z + 6, 0x57534e, { bare: true });
    }
  },

  'pet-bed': (m, { f }) => {
    // A low oval bed: a tan rim round a cream cushion, a bone resting on its rim.
    const rx = f.W / 2 - 3;
    const ry = f.D / 2 - 3;
    const z = KIND_HEIGHT['pet-bed']!;
    pixels(m, {
      cx: 0,
      cy: 0,
      rx,
      ry,
      cell: 4,
      w0: 0,
      w1: z,
      paint: oval(0xc2703d, 0.72),
      lit: () => 0xd08250,
    });
    disc(m, 0, 0, rx * 0.78, ry * 0.78, 0, 3.5, 0xf5e6c8, 0xf5e6c8, 4);
    m.b(14, ry * 0.7, z, 26, ry * 0.7 + 2, z + 2, 0xffffff, { bare: true });
    for (const x of [13, 27]) m.c(x, ry * 0.7 + 1, 3, 4, z, z + 2.4, 0xffffff, { bare: true });
  },
};
