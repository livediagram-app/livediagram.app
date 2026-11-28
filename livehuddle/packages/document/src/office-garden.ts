// The Office Pod, the bar and the garden (docs/specs/009-elements/office.md "Office Pod" to "Garden Fence"): their
// drawings, as tables of parts in the furniture's vocabulary (seating.ts), drawn upright from the room's camera like
// the rest of the office, which both renderers paint (the editor's views and svg-render-faces). The grid pieces join
// OFFICE_ART (office.ts); the garden path, grass and the garden fence are drawn to their own size, as a room is. The
// geometry the walk needs (the pod's seats, walls and door, the footprints) is @livehuddle/avatar's. The pod's drawings
// are office-pod-art.ts, the bar's office-bar-art.ts and the fixed colours garden-tones.ts; this file re-exports them.
// Pure: no React, no DOM.

import type { FurnitureDrawing, FurniturePart } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';
import { fenceRun } from '@livehuddle/avatar/fence';
import { flagstone, gravelSpecks } from './garden-ground';
import { GARDEN_TONES } from './garden-tones';
import { OFFICE_POD_BACK, OFFICE_POD_SIDE, OFFICE_POD_VIEW } from './office-pod-art';
import {
  BAR_BACK,
  BAR_SIDE,
  BAR_STOOL_VIEW,
  BAR_VIEW,
  DRINKS_CABINET_BACK,
  DRINKS_CABINET_SIDE,
  DRINKS_CABINET_VIEW,
  DRINKS_FRIDGE_BACK,
  DRINKS_FRIDGE_SIDE,
  DRINKS_FRIDGE_VIEW,
} from './office-bar-art';

export {
  GARDEN_PATH_FILL,
  GARDEN_PATH_FILL_DARK,
  GARDEN_TONES,
  GRASS_FILL,
  GRASS_FILL_DARK,
} from './garden-tones';
export {
  OFFICE_POD_VIEW,
  POD_DOOR,
  POD_DOORS,
  podFurniture,
  type PodDoorView,
  type PodFurnitureGroup,
} from './office-pod-art';
export { BAR_STOOL_VIEW } from './office-bar-art';

const T = GARDEN_TONES;

// --- The garden -----------------------------------------------------------------------------------------------

// A round leafy shrub with a few flowers, in a stone planter.
const OUTDOOR_PLANT_VIEW: FurnitureDrawing = {
  width: 72,
  height: 80,
  parts: [
    ellipse('shadow', 36, 77, 26, 3),
    ellipse('panel', 36, 36, 31, 22, T.leafDeep),
    ellipse('panel', 22, 32, 15, 13, T.leaf),
    ellipse('panel', 50, 30, 15, 13, T.leaf),
    ellipse('panel', 36, 20, 16, 13, T.leaf),
    ellipse('panel', 24, 24, 3, 3, T.pink),
    ellipse('panel', 46, 18, 3, 3, T.yellow),
    ellipse('panel', 54, 34, 3, 3, T.pink),
    ellipse('panel', 32, 40, 3, 3, T.yellow),
    rect('panel', 12, 52, 48, 8, 3, T.stone),
    path('panel', 'M15 59H57L53 76H19Z', T.stoneDeep),
  ],
  seats: [],
};

// A trunk under a full round canopy, a soft shadow on the ground.
const TREE_VIEW: FurnitureDrawing = {
  width: 120,
  height: 160,
  parts: [
    ellipse('shadow', 60, 151, 46, 6),
    path('panel', 'M51 152C54 130 55 112 51 92H69C65 112 66 130 69 152Z', T.bark),
    path('rail', 'M58 140V104M63 132V112'),
    path('panel', 'M51 152C46 152 42 154 40 156H80C78 154 74 152 69 152Z', T.barkDeep),
    ellipse('panel', 60, 64, 54, 46, T.leafDark),
    ellipse('panel', 38, 62, 26, 24, T.leafDeep),
    ellipse('panel', 82, 60, 26, 24, T.leafDeep),
    ellipse('panel', 60, 40, 34, 28, T.leaf),
    ellipse('panel', 42, 36, 16, 14, T.leaf),
    ellipse('panel', 78, 34, 16, 14, T.leaf),
    path('glint', 'M48 30C52 24 58 22 64 22'),
  ],
  seats: [],
};

/** The grid pieces this module draws, for OFFICE_ART. */
export const OFFICE_EXTRA_ART = {
  'office-pod': { front: OFFICE_POD_VIEW, back: OFFICE_POD_BACK, side: OFFICE_POD_SIDE },
  bar: { front: BAR_VIEW, back: BAR_BACK, side: BAR_SIDE },
  // Round: it reads the same from every side, and only its sitter turns (seats.ts SEAT_VIEWS).
  'bar-stool': allSides(BAR_STOOL_VIEW),
  'drinks-cabinet': {
    front: DRINKS_CABINET_VIEW,
    back: DRINKS_CABINET_BACK,
    side: DRINKS_CABINET_SIDE,
  },
  'drinks-fridge': {
    front: DRINKS_FRIDGE_VIEW,
    back: DRINKS_FRIDGE_BACK,
    side: DRINKS_FRIDGE_SIDE,
  },
  'outdoor-plant': allSides(OUTDOOR_PLANT_VIEW),
  tree: allSides(TREE_VIEW),
} as const;

// --- Drawn to their size --------------------------------------------------------------------------------------

// A path whose longer side is at most this times its shorter is a round plaza (docs/specs/009-elements/office.md
// "Garden Path").
export const PLAZA_RATIO = 1.25;
// Every stone stays this share of the path's width in from each end, so its rounded ends are bare gravel and a path
// ending under another never shows a stone there.
export const PATH_STONE_INSET = 0.7;

/** Whether a path of this size draws as a round plaza. */
export function isPlazaPath(width: number, height: number): boolean {
  return Math.max(width, height) <= PLAZA_RATIO * Math.min(width, height);
}

/**
 * A garden path's drawing, in its own px (docs/specs/009-elements/office.md "Garden Path"): a rounded strip of gravel in
 * the element's fill (the floor), stepping stones evenly along its longer side, each the same size however long the
 * path and every one whole, kept back from both ends. About square, it is a round plaza instead (plazaParts).
 */
export function gardenPathParts(width: number, height: number): FurniturePart[] {
  if (width <= 0 || height <= 0) return [];
  if (isPlazaPath(width, height)) return plazaParts(width, height);
  const { thickness } = fenceRun({ width, height });
  const r = thickness / 2;
  const parts: FurniturePart[] = [rect('floor', 0, 0, width, height, r)];
  // The gravel: specks of light and shadow over the bed, inside its rounded ends.
  const inBed = (x: number, y: number) => {
    const ex = Math.max(r, Math.min(width - r, x));
    const ey = Math.max(r, Math.min(height - r, y));
    return Math.hypot(x - ex, y - ey) < r - 1.5;
  };
  parts.push(...gravel(width, height, inBed));
  // The bed's edging: a soft darker line round it.
  parts.push(rect('rail', 0.75, 0.75, width - 1.5, height - 1.5, r - 0.75, GARDEN_EDGE));
  // The stepping stones: flagstones cut by hand, each on its own soft shadow.
  pathStones(width, height).forEach((s, i) => {
    const d = flagstone(s.cx, s.cy, s.rx, s.ry, i + Math.round(width + height));
    parts.push(
      path(
        'mark',
        d.replace(/^M([\d.-]+) ([\d.-]+)/, (_, x, y) => `M${x} ${+y + 1.2}`),
        STONE_SHADOW,
      ),
    );
    parts.push(path('panel', d, T.stone));
  });
  return parts;
}

// The gravel's specks as two marks, light and shadow.
function gravel(width: number, height: number, inside: (x: number, y: number) => boolean) {
  const { light, dark } = gravelSpecks(width, height, Math.round(width * 3 + height), inside);
  const out: FurniturePart[] = [];
  if (dark) out.push(path('mark', dark, GRAVEL_DARK));
  if (light) out.push(path('mark', light, GRAVEL_LIGHT));
  return out;
}

// The gravel's tints and a stone's shadow: alpha over the bed's fill, so they suit any fill and either paper.
const GRAVEL_DARK = '#00000030';
const GRAVEL_LIGHT = '#ffffff38';
const GARDEN_EDGE = '#00000040';
const STONE_SHADOW = '#00000038';

/**
 * Where a path's stepping stones lie, as the ellipse each stone is cut inside: evenly along its longer side, each the
 * same size however long the path and every one whole, kept back from both ends.
 */
export function pathStones(
  width: number,
  height: number,
): { cx: number; cy: number; rx: number; ry: number }[] {
  if (width <= 0 || height <= 0 || isPlazaPath(width, height)) return [];
  const { horizontal, length, thickness } = fenceRun({ width, height });
  const rx = thickness * 0.3;
  const ry = thickness * 0.24;
  const pitch = thickness * 0.95;
  // The first and last stone's middles: each stone's end PATH_STONE_INSET widths in from the path's end.
  const first = thickness * PATH_STONE_INSET + rx;
  const last = length - first;
  // Spaced at least 0.7 of a pitch, so the stones never touch; a path with no room for two holds one in its middle.
  const count = last - first >= pitch * 0.7 ? Math.round((last - first) / pitch) + 1 : 1;
  const step = count > 1 ? (last - first) / (count - 1) : 0;
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const along = count > 1 ? first + step * i : length / 2;
    // Every other stone sits a little off the middle, so the stones read as laid by hand.
    const across = thickness / 2 + (i % 2 === 0 ? -1 : 1) * thickness * 0.06;
    const [cx, cy] = horizontal ? [along, across] : [across, along];
    out.push({ cx, cy, rx: horizontal ? rx : ry, ry: horizontal ? ry : rx });
  }
  return out;
}

/**
 * A round plaza filling the box: paving in the element's fill, a kerb just inside the rim, an inner ring and a ring of
 * small setts between them, the middle left open. The setts are whole and evenly spaced round the ring, however big.
 */
function plazaParts(width: number, height: number): FurniturePart[] {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const kerb = Math.min(6, Math.min(rx, ry) * 0.08);
  const parts: FurniturePart[] = [
    ellipse('floor', cx, cy, rx, ry),
    ...gravel(
      width,
      height,
      (x, y) => ((x - cx) / (rx - kerb)) ** 2 + ((y - cy) / (ry - kerb)) ** 2 < 1,
    ),
    ellipse('rail', cx, cy, rx - kerb, ry - kerb, GARDEN_EDGE),
    ellipse('rail', cx, cy, rx * 0.62, ry * 0.62, GARDEN_EDGE),
  ];
  // The setts' ring halfway between the inner ring and the kerb.
  const ring = (0.62 + (1 - kerb / Math.min(rx, ry))) / 2;
  const size = Math.min(rx, ry) * 0.07;
  const around = Math.PI * (rx + ry) * ring;
  const count = Math.max(6, Math.floor(around / (size * 4)));
  for (let i = 0; i < count; i += 1) {
    const a = (2 * Math.PI * i) / count;
    const sx = cx + Math.cos(a) * rx * ring;
    const sy = cy + Math.sin(a) * ry * ring;
    // Each sett a small flagstone of its own, inside the circle it is laid in.
    parts.push(path('panel', flagstone(sx, sy, size, size, i), T.stone));
  }
  return parts;
}

/**
 * Grass's outline, as SVG path data in its own px: a rounded lawn whose sides swell gently to the element's edge, so
 * it reads as grown rather than cut. A fixed handful of curves whatever its size. Empty when it has no area.
 */
export function grassEdgePath(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '';
  const w = width;
  const h = height;
  const r = Math.min(28, Math.min(w, h) * 0.22);
  // How far the corners sit in from the edge the sides swell out to.
  const b = Math.min(3, Math.min(w, h) * 0.04);
  const n = (v: number) => Math.round(v * 100) / 100;
  return (
    `M${n(r)} ${n(b)}Q${n(w / 2)} ${n(-b)} ${n(w - r)} ${n(b)}` +
    `Q${n(w - b)} ${n(b)} ${n(w - b)} ${n(r)}` +
    `Q${n(w + b)} ${n(h / 2)} ${n(w - b)} ${n(h - r)}` +
    `Q${n(w - b)} ${n(h - b)} ${n(w - r)} ${n(h - b)}` +
    `Q${n(w / 2)} ${n(h + b)} ${n(r)} ${n(h - b)}` +
    `Q${n(b)} ${n(h - b)} ${n(b)} ${n(h - r)}` +
    `Q${n(-b)} ${n(h / 2)} ${n(b)} ${n(r)}` +
    `Q${n(b)} ${n(b)} ${n(r)} ${n(b)}Z`
  );
}

// Roughly how far apart the pickets stand, in canvas px.
const PICKET_PITCH = 14;

/**
 * A garden fence's drawing, in its own px: two rails along its longer side and pointed white pickets across them,
 * evenly spaced end to end. A tall (vertical) one is seen from above: its pickets are their tops on the rails.
 */
export function gardenFenceParts(width: number, height: number): FurniturePart[] {
  if (width <= 0 || height <= 0) return [];
  const { horizontal, length, thickness } = fenceRun({ width, height });
  const count = Math.max(2, Math.round(length / PICKET_PITCH) + 1);
  const pw = Math.min(thickness * 0.4, PICKET_PITCH * 0.6);
  const step = (length - pw) / (count - 1);
  const parts: FurniturePart[] = [];
  if (horizontal) {
    parts.push(ellipse('shadow', length / 2, thickness - 2, length / 2, 2.5));
    for (const top of [0.34, 0.64])
      parts.push(rect('panel', 0, thickness * top, length, thickness * 0.12, 1, T.picket));
    const point = Math.min(pw * 0.6, thickness * 0.2);
    for (let i = 0; i < count; i += 1) {
      const x = i * step;
      parts.push(
        path(
          'panel',
          `M${x} ${point}L${x + pw / 2} 0L${x + pw} ${point}V${thickness - 3}H${x}Z`,
          T.picket,
        ),
      );
    }
    return parts;
  }
  for (const left of [0.3, 0.58])
    parts.push(rect('panel', thickness * left, 0, thickness * 0.12, length, 1, T.picket));
  for (let i = 0; i < count; i += 1)
    parts.push(rect('panel', thickness * 0.25, i * step, thickness * 0.5, pw, 1.5, T.picket));
  return parts;
}
