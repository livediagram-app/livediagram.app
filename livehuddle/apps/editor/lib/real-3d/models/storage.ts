// Real 3D's storage models (docs/specs/008-canvas/3d-engine.md "Block models"): cabinets, fridges, machines and
// fittings, each built on its front drawing's grid so its front reads as the drawing, with plain finished backs.
import type { BoxSpec, Rgb } from '../mesh-builder';
import { KIND_HEIGHT, mix, type Builder, type ModelContext, type ModelTable } from './kit';

const WHITE = 0xffffff;
const BLACK = 0x000000;

/** Where a counter's worktop is: what a microwave or kettle stands on. */
const COUNTER_Z = KIND_HEIGHT['kitchen-counter']!;

/** How high a Printer's stand lifts it (its shelf of paper under it). */
const PRINTER_STAND_Z = 16;

/** Heights this file sets for its own kinds, where the drawing asks for a different one than the kit's. */
const H = {
  'umbrella-stand': 30,
  washbasin: 62,
} as const;

/** A drawing's grid in the model: x across from the drawing's x, z up from the drawing's y (its floor at `base`). */
type Grid = { x: (ax: number) => number; z: (ay: number) => number; s: number };

function grid(c: ModelContext, artW: number, base: number, top: number, h: number): Grid {
  const s = c.f.W / artW;
  const k = h / (base - top);
  return { x: (ax) => (ax - artW / 2) * s, z: (ay) => (base - ay) * k, s };
}

/** A drawing's rectangle as a plate on a face at depth y, `d` thick (negative for a back face). */
function plate(
  m: Builder,
  g: Grid,
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  y: number,
  d: number,
  colour: Rgb,
  o: Partial<BoxSpec> = {},
): void {
  m.b(g.x(ax), y, g.z(ay + ah), g.x(ax + aw), y + d, g.z(ay), colour, o);
}

const dark = (c: Rgb, t = 0.3): Rgb => mix(c, BLACK, t);
const light = (c: Rgb, t = 0.15): Rgb => mix(c, WHITE, t);

/** A kitchen run's carcass, worktop and tiled upstand (the Kitchen Counter and Sink drawings share them). */
function kitchenRun(m: Builder, c: ModelContext): { g: Grid; yf: number } {
  const { x0, y0, x1, y1 } = c.f.foot;
  const g = grid(c, 112, 83, 14, COUNTER_Z);
  const green = 0x6f9a6c;
  const yf = y1 - 2;
  m.b(g.x(6), y0 + 2, 0, g.x(106), yf - 2, g.z(77), dark(green, 0.15), { bare: true });
  m.b(g.x(2), y0, g.z(77), g.x(110), yf, g.z(24), green);
  m.b(x0, y0, g.z(24), x1, y1, COUNTER_Z, 0xb7793d, { top: 0xd9a066 });
  // The tiles behind the worktop, as the drawing's top band, with their grout.
  const tile = 0xf1f5f9;
  const grout = 0xcbd5e1;
  const tz = COUNTER_Z + 9;
  m.b(x0, y0, COUNTER_Z, x1, y0 + 2.5, tz, tile);
  m.b(x0, y0 + 2.5, COUNTER_Z + 4.3, x1, y0 + 2.9, COUNTER_Z + 4.7, grout, { bare: true });
  for (let x = x0 + 14; x < x1 - 4; x += 14) {
    m.b(x, y0 + 2.5, COUNTER_Z, x + 0.5, y0 + 2.9, COUNTER_Z + 4.3, grout, { bare: true });
    m.b(x - 7, y0 + 2.5, COUNTER_Z + 4.7, x - 6.5, y0 + 2.9, tz, grout, { bare: true });
  }
  return { g, yf };
}

export const STORAGE_MODELS: ModelTable = {
  bookshelf: (m, c) => {
    // An open case: back, sides, top and plinth in the theme's wash, two shelves, and rows of books inside.
    const { x0, y0, x1, y1 } = c.f.foot;
    const h = KIND_HEIGHT.bookshelf!;
    const g = grid(c, 120, 126, 4, h);
    const wood = c.t.seat;
    m.b(x0, y0, 0, x1, y0 + 3, h, wood);
    m.b(x0, y0, 0, g.x(10), y1, h, wood);
    m.b(g.x(110), y0, 0, x1, y1, h, wood);
    m.b(g.x(10), y0, g.z(12), g.x(110), y1, h, wood);
    m.b(g.x(10), y0, 0, g.x(110), y1, g.z(114), wood);
    m.b(g.x(10), y0 + 3, g.z(114), g.x(110), y0 + 3.5, g.z(12), c.t.face, { bare: true });
    for (const [a, b] of [
      [42, 47],
      [78, 83],
    ] as const)
      m.b(g.x(10), y0 + 3, g.z(b), g.x(110), y1, g.z(a), wood);
    const RED = 0xb5524a;
    const BLUE = 0x3f74a8;
    const GOLD = 0xd4a23f;
    const GREEN = 0x4d9a78;
    const PURPLE = 0x7b65a8;
    const books: [number, number, number, number, Rgb][] = [
      [14, 18, 8, 24, RED],
      [23, 22, 7, 20, BLUE],
      [31, 16, 9, 26, GOLD],
      [41, 20, 6, 22, GREEN],
      [48, 18, 8, 24, PURPLE],
      [67, 22, 7, 20, BLUE],
      [75, 16, 10, 26, GOLD],
      [86, 20, 7, 22, GREEN],
      [94, 18, 8, 24, PURPLE],
      [14, 56, 7, 22, BLUE],
      [22, 54, 9, 24, GOLD],
      [32, 60, 6, 18, GREEN],
      [39, 58, 8, 20, PURPLE],
      [58, 56, 7, 22, BLUE],
      [66, 54, 10, 24, GOLD],
      [77, 54, 7, 24, GREEN],
      [85, 58, 8, 20, PURPLE],
      [94, 52, 8, 26, RED],
      [14, 94, 9, 20, GOLD],
      [24, 88, 6, 26, GREEN],
      [31, 92, 8, 22, PURPLE],
      [50, 90, 7, 24, BLUE],
      [58, 94, 10, 20, GOLD],
      [69, 88, 7, 26, GREEN],
      [77, 92, 8, 22, PURPLE],
      [86, 90, 8, 24, RED],
      [95, 96, 7, 18, BLUE],
    ];
    for (const [x, y, w, bh, col] of books)
      m.b(g.x(x), y0 + 6, g.z(y + bh), g.x(x + w) - 0.4, y1 - 2, g.z(y), col, {
        top: light(col, 0.2),
      });
  },

  'water-cooler': (m, c) => {
    // A cabinet with two taps and a drip tray, a neck, and the big water bottle upside down on top.
    const { y0, y1 } = c.f.foot;
    const g = grid(c, 56, 104, 4, KIND_HEIGHT['water-cooler']!);
    const yc = (y0 + y1) / 2;
    const half = 15;
    const yf = yc + half;
    m.b(g.x(10), yc - half, 0, g.x(46), yf, g.z(44), c.t.face);
    m.b(g.x(8), yc - half - 2, g.z(48), g.x(48), yf + 2, g.z(40), c.t.seat);
    plate(m, g, 14, 54, 28, 10, yf, 0.6, dark(c.t.face, 0.25), { bare: true });
    plate(m, g, 16, 56, 8, 6, yf + 0.6, 2.5, 0x5a95d6);
    plate(m, g, 32, 56, 8, 6, yf + 0.6, 2.5, 0xd9645c);
    plate(m, g, 16, 72, 24, 4, yf, 4, dark(c.t.seat, 0.35));
    m.c(0, yc, g.x(33) - g.x(23), 10, g.z(42), g.z(33), 0x9fd0ee);
    const bottle = 0xcfe8f6;
    m.c(0, yc, 32 * g.s, 28, g.z(36), g.z(8), bottle, { top: light(bottle, 0.3) });
    m.c(0, yc, 22 * g.s, 20, g.z(8), g.z(4), bottle, { top: light(bottle, 0.3) });
    // The water line round the bottle.
    m.c(0, yc, 32 * g.s + 0.6, 28.6, g.z(14), g.z(13), dark(bottle, 0.18), { bare: true });
  },

  'coffee-machine': (m, c) => {
    // A cupboard under a worktop, and the machine on it: a screen, a button, the cup under its spout, a water tank.
    const { x0, y0, x1, y1 } = c.f.foot;
    // The cupboard's worktop is at counter height (3d-engine.md "Stands at a real height"), the machine on it.
    const top = KIND_HEIGHT['coffee-machine']!;
    const g = grid(c, 72, 88, 8, top);
    const cz = COUNTER_Z;
    m.b(x0 + 1, y0 + 1, 0, x1 - 1, y1 - 1, cz - 3, c.t.face);
    m.b(x0, y0, cz - 3, x1, y1, cz, c.t.seat);
    // Two doors: their meeting line, a handle each, and a kick plate.
    m.b(-0.3, y1 - 1, 3, 0.3, y1 - 0.5, cz - 5, dark(c.t.face, 0.3), { bare: true });
    m.b(-4, y1 - 1, cz - 11, -2.5, y1 - 0.2, cz - 7, dark(c.t.face, 0.35));
    m.b(2.5, y1 - 1, cz - 11, 4, y1 - 0.2, cz - 7, dark(c.t.face, 0.35));
    m.b(x0 + 1, y1 - 1.2, 0, x1 - 1, y1 - 1, 2.5, dark(c.t.face, 0.25), { bare: true });
    const by0 = y0 + 2;
    const yf = by0 + 20;
    m.b(g.x(14), by0, cz, g.x(58), yf, top - 4, c.t.face);
    m.b(g.x(14) - 0.5, by0 - 0.5, top - 4, g.x(58) + 0.5, yf + 0.5, top, c.t.seat);
    m.b(g.x(20), yf, top - 9, g.x(52), yf + 0.6, top - 6, 0x1e293b, { front: 0x4b7aa8 });
    m.b(-2.5, yf, top - 13.5, 2.5, yf + 1.2, top - 11.5, c.t.seat);
    // The cup bay: a light recess, the spout and the cup.
    m.b(g.x(26), yf, cz, g.x(46), yf + 0.6, cz + 9, 0xdde5ec, { bare: true });
    m.b(-2, yf, cz + 7.5, 2, yf + 4, cz + 9.5, dark(c.t.face, 0.3));
    m.b(-5, yf + 1, cz, 5, yf + 7, cz + 5, 0xdde5ec, { top: 0x5e3a1e, front: 0xf1f5f9 });
    m.b(g.x(58), by0 + 3, cz, g.x(67), by0 + 16, cz + 11, c.t.seat, { top: light(c.t.seat) });
  },

  'drinks-cabinet': (m, c) => {
    // A wooden cabinet on legs: two glass doors over shelves of bottles, a drawer below.
    const { x0, y0, x1, y1 } = c.f.foot;
    const h = KIND_HEIGHT['drinks-cabinet']!;
    const g = grid(c, 88, 116, 4, h);
    const wood = 0xb98352;
    const lz = g.z(108);
    m.legs(g.x(10), y0 + 3, g.x(78), y1 - 3, lz, 3, c.t.stroke);
    m.b(x0, y0, lz, x1, y1, g.z(78), wood);
    m.b(x0, y0, g.z(78), x1, y0 + 3, g.z(12), wood);
    m.b(x0, y0, g.z(78), g.x(10), y1, g.z(12), wood);
    m.b(g.x(78), y0, g.z(78), x1, y1, g.z(12), wood);
    m.b(g.x(42), y0, g.z(78), g.x(46), y1, g.z(12), wood);
    m.b(x0, y0, g.z(12), x1, y1, h, wood, { top: light(wood, 0.1) });
    m.b(g.x(10), y0 + 3, g.z(78), g.x(78), y0 + 3.5, g.z(12), dark(wood, 0.35), { bare: true });
    m.b(g.x(10), y0 + 3, g.z(45), g.x(78), y1 - 2, g.z(43), light(wood, 0.1));
    // Bottles: a body and a neck, on the shelf and the floor of the case.
    const yc = y1 - 12;
    const bottles: [number, number, number, Rgb, number][] = [
      [13, 12, 7, 0xa8642a, 43],
      [24, 18, 7, 0xb5403a, 43],
      [49, 10, 7, 0x7e5aa8, 43],
      [60, 16, 7, 0xd5b043, 43],
      [13, 18, 7, 0xb5403a, 78],
      [24, 14, 7, 0x3a86b8, 78],
      [49, 16, 7, 0xd5b043, 78],
      [60, 13, 7, 0x2f7d4a, 78],
    ];
    for (const [x, bh, w, col, floor] of bottles) {
      const z0 = g.z(floor);
      const z1 = z0 + bh * 0.62;
      m.b(g.x(x), yc - 3.5, z0, g.x(x + w), yc + 3.5, z1, col, { top: light(col, 0.2) });
      m.b(g.x(x + 2), yc - 1.5, z1, g.x(x + 5), yc + 1.5, z1 + 4, col, { top: light(col, 0.2) });
    }
    plate(m, g, 10, 12, 32, 64, y1 - 1.5, 1.5, 0xdbe6ee, { glass: true });
    plate(m, g, 46, 12, 32, 64, y1 - 1.5, 1.5, 0xdbe6ee, { glass: true });
    plate(m, g, 10, 82, 68, 22, y1, 0.8, 0x7c4f2c);
    plate(m, g, 38, 92, 12, 2, y1 + 0.8, 1, dark(wood, 0.5), { bare: true });
    // Knobs on the glass doors.
    plate(m, g, 37, 42, 3, 6, y1, 1.5, dark(wood, 0.4), { bare: true });
    plate(m, g, 48, 42, 3, 6, y1, 1.5, dark(wood, 0.4), { bare: true });
  },

  'drinks-fridge': (m, c) => {
    // A glass-fronted cooler: a lit strip over the door, three shelves of cans behind the glass, a long handle.
    const { x0, y0, x1, y1 } = c.f.foot;
    const h = KIND_HEIGHT['drinks-fridge']!;
    const g = grid(c, 72, 122, 4, h);
    const body = c.t.seat;
    m.b(x0, y0, 0, x1, y0 + 3, h, body);
    m.b(x0, y0, 0, g.x(9), y1, h, body);
    m.b(g.x(63), y0, 0, x1, y1, h, body);
    m.b(g.x(9), y0, g.z(19), g.x(63), y1, h, body, { top: light(body, 0.08) });
    m.b(g.x(9), y0, 0, g.x(63), y1, g.z(115), body);
    m.b(g.x(9), y0 + 3, g.z(115), g.x(63), y0 + 3.5, g.z(19), dark(0xb9c8d4, 0.2), { bare: true });
    plate(m, g, 10, 9, 52, 6, y1, 0.6, 0x1e293b, { front: 0x4b7aa8 });
    const cols = [0xc8453d, 0x3f74b8, 0x3f9a5a, 0xd28f36];
    const yc = y1 - 10;
    [45, 73, 101].forEach((shelf, r) => {
      m.b(g.x(9), y0 + 3, g.z(shelf + 1), g.x(63), y1 - 2, g.z(shelf), 0xcbd5e1, { bare: true });
      for (let i = 0; i < 5; i++) {
        const x = 13 + i * 9.4;
        const col = cols[(i + r) % 4]!;
        m.b(g.x(x), yc - 3.5, g.z(shelf), g.x(x + 7), yc + 3.5, g.z(shelf - 12), col, {
          top: 0xe2e8f0,
        });
      }
    });
    plate(m, g, 9, 19, 54, 96, y1 - 1.5, 1.5, 0xb9c8d4, { glass: true });
    plate(m, g, 57, 48, 2.5, 40, y1, 2, c.t.stroke);
  },

  'vending-machine': (m, c) => {
    // The green machine: a gold header, a window of snacks on shelves, a keypad with its display and coin slot,
    // the delivery flap, on a plinth.
    const { x0, y0, x1, y1 } = c.f.foot;
    const h = KIND_HEIGHT['vending-machine']!;
    const g = grid(c, 72, 124, 4, h);
    const green = 0x176e67;
    const deep = 0x115e59;
    const yf = y1 - 1;
    m.b(x0, y0, 0, x1, y1, g.z(116), deep);
    m.b(x0 + 1, y0, g.z(116), x1 - 1, yf, h, green, { top: light(green, 0.08) });
    plate(m, g, 8, 8, 56, 11, yf, 0.8, 0xdeb241);
    plate(m, g, 12, 12, 14, 1.5, yf + 0.8, 0.4, light(0xdeb241, 0.4), { bare: true });
    plate(m, g, 8, 23, 41, 74, yf, 0.6, 0xecfeff);
    const R = 0xde5555;
    const O = 0xd89728;
    const B = 0x5187e0;
    const G = 0x21a87b;
    const P = 0xa868e4;
    const K = 0xdd5799;
    const rows: Rgb[][] = [
      [R, O, B],
      [B, G, P],
      [P, K, R],
      [R, O, B],
      [B, G, P],
    ];
    rows.forEach((row, r) => {
      const y = 26 + r * 14;
      row.forEach((col, i) =>
        plate(m, g, 12 + i * 12, y, 9, 10, yf + 0.6, 2, col, { top: light(col, 0.2) }),
      );
      plate(m, g, 10, y + 10, 37, 1.2, yf + 0.6, 2.6, dark(0xecfeff, 0.3), { bare: true });
    });
    plate(m, g, 52, 23, 12, 74, yf, 0.8, deep);
    plate(m, g, 54, 27, 8, 5, yf + 0.8, 0.5, 0x50d882, { bare: true });
    plate(m, g, 53.5, 36, 8, 10, yf + 0.8, 0.5, 0xcbd5e1, { bare: true });
    plate(m, g, 57, 52, 2, 7, yf + 0.8, 0.5, 0x0f172a, { bare: true });
    plate(m, g, 10, 102, 38, 13, yf, 0.8, deep);
    plate(m, g, 14, 105.5, 30, 1.5, yf + 0.8, 0.4, 0x0b3f3b, { bare: true });
  },

  printer: (m, c) => {
    // A desktop printer on its paper drawer: the page coming out of the top, the output slot, the control panel.
    // On a low stand with a shelf of paper, so its top is at a hand's height (3d-engine.md "Stands at a real height").
    const { x0, y0, x1, y1 } = c.f.foot;
    const stand = PRINTER_STAND_Z;
    const g0 = grid(c, 72, 75, 4, KIND_HEIGHT.printer! - stand);
    const g: Grid = { ...g0, z: (ay) => stand + g0.z(ay) };
    const leg = dark(c.t.stroke, 0.1);
    m.legs(g.x(8), y0 + 0.5, g.x(64), y1 - 0.5, stand - 2, 2.5, leg);
    m.b(g.x(6), y0, stand - 2, g.x(66), y1, stand, c.t.seat, { top: light(c.t.seat, 0.08) });
    m.b(g.x(9), y0 + 1, 4, g.x(63), y1 - 1, 5.5, c.t.seat, { top: light(c.t.seat, 0.08) });
    m.b(g.x(14), y0 + 3, 5.5, g.x(40), y1 - 4, 9.5, WHITE, { top: 0xf8fafc });
    m.b(g.x(10), y0, stand, g.x(62), y1, g.z(44), c.t.face);
    plate(m, g, 14, 59, 44, 1, y1, 0.4, dark(c.t.face, 0.3), { bare: true });
    plate(m, g, 30, 50, 12, 2.5, y1, 0.8, 0x334155, { bare: true });
    plate(m, g, 30, 65, 12, 2.5, y1, 0.8, 0x334155, { bare: true });
    m.b(x0 - 1, y0 - 1, g.z(46), x1 + 1, y1, g.z(20), c.t.seat, { top: light(c.t.seat, 0.08) });
    plate(m, g, 12, 20, 48, 6, y1, 0.6, c.t.face);
    plate(m, g, 13, 37.5, 29, 1, y1, 0.4, dark(c.t.seat, 0.3), { bare: true });
    plate(m, g, 46, 30, 14, 7, y1, 0.8, 0x0f172a);
    plate(m, g, 48, 32, 7, 2, y1 + 0.8, 0.4, 0x50b4e0, { bare: true });
    plate(m, g, 52, 40, 2.5, 2.5, y1, 0.8, 0x29be60, { bare: true });
    // The page standing out of the top, its lines.
    const py = y0 + 3;
    m.b(g.x(19), py, g.z(20), g.x(47), py + 1, g.z(4), WHITE);
    for (const [ax, aw, ay] of [
      [22, 18, 9],
      [21.5, 22, 13],
      [21, 14, 17],
    ] as const)
      m.b(g.x(ax), py + 1, g.z(ay + 0.6), g.x(ax + aw), py + 1.3, g.z(ay - 0.6), 0x94a3b8, {
        bare: true,
      });
  },

  copier: (m, c) => {
    // A floor copier: three paper drawers on castors, the body with its output tray, the scanner lid with paper on
    // it, the control panel and screen at its right.
    const { y0, y1 } = c.f.foot;
    const g = grid(c, 104, 122, 8, KIND_HEIGHT.copier!);
    const lz = g.z(118);
    m.legs(g.x(16), y0 + 1, g.x(88), y1 - 1, lz, 3, c.t.stroke);
    m.b(g.x(12), y0, lz, g.x(92), y1, g.z(62), c.t.seat);
    for (const ay of [66, 83, 100]) {
      plate(m, g, 16, ay, 72, 14, y1, 0.6, c.t.face);
      plate(m, g, 44, ay + 5, 16, 3, y1 + 0.6, 0.8, 0x334155, { bare: true });
    }
    m.b(g.x(8), y0 - 1, g.z(64), g.x(96), y1 + 1, g.z(30), c.t.seat, {
      top: light(c.t.seat, 0.08),
    });
    plate(m, g, 16, 38, 50, 18, y1 + 1, 0.6, c.t.face);
    plate(m, g, 22, 46, 38, 7, y1 + 1.6, 1.5, WHITE);
    m.b(g.x(6), y0, g.z(32), g.x(82), y1, g.z(18), c.t.seat, { top: light(c.t.seat, 0.12) });
    const pz = g.z(18);
    m.b(g.x(16), y0 + 3, pz, g.x(62), y1 - 3, pz + 2.5, WHITE, { top: 0xf8fafc });
    m.b(g.x(20), y1 - 9, pz + 2.5, g.x(52), y1 - 8.4, pz + 2.6, 0x94a3b8, { bare: true });
    m.b(g.x(20), y1 - 7, pz + 2.5, g.x(44), y1 - 6.4, pz + 2.6, 0x94a3b8, { bare: true });
    // The control panel, standing proud at the right of the lid.
    m.b(g.x(72), y1 - 8, g.z(40), g.x(100), y1 + 2, g.z(20), c.t.seat, {
      top: light(c.t.seat, 0.12),
    });
    plate(m, g, 76, 23, 20, 12, y1 + 2, 0.6, 0x0f172a);
    plate(m, g, 78, 25, 11, 3, y1 + 2.6, 0.4, 0x50b4e0, { bare: true });
    plate(m, g, 78, 30, 7, 2.5, y1 + 2.6, 0.4, 0x50b4e0, { bare: true });
    plate(m, g, 91, 30, 2.5, 2.5, y1 + 2.6, 0.4, 0x29be60, { bare: true });
  },

  lockers: (m, c) => {
    // A bank of four lockers: blue doors in two tones, each with vents, a name card and a handle, on a kick plate.
    const { x0, y0, x1, y1 } = c.f.foot;
    const h = KIND_HEIGHT.lockers!;
    const g = grid(c, 136, 122, 4, h);
    m.b(x0, y0, 0, x1, y1, h, c.t.seat, { top: light(c.t.seat, 0.08) });
    plate(m, g, 4, 113, 128, 9, y1, 0.4, c.t.face, { bare: true });
    for (let i = 0; i < 4; i++) {
      const x = 9 + i * 30;
      const col = i % 2 ? 0x5187e0 : 0x74a7e6;
      plate(m, g, x, 9, 28, 104, y1, 0.8, col);
      for (const ay of [14, 18, 22])
        plate(m, g, x + 6, ay, 16, 1.4, y1 + 0.8, 0.4, dark(col, 0.3), { bare: true });
      plate(m, g, x + 9, 33, 10, 6, y1 + 0.8, 0.5, 0xf8fafc, { bare: true });
      plate(m, g, x + 21, 58, 3, 15, y1 + 0.8, 1.2, 0x334155, { bare: true });
    }
  },

  'coat-rack': (m, c) => {
    // A wooden pole on splayed feet, a hat on top, a blue coat with a red scarf and a tan coat on its hooks.
    const { y0, y1 } = c.f.foot;
    const g = grid(c, 56, 125, 3, KIND_HEIGHT['coat-rack']!);
    const yc = (y0 + y1) / 2;
    const pole = 0xc2894b;
    const ink = c.t.stroke;
    m.c(0, yc, 30, 3, 0, 2, ink);
    m.c(0, yc, 3, Math.max(8, y1 - y0), 0, 2, ink);
    m.c(0, yc, 6, 6, 0, 5, ink);
    m.c(0, yc, 4, 4, 5, g.z(12), pole);
    m.c(0, yc, 24, 2.5, g.z(25), g.z(23), ink, { bare: true });
    // The hat: brim and crown.
    const hat = 0x57534e;
    m.c(0, yc, 26 * g.s, 16, g.z(12), g.z(12) + 1.6, hat);
    m.c(0, yc, 16 * g.s, 11, g.z(12) + 1.6, g.z(3), hat, { top: light(hat, 0.1) });
    // The blue coat, hung left of the pole.
    const blue = 0x1f3b89;
    m.b(g.x(7), yc - 5, g.z(91), g.x(23), yc + 5, g.z(37), blue);
    m.b(g.x(11), yc - 4.5, g.z(37), g.x(26), yc + 4.5, g.z(27), blue);
    // The tan coat, right of it, with its buttons.
    const tan = 0xc8924f;
    m.b(g.x(33), yc - 5, g.z(87), g.x(49), yc + 5, g.z(37), tan);
    m.b(g.x(30), yc - 4.5, g.z(37), g.x(45), yc + 4.5, g.z(27), tan);
    for (const ay of [46, 58, 70])
      plate(m, g, 38, ay, 2.5, 2.5, yc + 5, 0.6, 0x86431a, { bare: true });
    // The scarf down the front of the blue coat, striped.
    plate(m, g, 13.5, 27, 7, 27, yc + 5, 1, 0xd23030);
    for (const ay of [38, 45]) plate(m, g, 13.5, ay, 7, 2.5, yc + 6, 0.4, 0xeedd99, { bare: true });
  },

  'umbrella-stand': (m, c) => {
    // A bin with three furled umbrellas leaning out of it, their hooked handles on top.
    const { y0, y1 } = c.f.foot;
    const g = grid(c, 40, 59, 5, H['umbrella-stand']);
    const yc = (y0 + y1) / 2;
    const bz = g.z(31);
    const ink = c.t.stroke;
    const brolly = (
      ax0: number,
      ax1: number,
      ay: number,
      y: number,
      col: Rgb,
      hx: number,
      hy: number,
    ) => {
      m.b(g.x(ax0), y - 1.5, bz - 6, g.x(ax1), y + 1.5, g.z(ay), col, { top: light(col, 0.2) });
      const sx = g.x((ax0 + ax1) / 2);
      m.b(sx - 0.5, y - 0.5, g.z(ay), sx + 0.5, y + 0.5, g.z(hy), ink, { bare: true });
      m.b(
        Math.min(sx, g.x(hx)) - 0.5,
        y - 0.5,
        g.z(hy) - 1,
        Math.max(sx, g.x(hx)) + 0.5,
        y + 0.5,
        g.z(hy),
        ink,
        {
          bare: true,
        },
      );
      m.b(g.x(hx) - 0.5, y - 0.5, g.z(hy) - 3, g.x(hx) + 0.5, y + 0.5, g.z(hy) - 1, ink, {
        bare: true,
      });
    };
    brolly(9.5, 14.5, 14, yc - 2, 0xde5555, 4.5, 6);
    brolly(18.5, 22, 12, yc + 1, 0x2a54cb, 26, 3);
    brolly(25, 30, 16, yc - 1, 0xdcba33, 36, 7.5);
    m.b(g.x(8), y0, 0, g.x(32), y1, bz, c.t.seat, { top: dark(c.t.seat, 0.45) });
    m.b(g.x(7), y0 - 0.6, bz - 2.5, g.x(33), y1 + 0.6, bz - 0.2, c.t.face);
    m.b(g.x(8), y0 - 0.4, 0, g.x(32), y1 + 0.4, 1.5, dark(c.t.seat, 0.2), { bare: true });
  },

  'kitchen-counter': (m, c) => {
    // Two drawers over two cupboards in sage green, brass handles, a wooden worktop and tiles behind it.
    const { g, yf } = kitchenRun(m, c);
    const door = 0x9cbf9a;
    const brass = 0xd2a63c;
    plate(m, g, 4, 29, 51, 12, yf, 0.8, door);
    plate(m, g, 57, 29, 51, 12, yf, 0.8, door);
    plate(m, g, 4, 43, 51, 34, yf, 0.8, door);
    plate(m, g, 57, 43, 51, 34, yf, 0.8, door);
    plate(m, g, 22.5, 33.75, 14, 2.5, yf + 0.8, 1, brass, { bare: true });
    plate(m, g, 75.5, 33.75, 14, 2.5, yf + 0.8, 1, brass, { bare: true });
    plate(m, g, 49, 49, 2.5, 12, yf + 0.8, 1, brass, { bare: true });
    plate(m, g, 60.5, 49, 2.5, 12, yf + 0.8, 1, brass, { bare: true });
  },

  'kitchen-sink': (m, c) => {
    // The counter run with a steel sink let into the worktop, a gooseneck tap, two cupboards and a tea towel.
    const { g, yf } = kitchenRun(m, c);
    const { y0, y1 } = c.f.foot;
    const door = 0x9cbf9a;
    const brass = 0xd2a63c;
    plate(m, g, 4, 29, 51, 48, yf, 0.8, door);
    plate(m, g, 57, 29, 51, 48, yf, 0.8, door);
    plate(m, g, 49, 35, 2.5, 12, yf + 0.8, 1, brass, { bare: true });
    plate(m, g, 60.5, 35, 2.5, 12, yf + 0.8, 1, brass, { bare: true });
    // The tea towel over the right door.
    plate(m, g, 70, 33, 16, 25, yf + 0.8, 0.8, 0xf8fafc);
    plate(m, g, 70, 44, 16, 2.5, yf + 1.6, 0.3, 0xde5555, { bare: true });
    plate(m, g, 70, 49, 16, 1.5, yf + 1.6, 0.3, 0xde5555, { bare: true });
    // The sink: a steel rim and the bowl inside it.
    const z = COUNTER_Z;
    m.b(g.x(28), y0 + 6, z, g.x(84), y1 - 5, z + 0.4, 0xcbd5e1);
    m.b(g.x(31), y0 + 8, z + 0.4, g.x(81), y1 - 7, z + 0.5, 0x94a3b8, { bare: true });
    // The tap and its two handles at the back.
    const ink = c.t.stroke;
    const ty = y0 + 4;
    m.b(-1, ty, z, 1, ty + 2, z + 10, ink);
    m.b(-1, ty + 2, z + 8, 1, ty + 9, z + 10, ink);
    m.b(-1, ty + 7, z + 6, 1, ty + 9, z + 8, ink, { bare: true });
    m.b(g.x(47), ty, z, g.x(51), ty + 2.5, z + 1.6, 0x94a3b8);
    m.b(g.x(61), ty, z, g.x(65), ty + 2.5, z + 1.6, 0x94a3b8);
  },

  fridge: (m, c) => {
    // A tall fridge-freezer: two doors with long handles, a photo and a note held by magnets, the coil on its back.
    const { x0, y0, x1, y1 } = c.f.foot;
    const h = KIND_HEIGHT.fridge!;
    const g = grid(c, 72, 132, 4, h);
    const lz = g.z(129);
    m.legs(g.x(10), y0 + 1, g.x(62), y1 - 2, lz, 3, c.t.stroke);
    m.b(x0, y0, lz, x1, y1 - 1, h, c.t.seat, { top: light(c.t.seat, 0.08) });
    const door = light(c.t.seat, 0.05);
    plate(m, g, 8, 8, 56, 38, y1 - 1, 1, door);
    plate(m, g, 8, 49, 56, 76, y1 - 1, 1, door);
    plate(m, g, 55, 18, 3.5, 20, y1, 2, 0x94a3b8);
    plate(m, g, 55, 56, 3.5, 32, y1, 2, 0x94a3b8);
    // The photo (a sun, a house, the grass) and the note.
    plate(m, g, 15, 63, 24, 20, y1, 0.5, 0xfefce8, { bare: true });
    plate(m, g, 18.5, 66.5, 5, 5, y1 + 0.5, 0.3, 0xdcba33, { bare: true });
    plate(m, g, 27, 72, 10, 8, y1 + 0.5, 0.3, 0xde5555, { bare: true });
    plate(m, g, 16, 80, 22, 2, y1 + 0.5, 0.3, 0x29be60, { bare: true });
    plate(m, g, 25, 61, 4.5, 4.5, y1 + 0.5, 1, 0x5187e0, { bare: true });
    plate(m, g, 14, 95, 16, 14, y1, 0.5, 0xeedd99, { bare: true });
    plate(m, g, 16, 99, 12, 1, y1 + 0.5, 0.2, dark(0xeedd99, 0.35), { bare: true });
    plate(m, g, 16, 103, 9, 1, y1 + 0.5, 0.2, dark(0xeedd99, 0.35), { bare: true });
    plate(m, g, 20, 93, 4.5, 4.5, y1 + 0.5, 1, 0xdb7834, { bare: true });
    // The coil on the back.
    const coil = dark(c.t.seat, 0.35);
    for (let i = 0; i < 5; i++) {
      const z = 14 + i * 12;
      m.b(g.x(14), y0 - 0.8, z, g.x(58), y0, z + 1.5, coil, { bare: true });
    }
    m.b(g.x(14), y0 - 0.8, 14, g.x(16), y0, 63.5, coil, { bare: true });
    m.b(g.x(56), y0 - 0.8, 14, g.x(58), y0, 63.5, coil, { bare: true });
  },

  microwave: (m, c) => {
    // Stands on a counter's worktop: a dark glass door, the display and the buttons beside it.
    const g = grid(c, 60, 36, 4, 16);
    const z0 = COUNTER_Z;
    const zt = (ay: number) => z0 + 1 + g.z(ay);
    const yf = 11;
    for (const [ax, y] of [
      [4, -11],
      [53, -11],
      [4, 8],
      [53, 8],
    ] as const)
      m.b(g.x(ax), y, z0, g.x(ax + 3), y + 2.5, z0 + 1, c.t.stroke, { bare: true });
    m.b(g.x(2), -12, z0 + 1, g.x(58), yf, zt(4), c.t.seat, { top: light(c.t.seat, 0.08) });
    m.b(g.x(6), yf, zt(32), g.x(42), yf + 0.6, zt(8), 0x1e293b);
    m.b(g.x(14), yf + 0.6, zt(20), g.x(17), yf + 0.9, zt(14), 0x475569, { bare: true });
    m.b(g.x(19), yf + 0.6, zt(22), g.x(22), yf + 0.9, zt(13), 0x475569, { bare: true });
    m.b(g.x(47), yf, zt(14), g.x(55), yf + 0.6, zt(9), 0x0f172a, { bare: true });
    m.b(g.x(48.5), yf + 0.6, zt(12.5), g.x(53.5), yf + 0.9, zt(10.5), 0x50d882, { bare: true });
    for (const [ax, ay] of [
      [48, 18],
      [52, 18],
      [48, 22.5],
      [52, 22.5],
      [48, 27],
      [52, 27],
    ] as const)
      m.b(g.x(ax), yf, zt(ay + 2.5), g.x(ax + 3), yf + 0.8, zt(ay), 0x94a3b8, { bare: true });
  },

  kettle: (m, c) => {
    // Stands on a counter's worktop: a red kettle on its dark base, a spout, a handle and the water window.
    const g = grid(c, 32, 33, 4.5, 12);
    const z = (ay: number) => COUNTER_Z + g.z(ay);
    const red = 0xde5555;
    const ink = 0x334155;
    m.b(g.x(5), -6, COUNTER_Z, g.x(27), 6, z(29), ink);
    m.b(g.x(9), -5, z(29), g.x(24), 5, z(10), red, { top: light(red, 0.1) });
    m.b(g.x(11), -4, z(10), g.x(22), 4, z(8), red);
    m.b(g.x(13.5), -2, z(8), g.x(19.5), 2, z(4.5), ink);
    m.b(g.x(4), -1, z(13), g.x(9), 1, z(10), red);
    m.b(g.x(24), -1, z(25.5), g.x(29), 1, z(23.5), c.t.stroke);
    m.b(g.x(27.5), -1, z(23.5), g.x(29.5), 1, z(12.5), c.t.stroke);
    m.b(g.x(24), -1, z(13.5), g.x(29), 1, z(11.5), c.t.stroke);
    m.b(g.x(18.5), 5, z(25), g.x(21.5), 5.5, z(14), 0xbae6fd, { bare: true });
  },

  washbasin: (m, c) => {
    // A pedestal basin with its tap and soap, and the mirror on a board standing behind it.
    const { y0, y1 } = c.f.foot;
    const top = H.washbasin;
    const g = grid(c, 72, 106, 2, top);
    const yc = (y0 + y1) / 2;
    const china = 0xf8fafc;
    m.b(g.x(28), yc - 6, 0, g.x(44), yc + 6, g.z(80), china);
    const by0 = yc - 15;
    const by1 = yc + 8;
    m.b(g.x(12), by0, g.z(83), g.x(60), by1, g.z(65), china);
    m.b(g.x(8), by0 - 1, g.z(65), g.x(64), by1 + 1, g.z(59), china);
    m.b(g.x(14), by0 + 3, g.z(59), g.x(58), by1 - 2, g.z(59) + 0.2, 0xcbd5e1, { bare: true });
    // The board the mirror hangs on, the mirror and its glint.
    const my = by0 - 1;
    m.b(g.x(10), my - 3, 0, g.x(62), my, top, c.t.seat, { top: light(c.t.seat, 0.1) });
    plate(m, g, 14, 6, 44, 38, my, 0.6, 0xdbeafe);
    m.b(g.x(30), my + 0.6, g.z(40), g.x(36), my + 0.9, g.z(10), 0xeff6ff, { bare: true });
    // The tap, and the soap on the rim.
    const ink = c.t.stroke;
    m.b(-1, by0 + 1, g.z(59), 1, by0 + 3, g.z(52), ink);
    m.b(-1, by0 + 3, g.z(54), 1, by0 + 8, g.z(52), ink);
    m.b(g.x(51), by1 - 6, g.z(59), g.x(58), by1 - 1, g.z(51), 0xa7f3d0);
    m.b(g.x(54), by1 - 4, g.z(51), g.x(55.5), by1 - 3, g.z(48), ink, { bare: true });
  },

  jukebox: (m, c) => {
    // The red arched jukebox: a gold arch, the window with its record, the speaker grille, a chrome base.
    const { x0, y0, x1, y1 } = c.f.foot;
    const h = KIND_HEIGHT.jukebox!;
    const g = grid(c, 72, 108, 4, h);
    const red = 0xae2244;
    const gold = 0xdeb241;
    const chrome = 0xe2e8f0;
    m.b(x0, y0, 0, x1, y1, g.z(100), chrome);
    const yf = y1 - 1;
    m.b(g.x(4), y0 + 1, g.z(100), g.x(68), yf, g.z(40), red);
    // The arch, in steps.
    const steps: [number, number, number][] = [
      [3, 40, 26],
      [8, 26, 16],
      [16, 16, 8],
      [24, 8, 4],
    ];
    for (const [inset, a, b] of steps)
      m.b(g.x(4 + inset), y0 + 1, g.z(a), g.x(68 - inset), yf, g.z(b), red, {
        top: light(red, 0.08),
      });
    const arch: [number, number, number][] = [
      [12, 60, 34],
      [16, 34, 22],
      [24, 22, 15],
    ];
    for (const [ax, a, b] of arch)
      plate(m, g, ax, b, 72 - 2 * ax, a - b, yf, 0.8, gold, { bare: true });
    // The arch's red bands, as the drawing's arcs.
    for (const [ax, ay] of [
      [20, 26],
      [28, 34],
    ] as const) {
      plate(m, g, ax, ay, 72 - 2 * ax, 2, yf + 0.8, 0.3, red, { bare: true });
      plate(m, g, ax, ay, 2, 60 - ay, yf + 0.8, 0.3, red, { bare: true });
      plate(m, g, 70 - ax, ay, 2, 60 - ay, yf + 0.8, 0.3, red, { bare: true });
    }
    plate(m, g, 14, 64, 44, 18, yf, 0.8, chrome);
    plate(m, g, 23, 69, 26, 9, yf + 0.8, 0.4, 0x1f2937, { bare: true });
    plate(m, g, 33, 72, 6, 2.5, yf + 1.2, 0.3, gold, { bare: true });
    plate(m, g, 14, 86, 44, 14, yf, 0.8, 0x801b3a);
    for (const ay of [89, 92.5, 96])
      plate(m, g, 18, ay, 36, 1, yf + 0.8, 0.3, dark(0x801b3a, 0.35), { bare: true });
  },

  'arcade-machine': (m, c) => {
    // The purple cabinet: a gold marquee, the screen in its bezel, the control deck with a stick and buttons
    // jutting out, the coin door below.
    const { y0, y1 } = c.f.foot;
    const h = KIND_HEIGHT['arcade-machine']!;
    const g = grid(c, 64, 108, 4, h);
    const body = 0x4338ca;
    const trim = 0x7173e3;
    const yf = y1 - 4;
    // The cabinet's base runs its whole depth; above the control deck its back steps in a little, as a real
    // cabinet's top is shallower than its foot.
    const top0 = y0 + (y1 - y0) * 0.18;
    m.b(g.x(6), y0, 0, g.x(58), yf, g.z(20), body);
    m.b(g.x(14), top0, g.z(20), g.x(50), yf, h, body, { top: light(body, 0.1) });
    m.b(g.x(8), top0 + 2, g.z(20), g.x(14), yf, g.z(10), body);
    m.b(g.x(50), top0 + 2, g.z(20), g.x(56), yf, g.z(10), body);
    plate(m, g, 10, 8, 44, 12, yf, 0.8, 0xdeb241);
    plate(m, g, 14, 12, 18, 2, yf + 0.8, 0.3, light(0xdeb241, 0.4), { bare: true });
    plate(m, g, 10, 24, 44, 34, yf, 0.8, trim);
    plate(m, g, 14, 28, 36, 26, yf + 0.8, 0.4, 0x0f172a, { front: 0x1e2a4a });
    m.b(g.x(19), yf + 1.2, g.z(48), g.x(21), yf + 1.4, g.z(34), 0x475569, { bare: true });
    // The control deck, standing out in front.
    m.b(g.x(2), yf - 2, g.z(74), g.x(62), y1, g.z(62), trim, { top: light(trim, 0.1) });
    const dz = g.z(62);
    m.b(g.x(19), y1 - 3, dz, g.x(21), y1 - 1, dz + 3, c.t.stroke, { bare: true });
    m.b(g.x(17.5), y1 - 3.5, dz + 3, g.x(22.5), y1 - 0.5, dz + 5.5, 0xd23030);
    m.b(g.x(35), y1 - 3, dz, g.x(41), y1 - 1, dz + 1.2, 0xdcba33);
    m.b(g.x(44), y1 - 3, dz, g.x(50), y1 - 1, dz + 1.2, 0x37c3d9);
    plate(m, g, 8, 74, 48, 34, yf, 0.8, trim);
    plate(m, g, 25, 82, 14, 12, yf + 0.8, 0.6, body);
    plate(m, g, 31, 85, 2, 4, yf + 1.4, 0.3, 0xdeb241, { bare: true });
  },

  'suggestion-box': (m, c) => {
    // A wooden box on a tall turned post, its slot at chest height (3d-engine.md "Stands at a real height"): a slot
    // in its lid with a note going in, the lightbulb poster on its front, a round foot.
    const { y0, y1 } = c.f.foot;
    const g = grid(c, 64, 108, 6, KIND_HEIGHT['suggestion-box']!);
    const yc = (y0 + y1) / 2;
    const wood = 0xc2894b;
    const deep = 0x86431a;
    const half = 10;
    const bz = 31;
    const lz = 43;
    m.cylinder(0, yc, 0, 2.6, 11, 10, deep, { segments: 32, top: light(deep, 0.1) });
    m.cylinder(0, yc, 2.6, 4, 5, 3.4, deep, { segments: 24 });
    m.cylinder(0, yc, 4, bz - 1.5, 2.8, 2.3, wood, { segments: 20, caps: false });
    m.cylinder(0, yc, bz - 1.5, bz, 4.5, 5.5, deep, { segments: 24 });
    m.b(g.x(6), yc - half, bz, g.x(58), yc + half, lz, wood);
    m.b(g.x(2), yc - half - 2, lz, g.x(62), yc + half + 2, lz + 3, deep, { top: light(deep, 0.1) });
    m.b(g.x(18), yc - 1.5, lz + 3, g.x(46), yc + 1.5, lz + 3.2, 0x292524, { bare: true });
    m.b(g.x(27), yc - 0.5, lz + 3, g.x(39), yc + 0.5, lz + 7, WHITE);
    const front = yc + half;
    m.b(g.x(14), front, bz + 1.5, g.x(50), front + 0.6, lz - 1.5, 0xfef3c7, { bare: true });
    m.b(g.x(27), front + 0.6, bz + 5.5, g.x(37), front + 1.1, bz + 9, 0xdcba33, { bare: true });
    m.b(g.x(29), front + 0.6, bz + 3.6, g.x(35), front + 1.1, bz + 5.5, 0x8e5f1a, { bare: true });
  },

  directory: (m, c) => {
    // A sign on a post and foot: a blue header with the info mark and the floors listed in their colours, on both
    // faces, so it reads from either side.
    const g = grid(c, 72, 118, 6, KIND_HEIGHT.directory!);
    const yc = c.f.D / 2 - 14;
    const t = 3;
    m.b(g.x(16), yc - 7, 0, g.x(56), yc + 7, g.z(108), c.t.face);
    m.c(0, yc, 10 * g.s, 5, g.z(108), g.z(86), c.t.face);
    m.b(g.x(4), yc - t, g.z(90), g.x(68), yc + t, g.z(6), c.t.seat, { top: 0x386ad8 });
    const dots: Rgb[] = [0xd89728, 0x21a87b, 0x926ee4, 0xde5555];
    for (const side of [1, -1]) {
      const y = yc + side * t;
      const d = side * 0.6;
      plate(m, g, 4, 6, 64, 20, y, d, 0x386ad8);
      plate(m, g, 10, 12, 8, 8, y + d, side * 0.4, WHITE, { bare: true });
      plate(m, g, 24, 12, 28, 2, y + d, side * 0.3, light(0x386ad8, 0.6), { bare: true });
      plate(m, g, 24, 17, 18, 2, y + d, side * 0.3, light(0x386ad8, 0.4), { bare: true });
      dots.forEach((col, i) => {
        const ay = 36 + i * 12;
        plate(m, g, 11, ay - 3, 6, 6, y, side * 0.8, col, { bare: true });
        plate(m, g, 22, ay - 1, 30, 2, y, side * 0.4, dark(c.t.seat, 0.35), { bare: true });
      });
      plate(m, g, 10, 80, 52, 1.5, y, side * 0.4, dark(c.t.seat, 0.25), { bare: true });
    }
  },

  elevator: (m, c) => {
    // The lift's front at the front of its box: a full-height block of wall, a steel frame round two sliding doors,
    // the floor indicator over it, the call buttons at its side and the sill. It never blocks a walk (it has no
    // footprint), so it stays a slab rather than filling its box.
    const g = grid(c, 112, 134, 2, KIND_HEIGHT.elevator!);
    const { y1 } = c.f.foot;
    const h = KIND_HEIGHT.elevator!;
    const yf = y1 - 1;
    m.b(g.x(6), yf - 28, 0, g.x(106), yf, h, c.t.face, { top: light(c.t.face, 0.05) });
    plate(m, g, 34, 2, 44, 16, yf, 1, 0x1e293b);
    plate(m, g, 41, 7, 8, 6, yf + 1, 0.4, 0xdeb241, { bare: true });
    plate(m, g, 54, 7, 16, 6, yf + 1, 0.4, 0xdeb241, { bare: true });
    plate(m, g, 14, 22, 72, 112, yf, 0.6, 0x64748b);
    plate(m, g, 17, 25, 32, 109, yf + 0.6, 0.6, 0xcbd5e1);
    plate(m, g, 51, 25, 32, 109, yf + 0.6, 0.6, 0xcbd5e1);
    plate(m, g, 90, 62, 10, 26, yf, 0.8, 0xcbd5e1);
    plate(m, g, 92.5, 66.5, 5, 5, yf + 0.8, 0.6, 0xdeb241, { bare: true });
    plate(m, g, 92.5, 77.5, 5, 5, yf + 0.8, 0.6, WHITE, { bare: true });
    m.b(g.x(12), yf, 0, g.x(88), y1 + 1, 0.8, 0x94a3b8);
  },
};
