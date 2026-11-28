// Real 3D's turned and slung seats (docs/specs/008-canvas/3d-engine.md "Models", "No blocky soft goods"): the Bar
// Stool, turned round its pole, and the Hammock, its sling one smooth sagging surface on a wooden stand. The owner
// (2026-11-27): "hammock looks blocky", "bar stools look pixelated". Pure: no three.js, no DOM.
import { shade, type Rgb, type Vec3 } from '../mesh-builder';
import { mix, SEAT_Z, type Builder, type ModelTable } from './kit';

/** How far behind its seat point a seated figure's hips sit (seating.ts HIP): the seat is built under the hips. */
const HIP = -2;

const STEEL = 0x8c96a3;
const STEEL_DARK = 0x4b525c;
const LEATHER = 0x5a3a24;
const LEATHER_TOP = 0x8a5a3a;

/** A ring (a torus) lying flat about (cx, cy) at height z: `R` from the middle, its tube `r` thick. */
function ring(m: Builder, cx: number, cy: number, z: number, R: number, r: number, c: Rgb): void {
  const n = 10;
  const profile = Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return { r: R + Math.cos(t) * r, z: z + Math.sin(t) * r };
  });
  m.lathe(cx, cy, profile, c, { segments: 32 });
}

// --- The Hammock's sling --------------------------------------------------------------------------------------

/** Half the sling's length, between its spreader bars, and half its width. */
const SLING_HALF = 46;
const SLING_WIDE = 13;
/** How far the sling rises from its middle to its ends, and how far its sides rise above its midline. */
const SAG = 14;
const CRADLE = 4.5;

/**
 * The sling's top surface height at (x, y) in the model's frame: lowest (`SEAT_Z`) at its middle, rising to its
 * spreader bars along its length and up its sides across it, so a lying sitter sinks into it.
 */
export function hammockSurfaceZ(x: number, y: number): number {
  const u = x / SLING_HALF;
  const v = y / SLING_WIDE;
  return SEAT_Z + SAG * u * u + CRADLE * v * v;
}

function sling(m: Builder, colours: readonly Rgb[]): void {
  const nx = 28;
  const ny = 10;
  const T = 0.7;
  const P = (i: number, j: number, dz = 0): Vec3 => {
    const x = -SLING_HALF + (2 * SLING_HALF * i) / nx;
    const y = -SLING_WIDE + (2 * SLING_WIDE * j) / ny;
    return [x, y, hammockSurfaceZ(x, y) + dz];
  };
  const N = (i: number, j: number, sgn: 1 | -1): Vec3 => {
    const x = -SLING_HALF + (2 * SLING_HALF * i) / nx;
    const y = -SLING_WIDE + (2 * SLING_WIDE * j) / ny;
    const dx = (2 * SAG * x) / (SLING_HALF * SLING_HALF);
    const dy = (2 * CRADLE * y) / (SLING_WIDE * SLING_WIDE);
    const l = Math.hypot(dx, dy, 1);
    return [(-dx / l) * sgn, (-dy / l) * sgn, (1 / l) * sgn];
  };
  for (let j = 0; j < ny; j++) {
    // Stripes run its length, a band across it each.
    const top = shade(colours[j % colours.length]!, 1);
    const under = shade(mix(colours[j % colours.length]!, 0x000000, 0.18), 1);
    for (let i = 0; i < nx; i++) {
      const a = P(i, j);
      const b = P(i + 1, j);
      const c = P(i + 1, j + 1);
      const d = P(i, j + 1);
      m.tri(a, b, c, N(i, j, 1), N(i + 1, j, 1), N(i + 1, j + 1, 1), top);
      m.tri(a, c, d, N(i, j, 1), N(i + 1, j + 1, 1), N(i, j + 1, 1), top);
      const a2 = P(i, j, -T);
      const b2 = P(i + 1, j, -T);
      const c2 = P(i + 1, j + 1, -T);
      const d2 = P(i, j + 1, -T);
      m.tri(a2, c2, b2, N(i, j, -1), N(i + 1, j + 1, -1), N(i + 1, j, -1), under);
      m.tri(a2, d2, c2, N(i, j, -1), N(i, j + 1, -1), N(i + 1, j + 1, -1), under);
    }
  }
  // A hem down each long side, so the cloth has an edge you can see.
  const hem = mix(colours[0]!, 0x000000, 0.25);
  for (const j of [0, ny])
    for (let i = 0; i < nx; i += 2)
      m.tube(P(i, j, -T / 2), P(i + 2, j, -T / 2), 0.75, hem, { segments: 6 });
}

export const TURNED_SEAT_MODELS: ModelTable = {
  'bar-stool': (m, { seats }) => {
    // A round weighted foot, a slim steel pole, a footrest ring, a collar and a rounded leather seat, all turned.
    const s = seats[0] ?? { x: 0, y: -6, facing: 'down' };
    const x = s.x;
    const y = s.y + HIP;
    m.lathe(
      x,
      y,
      [
        { r: 0, z: 0 },
        { r: 10.5, z: 0 },
        { r: 11, z: 0.6 },
        { r: 10.4, z: 1.6 },
        { r: 6, z: 2.4 },
        { r: 2.4, z: 3 },
        { r: 1.6, z: 3.6 },
      ],
      STEEL_DARK,
      { segments: 40, colours: [STEEL_DARK, STEEL, STEEL, STEEL, STEEL, STEEL] },
    );
    m.cylinder(x, y, 3, SEAT_Z - 4, 1.6, 1.6, STEEL, { segments: 24, caps: false });
    ring(m, x, y, 7, 8, 0.85, STEEL);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      m.tube(
        [x + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4, 7],
        [x + Math.cos(a) * 7.4, y + Math.sin(a) * 7.4, 7],
        0.5,
        STEEL,
        {
          segments: 8,
        },
      );
    }
    m.cylinder(x, y, SEAT_Z - 4.6, SEAT_Z - 3.2, 3.6, 3.2, STEEL_DARK, { segments: 24 });
    // The seat: a soft cushion, its top domed a little, its rim rolled.
    m.lathe(
      x,
      y,
      [
        { r: 0, z: SEAT_Z - 3.4 },
        { r: 10, z: SEAT_Z - 3.4 },
        { r: 12.2, z: SEAT_Z - 2.8 },
        { r: 13.2, z: SEAT_Z - 1.7 },
        { r: 13, z: SEAT_Z - 0.8 },
        { r: 12, z: SEAT_Z - 0.15 },
        { r: 8, z: SEAT_Z + 0.25 },
        { r: 0, z: SEAT_Z + 0.4 },
      ],
      LEATHER,
      {
        segments: 40,
        colours: [LEATHER, LEATHER, LEATHER, LEATHER, LEATHER_TOP, LEATHER_TOP, LEATHER_TOP],
      },
    );
    // A welt round the seat's rim.
    ring(m, x, y, SEAT_Z - 1.3, 13.1, 0.45, mix(LEATHER, 0x000000, 0.3));
  },

  hammock: (m) => {
    // A wooden stand (a floor beam, feet, a post at each end with a ball on top), ropes from each post to a spreader
    // bar, and the striped sling between the bars, sagging smoothly to seat height in its middle.
    const post = 0x86431a;
    const postTop = 0xa65a28;
    const rope = 0xd8cba8;
    const stripes = [0x50b4e0, 0x50b4e0, 0xf3efe6, 0xe29555, 0xf3efe6, 0x50b4e0, 0x50b4e0];
    const PX = 66;
    const TOP = 44;
    m.tube([-PX, 0, 2.4], [PX, 0, 2.4], 2.4, mix(post, 0x000000, 0.12), { segments: 14 });
    for (const x of [-PX, PX]) {
      m.tube([x, -15, 1.8], [x, 15, 1.8], 2.2, mix(post, 0x000000, 0.12), { segments: 14 });
      m.cylinder(x, 0, 0, TOP, 3.6, 3, post, { segments: 24, top: postTop });
      m.sphere(x, 0, TOP + 3, 3.8, 3.8, 3.8, postTop, { segments: 18, rings: 9 });
      // A brace from the beam up to the post.
      const s = Math.sign(x);
      m.tube([x - s * 16, 0, 3], [x - s * 1.5, 0, 20], 1.4, post, { segments: 10 });
    }
    // The spreader bars and the ropes fanning from each to its post.
    const endZ = hammockSurfaceZ(SLING_HALF, 0);
    for (const sx of [-1, 1]) {
      const bx = sx * SLING_HALF;
      m.tube([bx, -SLING_WIDE - 2, endZ + 1], [bx, SLING_WIDE + 2, endZ + 1], 1.2, 0xc2894b, {
        segments: 12,
      });
      const knot: Vec3 = [sx * (PX - 9), 0, TOP - 5];
      for (const y of [-SLING_WIDE, -SLING_WIDE / 2, 0, SLING_WIDE / 2, SLING_WIDE])
        m.tube([bx, y, endZ + 1.6], knot, 0.32, rope, { segments: 6 });
      m.tube(knot, [sx * (PX - 3.2), 0, TOP - 2], 0.6, rope, { segments: 8 });
      m.sphere(knot[0], knot[1], knot[2], 1.3, 1.3, 1.3, rope, { segments: 10, rings: 6 });
    }
    sling(m, stripes);
  },
};
