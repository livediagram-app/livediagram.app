// Real 3D's Pond (docs/specs/008-canvas/3d-engine.md "Models"; docs/specs/009-elements/social-pieces.md "Pond"): sunk
// into the ground (the owner, 2026-11-27: "the pond needs to feel like it has more depth, design wise it feels older
// now"). An oval of its box: a smooth pale stone coping just proud of the lawn, a few pebbles on it, wet stone and a
// muddy bank shelving down below the floor to the water, which is dark in its deep middle and light in its shallows,
// with a sheen of sky in soft see-through streaks, lily pads and a clump of reeds. The floor is the DOM's, under the
// scene, so what lies below it still draws; every bank below the floor shelves more gently than the camera looks down
// (SPACE_3D_TILT_DEG), so no side shows what the ground in front of it would hide. Pure: no three.js, no DOM.
import { APPLIANCE_WHITE, POND_FILL, POND_FILL_DARK } from '@livehuddle/document';
import { parseColour, shade, type Rgb, type Vec3 } from '../mesh-builder';
import { mix, RISE, type Builder, type ModelTable } from './kit';

/** The water's height below the floor at full size, as built (risen by RISE in the scene). */
export const POND_WATER_Z = -3.6;

/** The pond's own scale: its parts shrink with a pond smaller than 120 px across its narrow side. */
function pondScale(w: number, d: number): number {
  return Math.max(0.4, Math.min(1, Math.min(w, d) / 120));
}

/** How high the water lies in the scene (canvas px, below the floor) for a pond of this box: where a pebble lands. */
export function pondWaterHeight(w: number, d: number): number {
  return POND_WATER_Z * pondScale(w, d) * RISE;
}

const STONE_FOOT = 0x8d877f;
const STONE = 0xcdc7bd;
const STONE_TOP = 0xe6e1d8;
const STONE_WET = 0x8a8379;
const STONE_DARK = 0x57534c;
const MUD = 0x4a4636;
const MUD_DEEP = 0x34352b;
const ABYSS = 0x040e18;
const SHALLOW = 0x5f8f86;
const LILY = 0x3fae68;
const LILY_TOP = 0x50c478;
const LILY_EDGE = 0x2b7f4a;
const PINK = 0xe77fb5;
const PINK_PALE = 0xf6c6dc;
const GOLD = 0xf2c94c;
const REED = 0x5f8f3a;
const REED_LIGHT = 0x86a84c;
const CATTAIL = 0x6b4423;
const PEBBLES = [0xb9b2a7, 0x9c958b, 0xd8d2c8, 0x847d74] as const;

/**
 * The coping and bank, outside in: how far in from the oval's edge (px) and how high (built), each with its colour.
 * Below the floor every step runs at least 2.2 times as far in as it falls, more than the camera's 1.28 (tan 52°)
 * once risen by 1.4, so the bank is always seen from above.
 */
const BANK: readonly { i: number; z: number; c: Rgb }[] = [
  { i: 0, z: 0, c: STONE_FOOT },
  { i: 0.9, z: 1.3, c: STONE },
  { i: 2.6, z: 2.05, c: STONE_TOP },
  { i: 4.8, z: 1.95, c: STONE_TOP },
  { i: 6.2, z: 1.0, c: STONE_WET },
  { i: 6.9, z: 0, c: STONE_DARK },
  { i: 11.4, z: -2.0, c: MUD },
  { i: 16.4, z: -4.0, c: MUD_DEEP },
];
/** Where the water's edge lies, in from the oval's edge (just inside where the bank meets it). */
const WATER_IN = 15.2;

type Pt = { p: Vec3; n: Vec3; c: readonly [number, number, number] };

/** A triangle whose corners each keep their own colour (a gradient), wound to face its normals. */
function tri3(m: Builder, a: Pt, b: Pt, c: Pt): void {
  const ux = b.p[0] - a.p[0];
  const uy = b.p[1] - a.p[1];
  const uz = b.p[2] - a.p[2];
  const vx = c.p[0] - a.p[0];
  const vy = c.p[1] - a.p[1];
  const vz = c.p[2] - a.p[2];
  const fx = uy * vz - uz * vy;
  const fy = uz * vx - ux * vz;
  const fz = ux * vy - uy * vx;
  const flip =
    fx * (a.n[0] + b.n[0] + c.n[0]) +
      fy * (a.n[1] + b.n[1] + c.n[1]) +
      fz * (a.n[2] + b.n[2] + c.n[2]) <
    0;
  for (const v of flip ? [a, c, b] : [a, b, c]) {
    m.positions.push(v.p[0], v.p[1], v.p[2]);
    m.normals.push(v.n[0], v.n[1], v.n[2]);
    m.colours.push(v.c[0], v.c[1], v.c[2]);
  }
}

/** A thin flat strip on the water (see-through, as glass): a curve of the oval from angle t0 to t1, `w` wide. */
function sheen(
  m: Builder,
  A: number,
  B: number,
  k: number,
  t0: number,
  t1: number,
  w: number,
  z: number,
): void {
  const n = 10;
  const up: Vec3 = [0, 0, 1];
  const white = shade(0xffffff, 1);
  for (let s = 0; s < n; s++) {
    const a0 = t0 + ((t1 - t0) * s) / n;
    const a1 = t0 + ((t1 - t0) * (s + 1)) / n;
    // Tapered at both ends.
    const h0 = Math.sin((s / n) * Math.PI) * w;
    const h1 = Math.sin(((s + 1) / n) * Math.PI) * w;
    const at = (a: number, kk: number): Vec3 => [Math.cos(a) * A * kk, Math.sin(a) * B * kk, z];
    const p0 = at(a0, k - h0 / B / 2);
    const p1 = at(a1, k - h1 / B / 2);
    const q1 = at(a1, k + h1 / B / 2);
    const q0 = at(a0, k + h0 / B / 2);
    m.tri(p0, p1, q1, up, up, up, white, true);
    m.tri(p0, q1, q0, up, up, up, white, true);
  }
}

/** A lily pad floating at (x, y): a disc `r` across with its notch toward `notch`, a thin edge under it. */
function lilyPad(m: Builder, x: number, y: number, r: number, notch: number, z: number): void {
  const n = 16;
  const up: Vec3 = [0, 0, 1];
  const top = shade(LILY_TOP, 1);
  const mid = shade(LILY, 1);
  const gap = 0.45;
  for (let s = 0; s < n; s++) {
    const a0 = notch + gap / 2 + ((Math.PI * 2 - gap) * s) / n;
    const a1 = notch + gap / 2 + ((Math.PI * 2 - gap) * (s + 1)) / n;
    const e0: Vec3 = [x + Math.cos(a0) * r, y + Math.sin(a0) * r * 0.92, z];
    const e1: Vec3 = [x + Math.cos(a1) * r, y + Math.sin(a1) * r * 0.92, z];
    tri3(
      m,
      { p: [x, y, z + 0.05], n: up, c: top },
      { p: e0, n: up, c: mid },
      { p: e1, n: up, c: mid },
    );
  }
  m.cylinder(x, y, z - 0.35, z, r * 0.98, r * 0.98, LILY_EDGE, {
    segments: n,
    caps: false,
    sy: 0.92,
  });
}

export const POND_MODELS: ModelTable = {
  pond: (m, { f, t }) => {
    const A0 = f.W / 2;
    const B0 = f.D / 2;
    if (A0 < 4 || B0 < 4) return;
    const k = pondScale(f.W, f.D);
    // The water in the pond's own fill, or, with none, a natural pond blue between its drawing's light and dark waters
    // (the light one alone reads as a pale swimming pool once lit).
    const water =
      t.seat === parseColour(APPLIANCE_WHITE)
        ? mix(parseColour(POND_FILL), parseColour(POND_FILL_DARK), 0.7)
        : t.seat;
    const deep = mix(water, ABYSS, 0.36);
    const deepest = mix(water, ABYSS, 0.5);
    const shallow = mix(water, SHALLOW, 0.4);
    // Smooth all round: a segment about every 8 px of the oval's edge.
    const perimeter = Math.PI * (3 * (A0 + B0) - Math.sqrt((3 * A0 + B0) * (A0 + 3 * B0)));
    const n = Math.max(40, Math.min(96, Math.round(perimeter / 8)));
    const cos = Array.from({ length: n + 1 }, (_, s) => Math.cos((s / n) * Math.PI * 2));
    const sin = Array.from({ length: n + 1 }, (_, s) => Math.sin((s / n) * Math.PI * 2));
    // The oval's outward normal at angle s, and a point `inset` in from its edge.
    const out = (s: number): [number, number] => {
      const x = cos[s]! / A0;
      const y = sin[s]! / B0;
      const l = Math.hypot(x, y) || 1;
      return [x / l, y / l];
    };
    const at = (s: number, inset: number, z: number): Vec3 => [
      cos[s]! * Math.max(0, A0 - inset * k),
      sin[s]! * Math.max(0, B0 - inset * k),
      z * k,
    ];

    // The coping and the bank: one smooth surface round the oval, each corner its own colour.
    const bankN = BANK.map((_, j) => {
      const a = BANK[Math.max(0, j - 1)]!;
      const b = BANK[Math.min(BANK.length - 1, j + 1)]!;
      // Across the profile's slope, as (outward, up): the profile runs inward (i grows) from the oval's edge.
      const nr = b.z - a.z;
      const nz = b.i - a.i;
      const l = Math.hypot(nr, nz) || 1;
      return [nr / l, nz / l] as const;
    });
    const bankC = BANK.map((b) => shade(b.c, 1));
    // Laid stones, not a moulded ring: each stone a few segments long, its own shade and a little higher or lower.
    const stone = Array.from({ length: n }, (_, s) => {
      const h = Math.sin(Math.floor(s / 3) * 78.233 + 1.7) * 43758.5453;
      return h - Math.floor(h);
    });
    const STONE_PARTS = 5;
    const bankPt = (s: number, j: number): Pt => {
      const [ox, oy] = out(s);
      const [nr, nz] = bankN[j]!;
      const v = stone[s % n]!;
      const b = BANK[j]!;
      const own = j > 0 && j < STONE_PARTS;
      // A darker seam where one stone meets the next.
      const seam = s % 3 === 0 ? 0.72 : 1;
      const c = own ? shade(b.c, (0.84 + v * 0.24) * seam) : bankC[j]!;
      const z = own && b.z > 1.5 ? b.z + (v - 0.5) * 0.5 : b.z;
      return { p: at(s, b.i, z), n: [ox * nr, oy * nr, nz], c };
    };
    for (let j = 0; j + 1 < BANK.length; j++)
      for (let s = 0; s < n; s++) {
        const a = bankPt(s, j);
        const b = bankPt(s + 1, j);
        const c = bankPt(s + 1, j + 1);
        const d = bankPt(s, j + 1);
        tri3(m, a, b, c);
        tri3(m, a, c, d);
      }

    // The water: rings from its edge to its middle, light in the shallows and dark in the deep.
    const wz = POND_WATER_Z;
    const up: Vec3 = [0, 0, 1];
    const Aw = A0 - WATER_IN * k;
    const Bw = B0 - WATER_IN * k;
    const rings: readonly { r: number; c: Rgb }[] = [
      { r: 1, c: shallow },
      { r: 0.86, c: mix(shallow, water, 0.6) },
      { r: 0.64, c: water },
      { r: 0.36, c: deep },
      { r: 0, c: deepest },
    ];
    // The deep lies a little toward the back, where a pond's far bank falls steepest.
    const dx = 0;
    const dy = -Bw * 0.08;
    const ringPt = (s: number, j: number): Pt => {
      const g = rings[j]!;
      const w = 1 - g.r;
      return {
        p: [cos[s]! * Aw * g.r + dx * w, sin[s]! * Bw * g.r + dy * w, wz * k],
        n: up,
        c: shade(g.c, 1),
      };
    };
    for (let j = 0; j + 1 < rings.length; j++)
      for (let s = 0; s < n; s++) {
        const a = ringPt(s, j);
        const b = ringPt(s + 1, j);
        const c = ringPt(s + 1, j + 1);
        if (rings[j + 1]!.r === 0) tri3(m, a, b, c);
        else {
          tri3(m, a, b, c);
          tri3(m, a, c, ringPt(s, j + 1));
        }
      }

    // The sky's sheen: a few soft streaks on the water (the glass's see-through white), two stacked for a bright core.
    const sz = wz * k + 0.06;
    sheen(m, Aw, Bw, 0.74, Math.PI * 1.12, Math.PI * 1.42, 3.2 * k, sz);
    sheen(m, Aw, Bw, 0.74, Math.PI * 1.18, Math.PI * 1.34, 1.4 * k, sz + 0.03);
    sheen(m, Aw, Bw, 0.48, Math.PI * 1.62, Math.PI * 1.8, 2.2 * k, sz);
    sheen(m, Aw, Bw, 0.62, Math.PI * 0.22, Math.PI * 0.36, 1.8 * k, sz);

    // Lily pads where the drawing has them, and a smaller third; a pink flower on the first.
    const pad = Math.min(11, Math.min(f.W, f.D) * 0.11);
    const pz = wz * k + 0.12;
    if (pad >= 3) {
      const p1 = { x: -0.18 * f.W, y: -0.08 * f.D };
      const p2 = { x: 0.14 * f.W, y: 0.12 * f.D };
      lilyPad(m, p1.x, p1.y, pad, 0.6, pz);
      lilyPad(m, p2.x, p2.y, pad * 0.8, 2.4, pz);
      lilyPad(m, p2.x + pad * 1.4, p2.y - pad * 0.7, pad * 0.5, 4.1, pz);
      // The flower: a cup of petals, pale at the tips, a gold heart.
      const fx = p1.x + pad * 0.25;
      const fy = p1.y - pad * 0.1;
      const fr = pad * 0.34;
      m.lathe(
        fx,
        fy,
        [
          { r: fr * 0.25, z: pz + 0.1 },
          { r: fr * 0.85, z: pz + 0.5 },
          { r: fr, z: pz + 1.3 },
          { r: fr * 0.7, z: pz + 1.9 },
        ],
        PINK,
        { segments: 10, colours: [PINK, PINK, PINK_PALE] },
      );
      m.sphere(fx, fy, pz + 1.0, fr * 0.32, fr * 0.32, fr * 0.3, GOLD, { segments: 8, rings: 4 });
    }

    // A clump of reeds standing in the shallows at the back right, some with a cattail.
    if (k >= 0.6) {
      const ra = -Math.PI * 0.28;
      const rx = Math.cos(ra) * (A0 - 17 * k);
      const ry = Math.sin(ra) * (B0 - 17 * k);
      const REEDS = [
        [0, 0, 22, 0.15, -0.1, true],
        [2.2, 0.8, 18, 0.3, 0.12, false],
        [-1.8, 1.2, 16, -0.25, 0.05, false],
        [1.0, -1.6, 20, 0.1, -0.25, true],
        [-2.6, -0.6, 14, -0.35, -0.1, false],
        [3.4, -0.4, 12, 0.4, -0.05, false],
        [-0.6, 2.4, 13, -0.05, 0.3, true],
      ] as const;
      for (const [ox, oy, h, lx, ly, tail] of REEDS) {
        const base: Vec3 = [rx + ox * k, ry + oy * k, wz * k];
        const top: Vec3 = [base[0] + lx * h * 0.25, base[1] + ly * h * 0.25, wz * k + h * k];
        m.tube(base, top, 0.7 * k, tail ? REED : REED_LIGHT, { segments: 5, r1: 0.2 * k });
        if (tail) {
          const u = 0.72;
          const a: Vec3 = [
            base[0] + (top[0] - base[0]) * u,
            base[1] + (top[1] - base[1]) * u,
            base[2] + (top[2] - base[2]) * u,
          ];
          const b: Vec3 = [
            base[0] + (top[0] - base[0]) * (u + 0.16),
            base[1] + (top[1] - base[1]) * (u + 0.16),
            base[2] + (top[2] - base[2]) * (u + 0.16),
          ];
          m.tube(a, b, 1.2 * k, CATTAIL, { segments: 6 });
        }
      }
    }

    // A few pebbles on the coping, the same ones every time.
    const pebbles = Math.max(4, Math.min(14, Math.round(perimeter / 70)));
    for (let p = 0; p < pebbles; p++) {
      const h = Math.sin(p * 12.9898 + 4.1) * 43758.5453;
      const r = h - Math.floor(h);
      const s = Math.floor(((p + r * 0.6) / pebbles) * n) % n;
      const q = at(s, 3.0 + r * 1.6, 1.95);
      const size = (1.4 + r * 1.2) * k;
      m.sphere(
        q[0],
        q[1],
        q[2],
        size,
        size * (0.7 + r * 0.3),
        size * 0.55,
        PEBBLES[p % PEBBLES.length]!,
        {
          segments: 8,
          rings: 4,
          from: 0.35,
        },
      );
    }
  },
};
