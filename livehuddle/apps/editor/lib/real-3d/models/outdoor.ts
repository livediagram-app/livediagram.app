// Real 3D's outdoor and recreation models (docs/specs/008-canvas/3d-engine.md "Block models"): plants and trees,
// the wall boards (hung at eye height against the back of their frame), the games tables, fires, the umbrella, the
// fountain, the bike rack, the stage curtains, pillars, columns, the signpost and the pet bed. Each in its drawing's
// colours (packages/document office*.ts), round things built smooth (cylinders, turned shapes, leafy balls).
// The shared colours and painted layers are outdoor-kit.ts, the wall boards outdoor-boards.ts and the games tables
// outdoor-games.ts; this file joins them and re-exports what the trees and tests read.
import { type Rgb } from '../mesh-builder';
import { KIND_HEIGHT, mix, type ModelTable } from './kit';
import {
  CURTAIN,
  CURTAIN_DARK,
  CURTAIN_GOLD,
  disc,
  FLAME,
  FLAME_CORE,
  foliage,
  GOLD,
  inOval,
  LEAF,
  LEAF_DARK,
  LEAF_LIGHT,
  LOG,
  OAK,
  OAK_DARK,
  onFace,
  oval,
  type Paint,
  pixels,
  SOIL,
  STONE,
  STONE_DARK,
  TERRACOTTA,
  TERRACOTTA_DARK,
  wedge,
} from './outdoor-kit';
import { WALL_BOARD_MODELS } from './outdoor-boards';
import { GAMES_MODELS } from './outdoor-games';

export { CLOCK_Z, foliage, hash } from './outdoor-kit';

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
  ...WALL_BOARD_MODELS,
  ...GAMES_MODELS,
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
