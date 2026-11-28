// Real 3D's trees (docs/specs/008-canvas/3d-engine.md "Models", 009-elements/office.md "Tree species"): the Tree by
// its species, read from the model context's `variant`, each built smooth (turned trunks, bent boughs, leafy balls,
// cone tiers, curved fronds and curtains) in its drawing's colours (packages/document tree-species.ts). Every species
// stands its trunk on the same footprint, the crown never blocking a walk. Pure: no three.js, no DOM.
import { treeSpecies, type TreeSpecies } from '@livehuddle/document';
import { faceNormal, shade, type Rgb, type Vec3 } from '../mesh-builder';
import { mix, type Builder, type ModelContext, type ModelTable } from './kit';
import { foliage, hash } from './outdoor';

const hex = (s: string) => parseInt(s.slice(1), 16);

// The Oak's colours, as it always was.
const OAK = { deep: 0x2f6e38, mid: 0x428c46, light: 0x63ad5c, bark: 0x8a5a32, barkDark: 0x5f3d22 };

/** A tree's colours by species (tree-species.ts TREE_TONES). */
const TONES = {
  pine: { deep: hex('#1f4d3a'), mid: hex('#2b6449'), light: hex('#3f7d5a'), bark: hex('#5f3d22') },
  birch: {
    deep: hex('#6f9c3e'),
    mid: hex('#8fbb4e'),
    light: hex('#b5d873'),
    bark: hex('#efece4'),
    mark: hex('#3b3632'),
  },
  palm: {
    deep: hex('#2f7a3a'),
    mid: hex('#46a04a'),
    light: hex('#6cc15c'),
    bark: hex('#a8804f'),
    nut: hex('#6b4a2b'),
  },
  cherry: {
    deep: hex('#d27a9a'),
    mid: hex('#eba3bb'),
    light: hex('#f7cbd9'),
    bark: hex('#5a3a2e'),
  },
  maple: { deep: hex('#b4432b'), mid: hex('#df7a30'), light: hex('#f0b43e'), bark: hex('#6b4428') },
  willow: {
    deep: hex('#557f37'),
    mid: hex('#76a64c'),
    light: hex('#9cc66b'),
    bark: hex('#6e4b2c'),
  },
} as const;

/** Where the trunk stands in the model's frame: the middle of its footprint. */
const trunkY = (c: ModelContext) => (c.f.foot.y0 + c.f.foot.y1) / 2;

/**
 * A blade seen from both sides (a palm's frond, a willow's curtain): a strip along `spine`, `half` wide either side
 * along `across`, each edge dropped by `droop` times its half width so it folds down from its midrib like a leaf.
 */
function blade(
  m: Builder,
  spine: readonly Vec3[],
  half: readonly number[],
  across: readonly Vec3[],
  colour: Rgb,
  droop = 0,
): void {
  const rgb = shade(colour, 1);
  const edge = (i: number, side: 1 | -1): Vec3 => {
    const p = spine[i]!;
    const a = across[i]!;
    const h = half[i]! * side;
    return [p[0] + a[0] * h, p[1] + a[1] * h, p[2] + a[2] * h - Math.abs(h) * droop];
  };
  const face = (a: Vec3, b: Vec3, c: Vec3) => {
    const n = faceNormal(a, b, c);
    if (!Number.isFinite(n[0]) || (n[0] === 0 && n[1] === 0 && n[2] === 0)) return;
    const back: Vec3 = [-n[0], -n[1], -n[2]];
    m.tri(a, b, c, n, n, n, rgb);
    m.tri(a, c, b, back, back, back, rgb);
  };
  for (let i = 0; i + 1 < spine.length; i++)
    for (const side of [1, -1] as const) {
      const p0 = spine[i]!;
      const p1 = spine[i + 1]!;
      const e0 = edge(i, side);
      const e1 = edge(i + 1, side);
      face(p0, e0, e1);
      if (half[i + 1]! > 0.01) face(p0, e1, p1);
    }
}

/** A round crown of leaf clumps over a flared trunk with two boughs: the Oak, and the Maple in its autumn colours. */
function broadleaf(
  m: Builder,
  cy: number,
  t: { deep: Rgb; mid: Rgb; light: Rgb; bark: Rgb; barkDark: Rgb },
): void {
  m.lathe(
    0,
    cy,
    [
      { r: 11, z: 0 },
      { r: 7.5, z: 3 },
      { r: 5.6, z: 12 },
      { r: 4.6, z: 50 },
      { r: 3.6, z: 74 },
    ],
    t.bark,
    { segments: 14, colours: [t.barkDark, t.bark, t.bark, t.bark] },
  );
  for (const x of [-2.5, 2]) {
    m.b(x, cy + 5, 8, x + 1.2, cy + 5.8, 58, t.barkDark, { bare: true });
    m.b(x, cy - 5.8, 8, x + 1.2, cy - 5, 58, t.barkDark, { bare: true });
  }
  // Two boughs into the canopy.
  m.tube([0, cy, 52], [-14, cy, 68], 2.4, t.bark, { r1: 1.4 });
  m.tube([0, cy, 48], [14, cy - 2, 64], 2.4, t.bark, { r1: 1.4 });
  m.sphere(0, cy, 72, 32, 27, 8, t.deep, { segments: 20, rings: 8 });
  foliage(m, 0, cy, 52, 44, 70, 94, t.deep, t.mid, 3);
  foliage(m, 0, cy, 46, 39, 94, 116, t.mid, t.light, 4);
  foliage(m, 0, cy, 34, 29, 116, 134, t.mid, t.light, 5);
  // The two lobes on top, as in the drawing.
  m.sphere(-12, cy, 138, 16, 15, 12, t.light, { segments: 16, rings: 8 });
  m.sphere(13, cy - 2, 136, 14, 13, 10, t.light, { segments: 16, rings: 8 });
}

/** Leaves fallen round a tree's foot: small flat ovals on the ground, placed by `seed`. */
function fallen(m: Builder, cy: number, colours: readonly Rgb[], n: number, seed: number): void {
  for (let k = 0; k < n; k++) {
    const a = hash(k, seed, 1) * Math.PI * 2;
    const r = 16 + hash(k, seed, 2) * 34;
    const x = Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.8;
    const s = 1.6 + hash(k, seed, 3) * 1.4;
    const turn = hash(k, seed, 4) * Math.PI;
    const pts = Array.from({ length: 6 }, (_, i) => {
      const t = (i / 6) * Math.PI * 2;
      const u = Math.cos(t) * s * 1.6;
      const v = Math.sin(t) * s;
      return {
        x: x + u * Math.cos(turn) - v * Math.sin(turn),
        y: y + u * Math.sin(turn) + v * Math.cos(turn),
      };
    });
    m.flat(pts, 0.5 + k * 0.01, colours[k % colours.length]!);
  }
}

const SPECIES: Record<TreeSpecies, (m: Builder, c: ModelContext) => void> = {
  oak: (m, c) => broadleaf(m, trunkY(c), OAK),

  pine: (m, c) => {
    // A straight trunk, and stacked cone tiers of needles narrowing to a point, each tier's skirt flaring over the
    // one below it.
    const cy = trunkY(c);
    const t = TONES.pine;
    m.lathe(
      0,
      cy,
      [
        { r: 8, z: 0 },
        { r: 5.5, z: 3 },
        { r: 4.4, z: 14 },
        { r: 3.2, z: 60 },
      ],
      t.bark,
      { segments: 16 },
    );
    const tiers: [number, number, number, Rgb, Rgb][] = [
      [48, 30, 74, t.deep, t.mid],
      [41, 54, 96, t.deep, t.mid],
      [33, 76, 116, t.mid, t.light],
      [24, 98, 134, t.mid, t.light],
      [14, 120, 156, t.light, t.light],
    ];
    for (const [rb, zb, zt, under, over] of tiers) {
      const h = zt - zb;
      m.lathe(
        0,
        cy,
        [
          { r: 0, z: zb + 6 },
          { r: rb * 0.75, z: zb + 2.5 },
          { r: rb, z: zb },
          { r: rb * 0.97, z: zb + 1.2 },
          { r: rb * 0.62, z: zb + h * 0.38 },
          { r: rb * 0.3, z: zb + h * 0.72 },
          { r: 0, z: zt },
        ],
        over,
        { segments: 28, colours: [under, under, under, over, over, over] },
      );
    }
  },

  birch: (m, c) => {
    // A slim white trunk with dark marks round it, thin boughs, and a light, airy crown of small clumps.
    const cy = trunkY(c);
    const t = TONES.birch;
    m.lathe(
      0,
      cy,
      [
        { r: 6.5, z: 0 },
        { r: 4.4, z: 3 },
        { r: 3.8, z: 20 },
        { r: 3, z: 80 },
        { r: 2.2, z: 118 },
      ],
      t.bark,
      { segments: 16 },
    );
    // The marks: short dark dashes wrapped round the bark.
    for (let k = 0; k < 16; k++) {
      const z = 8 + k * 6.5 + hash(k, 7, 1) * 3;
      const r = 3.9 - (z / 118) * 1.6 + 0.15;
      const a = hash(k, 7, 2) * Math.PI * 2;
      const w = 0.35 + hash(k, 7, 3) * 0.35;
      m.tube(
        [Math.cos(a - w) * r, cy + Math.sin(a - w) * r, z],
        [Math.cos(a + w) * r, cy + Math.sin(a + w) * r, z],
        0.7,
        t.mark,
        { segments: 6 },
      );
    }
    m.tube([0, cy, 70], [-16, cy + 2, 92], 1.4, t.bark, { r1: 0.8 });
    m.tube([0, cy, 82], [15, cy - 3, 104], 1.4, t.bark, { r1: 0.8 });
    m.tube([0, cy, 96], [-9, cy - 4, 118], 1.2, t.bark, { r1: 0.7 });
    foliage(m, 0, cy, 30, 26, 74, 98, t.deep, t.mid, 11);
    foliage(m, 0, cy, 34, 28, 96, 122, t.mid, t.light, 12);
    foliage(m, 0, cy, 22, 19, 120, 142, t.mid, t.light, 13);
    m.sphere(-14, cy + 6, 86, 11, 10, 9, t.mid, { segments: 14, rings: 7 });
    m.sphere(16, cy - 4, 106, 10, 9, 8, t.light, { segments: 14, rings: 7 });
    m.sphere(2, cy, 146, 10, 9, 8, t.light, { segments: 14, rings: 7 });
  },

  palm: (m, c) => {
    // A tall ringed trunk curving up and over a little, a crown of long arching fronds drooping at their tips,
    // coconuts under them.
    const cy = trunkY(c);
    const t = TONES.palm;
    const ring = mix(t.bark, 0x000000, 0.22);
    const n = 12;
    const top = 128;
    const at = (s: number): Vec3 => [12 * s * s, cy, top * s];
    m.cylinder(0, cy, 0, 4, 8, 5.6, ring, { segments: 18 });
    for (let i = 0; i < n; i++) {
      const s0 = i / n;
      const s1 = (i + 1) / n;
      const r0 = 5.4 - s0 * 2.2;
      const r1 = 5.4 - s1 * 2.2;
      // Each ring flares at its foot and narrows into the next, so the trunk reads as stacked leaf scars.
      m.tube(at(s0), at(s1), r0, i % 2 === 0 ? t.bark : mix(t.bark, 0xffffff, 0.08), {
        segments: 16,
        r1: r1 * 0.86,
      });
    }
    const crown = at(1);
    m.sphere(crown[0], cy, crown[2] + 1, 6, 6, 5, mix(t.bark, t.deep, 0.4), { segments: 14 });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      m.sphere(
        crown[0] + Math.cos(a) * 5,
        cy + Math.sin(a) * 5,
        crown[2] - 5,
        3.6,
        3.6,
        3.8,
        t.nut,
        {
          segments: 12,
          rings: 7,
        },
      );
    }
    const fronds = 10;
    for (let k = 0; k < fronds; k++) {
      const a = (k / fronds) * Math.PI * 2 + hash(k, 3, 1) * 0.3;
      const len = 46 + hash(k, 3, 2) * 12;
      const lift = 10 + hash(k, 3, 3) * 6;
      const steps = 9;
      const spine: Vec3[] = [];
      const half: number[] = [];
      const across: Vec3[] = [];
      for (let i = 0; i <= steps; i++) {
        const s = i / steps;
        const d = len * s;
        spine.push([
          crown[0] + Math.cos(a) * d,
          cy + Math.sin(a) * d,
          crown[2] + 2 + lift * s * 2 - (lift + 24) * s * s,
        ]);
        half.push(9 * Math.sin(Math.PI * Math.min(1, s * 1.05)) ** 0.7 + (s === 0 ? 1.5 : 0));
        across.push([-Math.sin(a), Math.cos(a), 0]);
      }
      blade(m, spine, half, across, k % 2 === 0 ? t.mid : t.deep, 0.35);
    }
  },

  cherry: (m, c) => {
    // A dark trunk splitting into spreading branches, under a wide crown of pink blossom; petals on the ground.
    const cy = trunkY(c);
    const t = TONES.cherry;
    m.lathe(
      0,
      cy,
      [
        { r: 10, z: 0 },
        { r: 7, z: 3 },
        { r: 5.4, z: 14 },
        { r: 4.6, z: 46 },
        { r: 3.6, z: 58 },
      ],
      t.bark,
      { segments: 14 },
    );
    m.tube([0, cy, 50], [-30, cy + 4, 74], 3, t.bark, { r1: 1.4 });
    m.tube([0, cy, 54], [30, cy - 4, 76], 3, t.bark, { r1: 1.4 });
    m.tube([0, cy, 56], [-4, cy - 14, 84], 2.6, t.bark, { r1: 1.2 });
    m.tube([0, cy, 56], [6, cy + 14, 86], 2.6, t.bark, { r1: 1.2 });
    m.sphere(0, cy, 76, 44, 36, 8, t.deep, { segments: 22, rings: 8 });
    foliage(m, 0, cy, 62, 48, 72, 96, t.deep, t.mid, 21);
    foliage(m, 0, cy, 52, 42, 94, 114, t.mid, t.light, 22);
    foliage(m, 0, cy, 34, 28, 112, 128, t.mid, t.light, 23);
    m.sphere(-30, cy + 4, 104, 14, 13, 10, t.light, { segments: 14, rings: 7 });
    m.sphere(28, cy - 6, 108, 13, 12, 10, t.light, { segments: 14, rings: 7 });
    fallen(m, cy, [t.mid, t.light, t.deep], 14, 24);
  },

  maple: (m, c) => {
    const cy = trunkY(c);
    const t = TONES.maple;
    broadleaf(m, cy, { ...t, barkDark: mix(t.bark, 0x000000, 0.3) });
    fallen(m, cy, [t.mid, t.deep, t.light], 16, 31);
  },

  willow: (m, c) => {
    // A stout trunk under a dome of leaves, and curtains of long leaves weeping from its rim almost to the ground,
    // parted at the front so the trunk shows.
    const cy = trunkY(c);
    const t = TONES.willow;
    m.lathe(
      0,
      cy,
      [
        { r: 13, z: 0 },
        { r: 9, z: 3 },
        { r: 7, z: 14 },
        { r: 6, z: 56 },
        { r: 4.6, z: 82 },
      ],
      t.bark,
      { segments: 16 },
    );
    m.tube([0, cy, 70], [-24, cy, 92], 3, t.bark, { r1: 1.6 });
    m.tube([0, cy, 74], [22, cy - 4, 94], 3, t.bark, { r1: 1.6 });
    foliage(m, 0, cy, 50, 44, 84, 112, t.deep, t.mid, 41);
    foliage(m, 0, cy, 38, 33, 108, 128, t.mid, t.light, 42);
    m.sphere(0, cy, 128, 22, 19, 10, t.light, { segments: 18, rings: 8 });
    const strands = 44;
    for (let k = 0; k < strands; k++) {
      const a = (k / strands) * Math.PI * 2 + hash(k, 5, 1) * 0.08;
      // Parted at the front (+y, toward the default camera) so the trunk shows between them.
      if (Math.abs(a - Math.PI / 2) < 0.32) continue;
      const r0 = 38 + hash(k, 5, 2) * 8;
      const z0 = 96 + hash(k, 5, 3) * 8;
      const z1 = 16 + hash(k, 5, 4) * 18;
      const steps = 7;
      const spine: Vec3[] = [];
      const half: number[] = [];
      const across: Vec3[] = [];
      for (let i = 0; i <= steps; i++) {
        const s = i / steps;
        const r = r0 + 9 * Math.sin(s * Math.PI * 0.6);
        spine.push([Math.cos(a) * r, cy + Math.sin(a) * r * 0.88, z0 - (z0 - z1) * s]);
        half.push(4.2 * (1 - 0.6 * s));
        across.push([-Math.sin(a), Math.cos(a), 0]);
      }
      const colour = k % 3 === 0 ? t.light : k % 3 === 1 ? t.mid : t.deep;
      blade(m, spine, half, across, colour);
    }
  },
};

export const TREE_MODELS: ModelTable = {
  tree: (m, c) => SPECIES[treeSpecies(c.variant)](m, c),
};
