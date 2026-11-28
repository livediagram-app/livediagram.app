// Real 3D's wall boards and fittings (docs/specs/008-canvas/3d-engine.md "Block models"): the notice-board, the Clock,
// the dartboard, the calendar and photo walls and the hand dryer, each hung at eye height against the back of its
// frame. Part of OUTDOOR_MODELS (outdoor.ts).
import { shade, type Rgb } from '../mesh-builder';
import { KIND_HEIGHT, mix, RISE, type ModelTable } from './kit';
import {
  BLUE,
  BOARD,
  CLOCK_CREAM,
  CLOCK_RIM,
  CLOCK_Z,
  GOLD,
  INK,
  OAK_DARK,
  onFace,
  oval,
  pixels,
  RED,
  wallY,
  wedge,
  WHITE,
} from './outdoor-kit';

export const WALL_BOARD_MODELS: ModelTable = {
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
};
