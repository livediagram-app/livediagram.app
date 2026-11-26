// Real 3D's seating models (docs/specs/008-canvas/3d-engine.md "Block models"): the pieces people sit, stand or lie
// at, each laid out from its own drawings (the front for x and heights, the side for depth) in their colours. A
// sitter's seat is built under the hips of the figure the engine stands at its seat point, its back behind them.
import type { Rgb } from '../mesh-builder';
import { mix, SEAT_Z, type Builder, type ModelContext, type ModelTable } from './kit';

/** The drawings' named colours (packages/avatar furniture-art SEATING_TONES and the office drawings). */
const C = {
  wood: 0xb98352,
  woodLight: 0xcf9d6b,
  woodDeep: 0x7c4f2c,
  metal: 0x59616d,
  metalDeep: 0x3a4049,
  monitor: 0x363c46,
  screen: 0x1d3557,
  paper: 0xf4efe4,
  mug: 0xece6da,
  coffee: 0x6b4423,
  keys: 0xd6dae0,
  pillow: 0xe0a943,
  slat: 0xc2894b,
  iron: 0x374151,
  ink: 0x1f2937,
  sky: 0xa1c6ef,
  steel: 0x94a3b8,
  white: 0xf8fafc,
} as const;

type Seat = ModelContext['seats'][number];

/** Which way a sitter faces, as a unit step in the model's frame. */
const FORWARD: Record<string, readonly [number, number]> = {
  down: [0, 1],
  up: [0, -1],
  right: [1, 0],
  left: [-1, 0],
};

/**
 * Where a seated figure's hips are, ahead of (+) or behind (-) its seat point along the way it faces: the seat is
 * built about this so the figure sits on it.
 */
const HIP = -2;

type SeatBox = (
  u0: number,
  v0: number,
  z0: number,
  u1: number,
  v1: number,
  z1: number,
  colour: Rgb,
  top?: Rgb,
  bare?: boolean,
) => void;

/**
 * Boxes in a sitter's own frame: u across them, v toward where they face (v = 0 at their hips), z up.
 */
function seatBoxes(m: Builder, s: Seat): SeatBox {
  const [fx, fy] = FORWARD[s.facing] ?? [0, 1];
  const ax = fy;
  const ay = -fx;
  const hx = s.x + fx * HIP;
  const hy = s.y + fy * HIP;
  return (u0, v0, z0, u1, v1, z1, colour, top, bare = false) => {
    const xa = hx + ax * u0 + fx * v0;
    const ya = hy + ay * u0 + fy * v0;
    const xb = hx + ax * u1 + fx * v1;
    const yb = hy + ay * u1 + fy * v1;
    m.b(xa, ya, z0, xb, yb, z1, colour, { top, bare });
  };
}

/** An office chair on a pole and a star foot, at a seat. */
function officeChair(m: Builder, s: Seat, fabric: Rgb, frame: Rgb = C.metalDeep): void {
  const b = seatBoxes(m, s);
  const dark = mix(fabric, 0x000000, 0.25);
  b(-12, -2, 1, 12, 1, 3, frame, undefined, true);
  b(-1.5, -11, 1, 1.5, 10, 3, frame, undefined, true);
  b(-1.5, -2, 3, 1.5, 1, SEAT_Z - 3, frame, undefined, true);
  b(-11, -10, SEAT_Z - 3, 11, 10, SEAT_Z, dark, fabric);
  b(-1.5, -12, SEAT_Z - 3, 1.5, -10, SEAT_Z + 4, frame, undefined, true);
  b(-10, -14, SEAT_Z + 3, 10, -10, SEAT_Z + 23, dark, fabric);
}

/** A meeting chair on four legs, at a seat. */
function legChair(m: Builder, s: Seat, fabric: Rgb, legs: Rgb): void {
  const b = seatBoxes(m, s);
  const dark = mix(fabric, 0x000000, 0.25);
  for (const [u, v] of [
    [-10, -11],
    [8, -11],
    [-10, 7],
    [8, 7],
  ] as const)
    b(u, v, 0, u + 2.5, v + 2.5, SEAT_Z - 3, legs, undefined, true);
  b(-11, -11, SEAT_Z - 3, 11, 10, SEAT_Z, dark, fabric);
  b(-10, -14, SEAT_Z - 3, 10, -10, SEAT_Z + 22, dark, fabric);
}

/** A roundish block: two crossed boxes, `k` of the way in at the corners. */
function round(
  m: Builder,
  x: number,
  y: number,
  w: number,
  d: number,
  z0: number,
  z1: number,
  colour: Rgb,
  top?: Rgb,
  k = 0.3,
): void {
  m.c(x, y, w, d * (1 - k), z0, z1, colour, { top });
  m.c(x, y, w * (1 - k), d, z0, z1, colour, { top, bare: true });
}

/** A rug of ellipse `rx` by `ry` lying on the floor, with an inner ring. */
function rug(
  m: Builder,
  x: number,
  y: number,
  rx: number,
  ry: number,
  colour: Rgb,
  inner?: Rgb,
): void {
  const ring = (r: number, z: number, c: Rgb) => {
    const pts = Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      return { x: x + Math.cos(a) * rx * r, y: y + Math.sin(a) * ry * r };
    });
    m.flat(pts, z, c);
  };
  ring(1, 0.6, colour);
  if (inner !== undefined) ring(0.86, 0.9, inner);
}

/** A desk's top on its legs: x0..x1 across, y0..y1 deep, its top at h. */
function deskTop(
  m: Builder,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  h: number,
  top: Rgb,
  face: Rgb,
  legs: Rgb,
): void {
  for (const [x, y] of [
    [x0 + 4, y0 + 3],
    [x1 - 7, y0 + 3],
    [x0 + 4, y1 - 6],
    [x1 - 7, y1 - 6],
  ] as const)
    m.b(x, y, 0, x + 3, y + 3, h - 4, legs, { bare: true });
  m.b(x0, y0, h - 4, x1, y1, h, face, { top });
}

/** A monitor on a desk whose screen looks toward -y (the sitter behind the desk): its back is to the camera. */
function monitor(
  m: Builder,
  x: number,
  y: number,
  w: number,
  z: number,
  h: number,
  body: Rgb,
  screen: Rgb,
): void {
  m.c(x, y + 2, 10, 6, z, z + 1.5, body);
  m.c(x, y + 2, 3, 3, z + 1.5, z + 6, body, { bare: true });
  m.c(x, y, w, 4, z + 5, z + 5 + h, body);
  m.c(x, y - 2.3, w - 4, 0.6, z + 7, z + 3 + h, screen, { bare: true });
}

/** A mug of coffee. */
function mug(m: Builder, x: number, y: number, z: number): void {
  m.c(x, y, 6, 6, z, z + 6, C.mug, { top: C.coffee });
}

/** Bottles along a shelf from x0 to x1 at y, standing on z. */
function bottles(m: Builder, x0: number, x1: number, y: number, z: number, from: number): void {
  const cols = [0x2f7d4a, 0xa8642a, 0xb5403a, 0x3a86b8, 0x7e5aa8, 0xd5b043];
  const n = Math.max(1, Math.floor((x1 - x0) / 18));
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const c = cols[(i + from) % cols.length]!;
    const x = x0 + step * (i + 0.5);
    const h = 10 + ((i * 7 + from) % 3) * 3;
    m.c(x, y, 5, 5, z, z + h, c);
    m.c(x, y, 2, 2, z + h, z + h + 3, c, { bare: true });
  }
}

const MODELS: ModelTable = {
  chair: (m, { t, seats }) => {
    // The chair's wooden frame, its upholstered seat and backrest (the seat's fabric), its back wood.
    const s = seats[0] ?? { x: 0, y: 0, facing: 'down' };
    const b = seatBoxes(m, s);
    const fab = t.seat;
    const dark = mix(fab, 0x000000, 0.22);
    for (const [u, v] of [
      [-20, -16],
      [17, -16],
      [-20, 13],
      [17, 13],
    ] as const)
      b(u, v, 0, u + 3, v + 3, SEAT_Z - 4, v < 0 ? C.woodDeep : C.wood, undefined, true);
    b(-22, -17, SEAT_Z - 5, 22, 17, SEAT_Z - 2, C.wood);
    b(-21, -15, SEAT_Z - 2, 21, 16, SEAT_Z, dark, fab);
    b(-17, -20, SEAT_Z - 5, 17, -15, SEAT_Z + 22, C.wood);
    b(-13, -15, SEAT_Z + 2, 13, -13.5, SEAT_Z + 19, dark, fab);
  },

  desk: (m, { t, seats }) => {
    // The desk nearest you, its monitor's back to you and the chair beyond it, the sitter facing you over it.
    const s = seats[0] ?? { x: 0, y: -27, facing: 'down' };
    const H = 30;
    const e = s.y + 13;
    deskTop(m, -56, e, 56, e + 40, H, C.woodLight, C.wood, C.metal);
    monitor(m, 0, e + 26, 40, H, 20, C.monitor, C.screen);
    m.c(0, e + 10, 26, 7, H, H + 1.5, C.keys, { bare: true });
    m.c(-36, e + 22, 20, 11, H, H + 0.8, C.paper, { bare: true });
    mug(m, 42, e + 14, H);
    officeChair(m, s, t.seat);
  },

  'hot-desk': (m, { t, seats }) => {
    // A bookable desk in the theme's wash: a monitor (its back to you), a white pad and a tray, an office chair.
    const s = seats[0] ?? { x: 0, y: -28, facing: 'down' };
    const H = 30;
    const top = t.seat;
    const face = mix(t.seat, t.stroke, 0.35);
    const e = s.y + 13;
    deskTop(m, -54, e, 54, e + 40, H, top, face, t.stroke);
    monitor(m, 0, e + 28, 36, H, 19, C.ink, C.sky);
    m.c(0, e + 10, 18, 5, H, H + 1.2, mix(top, 0x000000, 0.2), { bare: true });
    m.c(-30, e + 20, 38, 12, H, H + 0.8, 0xffffff, { bare: true });
    m.c(34, e + 18, 22, 13, H, H + 3, 0xcbd5e1);
    officeChair(m, s, mix(t.seat, t.stroke, 0.3));
  },

  'standing-desk': (m, { seats }) => {
    // A tall desk on two legs with feet, a cross bar, a monitor looking back at the person standing behind it.
    const H = 42;
    const top = 0xe7c79a;
    const e = (seats[0]?.y ?? -14) + 10;
    for (const x of [-42, 36]) {
      m.b(x, e + 6, 0, x + 6, e + 34, 3, C.steel);
      m.b(x, e + 17, 3, x + 6, e + 23, H - 3, C.steel);
    }
    m.b(-36, e + 19, 18, 36, e + 21, 21, C.steel, { bare: true });
    m.b(-52, e, H - 3, 52, e + 40, H, mix(top, 0x000000, 0.15), { top });
    monitor(m, 0, e + 26, 40, H, 19, C.ink, C.sky);
    m.c(-42, e + 32, 8, 6, H, H + 1.5, C.ink, { bare: true });
    m.c(0, e + 10, 22, 6, H, H + 1.2, 0xe5e7eb, { bare: true });
  },

  sofa: (m, { f, t }) => {
    // Two seat cushions between rolled arms, a tall back and a mustard pillow, on short wooden feet.
    const fab = t.seat;
    const dark = mix(fab, 0x000000, 0.2);
    const light = mix(fab, 0xffffff, 0.1);
    const x1 = Math.min(66, f.W / 2 - 2);
    for (const x of [-x1 + 3, x1 - 6])
      for (const y of [-31, 25]) m.b(x, y, 0, x + 3, y + 3, 4, C.woodDeep, { bare: true });
    m.b(-x1 + 8, -33, 4, x1 - 8, 30, 9, dark, { top: fab });
    m.b(-x1 + 19, -16, 9, -0.5, 28, SEAT_Z, dark, { top: light });
    m.b(0.5, -16, 9, x1 - 19, 28, SEAT_Z, dark, { top: light });
    m.b(-x1 + 8, -34, 4, x1 - 8, -16, 32, dark, { top: light });
    m.b(-x1 + 19, -16, SEAT_Z, -1, -13, 29, fab, { bare: true });
    m.b(1, -16, SEAT_Z, x1 - 19, -13, 29, fab, { bare: true });
    for (const x of [-x1, x1 - 19]) m.b(x, -34, 4, x + 19, 31, 23, dark, { top: light });
    m.b(-44, -13, SEAT_Z, -27, -9, SEAT_Z + 14, mix(C.pillow, 0x000000, 0.1), { top: C.pillow });
  },

  'meeting-table': (m, { t, seats }) => {
    // The table between its rows and ends of chairs (a Long Table's too: laid out from its own seats).
    const rowUp = seats.filter((s) => s.facing === 'down').map((s) => s.y);
    const rowDown = seats.filter((s) => s.facing === 'up').map((s) => s.y);
    const ends = seats.filter((s) => s.facing === 'left' || s.facing === 'right').map((s) => s.x);
    const rowXs = seats.filter((s) => s.facing === 'up' || s.facing === 'down').map((s) => s.x);
    const back = rowUp.length ? Math.max(...rowUp) + HIP + 14 : -38;
    const front = rowDown.length ? Math.min(...rowDown) - HIP - 14 : 38;
    const left = ends.length ? Math.min(...ends) - HIP + 14 : Math.min(...rowXs, 0) - 30;
    const right = ends.length ? Math.max(...ends) + HIP - 14 : Math.max(...rowXs, 0) + 30;
    const H = 28;
    deskTop(m, left, back, right, front, H, C.woodLight, C.wood, C.metal);
    // A jug of water in the middle and a pad at each place.
    const cx = (left + right) / 2;
    const cy = (back + front) / 2;
    m.c(cx, cy, 7, 7, H, H + 11, 0xd5ecf7, { top: 0x8fc9ea });
    for (const s of seats) {
      if (s.facing !== 'up' && s.facing !== 'down') continue;
      const y = s.facing === 'down' ? back + 9 : front - 9;
      m.c(s.x, y, 14, 9, H, H + 0.8, C.paper, { bare: true });
    }
    for (const s of seats) legChair(m, s, t.seat, C.metal);
  },

  bench: (m, { f }) => {
    // A park bench: three seat slats and two back slats on dark iron ends.
    const x1 = Math.min(68, f.W / 2);
    const wood = C.slat;
    const wd = mix(wood, 0x000000, 0.12);
    for (const x of [-x1, x1 - 7]) {
      m.b(x, -6, 0, x + 7, 26, SEAT_Z - 3, C.iron);
      m.b(x, -14, 0, x + 7, -7, SEAT_Z + 19, C.iron);
      m.b(x, -7, SEAT_Z - 5, x + 7, -2, SEAT_Z - 3, C.iron, { bare: true });
    }
    const sx = x1 - 3;
    for (let i = 0; i < 3; i++)
      m.b(-sx, -7 + i * 11, SEAT_Z - 3, sx, -7 + i * 11 + 10, SEAT_Z, wd, { top: wood });
    m.b(-sx, -13, SEAT_Z + 2, sx, -9, SEAT_Z + 8, wd, { top: wood });
    m.b(-sx, -13, SEAT_Z + 11, sx, -9, SEAT_Z + 17, wd, { top: wood });
  },

  'picnic-table': (m, { t, seats }) => {
    // A slatted table with a bench along each side, on splayed legs.
    const wood = C.slat;
    const wd = mix(wood, 0x000000, 0.12);
    const legs = t.stroke;
    const backRow = seats.filter((s) => s.facing === 'down').map((s) => s.y);
    const frontRow = seats.filter((s) => s.facing === 'up').map((s) => s.y);
    const by = backRow.length ? backRow[0]! + HIP : -44;
    const fy = frontRow.length ? frontRow[0]! - HIP : 46;
    const xs = seats.map((s) => s.x);
    const half = Math.max(...xs.map(Math.abs), 40) + 30;
    // The benches, each a pair of slats on two trestles.
    for (const y of [by, fy]) {
      for (const x of [-half + 18, half - 22])
        m.b(x, y - 6, 0, x + 4, y + 6, SEAT_Z - 3, legs, { bare: true });
      m.b(-half + 8, y - 8, SEAT_Z - 3, half - 8, y + 8, SEAT_Z, wd, { top: wood });
      m.b(
        -half + 8,
        y - 0.4,
        SEAT_Z - 0.2,
        half - 8,
        y + 0.4,
        SEAT_Z + 0.1,
        mix(wood, 0x000000, 0.3),
        { bare: true },
      );
    }
    // The table between them: splayed legs under a slatted top, a rail tying them to the benches.
    const ty0 = by + 18;
    const ty1 = fy - 18;
    for (const x of [-half + 22, half - 26]) {
      m.slab({ x: x + 2, y: ty0 + 2 }, { x: x + 2, y: (ty0 + ty1) / 2 }, 4, 0, 24, legs, {
        bare: true,
      });
      m.slab({ x: x + 2, y: (ty0 + ty1) / 2 }, { x: x + 2, y: ty1 - 2 }, 4, 0, 24, legs, {
        bare: true,
      });
    }
    m.b(-half + 22, by + 4, SEAT_Z - 6, -half + 26, fy - 4, SEAT_Z - 3, legs, { bare: true });
    m.b(half - 26, by + 4, SEAT_Z - 6, half - 22, fy - 4, SEAT_Z - 3, legs, { bare: true });
    m.b(-half, ty0, 23, half, ty1, 27, wd, { top: wood });
    const third = (ty1 - ty0) / 3;
    for (const k of [1, 2])
      m.b(
        -half + 1,
        ty0 + third * k - 0.4,
        26.9,
        half - 1,
        ty0 + third * k + 0.4,
        27.1,
        mix(wood, 0x000000, 0.3),
        { bare: true },
      );
  },

  bar: (m, { t }) => {
    // The counter in front (its dark top, wooden front and foot rail) and the back bar behind it: a cabinet and a
    // wall of shelves full of bottles.
    const wood = C.wood;
    const top = 0x4a4643;
    const wall = t.seat;
    m.b(-115, 2, 0, 115, 48, 31, mix(wood, 0x000000, 0.08), { top: wood });
    m.b(-118, 0, 31, 118, 51, 35, top);
    for (const x of [-58, 0, 58])
      m.b(x - 1, 48, 3, x + 1, 48.8, 29, mix(wood, 0x000000, 0.3), { bare: true });
    m.b(-110, 51, 6, 110, 53, 8, C.steel, { bare: true });
    for (const x of [-70, 30, 70]) m.c(x, 30, 5, 5, 35, 42, 0xdbe6ee);
    // The back bar.
    m.b(-112, -56, 0, 112, -38, 30, mix(wood, 0x000000, 0.08), { top: wood });
    m.b(-112, -60, 0, 112, -56, 82, mix(wood, 0x000000, 0.1), { front: wall, top: wood });
    m.b(-110, -56, 54, 110, -48, 56, wood);
    m.b(-112, -56, 80, 112, -48, 84, wood);
    bottles(m, -108, 108, -50, 30, 0);
    bottles(m, -108, 108, -52, 56, 3);
  },

  'bar-stool': (m, { seats }) => {
    // A round wooden seat on a steel pole with a foot ring and a round foot.
    const s = seats[0] ?? { x: 0, y: -6, facing: 'down' };
    const x = s.x;
    const y = s.y + HIP;
    round(m, x, y, 22, 22, 0, 2, 0x6b7480);
    m.c(x, y, 3, 3, 2, SEAT_Z - 3, C.metal, { bare: true });
    round(m, x, y, 16, 16, 6, 7.5, C.metalDeep, undefined, 0.35);
    round(m, x, y, 30, 30, SEAT_Z - 3, SEAT_Z, 0x5a3a24, 0x8a5a3a);
  },

  'reception-desk': (m) => {
    // A high curved counter in front (white, a band, a wooden top rail and a bell), the receptionist's lower desk
    // behind it with a monitor and a plant.
    const white = 0xf8f5ef;
    const rail = 0xb7793f;
    const band = 0x9aa7b8;
    const low = 0xe7c79a;
    m.b(-94, -4, 0, 94, 30, 24, white, { top: low });
    // The counter, its middle bowed toward you.
    const segs: [number, number, number][] = [
      [-96, -56, 42],
      [-56, 56, 46],
      [56, 96, 42],
    ];
    for (const [x0, x1, y1] of segs) {
      m.b(x0, 30, 0, x1, y1, 32, white);
      m.b(x0, y1, 16, x1, y1 + 0.6, 21, band, { bare: true });
      m.b(
        x0 - (x0 === -96 ? 2 : 0),
        28,
        32,
        x1 + (x1 === 96 ? 2 : 0),
        y1 + 3,
        35,
        mix(rail, 0x000000, 0.1),
        { top: rail },
      );
    }
    m.c(-30, 38, 9, 6, 35, 36, 0x8e5f1a, { bare: true });
    m.c(-30, 38, 6, 5, 36, 40, 0xd6ad3c);
    // The receptionist's monitor (screen to them) and a plant.
    monitor(m, 44, 14, 36, 24, 20, C.ink, C.sky);
    m.c(-70, 10, 14, 12, 24, 34, 0xd06026, { top: 0x5b3a1f });
    round(m, -70, 10, 24, 22, 34, 48, 0x40b06a, 0x50d882);
  },

  'reading-nook': (m, { seats }) => {
    // A round rug, a wing armchair with a mustard cushion, a floor lamp on its right, a side table of books on its left.
    const s = seats[0] ?? { x: -4, y: 8, facing: 'down' };
    rug(m, 0, -6, 76, 50, 0xe4a481, mix(0xe4a481, 0x000000, 0.06));
    const b = seatBoxes(m, s);
    const tan = 0xbe7521;
    const td = mix(tan, 0x000000, 0.12);
    const cushion = 0xdeb241;
    for (const u of [-34, 31])
      for (const v of [-24, 10]) b(u, v, 0, u + 3, v + 3, 5, C.woodDeep, undefined, true);
    b(-28, -22, 5, 28, 14, SEAT_Z - 4, td, tan);
    b(-26, -20, SEAT_Z - 4, 26, 14, SEAT_Z, mix(cushion, 0x000000, 0.1), cushion);
    b(-36, -24, 5, -27, 14, 28, td, tan);
    b(27, -24, 5, 36, 14, 28, td, tan);
    b(-30, -32, 5, 30, -20, 42, td, tan);
    b(-24, -32, 42, 24, -20, 46, td, tan);
    b(-24, -20, SEAT_Z, 24, -18, 36, cushion, undefined, true);
    // The lamp.
    m.c(58, 4, 12, 12, 0, 2, C.iron);
    m.c(58, 4, 2.5, 2.5, 2, 50, 0x475569, { bare: true });
    m.c(58, 4, 18, 18, 50, 58, 0xd9c67e, { top: 0xeedd99 });
    m.c(58, 4, 12, 12, 58, 62, 0xeedd99);
    // The side table and its books.
    m.c(-64, 4, 10, 10, 0, 2, 0x86431a);
    m.c(-64, 4, 3, 3, 2, 24, 0x86431a, { bare: true });
    round(m, -64, 4, 26, 22, 24, 27, 0xa8743d, C.slat);
    m.c(-64, 4, 17, 11, 27, 30, 0xde5555);
    m.c(-63, 3, 15, 10, 30, 33, 0x5187e0);
    m.c(-64, 5, 16, 10, 33, 36, 0xdcba33);
  },

  'bean-bag': (m, { seats }) => {
    // A slumped bag of pink with a dent where you sit and its back heaped up behind you.
    const s = seats[0] ?? { x: 0, y: 8, facing: 'down' };
    const b = seatBoxes(m, s);
    const pink = 0xe98392;
    const deep = mix(pink, 0x000000, 0.15);
    const dent = 0xdf546c;
    b(-27, -26, 0, 27, 18, 7, deep, pink);
    b(-23, -24, 7, 23, 15, SEAT_Z - 2, deep, pink);
    b(-14, -10, SEAT_Z - 2, 14, 10, SEAT_Z - 1.4, dent, dent, true);
    b(-24, -28, 7, 24, -10, 25, deep, pink);
    b(-18, -26, 25, 18, -14, 29, deep, pink);
    b(-27, -20, 7, -18, 10, 18, deep, pink);
    b(18, -20, 7, 27, 10, 18, deep, pink);
  },

  hammock: (m) => {
    // Two posts and the hammock slung between them on ropes, sagging to seat height in the middle.
    const post = 0x86431a;
    const blue = 0x50b4e0;
    const stripe = 0xe29555;
    const rope = 0x94a3b8;
    for (const x of [-72, 64]) m.b(x, -4, 0, x + 8, 4, 46, mix(post, 0x000000, 0.1), { top: post });
    m.b(-64, -0.75, 26, -46, 0.75, 36, rope, { bare: true });
    m.b(46, -0.75, 26, 64, 0.75, 36, rope, { bare: true });
    const steps: [number, number, number][] = [
      [46, 22, 26],
      [34, 16, 20],
      [24, 12, 15],
    ];
    for (const [x, w, z] of steps) {
      m.b(-x, -w / 2, z - 3, -x + 12, w / 2, z, mix(blue, 0x000000, 0.12), { top: blue });
      m.b(x - 12, -w / 2, z - 3, x, w / 2, z, mix(blue, 0x000000, 0.12), { top: blue });
    }
    m.b(-24, -12, SEAT_Z - 3, 24, 12, SEAT_Z, mix(blue, 0x000000, 0.12), { top: blue });
    m.b(-30, 3, SEAT_Z - 0.2, 30, 5, SEAT_Z + 0.1, stripe, { bare: true });
  },

  'weight-bench': (m) => {
    // A red padded bench on a dark frame, a rack at its head holding a barbell across it, a dumbbell on the floor.
    const red = 0xd23030;
    const frame = 0x334155;
    const plate = C.ink;
    m.b(-38, -4, 0, -34, 4, SEAT_Z - 4, C.steel, { bare: true });
    m.b(44, -4, 0, 48, 4, SEAT_Z - 4, C.steel, { bare: true });
    m.b(-42, -10, 0, -30, 10, 2, frame, { bare: true });
    m.b(40, -10, 0, 52, 10, 2, frame, { bare: true });
    m.b(-46, -10, SEAT_Z - 6, 58, 10, SEAT_Z - 3, frame);
    m.b(-46, -12, SEAT_Z - 3, 58, 12, SEAT_Z + 1, mix(red, 0x000000, 0.15), { top: red });
    // The rack and its bar.
    for (const y of [-24, 21]) {
      m.b(-56, y, 0, -52, y + 3, 44, C.steel);
      m.b(-60, y - 3, 0, -48, y + 6, 2, frame, { bare: true });
    }
    m.b(-55, -38, 42, -53, 38, 44, C.steel, { bare: true });
    for (const y of [-34, 28]) m.b(-61, y, 34, -47, y + 5, 52, mix(plate, 0xffffff, 0.08));
    // A dumbbell by its foot.
    m.b(26, 30, 3, 52, 32, 5, C.steel, { bare: true });
    for (const x of [26, 47]) m.b(x, 27, 0, x + 5, 35, 8, plate);
  },

  'nap-pod': (m) => {
    // A cream shell over the back of a bed: a plinth, a mattress, a pillow and a blanket, a reading light under the
    // hood and its dark lining.
    const shell = 0xf1ede4;
    const base = 0xd9d2c3;
    const lining = 0x475569;
    m.b(-52, -50, 0, 52, 48, 8, mix(base, 0x000000, 0.08), { top: base });
    m.b(-52, 48, 0, 52, 52, 10, base);
    m.b(-44, -46, 8, 44, 46, 13, 0xa9b4f0, { top: 0xc7d2fe });
    m.b(-44, 6, 13, 44, 44, 15, 0x7d85d8, { top: 0x8f97ea });
    m.b(-26, -40, 13, 26, -26, 18, 0xdfe4fa, { top: 0xeef2ff });
    // The hood: its sides, back and roof, lined dark.
    m.b(-54, -54, 0, -46, 4, 40, shell);
    m.b(46, -54, 0, 54, 4, 40, shell);
    m.b(-54, -54, 0, 54, -48, 46, shell);
    m.b(-54, -54, 40, 54, 4, 46, mix(shell, 0x000000, 0.05), { top: shell });
    m.b(-40, -54, 46, 40, -2, 52, mix(shell, 0x000000, 0.05), { top: shell });
    m.b(-46, -48, 13, -45, 4, 40, lining, { bare: true });
    m.b(45, -48, 13, 46, 4, 40, lining, { bare: true });
    m.b(-46, -48, 39, 46, 4, 40, lining, { bare: true });
    m.b(-46, -48, 13, 46, -47, 40, lining, { bare: true });
    m.c(0, -4, 12, 5, 37.5, 39, 0xeedd99, { bare: true });
  },

  podium: (m, { f, seats }) => {
    // A wooden lectern: a base, a tapered body with a brass emblem, a sloped top with notes and a microphone. It
    // stands on its footprint, reaching back toward the speaker behind it.
    const wood = 0xb7793f;
    const deep = 0x7c4a2a;
    const y1 = f.foot.y1;
    const y0 = Math.min(f.foot.y0, Math.max((seats[0]?.y ?? -24) + 14, y1 - 34));
    m.b(-22, y0, 0, 22, y1 + 2, 5, deep);
    m.b(-15, y0 + 3, 5, 15, y1 - 1, 18, wood);
    m.b(-17, y0 + 2, 18, 17, y1, 32, wood);
    m.b(10, y1 - 0.4, 6, 15, y1 + 0.2, 31, deep, { bare: true });
    m.c(-2, y1, 9, 1, 19, 28, 0xd6ad3c, { bare: true });
    m.c(-2, y1 + 0.6, 4, 0.6, 21.5, 25.5, deep, { bare: true });
    const mid = (y0 + y1) / 2;
    m.b(-25, y0 - 2, 32, 25, y1 + 2, 35, mix(wood, 0x000000, 0.1), { top: wood });
    m.b(-25, mid, 35, 25, y1 + 2, 38, mix(wood, 0x000000, 0.1), { top: wood });
    m.b(-12, y0 + 1, 35, 12, mid - 2, 35.6, 0xffffff, { bare: true });
    m.b(-12, mid + 1, 38, 12, y1 - 1, 38.6, 0xffffff, { bare: true });
    m.c(16, y1 - 4, 2, 2, 38, 46, 0x475569, { bare: true });
    m.c(16, y1 - 7, 2, 6, 45, 47, 0x475569, { bare: true });
    m.c(16, y1 - 11, 4, 4, 45, 50, C.ink);
    m.c(17, y1 - 2, 2, 2, 38, 39.5, 0xde5555, { bare: true });
  },

  'office-pod': (m, { seats }) => {
    // The pod's furniture (its walls are the 3D view's walls): a bench at each seat, its back against the pod's end,
    // and a table between them with a glass on it.
    if (seats.length === 0) return;
    const seat = 0x8496bd;
    const back = 0x64769f;
    for (const s of seats) {
      const b = seatBoxes(m, s);
      b(-26, -12, 0, 26, 9, SEAT_Z, mix(seat, 0x000000, 0.15), seat);
      b(-26, -20, 0, 26, -12, SEAT_Z + 24, back, mix(back, 0xffffff, 0.1));
    }
    const xs = seats.map((s) => s.x);
    const ys = seats.map((s) => s.y);
    const midX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const midY = ys.reduce((a, b) => a + b, 0) / ys.length;
    const across = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
    const tw = across ? Math.max(20, (Math.max(...xs) - Math.min(...xs)) * 0.42) : 44;
    const td = across ? 34 : Math.max(20, (Math.max(...ys) - Math.min(...ys)) * 0.42);
    deskTop(
      m,
      midX - tw / 2,
      midY - td / 2,
      midX + tw / 2,
      midY + td / 2,
      27,
      C.woodLight,
      C.wood,
      C.woodDeep,
    );
    m.c(midX, midY, 5, 5, 27, 34, 0xdbe6ee, { top: 0xbcd3e4 });
  },

  'phone-booth': (m, { seats }) => {
    // A tall wooden-framed booth with glass on three sides and a dark back panel, a header with a light on its roof,
    // a stool inside and a shelf with the phone on it.
    const s = seats[0] ?? { x: 0, y: 44, facing: 'down' };
    const frame = 0xc08a52;
    const deep = 0x8a5a2b;
    const glass = 0x3f4b5e;
    const H = 112;
    const x0 = -40;
    const x1 = 40;
    const y0 = -68;
    const y1 = 68;
    const k = 6;
    m.b(x0, y0, 0, x1, y1, 4, deep);
    for (const x of [x0, x1 - k])
      for (const y of [y0, y1 - k]) m.b(x, y, 4, x + k, y + k, H - 14, frame);
    m.b(x0, y0, H - 16, x1, y1, H, mix(frame, 0x000000, 0.1), { top: frame });
    m.b(-26, y1, H - 13, 26, y1 + 0.6, H - 7, deep, { bare: true });
    m.c(0, 0, 44, 8, H, H + 4, 0xe5e7eb);
    m.b(x0 + 1, y0, 4, x1 - 1, y0 + 4, H - 16, 0x334155);
    m.b(x0 + k, y1 - 3, 4, x1 - k, y1 - 1, H - 16, glass, { glass: true });
    m.b(x0, y0 + k, 4, x0 + 2, y1 - k, H - 16, glass, { glass: true });
    m.b(x1 - 2, y0 + k, 4, x1, y1 - k, H - 16, glass, { glass: true });
    m.b(x0 + k, y1 - 3, 40, x1 - k, y1 - 1, 42, frame, { bare: true });
    m.b(x0 + k, y1 - 3, 72, x1 - k, y1 - 1, 74, frame, { bare: true });
    // The shelf and phone, ahead of the sitter, and the stool under them.
    m.b(-28, y1 - 14, 34, 28, y1 - 3, 36, frame);
    m.c(-8, y1 - 9, 12, 6, 36, 39, C.ink);
    const b = seatBoxes(m, s);
    b(-1.5, -1.5, 0, 1.5, 1.5, SEAT_Z - 3, 0x475569, undefined, true);
    b(-12, -9, 0, 12, 9, 1.5, 0x475569, undefined, true);
    b(-12, -9, SEAT_Z - 3, 12, 9, SEAT_Z, mix(0xdb7834, 0x000000, 0.15), 0xdb7834);
  },

  'toilet-cubicle': (m) => {
    // A cubicle open to the front: tiled back wall, teal partitions on feet, the door swung in against the right
    // wall, a toilet and its cistern against the back, a paper roll on the left.
    const teal = 0x6cc0ae;
    const tile = 0xe6f4f1;
    const H = 112;
    const y0 = 15;
    const y1 = 70;
    const td = mix(teal, 0x000000, 0.1);
    m.b(-48, y0, 0, 48, y0 + 4, H, tile, { top: 0xcbd5e1 });
    for (const z of [36, 66, 96])
      m.b(-44, y0 + 4, z, 44, y0 + 4.6, z + 1, 0xc4dcd6, { bare: true });
    for (const x of [-48, 41]) {
      m.b(x, y0 + 4, 6, x + 7, y1, H, td, { top: teal });
      m.b(x + 2, y1 - 6, 0, x + 5, y1 - 3, 6, C.steel, { bare: true });
    }
    m.b(-48, y1 - 3, H - 6, 48, y1, H, 0xcbd5e1);
    // The door, open against the right wall, with its latch.
    m.b(35, y0 + 10, 6, 41, y1 - 4, H - 8, td, { top: teal });
    m.b(34.4, y0 + 13, 56, 35, y0 + 17, 62, 0x29be60, { bare: true });
    // The toilet.
    const white = C.white;
    m.b(-13, y0 + 4, 22, 13, y0 + 12, 40, mix(white, 0x000000, 0.06), { top: white });
    m.c(0, y0 + 8, 6, 3, 40, 41, C.steel, { bare: true });
    m.b(-4, y0 + 8, 12, 4, y0 + 14, 22, white);
    m.b(-6, y0 + 12, 0, 6, y0 + 28, 8, mix(white, 0x000000, 0.06));
    round(m, 0, y0 + 24, 24, 26, 8, 14, mix(white, 0x000000, 0.04), white, 0.35);
    m.c(0, y0 + 25, 13, 15, 14, 14.4, 0xcbd5e1, { bare: true });
    // The paper roll.
    m.b(-41, y0 + 28, 30, -39, y0 + 36, 36, C.steel, { bare: true });
    m.c(-37, y0 + 32, 5, 8, 28, 37, 0xffffff);
  },

  treadmill: (m) => {
    // A dark deck with grey rails and a black belt, its motor hood and handles at the front and a console with a
    // green display facing the runner.
    const deck = 0x334155;
    const rail = 0x64748b;
    const belt = 0x111827;
    const hood = C.ink;
    m.b(-30, -52, 0, 30, 34, 7, deck);
    m.b(-22, -50, 7, 22, 32, 8, belt);
    for (const y of [-34, -16, 2, 20]) m.b(-22, y, 8, 22, y + 1, 8.3, 0x1f2937, { bare: true });
    m.b(-30, -52, 7, -22, 34, 10, rail);
    m.b(22, -52, 7, 30, 34, 10, rail);
    m.b(-30, 34, 0, 30, 52, 14, mix(hood, 0xffffff, 0.04), { top: hood });
    for (const x of [-28, 24]) m.b(x, 40, 14, x + 4, 44, 44, rail);
    m.b(-30, 30, 34, -26, 44, 36, C.steel, { bare: true });
    m.b(26, 30, 34, 30, 44, 36, C.steel, { bare: true });
    m.b(-24, 36, 40, 24, 46, 54, hood);
    m.b(-16, 35.4, 44, 16, 36, 51, 0x36d198, { bare: true });
  },
};

export const SEATING_MODELS: ModelTable = MODELS;
