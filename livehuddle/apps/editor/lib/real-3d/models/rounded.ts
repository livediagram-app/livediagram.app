// Real 3D's smooth models (docs/specs/008-canvas/3d-engine.md "Block models"): the pieces whose shapes are round or
// curved, turned and bent rather than stacked: the Car Park's cars, the Bike Rack's bikes and hoops, the Fountain
// and the Garden Umbrella. Each in its drawing's colours (packages/document office-venue.ts, office-social.ts), at its
// drawing's size. Pure: no three.js, no DOM.
import { shade, type Rgb, type Vec3 } from '../mesh-builder';
import type { Builder } from './kit';
import { mix, type ModelTable } from './kit';

const TYRE = 0x1f2937;
const RIM = 0xcbd5e1;
const STEEL = 0x94a3b8;
const GLASS_TINT = 0x334155;
const LAMP = 0xfef3c7;
const TAIL = 0xef4444;
const PLATE = 0xf8fafc;
const CONCRETE = 0xd6d3d1;
const STONE = 0xe7e5e4;
const STONE_DARK = 0xa8a29e;
const WATER = 0x4fa9d6;
const WATER_LIT = 0x8ecdeb;
const SPRAY = 0xd5eefa;
const GOLD = 0xd6ad3c;
const LOG = 0x8e5f1a;
const BARK = 0x6b3f14;
const EMBER = 0x9a3412;
// The flame is lit like everything else, so its tones are a step brighter than the drawing's to glow.
const FLAME = 0xff8a3d;
const FLAME_CORE = 0xffe066;

/** A campfire's flame: a tapering lick, wide at the logs, leaning and narrowing to a point. */
function flameLick(
  m: Builder,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  colour: Rgb,
  lean: number,
): void {
  m.lathe(
    x,
    y,
    [
      { r: 0, z },
      { r: r * 0.85, z: z + h * 0.08 },
      { r, z: z + h * 0.28 },
      { r: r * 0.72, z: z + h * 0.55 },
      { r: r * 0.3, z: z + h * 0.82 },
      { r: 0, z: z + h },
    ].map((p, i) => ({ ...p, r: p.r * (1 - lean * i * 0.02) })),
    colour,
    { segments: 12 },
  );
}

/** A wheel on its side: a tyre round an axle along x at (x, y, z), its rim and hub showing on both faces. */
function wheelX(m: Builder, x: number, y: number, z: number, r: number, w: number): void {
  m.tube([x - w / 2, y, z], [x + w / 2, y, z], r, TYRE, { segments: 18 });
  for (const s of [-1, 1]) {
    const fx = x + s * (w / 2 + 0.05);
    m.tube([fx, y, z], [fx + s * 0.3, y, z], r * 0.62, RIM, { segments: 16 });
    m.tube([fx, y, z], [fx + s * 0.6, y, z], r * 0.22, STEEL, { segments: 10 });
  }
}

/** A thin wheel standing in the x-z plane at (x, y, z): a torus-like ring of tube, spokes and a hub. */
function bikeWheel(m: Builder, x: number, y: number, z: number, r: number): void {
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const p = (a: number, rr: number): Vec3 => [x + Math.cos(a) * rr, y, z + Math.sin(a) * rr];
    m.tube(p(a0, r), p(a1, r), 1.3, TYRE, { segments: 6 });
    m.tube(p(a0, r - 1.4), p(a1, r - 1.4), 0.5, RIM, { segments: 5 });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    m.tube(
      [x - Math.cos(a) * (r - 1.6), y, z - Math.sin(a) * (r - 1.6)],
      [x + Math.cos(a) * (r - 1.6), y, z + Math.sin(a) * (r - 1.6)],
      0.22,
      STEEL,
      { segments: 4 },
    );
  }
  m.tube([x, y - 1.6, z], [x, y + 1.6, z], 1.1, STEEL, { segments: 8 });
}

/** A bike side on along x, its wheels' feet on z0, `dir` 1 nose to +x: as the drawing's `bike()`, in the round. */
function bike(m: Builder, ox: number, y: number, z0: number, colour: Rgb, dir: 1 | -1): void {
  const r = 11;
  const wz = z0 + r;
  const P = (dx: number, dz: number): Vec3 => [ox + dx * dir, y, z0 + dz];
  const back = P(-17, r);
  const front = P(17, r);
  const crank = P(-2, r);
  const seat = P(-7, r + 19);
  const head = P(12, r + 17);
  bikeWheel(m, back[0], y, wz, r);
  bikeWheel(m, front[0], y, wz, r);
  const t = 1.25;
  m.tube(back, crank, t, colour);
  m.tube(back, seat, t, colour);
  m.tube(crank, seat, t * 1.15, colour);
  m.tube(crank, head, t * 1.2, colour);
  m.tube(seat, head, t * 1.1, colour);
  m.tube(head, front, t, colour);
  // The seat post and saddle, the stem and bars, the chainring and pedals.
  const saddle = P(-8, r + 22);
  m.tube(seat, saddle, 0.8, STEEL);
  m.rounded(
    saddle[0] - 4,
    y - 1.8,
    saddle[2] - 0.6,
    saddle[0] + 4,
    y + 1.8,
    saddle[2] + 1.4,
    TYRE,
    0.8,
  );
  const bars = P(10, r + 22);
  m.tube(head, bars, 0.8, STEEL);
  m.tube([bars[0], y - 6, bars[2]], [bars[0], y + 6, bars[2]], 0.8, STEEL);
  for (const s of [-1, 1])
    m.tube([bars[0], y + s * 4.5, bars[2]], [bars[0], y + s * 6.5, bars[2]], 1.2, TYRE);
  m.tube(
    [crank[0], y - 1.2, crank[2]],
    [crank[0], y + 1.2, crank[2]],
    3,
    mix(STEEL, 0x000000, 0.25),
    { segments: 14 },
  );
  m.tube([crank[0], y - 3, crank[2] - 3], [crank[0], y + 3, crank[2] + 3], 0.6, TYRE);
}

/** A Sheffield stand: an upright U of steel tube along x, from x0 to x1 at y, feet on z0, `h` tall. */
function hoop(m: Builder, x0: number, x1: number, y: number, z0: number, h: number): void {
  const r = 6;
  const t = 1.5;
  m.tube([x0, y, z0], [x0, y, z0 + h - r], t, STEEL);
  m.tube([x1, y, z0], [x1, y, z0 + h - r], t, STEEL);
  m.tube([x0 + r, y, z0 + h], [x1 - r, y, z0 + h], t, STEEL);
  const n = 6;
  for (const [cx, s] of [
    [x0 + r, -1],
    [x1 - r, 1],
  ] as const)
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * (Math.PI / 2);
      const a1 = ((i + 1) / n) * (Math.PI / 2);
      m.tube(
        [cx + s * Math.cos(a0) * r, y, z0 + h - r + Math.sin(a0) * r],
        [cx + s * Math.cos(a1) * r, y, z0 + h - r + Math.sin(a1) * r],
        t,
        STEEL,
        { segments: 8 },
      );
    }
}

/**
 * A car facing +y (nose to the front of the bay) about (cx, cy), `w` wide and `l` long: a body with eased edges, a
 * glass cabin with its pillars and roof, four wheels, lamps, tail lights, a number plate and mirrors.
 */
export function car(
  m: Builder,
  cx: number,
  cy: number,
  w: number,
  l: number,
  body: Rgb,
  deep: Rgb,
): void {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - l / 2;
  const y1 = cy + l / 2;
  const r = Math.min(7, w * 0.15);
  const zb = r * 0.55;
  const zt = zb + l * 0.2;
  // The shadow under it is the scene's; the body, with a darker sill.
  m.rounded(x0 + 1, y0 + 1, zb, x1 - 1, y1 - 1, zb + 3, deep, 1.4);
  m.rounded(x0, y0, zb + 2, x1, y1, zt, body, 3.2, { top: mix(body, 0xffffff, 0.1) });
  // The cabin: glass all round, a little in from the body, set back from the nose.
  const ca = y0 + l * 0.2;
  const cb = y1 - l * 0.36;
  const zr = zt + l * 0.17;
  m.rounded(x0 + 3, ca, zt - 0.5, x1 - 3, cb, zr, GLASS_TINT, 2.6, { top: body });
  // Its roof and pillars in the body's colour.
  m.rounded(x0 + 4, ca + 3, zr - 1, x1 - 4, cb - 2, zr + 1.2, body, 1);
  for (const sx of [-1, 1])
    for (const yy of [ca + 1, cb - 1])
      m.rounded(
        cx + sx * (w / 2 - 4.2) - 1,
        yy - 1.2,
        zt,
        cx + sx * (w / 2 - 4.2) + 1,
        yy + 1.2,
        zr,
        body,
        0.4,
      );
  // Wheels in their arches.
  for (const yy of [y0 + l * 0.2, y1 - l * 0.2])
    for (const xx of [x0 + 2.4, x1 - 2.4]) wheelX(m, xx, yy, r, r, 4.6);
  // Lamps at the nose, tail lights at the back, plates on both.
  for (const sx of [-1, 1]) {
    m.rounded(
      cx + sx * (w / 2 - 7) - 4,
      y1 - 0.8,
      zt - 5,
      cx + sx * (w / 2 - 7) + 4,
      y1 + 0.6,
      zt - 2,
      LAMP,
      0.6,
    );
    m.rounded(
      cx + sx * (w / 2 - 6) - 4,
      y0 - 0.6,
      zt - 5,
      cx + sx * (w / 2 - 6) + 4,
      y0 + 0.8,
      zt - 2,
      TAIL,
      0.6,
    );
    m.rounded(
      cx + sx * (w / 2 + 1.6) - 1.6,
      ca + 0.5,
      zt - 1,
      cx + sx * (w / 2 + 1.6) + 1.6,
      ca + 3.5,
      zt + 2,
      deep,
      0.6,
    );
  }
  m.b(cx - 7, y1 - 0.2, zb + 3, cx + 7, y1 + 0.5, zb + 7, PLATE, { bare: true, sharp: true });
  m.b(cx - 7, y0 - 0.5, zb + 3, cx + 7, y0 + 0.2, zb + 7, PLATE, { bare: true, sharp: true });
  // The grille.
  m.b(cx - 9, y1 - 0.1, zt - 7.5, cx + 9, y1 + 0.4, zt - 5.5, mix(deep, 0x000000, 0.35), {
    bare: true,
    sharp: true,
  });
}

/** A fan of water from (x, y, z) arcing out by `reach` and down `drop`, as a chain of see-through tube. */
function jet(
  m: Builder,
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  rise: number,
  drop: number,
): void {
  const n = 8;
  let prev: Vec3 = [x, y, z];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const h = 4 * rise * t * (1 - t) - drop * t * t;
    const next: Vec3 = [x + dx * t, y + dy * t, z + h];
    m.tube(prev, next, 0.75, SPRAY, { segments: 6, glass: true });
    prev = next;
  }
}

/** A flat ring lying on the water: a few short glints round a circle. */
function ripple(m: Builder, cx: number, cy: number, z: number, rx: number, ry: number): void {
  const n = 22;
  const c = shade(0xffffff, 1);
  const up: Vec3 = [0, 0, 1];
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const p = (a: number, k: number): Vec3 => [
      cx + Math.cos(a) * rx * k,
      cy + Math.sin(a) * ry * k,
      z,
    ];
    m.tri(p(a0, 1), p(a1, 1), p(a1, 1.06), up, up, up, c, true);
    m.tri(p(a0, 1), p(a1, 1.06), p(a0, 1.06), up, up, up, c, true);
  }
}

export const ROUNDED_MODELS: ModelTable = {
  campfire: (m, { f }) => {
    // A ring of pale and grey stones, two logs crossed in it on a bed of embers, and an orange flame with a yellow heart.
    const { y0, y1 } = f.foot;
    const cy = (y0 + y1) / 2;
    const rx = 24;
    const ry = (y1 - y0) / 2 - 3;
    const n = 11;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const s = 4.6 + ((k * 7) % 3) * 0.6;
      m.sphere(
        Math.cos(a) * rx,
        cy + Math.sin(a) * ry,
        s * 0.45,
        s,
        s * 0.85,
        s * 0.7,
        k % 2 ? STONE_DARK : STONE,
        {
          segments: 10,
          rings: 6,
          from: 0.5,
        },
      );
    }
    m.cylinder(0, cy, 0, 1.2, rx - 4, rx - 5, 0x44403c, { top: EMBER, segments: 24 });
    // Two logs crossed, their cut ends pale.
    for (const [a, z] of [
      [0.5, 3],
      [-0.6, 5.2],
    ] as const) {
      const dx = Math.cos(a) * 16;
      const dy = Math.sin(a) * 9;
      m.tube([-dx, cy - dy, z], [dx, cy + dy, z], 2.6, LOG, { segments: 10 });
      m.tube([dx, cy + dy, z], [dx * 1.04, cy + dy * 1.04, z], 2.2, 0xd6a56a, { segments: 10 });
      m.tube([-dx, cy - dy, z], [-dx * 1.04, cy - dy * 1.04, z], 2.2, 0xd6a56a, { segments: 10 });
      m.tube([-dx * 0.4, cy - dy * 0.4, z + 1.8], [dx * 0.1, cy + dy * 0.1, z + 2.2], 0.7, BARK, {
        segments: 6,
      });
    }
    flameLick(m, 0, cy + 2, 4, 6.5, 24, FLAME, 0);
    flameLick(m, -6, cy + 1, 4, 4, 15, FLAME, 1);
    flameLick(m, 6, cy, 4, 4, 17, FLAME, 1);
    flameLick(m, 0, cy - 5, 4, 4.4, 14, FLAME_CORE, 0);
  },

  'car-park': (m, { f }) => {
    // Only the cars stand: the tarmac, its bay lines and kerb lie flat in the floor (the drawing's flat row). A red
    // car in the left bay and a blue one in the right, nose out; the middle bay empty but for its wheel stop.
    const { x0, y0, x1, y1 } = f.foot;
    const W = x1 - x0;
    const D = y1 - y0;
    const at = (u: number) => x0 + W * u;
    const by0 = y0 + D * (36 / 128);
    const by1 = y0 + D * (120 / 128);
    const l = by1 - by0;
    const w = Math.min(W * (60 / 240), l * 0.56);
    m.rounded(x0, y0 + D * (18 / 128), 0, x1, y0 + D * (31 / 128), 3, CONCRETE, 1);
    m.rounded(
      at(98 / 240),
      y0 + D * (40 / 128),
      0,
      at(142 / 240),
      y0 + D * (46 / 128),
      2.4,
      CONCRETE,
      1,
    );
    car(m, at(44 / 240), (by0 + by1) / 2, w, l * 0.94, 0xd23030, 0x942020);
    car(m, at(196 / 240), (by0 + by1) / 2, w, l * 0.94, 0x386ad8, 0x1f3b89);
  },

  'bike-rack': (m, { f }) => {
    // A concrete pad with two steel Sheffield stands, a red bike and a teal bike locked to them, side on, all at the
    // drawing's size: wheels 22 across, saddles about as high as a sitter's hips.
    const { x0, y0, x1, y1 } = f.foot;
    const W = x1 - x0;
    const cy = (y0 + y1) / 2;
    const at = (u: number) => x0 + W * u;
    const s = W / 136;
    m.rounded(x0 + 1, y0 + 1, 0, x1 - 1, y1 - 1, 2.4, CONCRETE, 1.2);
    hoop(m, at(12 / 136), at(60 / 136), cy - 4, 2.4, 32 * Math.min(1.2, s));
    hoop(m, at(76 / 136), at(124 / 136), cy - 4, 2.4, 32 * Math.min(1.2, s));
    bike(m, at(34 / 136), cy + 2, 2.4, 0xde5555, 1);
    bike(m, at(100 / 136), cy + 2, 2.4, 0x22aa9b, 1);
  },

  fountain: (m, { f }) => {
    // A round stone basin of water on a footing, a turned pedestal with a bowl, water spilling from the bowl in a
    // sheet and jets arcing out into the basin.
    const { x0, y0, x1, y1 } = f.foot;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    // Round from above: its box is as wide as its drawing, so its depth is only squashed a little to stay inside it.
    const R = (x1 - x0) / 2;
    const k = Math.max(0.8, Math.min(1, (y1 - y0) / (x1 - x0)));
    const o = { sx: 1, sy: k, segments: 48 };
    const s = R / 60;
    const z = (v: number) => v * Math.max(0.8, Math.min(1.25, s));
    m.cylinder(cx, cy, 0, z(2.5), R, R - 1, STONE_DARK, { ...o, top: STONE_DARK });
    // The basin's wall: out, up, over its lip and down inside.
    m.lathe(
      cx,
      cy,
      [
        { r: R - 2, z: z(2.4) },
        { r: R - 2.4, z: z(10) },
        { r: R - 2, z: z(12.4) },
        { r: R - 4, z: z(13.6) },
        { r: R - 7.4, z: z(13.2) },
        { r: R - 8, z: z(11.4) },
        { r: R - 8.2, z: z(8) },
      ],
      STONE,
      { ...o, colours: [STONE, STONE, 0xf5f5f4, 0xf5f5f4, STONE, STONE] },
    );
    m.cylinder(cx, cy, z(2.4), z(8.6), R - 8, R - 8, WATER, { ...o, top: WATER_LIT });
    ripple(m, cx, cy, z(8.7), R * 0.32, R * 0.32 * k);
    ripple(m, cx, cy, z(8.7), R * 0.55, R * 0.55 * k);
    // The pedestal and its bowl.
    m.lathe(
      cx,
      cy,
      [
        { r: 9 * s, z: z(8.6) },
        { r: 7 * s, z: z(11) },
        { r: 4.6 * s, z: z(15) },
        { r: 4.2 * s, z: z(21) },
        { r: 5.4 * s, z: z(23.6) },
        { r: 14 * s, z: z(26) },
        { r: 17 * s, z: z(28.6) },
        { r: 15.6 * s, z: z(29.4) },
        { r: 13.4 * s, z: z(28) },
      ],
      STONE,
      { ...o, colours: [STONE, STONE, STONE, STONE, STONE, 0xf5f5f4, 0xf5f5f4, STONE] },
    );
    m.cylinder(cx, cy, z(26), z(28.2), 13.4 * s, 13.4 * s, WATER, { ...o, top: WATER_LIT });
    m.lathe(
      cx,
      cy,
      [
        { r: 2.6 * s, z: z(28) },
        { r: 2 * s, z: z(31) },
        { r: 3.2 * s, z: z(33) },
        { r: 0, z: z(36) },
      ],
      GOLD,
      o,
    );
    // The water: a sheet falling from the bowl's lip to the basin, and jets arcing out from the spout.
    m.cylinder(cx, cy, z(8.7), z(28.6), 19 * s, 16.4 * s, SPRAY, {
      ...o,
      glass: true,
      caps: false,
    });
    const jets = 8;
    for (let i = 0; i < jets; i++) {
      const a = (i / jets) * Math.PI * 2;
      jet(m, cx, cy, z(35), Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5 * k, z(8), z(26));
    }
  },

  'garden-umbrella': (m, { f }) => {
    // A weighted base, a slim pole, and a canopy of red and white panels sloping down from a gold finial, its rim
    // hung with a short valance.
    const { y0, y1 } = f.foot;
    const cy = (y0 + y1) / 2;
    m.cylinder(0, cy, 0, 2.4, 11, 10, STONE_DARK, { segments: 28 });
    m.cylinder(0, cy, 2.4, 4.4, 7, 6, STONE_DARK, { segments: 24 });
    m.tube([0, cy, 4], [0, cy, 96], 1.5, 0x64748b, { segments: 10 });
    const n = 16;
    const prof = [
      { r: 54, z: 70 },
      { r: 44, z: 79 },
      { r: 30, z: 88 },
      { r: 14, z: 95 },
      { r: 0, z: 98 },
    ];
    const ribs = 0xb91c1c;
    for (let j = 0; j < n; j++) {
      const colour = shade(j % 2 === 0 ? 0xde5555 : 0xfafafa, 1);
      const a0 = (j / n) * Math.PI * 2;
      const a1 = ((j + 1) / n) * Math.PI * 2;
      for (let k = 0; k + 1 < prof.length; k++) {
        const p0 = prof[k]!;
        const p1 = prof[k + 1]!;
        // Each panel bellies a little between its ribs: its middle sits a touch higher than its edges.
        const v = (p: { r: number; z: number }, a: number): Vec3 => [
          Math.cos(a) * p.r,
          cy + Math.sin(a) * p.r,
          p.z,
        ];
        const nr = (a: number): Vec3 => {
          const dr = p1.r - p0.r;
          const dz = p1.z - p0.z;
          const l = Math.hypot(dr, dz) || 1;
          return [(Math.cos(a) * dz) / l, (Math.sin(a) * dz) / l, -dr / l];
        };
        m.tri(v(p0, a0), v(p0, a1), v(p1, a1), nr(a0), nr(a1), nr(a1), colour);
        if (p1.r > 0) m.tri(v(p0, a0), v(p1, a1), v(p1, a0), nr(a0), nr(a1), nr(a0), colour);
      }
      // The valance: a short hanging strip under the rim, scalloped.
      const r = prof[0]!.r;
      const am = (a0 + a1) / 2;
      const out = (a: number): Vec3 => [Math.cos(a), Math.sin(a), 0];
      const P = (a: number, z: number): Vec3 => [Math.cos(a) * r, cy + Math.sin(a) * r, z];
      m.tri(P(a0, 70), P(a1, 70), P(am, 64), out(a0), out(a1), out(am), colour);
      m.tube(P(a0, 70.2), [Math.cos(a0) * 2, cy + Math.sin(a0) * 2, 97.4], 0.45, ribs, {
        segments: 5,
      });
    }
    m.sphere(0, cy, 99.5, 2.6, 2.6, 2.6, GOLD, { segments: 12, rings: 6 });
  },
};
