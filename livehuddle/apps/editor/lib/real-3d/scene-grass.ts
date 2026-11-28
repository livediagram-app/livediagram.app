// Real 3D's lawns (docs/specs/008-canvas/3d-engine.md "Grass"): every Grass piece grown as a field of blades, in
// clumps, scattered at random (the same for a lawn every time it is drawn), taller and shorter in patches, each blade
// its own shade of the lawn's colour as the floor under it is drawn, shorter where the lawn ends, with a few wild
// flowers. No blade grows through what lies over the lawn (a room's floor, a path, a rug, water, the Avatar Pad).
// Pure: canvas px throughout; grass-field.ts draws the blades.

import {
  defaultFillColor,
  isPlazaPath,
  ownColours,
  type CanvasSurface,
  type Element,
} from '@livehuddle/document';

/** Numbers per blade in `blades`: x, y, yaw, height, width, bend. */
export const BLADE_STRIDE = 6;
/** Numbers per flower in `flowers`: x, y, height, size. */
export const FLOWER_STRIDE = 4;

export type GrassField = {
  count: number;
  /** x, y, yaw, height, width (canvas px; yaw in radians) and bend (how far over it bows, about 0.5 to 1.5) per blade. */
  blades: Float32Array;
  /** r, g, b (0..1) per blade. */
  colours: Float32Array;
  flowerCount: number;
  /** x, y, height, size per flower, canvas px. */
  flowers: Float32Array;
  /** r, g, b (0..1) per flower. */
  flowerColours: Float32Array;
};

/** Canvas px² of lawn per blade: dense enough to hide the ground between blades from the walk's camera. */
export const PX_PER_BLADE = 7;
/** The most blades a scene grows; past it every lawn grows sparser alike. */
export const MAX_BLADES = 160_000;
/** The most wild flowers a scene grows. */
export const MAX_FLOWERS = 4_000;
/** How much wider a sparser lawn's blades grow, at most, so it still reads full. */
const MAX_SPREAD = 1.33;
/** Within this of the lawn's rim or a cover (canvas px), blades grow shorter, down to EDGE_SHORT of their height. */
export const EDGE_FADE = 10;
const EDGE_SHORT = 0.5;
/** How often a clump is a darker, taller tuft. */
const TUFT_CHANCE = 1 / 30;
/** Blades in a clump, and its spread. */
const CLUMP = { min: 2, max: 4, radius: 1.8 };
/** Blade height (canvas px; a character is about 56 tall) and base width. */
const HEIGHT = { min: 5, max: 8 };
const WIDTH = { min: 1.3, max: 2.0 };
/** How far over a blade bows, as a share of the mesh's lean for its height. */
const BEND = { min: 0.45, max: 1.5 };
/** A tuft's extra blades, and how much deeper its green. */
const TUFT_EXTRA = 3;
const TUFT_SHADE = 0.84;
/** The share of a lawn in flower drifts. */
const FLOWER_DRIFT_SHARE = 0.18;
/** How far in from the lawn's edge blades start, so the lawn's soft rim still shows. */
const INSET = 2;

/** How far round a Stage the grass is kept clear, in canvas px. */
const STAGE_CLEAR = 14;

/** The floor pieces no blade grows through (as the flat view's lawn lies under them). */
export const COVERS_GRASS = new Set<string>([
  'room',
  'corridor',
  'office-pod',
  'garden-path',
  'road',
  'rug',
  'stage',
  'pond',
  'swimming-pool',
  'car-park',
  'stairs',
  'avatar-pad',
]);

/** Elements that lie flat on the floor, read from above: no blade grows over them. */
const FLAT_ON_FLOOR = new Set<string>(['text', 'sticky', 'image', 'table', 'code']);

type Box = { x: number; y: number; w: number; h: number };

/** A small fast seeded random (mulberry32), so a lawn grows the same blades every time. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Smooth value noise, 0..1, for patches of taller grass and of lighter and darker green. */
function patchNoise(seed: number) {
  const at = (ix: number, iy: number) => {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = s(x - ix);
    const fy = s(y - iy);
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx;
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
    return a + (b - a) * fy;
  };
}

function rgbOf(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const v = m ? parseInt(m[1]!, 16) : 0x7cb342;
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/** How far inside a lawn's rounded outline (grassEdgePath's corners), less its rim, a point is; negative outside. */
function rimDistance(x: number, y: number, l: Box): number {
  const r = Math.min(28, Math.min(l.w, l.h) * 0.22);
  const lx = x - l.x;
  const ly = y - l.y;
  const cx = Math.min(Math.max(lx, r), l.w - r);
  const cy = Math.min(Math.max(ly, r), l.h - r);
  const side = Math.min(lx, ly, l.w - lx, l.h - ly);
  // In a corner's square the rounded corner decides; elsewhere the nearest side.
  // Math.sqrt over Math.hypot: this runs for every clump, and hypot is several times slower.
  const corner = cx !== lx && cy !== ly ? r - Math.sqrt((lx - cx) ** 2 + (ly - cy) ** 2) : side;
  return Math.min(side, corner) - INSET;
}

/** A smooth 0..1 step. */
function smooth(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}

/**
 * What keeps a patch of lawn clear: a box, the oval inside it (a Pond, whose stones end where its oval does; a round
 * plaza; the Avatar Pad), or the box with its corners rounded by `round` (a Garden Path's rounded ends).
 */
type Cover = Box & { oval?: boolean; round?: number };

/** A covering piece's own outline, as it is drawn on the floor (office-garden.ts, models/pad.ts). */
function coverOf(shape: string, box: Box): Cover {
  if (shape === 'pond') return { ...box, oval: true };
  if (shape === 'garden-path')
    return isPlazaPath(box.w, box.h)
      ? { ...box, oval: true }
      : { ...box, round: Math.min(box.w, box.h) / 2 };
  if (shape === 'avatar-pad') {
    // Round, as wide as the box's narrower side, in its middle.
    const d = Math.min(box.w, box.h);
    return { x: box.x + (box.w - d) / 2, y: box.y + (box.h - d) / 2, w: d, h: d, oval: true };
  }
  return box;
}

function covered(c: Cover, x: number, y: number): boolean {
  if (x < c.x || x > c.x + c.w || y < c.y || y > c.y + c.h) return false;
  if (c.round) return coverDistance(c, x, y) <= 0;
  if (!c.oval) return true;
  const u = (x - c.x) / c.w - 0.5;
  const v = (y - c.y) / c.h - 0.5;
  return u * u + v * v <= 0.25;
}

/** How far a point is from a cover (0 on or in it), never more than the true distance. */
function coverDistance(c: Cover, x: number, y: number): number {
  if (c.oval) {
    const u = (x - c.x) / c.w - 0.5;
    const v = (y - c.y) / c.h - 0.5;
    // In the oval's own units, then at its narrower scale: never past the true distance.
    return Math.max(0, Math.sqrt(u * u + v * v) - 0.5) * Math.min(c.w, c.h);
  }
  // A rounded box: the distance to its inner box (shrunk by the corner radius), less the radius.
  const r = c.round ?? 0;
  const dx = Math.max(c.x + r - x, 0, x - (c.x + c.w - r));
  const dy = Math.max(c.y + r - y, 0, y - (c.y + c.h - r));
  return Math.max(0, Math.sqrt(dx * dx + dy * dy) - r);
}

/** A daisy's petals, a buttercup's, and how they share the drifts. */
const DAISY: [number, number, number] = [0.97, 0.96, 0.92];
const BUTTERCUP: [number, number, number] = [1, 0.84, 0.22];

/** The blades (and wild flowers) of every lawn among `elements`, coloured as the floor is drawn on `surface`. */
export function grassField(
  elements: readonly Element[],
  surface: CanvasSurface = 'light',
): GrassField {
  const lawns: (Box & { id: string; fill: string })[] = [];
  const covers: Cover[] = [];
  for (const el of elements) {
    if (!('width' in el) || !('height' in el)) continue;
    const box = { x: el.x, y: el.y, w: el.width, h: el.height };
    // What lies flat on the floor (a note, a heading, a picture) keeps its patch clear, so it can be read.
    if (el.type !== 'shape') {
      if (FLAT_ON_FLOOR.has(el.type)) covers.push(box);
      continue;
    }
    if (el.shape === 'grass' && el.width > 0 && el.height > 0)
      lawns.push({ ...box, id: el.id, fill: ownColours(el).fill ?? defaultFillColor(el, surface) });
    else if (el.shape === 'stage')
      // A Stage keeps a strip clear all round, so its name plate on the skirt is never hidden in the grass (the
      // owner, 2026-11-27: "on stage sign is under the grass").
      covers.push({
        x: box.x - STAGE_CLEAR,
        y: box.y - STAGE_CLEAR,
        w: box.w + 2 * STAGE_CLEAR,
        h: box.h + 2 * STAGE_CLEAR,
      });
    else if (COVERS_GRASS.has(el.shape)) covers.push(coverOf(el.shape, box));
  }
  const area = lawns.reduce((n, l) => n + l.w * l.h, 0);
  const density = Math.min(1 / PX_PER_BLADE, MAX_BLADES / Math.max(1, area));
  // A lawn grown sparser than full has wider blades, so it still reads full for the same triangles.
  const spread = Math.min(MAX_SPREAD, Math.sqrt(1 / density / PX_PER_BLADE));
  // A tuft adds blades to its clump; the grid widens to match, so the budget holds.
  const meanClump = (CLUMP.min + CLUMP.max) / 2 + TUFT_CHANCE * TUFT_EXTRA;
  const cell = Math.sqrt(meanClump / density);
  // Written straight into typed arrays sized for the most blades the clumps can hold (no growing lists).
  const most = lawns.reduce(
    (n, l) =>
      n + (Math.ceil(l.w / cell) + 1) * (Math.ceil(l.h / cell) + 1) * (CLUMP.max + TUFT_EXTRA),
    0,
  );
  const blades = new Float32Array(most * BLADE_STRIDE);
  const colours = new Float32Array(most * 3);
  const flowers = new Float32Array(MAX_FLOWERS * FLOWER_STRIDE);
  const flowerColours = new Float32Array(MAX_FLOWERS * 3);
  // Wild flowers come one to a clump in a drift, so their share of clumps is set by how many clumps there are.
  const clumps = area * (density / meanClump);
  const flowerChance = Math.min(
    0.3,
    (MAX_FLOWERS * 0.8) / Math.max(1, clumps * FLOWER_DRIFT_SHARE),
  );
  // On dark paper the flowers are dimmed with the lawn, so they never glare.
  const flowerLight = surface === 'dark' ? 0.62 : 1;
  let count = 0;
  let flowerCount = 0;
  for (const lawn of lawns) {
    const seed = hash(lawn.id);
    const rand = seeded(seed);
    const tall = patchNoise(seed ^ 0x9e3779b9);
    const tone = patchNoise(seed ^ 0x85ebca6b);
    const drift = patchNoise(seed ^ 0xc2b2ae35);
    const bloom = patchNoise(seed ^ 0x27d4eb2f);
    const base = rgbOf(lawn.fill);
    // Clumps on a jittered grid, so the lawn is filled evenly but never in rows.
    const under = covers.filter(
      (c) =>
        c.x < lawn.x + lawn.w && c.x + c.w > lawn.x && c.y < lawn.y + lawn.h && c.y + c.h > lawn.y,
    );
    const reach = CLUMP.radius * spread;
    for (let gy = lawn.y; gy < lawn.y + lawn.h; gy += cell) {
      for (let gx = lawn.x; gx < lawn.x + lawn.w; gx += cell) {
        const cx = gx + rand() * cell;
        const cy = gy + rand() * cell;
        const tuft = rand() < TUFT_CHANCE;
        const n =
          CLUMP.min + Math.floor(rand() * (CLUMP.max - CLUMP.min + 1)) + (tuft ? TUFT_EXTRA : 0);
        // How far the clump stands from the lawn's rim and from what covers it: far enough, and none of its blades
        // need testing one by one; near, and its blades grow shorter, so the lawn thins softly into a path or a room.
        let clear = rimDistance(cx, cy, lawn);
        for (const c of under) if (clear > 0) clear = Math.min(clear, coverDistance(c, cx, cy));
        if (clear < -reach) continue;
        const exact = clear <= reach;
        const edge = EDGE_SHORT + (1 - EDGE_SHORT) * smooth(clear / EDGE_FADE);
        // A gentle unevenness (the owner, 2026-11-27: "its all patchy"): height and shade vary a little, never in blotches.
        const tallness = (0.88 + 0.22 * tall(cx / 90, cy / 90)) * edge * (tuft ? 1.2 : 1);
        const shade = tone(cx / 45, cy / 45);
        // Broad drifts of warmer and cooler green across a big lawn.
        const hue = (drift(cx / 260, cy / 260) - 0.5) * 0.12;
        const lean = rand() * Math.PI * 2;
        for (let i = 0; i < n; i++) {
          const a = rand() * Math.PI * 2;
          const d = Math.sqrt(rand()) * reach;
          const x = cx + Math.cos(a) * d;
          const y = cy + Math.sin(a) * d;
          if (exact && (rimDistance(x, y, lawn) < 0 || under.some((c) => covered(c, x, y))))
            continue;
          const h = (HEIGHT.min + rand() * (HEIGHT.max - HEIGHT.min)) * tallness;
          // Blades fan out from the clump's middle, each its own way.
          const yaw = a + (rand() - 0.5) * 1.2 + (rand() < 0.5 ? lean : 0) * 0.3;
          const o = count * BLADE_STRIDE;
          blades[o] = x;
          blades[o + 1] = y;
          blades[o + 2] = yaw;
          blades[o + 3] = h;
          blades[o + 4] = (WIDTH.min + rand() * (WIDTH.max - WIDTH.min)) * spread;
          // Some blades stand nearly upright, some bow well over.
          blades[o + 5] = BEND.min + rand() * (BEND.max - BEND.min);
          // Each blade its own shade: the lawn's colour, darker or lighter by patch, a tuft deeper, now and then a
          // dry one.
          const light = (0.95 + 0.08 * shade + (rand() - 0.5) * 0.08) * (tuft ? TUFT_SHADE : 1);
          const dry = !tuft && rand() < 0.02 ? 0.25 : 0;
          const warm = (rand() - 0.5) * 0.06 + hue;
          const k = count * 3;
          colours[k] = Math.min(1, (base[0] + dry * (0.78 - base[0]) + warm) * light);
          colours[k + 1] = Math.min(1, (base[1] + dry * (0.72 - base[1]) + hue * 0.25) * light);
          colours[k + 2] = Math.min(1, (base[2] + dry * (0.38 - base[2]) - warm) * light * 0.92);
          count++;
        }
        // Now and then a wild flower, in drifts: a daisy mostly, a buttercup in its own patches.
        const b = bloom(cx / 150, cy / 150);
        if (
          b > 1 - FLOWER_DRIFT_SHARE &&
          flowerCount < MAX_FLOWERS &&
          clear > 3 &&
          rand() < flowerChance
        ) {
          const f = flowerCount * FLOWER_STRIDE;
          flowers[f] = cx;
          flowers[f + 1] = cy;
          flowers[f + 2] = (HEIGHT.min + rand() * (HEIGHT.max - HEIGHT.min)) * tallness * 1.15;
          flowers[f + 3] = 2.4 + rand() * 1.0;
          const petals = tone(cx / 30 + 7, cy / 30) > 0.62 ? BUTTERCUP : DAISY;
          const k = flowerCount * 3;
          flowerColours[k] = petals[0] * flowerLight;
          flowerColours[k + 1] = petals[1] * flowerLight;
          flowerColours[k + 2] = petals[2] * flowerLight;
          flowerCount++;
        }
      }
    }
  }
  return {
    count,
    blades: blades.subarray(0, count * BLADE_STRIDE),
    colours: colours.subarray(0, count * 3),
    flowerCount,
    flowers: flowers.subarray(0, flowerCount * FLOWER_STRIDE),
    flowerColours: flowerColours.subarray(0, flowerCount * 3),
  };
}

/** What a scene's lawns depend on (their boxes and colours and what covers them), so grass regrows only when it changes. */
export function grassKey(elements: readonly Element[]): string {
  const parts: string[] = [];
  for (const el of elements) {
    if (!('width' in el)) continue;
    const covers = el.type === 'shape' ? COVERS_GRASS.has(el.shape) : FLAT_ON_FLOOR.has(el.type);
    const lawn = el.type === 'shape' && el.shape === 'grass';
    if (!lawn && !covers) continue;
    const fill = lawn ? (ownColours(el).fill ?? '') : '';
    parts.push(`${el.id}:${el.x},${el.y},${el.width},${el.height}:${fill}`);
  }
  return parts.join('|');
}

/** Whether grass grows at a canvas point (inside a lawn, under nothing that covers it): what stands there stands in it. */
export function onLawn(elements: readonly Element[], x: number, y: number): boolean {
  let lawn = false;
  for (const el of elements) {
    if (el.type !== 'shape' || !('width' in el)) continue;
    const inside = x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height;
    if (!inside) continue;
    if (el.shape === 'grass') lawn = true;
    else if (
      COVERS_GRASS.has(el.shape) &&
      covered(coverOf(el.shape, { x: el.x, y: el.y, w: el.width, h: el.height }), x, y)
    )
      return false;
  }
  return lawn;
}
