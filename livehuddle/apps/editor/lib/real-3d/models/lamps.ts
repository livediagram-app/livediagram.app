// Real 3D's lamps (docs/specs/009-elements/office-amenities.md "Lamps", 3d-engine.md "Lamps glow without lights"):
// the Floor Lamp, the Table Lamp and the Desk Lamp, turned and bent rather than stacked, in their drawing's colours
// (packages/document office-lamps.ts). A shade is a lathed shell open at both ends, its inside a brighter warm cream
// than its outside and a bulb in it; its pool of light is a faint warm see-through disc (the glass material) on the
// floor or the desk. No lamp adds a light to the scene. Pure: no three.js, no DOM.
import { shade as tone, type Rgb, type Vec3 } from '../mesh-builder';
import { KIND_HEIGHT, type Builder, type ModelTable } from './kit';

const SHADE = 0xffe6ae;
const SHADE_IN = 0xfffaea;
const TRIM = 0xe8c27c;
const BULB = 0xfffbea;
const POOL = 0xffe2a0;
const BRASS = 0xc9a35c;
const BRASS_DEEP = 0x8c6a2e;

/** Where the Table Lamp and the Desk Lamp stand: on a Desk's top, as the microwave stands on a counter's. */
export const LAMP_DESK_Z = KIND_HEIGHT.desk!;

/** The middle of each lamp's light (its shade, or its head's rim), as built, before the scene's rise. */
export const LAMP_SHADE_Z: Readonly<Record<string, number>> = {
  'floor-lamp': 66,
  'table-lamp': LAMP_DESK_Z + 16,
  'desk-lamp': LAMP_DESK_Z + 15,
};

/** A pool of light: three faint warm discs, each smaller one brighter where they overlap, lying at `z`. */
function pool(m: Builder, x: number, y: number, z: number, r: number): void {
  [1, 0.7, 0.42].forEach((k, i) =>
    m.cylinder(x, y, z + i * 0.1, z + i * 0.1 + 0.06, r * k, r * k, POOL, {
      glass: true,
      segments: 36,
      caps: true,
    }),
  );
}

/** How much brighter than lit a glowing part is: lit from within, it stays bright on the side away from the sun. */
const GLOW = 1.6;

/**
 * A shell turned about (x, y) through `prof`, smooth round, its colour over-bright (past 1, which the scene's light
 * scales down on its shaded side and clips on its lit side), so it reads lit from within from every side without a
 * light or a material of its own.
 */
function glowingShell(
  m: Builder,
  x: number,
  y: number,
  prof: readonly { r: number; z: number }[],
  colour: Rgb,
  n = 28,
): void {
  const rgb = tone(colour, 1).map((c) => c * GLOW) as [number, number, number];
  const v = (p: { r: number; z: number }, i: number): Vec3 => {
    const a = (i / n) * Math.PI * 2;
    return [x + Math.cos(a) * p.r, y + Math.sin(a) * p.r, p.z];
  };
  for (let k = 0; k + 1 < prof.length; k++) {
    const p0 = prof[k]!;
    const p1 = prof[k + 1]!;
    // Its normal across the slope, out and (as a shade narrows upward) a little up.
    const dr = p1.r - p0.r;
    const dz = p1.z - p0.z;
    const l = Math.hypot(dr, dz) || 1;
    const nv = (i: number): Vec3 => {
      const a = (i / n) * Math.PI * 2;
      return [(Math.cos(a) * dz) / l, (Math.sin(a) * dz) / l, -dr / l];
    };
    for (let i = 0; i < n; i++) {
      m.tri(v(p0, i), v(p0, i + 1), v(p1, i + 1), nv(i), nv(i + 1), nv(i + 1), rgb);
      m.tri(v(p0, i), v(p1, i + 1), v(p1, i), nv(i), nv(i + 1), nv(i), rgb);
    }
  }
}

/**
 * A lit shade about (x, y) from radius `r0` at `z0` up to `r1` at `z1`: the shell outside, its inside a brighter
 * cream, both lit as from within; trim at both rims, open at both ends, and the bulb in it.
 */
function shade(
  m: Builder,
  x: number,
  y: number,
  z0: number,
  z1: number,
  r0: number,
  r1: number,
  bulb: number,
): void {
  const at = (u: number) => ({ r: r0 + (r1 - r0) * u, z: z0 + (z1 - z0) * u });
  glowingShell(m, x, y, [at(0), at(1)], SHADE);
  const lip = Math.max(0.8, (z1 - z0) * 0.06);
  m.cylinder(x, y, z0, z0 + lip, r0 + 0.25, r0 + 0.25 - (r0 - r1) * 0.06, TRIM, {
    caps: false,
    segments: 28,
  });
  m.cylinder(x, y, z1 - lip, z1, r1 + 0.25 + (r0 - r1) * 0.06, r1 + 0.25, TRIM, {
    caps: false,
    segments: 24,
  });
  m.sphere(x, y, z0 + (z1 - z0) * 0.35, bulb, bulb, bulb, BULB, { segments: 12, rings: 8 });
}

/** A lit disc at `c` facing along `n` (unit), radius `r`, over-bright as a glowing shell is. */
function glowingDisc(m: Builder, c: Vec3, n: Vec3, r: number, colour: Rgb, segs = 20): void {
  const rgb = tone(colour, 1).map((v) => v * GLOW) as [number, number, number];
  const h: Vec3 = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = unit([h[1] * n[2] - h[2] * n[1], h[2] * n[0] - h[0] * n[2], h[0] * n[1] - h[1] * n[0]]);
  const w: Vec3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const p = (i: number): Vec3 => {
    const a = (i / segs) * Math.PI * 2;
    const cs = Math.cos(a) * r;
    const sn = Math.sin(a) * r;
    return [
      c[0] + u[0] * cs + w[0] * sn,
      c[1] + u[1] * cs + w[1] * sn,
      c[2] + u[2] * cs + w[2] * sn,
    ];
  };
  for (let i = 0; i < segs; i++) m.tri(c, p(i), p(i + 1), n, n, n, rgb);
}

function unit(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** A turned body from a profile of (radius, height) pairs, about (x, y). */
function turned(m: Builder, x: number, y: number, prof: [number, number][], colour: Rgb): void {
  m.lathe(
    x,
    y,
    prof.map(([r, z]) => ({ r, z })),
    colour,
    { segments: 24 },
  );
}

export const LAMP_MODELS: ModelTable = {
  'floor-lamp': (m, { f }) => {
    // A domed brass base, a slim pole with its switch collar, a socket, a drum shade tapering to its top round a
    // bulb, the harp's spokes and a finial over it, and the warm pool on the floor round its foot.
    const { y0, y1 } = f.foot;
    const yc = (y0 + y1) / 2;
    pool(m, 0, yc, 0.4, 26);
    turned(
      m,
      0,
      yc,
      [
        [0, 0],
        [9.5, 0],
        [9.5, 0.9],
        [8.6, 1.9],
        [6, 3.1],
        [2.6, 3.9],
        [1.5, 4.3],
        [0, 4.4],
      ],
      BRASS,
    );
    m.cylinder(0, yc, 4, 57, 0.95, 0.95, BRASS, { segments: 12 });
    m.cylinder(0, yc, 33, 35.5, 1.7, 1.7, BRASS_DEEP, { segments: 14 });
    m.cylinder(0, yc, 56, 60, 2.1, 2.1, BRASS_DEEP, { segments: 14 });
    shade(m, 0, yc, 56, 76, 15, 10, 3);
    // The harp: three spokes from the shade's top rim in to the finial's stem.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const rim: Vec3 = [Math.cos(a) * 9.6, yc + Math.sin(a) * 9.6, 75.4];
      m.tube(rim, [0, yc, 75.8], 0.35, BRASS_DEEP, { segments: 5 });
    }
    m.tube([0, yc, 60], [0, yc, 77], 0.45, BRASS_DEEP, { segments: 6 });
    m.sphere(0, yc, 78, 1.6, 1.6, 1.4, BRASS_DEEP, { segments: 10, rings: 6 });
  },

  'table-lamp': (m, { t }) => {
    // On a desk's top: a round ceramic base in the theme's wash on a brass neck, an empire shade round its bulb, a
    // finial, and a little pool of light on the desk.
    const z = LAMP_DESK_Z;
    pool(m, 0, 0, z + 0.15, 10.5);
    turned(
      m,
      0,
      0,
      [
        [0, z],
        [3.6, z],
        [4.6, z + 0.7],
        [6.4, z + 3],
        [7, z + 5.4],
        [6.1, z + 7.9],
        [3.6, z + 9.5],
        [1.8, z + 10.2],
        [0, z + 10.3],
      ],
      t.seat,
    );
    m.cylinder(0, 0, z + 10, z + 12.6, 1.2, 1.2, BRASS, { segments: 12 });
    shade(m, 0, 0, z + 11.5, z + 21, 11, 6, 2.2);
    m.tube([0, 0, z + 12], [0, 0, z + 21.6], 0.35, BRASS_DEEP, { segments: 5 });
    m.sphere(0, 0, z + 22.4, 1.2, 1.2, 1.1, BRASS_DEEP, { segments: 10, rings: 6 });
  },

  'desk-lamp': (m, { t }) => {
    // On a desk's top: a weighted round base, a lower arm leaning back to the elbow, an upper arm out over the desk,
    // and a cone head tipped down toward the front, its rim lit, throwing a pool of light on the desk in front.
    const z = LAMP_DESK_Z;
    const body = t.seat;
    const joint = 0x475569;
    const bx = -7;
    m.cylinder(bx, 0, z, z + 1.8, 6.2, 5.6, body, { segments: 24 });
    m.cylinder(bx, 0, z + 1.8, z + 3.2, 1.6, 1.4, joint, { segments: 12 });
    const elbow: Vec3 = [-10, -1.5, z + 14];
    const wrist: Vec3 = [5, 0, z + 18.5];
    m.tube([bx, 0, z + 3], elbow, 1, body, { segments: 10 });
    m.tube([bx + 1, 0.3, z + 4], [elbow[0] + 1, elbow[1] + 0.3, elbow[2] - 1], 0.3, joint, {
      segments: 5,
    });
    m.sphere(elbow[0], elbow[1], elbow[2], 1.7, 1.7, 1.7, joint, { segments: 10, rings: 6 });
    m.tube(elbow, wrist, 0.95, body, { segments: 10 });
    m.sphere(wrist[0], wrist[1], wrist[2], 1.6, 1.6, 1.6, joint, { segments: 10, rings: 6 });
    // The head: a cone from the wrist, opening down toward the front and right, a rolled rim round its mouth and
    // the lit glass in it, over-bright so it glows from every side.
    const d: Vec3 = [0.3, 0.3, -0.905];
    const at = (k: number): Vec3 => [wrist[0] + d[0] * k, wrist[1] + d[1] * k, wrist[2] + d[2] * k];
    m.tube(at(0.4), at(8.5), 1.8, body, { segments: 20, r1: 5.4 });
    m.tube(at(8.3), at(8.9), 5.7, joint, { segments: 20 });
    glowingDisc(m, at(9), d, 5, SHADE_IN);
    // The pool falls on the desk where the head points.
    const k = (z + 0.15 - wrist[2]) / d[2];
    const p = at(k);
    pool(m, p[0], p[1], z + 0.15, 7.5);
  },
};
