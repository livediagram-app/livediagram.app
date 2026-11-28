// Real 3D's Stairs (docs/specs/009-elements/stairs.md, 3d-engine.md "Stairs stand up"): a stone flight rising away
// from its front to a landing at its back, between two side walls with a wooden handrail on each, and a small sign
// over the landing with an up and a down arrow. It never blocks: walking onto its foot is how you take it.
import { mix, type ModelTable } from './kit';

/** The flight's top (the landing), in canvas px as built: about two thirds of a wall, so it reads as a climb. */
export const STAIRS_RISE = 70;
const STEPS = 8;
const STONE = 0xd6cfc2;
const STONE_DARK = 0xa59c8c;
const WALL = 0xe9e4da;
const RAIL = 0x8a5a2b;
const SIGN = 0x1f6f5c;

export const STAIRS_MODELS: ModelTable = {
  stairs: (m, { f }) => {
    const { x0, y0, x1, y1 } = f.foot;
    const side = Math.max(4, (x1 - x0) * 0.07);
    const ix0 = x0 + side;
    const ix1 = x1 - side;
    // The landing takes the back fifth; the steps the rest, each a rise higher towards the back.
    const landing = (y1 - y0) * 0.2;
    const run = (y1 - y0 - landing) / STEPS;
    const rise = STAIRS_RISE / STEPS;
    for (let i = 0; i < STEPS; i++) {
      const front = y1 - i * run;
      const top = rise * (i + 1);
      // Each step a solid block from the floor (the flight's side shows its saw-tooth), a nosing a shade lighter.
      m.b(ix0, front - run, 0, ix1, front, top, mix(STONE_DARK, STONE, 0.4), {
        top: i % 2 ? STONE : mix(STONE, 0xffffff, 0.08),
      });
    }
    m.b(ix0, y0, 0, ix1, y0 + landing, STAIRS_RISE, STONE_DARK, { top: STONE });
    // The side walls follow the flight up, a little above its line, capped by the handrail.
    for (const [a, b] of [
      [x0, ix0],
      [ix1, x1],
    ] as const) {
      for (let i = 0; i < STEPS; i++) {
        const front = y1 - i * run;
        const top = rise * (i + 1) + 10;
        m.b(a, front - run, 0, b, front, top, WALL, { top: mix(WALL, 0xffffff, 0.15) });
      }
      m.b(a, y0, 0, b, y0 + landing, STAIRS_RISE + 10, WALL, { top: mix(WALL, 0xffffff, 0.15) });
      // The handrail: a slab along the wall's top, stepping with it.
      const mid = (a + b) / 2;
      for (let i = 0; i < STEPS; i++) {
        const front = y1 - i * run;
        const z = rise * (i + 1) + 10;
        m.b(mid - 1.6, front - run - 0.4, z, mid + 1.6, front + 0.4, z + 2.4, RAIL);
      }
      // The newel post at the foot.
      m.b(mid - 2.4, y1 - 4, 0, mid + 2.4, y1, rise + 16, mix(RAIL, 0x000000, 0.15));
    }
    // The sign over the landing: a green plate with an up and a down arrow on it, facing down the flight.
    const sz = STAIRS_RISE + 26;
    const sy = y0 + landing * 0.5;
    m.b(-12, sy - 0.8, sz, 12, sy + 0.8, sz + 12, SIGN);
    m.b(-1, sy, STAIRS_RISE + 10, 1, sy + 0.6, sz, 0x475569, { bare: true });
    const ay = sy + 0.9;
    // Up arrow on the left, down arrow on the right, white.
    m.b(-7.5, ay, sz + 3, -5.5, ay + 0.4, sz + 9, 0xffffff, { bare: true });
    m.b(-9.5, ay, sz + 7, -3.5, ay + 0.4, sz + 9, 0xffffff, { bare: true });
    m.b(5.5, ay, sz + 3, 7.5, ay + 0.4, sz + 9, 0xffffff, { bare: true });
    m.b(3.5, ay, sz + 3, 9.5, ay + 0.4, sz + 5, 0xffffff, { bare: true });
  },
};
