// The Office Pod's drawings (docs/specs/009-elements/office.md "Office Pod"): its three views as tables of parts in the
// furniture's vocabulary (seating.ts), its doorway on each, and which of its parts are furniture the 3D view stands up.
// office-garden.ts re-exports what it shares. Pure: no React, no DOM.

import type { FurnitureDrawing, FurniturePart } from './seating';
import { ellipse, path, rect } from './furniture-parts';
import { POD_SEATS, POD_SEATS_BACK, POD_SEATS_SIDE, type SeatView } from '@livehuddle/avatar/seats';
import { POD_DOOR_SPAN, POD_SIDE_DOOR_SPAN } from '@livehuddle/avatar/pod';
import { GARDEN_TONES as T } from './garden-tones';

// --- The Office Pod -------------------------------------------------------------------------------------------

const [DOOR_FROM, DOOR_TO] = POD_DOOR_SPAN;
const [SIDE_DOOR_FROM, SIDE_DOOR_TO] = POD_SIDE_DOOR_SPAN;

/**
 * The pod's sliding door on a drawing's grid, shut: a glass panel across the doorway, and the way it slides open
 * (`open`, in grid units) to sit behind the wall. The views slide it open. In the front drawing it is the front
 * wall's top seen from above and slides right; from behind it stands in the far wall's face, seen face on, and slides
 * to your left (the front's right, turned round); on its side it runs down the left wall and slides toward you.
 */
export type PodDoorView = {
  x: number;
  y: number;
  w: number;
  h: number;
  open: { x: number; y: number };
};
export const POD_DOORS: Readonly<Record<SeatView, PodDoorView>> = {
  front: {
    x: DOOR_FROM,
    y: 134,
    w: DOOR_TO - DOOR_FROM,
    h: 9,
    open: { x: DOOR_TO - DOOR_FROM, y: 0 },
  },
  back: {
    x: DOOR_FROM,
    y: 7,
    w: DOOR_TO - DOOR_FROM,
    h: 30,
    open: { x: DOOR_FROM - DOOR_TO, y: 0 },
  },
  side: {
    x: 0,
    y: SIDE_DOOR_FROM,
    w: 9,
    h: SIDE_DOOR_TO - SIDE_DOOR_FROM,
    open: { x: 0, y: SIDE_DOOR_TO - SIDE_DOOR_FROM },
  },
};
/** The front drawing's door. */
export const POD_DOOR = POD_DOORS.front;

// A booth for two: a back wall with a window in its face, side walls, a front wall with a doorway, two padded
// benches facing each other across a little table. The door is not a part: it moves with who sits in it.
export const OFFICE_POD_VIEW: FurnitureDrawing = {
  width: POD_SEATS.width,
  height: POD_SEATS.height,
  parts: [
    ellipse('shadow', 88, 141, 86, 4),
    rect('floor', 6, 30, 164, 108, 2, T.podCarpet),
    // The back wall: its top, its face with a window.
    rect('panel', 0, 0, 176, 8, 2, T.podWall),
    rect('face', 0, 7, 176, 30, 1, T.podTrim),
    rect('panel', 58, 12, 60, 18, 3, T.glass),
    path('glint', 'M64 26L72 16M72 26L80 16'),
    // The benches, each a backrest against its side wall and a cushion.
    rect('panel', 9, 54, 9, 56, 3, T.cushionDeep),
    rect('panel', 16, 60, 30, 48, 5, T.cushion),
    path('rail', 'M20 84H42'),
    rect('panel', 158, 54, 9, 56, 3, T.cushionDeep),
    rect('panel', 130, 60, 30, 48, 5, T.cushion),
    path('rail', 'M134 84H156'),
    // The table between them, a mug on it.
    path('line', 'M74 100v14M102 100v14', T.woodDeep),
    rect('panel', 64, 66, 48, 30, 4, T.oak),
    rect('face', 64, 94, 48, 8, 3, T.wood),
    rect('panel', 82, 72, 8, 9, 2, T.glass),
    // The side walls, then the front wall either side of the doorway, its frame posts.
    rect('panel', 0, 0, 8, 144, 2, T.podWall),
    rect('panel', 168, 0, 8, 144, 2, T.podWall),
    rect('panel', 0, 136, DOOR_FROM, 8, 2, T.podWall),
    rect('panel', DOOR_TO, 136, 176 - DOOR_TO, 8, 2, T.podWall),
    rect('panel', DOOR_FROM - 4, 128, 6, 16, 2, T.podWall),
    rect('panel', DOOR_TO - 2, 128, 6, 16, 2, T.podWall),
  ],
  seats: POD_SEATS.seats.map(({ u, v }) => ({ u, v })),
};

// What of a pod's drawing is its furniture (its benches, their seams, its table and the mug on it), as opposed to
// its floor and walls: the 3D view stands the furniture up inside the walls (3d-view.md "Which pieces").
const POD_FURNITURE_FILLS: ReadonlySet<string> = new Set([
  T.cushion,
  T.cushionDeep,
  T.oak,
  T.wood,
  T.woodDeep,
]);

/** One piece of a pod's furniture (a bench, the table with its mug): its parts, its middle across and its foot. */
export type PodFurnitureGroup = { indices: number[]; foot: number; middle: number };

/** Parts closer than this in the drawing's px, either way, are one piece of furniture. */
const POD_GROUP_GAP = 2;

type Span = { i: number; left: number; right: number; top: number; bottom: number };

/**
 * A pod drawing's furniture: the indices of its parts and the line they stand on (the lowest edge among them, in the
 * drawing's px), and the same split into its pieces (`groups`: parts whose boxes overlap, chained), each of which the
 * 3D view stands up about its own foot and middle, so the far bench stands on the floor rather than floating over it
 * and a turned camera turns each piece where it stands rather than swinging them round the pod's middle (the owner,
 * 2026-11-25).
 */
export function podFurniture(parts: readonly FurniturePart[]): {
  indices: number[];
  foot: number;
  groups: PodFurnitureGroup[];
} {
  const indices: number[] = [];
  const spans: Span[] = [];
  let foot = 0;
  parts.forEach((p, i) => {
    const mug = p.tag === 'rect' && p.fill === T.glass && p.w <= 8 && p.h <= 9;
    if (!(p.role === 'rail' || mug || (p.fill !== undefined && POD_FURNITURE_FILLS.has(p.fill))))
      return;
    indices.push(i);
    const span = spanOf(p, i);
    spans.push(span);
    foot = Math.max(foot, span.bottom);
  });
  // Union the overlapping boxes.
  const root = spans.map((_, k) => k);
  const find = (k: number): number => {
    while (root[k] !== k) k = root[k] = root[root[k]!]!;
    return k;
  };
  const g = POD_GROUP_GAP;
  for (let a = 0; a < spans.length; a++)
    for (let b = a + 1; b < spans.length; b++) {
      const s = spans[a]!;
      const t = spans[b]!;
      if (
        s.left <= t.right + g &&
        t.left <= s.right + g &&
        s.top <= t.bottom + g &&
        t.top <= s.bottom + g
      )
        root[find(a)] = find(b);
    }
  const byRoot = new Map<number, Span[]>();
  spans.forEach((s, k) => {
    const r = find(k);
    byRoot.set(r, [...(byRoot.get(r) ?? []), s]);
  });
  const groups: PodFurnitureGroup[] = [...byRoot.values()].map((members) => ({
    indices: members.map((m) => m.i).sort((x, y) => x - y),
    foot: Math.max(...members.map((m) => m.bottom)),
    middle:
      (Math.min(...members.map((m) => m.left)) + Math.max(...members.map((m) => m.right))) / 2,
  }));
  // Far pieces first, so a near one is drawn over them.
  groups.sort((x, y) => x.foot - y.foot);
  return { indices, foot, groups };
}

// A part's box in the drawing's px: a rect's and an ellipse's exactly, a path's from its absolute points and its
// relative runs.
function spanOf(p: FurniturePart, i: number): Span {
  if (p.tag === 'rect') return { i, left: p.x, right: p.x + p.w, top: p.y, bottom: p.y + p.h };
  if (p.tag === 'ellipse')
    return { i, left: p.cx - p.rx, right: p.cx + p.rx, top: p.cy - p.ry, bottom: p.cy + p.ry };
  let x = 0;
  let y = 0;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const m of p.d.matchAll(/([MLHVQvh])([^MLHVQvh]*)/g)) {
    const nums = (m[2]!.match(/-?[\d.]+/g) ?? []).map(Number);
    if (m[1] === 'M' || m[1] === 'L') {
      x = nums[0] ?? x;
      y = nums[1] ?? y;
    } else if (m[1] === 'H') x = nums[0] ?? x;
    else if (m[1] === 'V') y = nums[0] ?? y;
    else if (m[1] === 'h') x += nums[0] ?? 0;
    else if (m[1] === 'v') y += nums[0] ?? 0;
    else if (m[1] === 'Q') {
      x = nums[2] ?? x;
      y = nums[3] ?? y;
    }
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  return Number.isFinite(left)
    ? { i, left, right, top, bottom: Math.max(bottom, lowest(p.d)) }
    : { i, left: 0, right: 0, top: 0, bottom: lowest(p.d) };
}

// The lowest y a part's path reaches: its absolute points and the ends of its relative vertical runs.
function lowest(d: string): number {
  let y = 0;
  let max = 0;
  for (const m of d.matchAll(/([MLHVQvh])([^MLHVQvh]*)/g)) {
    const nums = (m[2]!.match(/-?[\d.]+/g) ?? []).map(Number);
    if (m[1] === 'M' || m[1] === 'L') y = nums[1] ?? y;
    else if (m[1] === 'V') y = nums[0] ?? y;
    else if (m[1] === 'v') y += nums[0] ?? 0;
    else if (m[1] === 'Q') y = nums[3] ?? y;
    max = Math.max(max, y);
  }
  return max;
}

// Its back to you: the doorway now in the far wall, its face broken by it and the ground outside showing through;
// the benches have swapped sides; the window wall nearest you, seen from above, its glass along its top.
export const OFFICE_POD_BACK: FurnitureDrawing = {
  ...POD_SEATS_BACK,
  parts: [
    ellipse('shadow', 88, 141, 86, 4),
    rect('floor', 6, 30, 164, 108, 2, T.podCarpet),
    rect('floor', DOOR_FROM, 4, DOOR_TO - DOOR_FROM, 30, 0, T.podCarpet),
    // The far wall either side of the doorway: its top, its face, and the doorway's posts.
    rect('panel', 0, 0, DOOR_FROM, 8, 2, T.podWall),
    rect('panel', DOOR_TO, 0, 176 - DOOR_TO, 8, 2, T.podWall),
    rect('face', 0, 7, DOOR_FROM, 30, 1, T.podTrim),
    rect('face', DOOR_TO, 7, 176 - DOOR_TO, 30, 1, T.podTrim),
    // The benches.
    rect('panel', 9, 54, 9, 56, 3, T.cushionDeep),
    rect('panel', 16, 60, 30, 48, 5, T.cushion),
    path('rail', 'M20 84H42'),
    rect('panel', 158, 54, 9, 56, 3, T.cushionDeep),
    rect('panel', 130, 60, 30, 48, 5, T.cushion),
    path('rail', 'M134 84H156'),
    // The table, its mug at the other end.
    path('line', 'M74 100v14M102 100v14', T.woodDeep),
    rect('panel', 64, 66, 48, 30, 4, T.oak),
    rect('face', 64, 94, 48, 8, 3, T.wood),
    rect('panel', 86, 72, 8, 9, 2, T.glass),
    // The side walls, the near wall with its window, the doorway's posts.
    rect('panel', 0, 0, 8, 144, 2, T.podWall),
    rect('panel', 168, 0, 8, 144, 2, T.podWall),
    rect('panel', 0, 136, 176, 8, 2, T.podWall),
    rect('panel', 58, 138, 60, 4, 1.5, T.glass),
    rect('panel', DOOR_FROM - 4, 0, 6, 38, 2, T.podWall),
    rect('panel', DOOR_TO - 2, 0, 6, 38, 2, T.podWall),
  ],
};

// Facing left: the doorway down its left wall, the window wall down its right, the far wall's face along its top;
// the benches run across it, one under the far wall facing you, one against the near wall with its back to you, the
// table between them.
export const OFFICE_POD_SIDE: FurnitureDrawing = {
  ...POD_SEATS_SIDE,
  parts: [
    ellipse('shadow', 72, 173, 70, 4),
    rect('floor', 6, 30, 132, 140, 2, T.podCarpet),
    // The far wall: its top, its face.
    rect('panel', 0, 0, 144, 8, 2, T.podWall),
    rect('face', 0, 7, 144, 30, 1, T.podTrim),
    // The far bench: its backrest standing against the wall, its cushion.
    rect('panel', 44, 26, 56, 22, 4, T.cushionDeep),
    rect('panel', 46, 42, 52, 28, 5, T.cushion),
    path('rail', 'M72 46V66'),
    // The table, a mug on it.
    path('line', 'M56 118v12M88 118v12', T.woodDeep),
    rect('panel', 50, 84, 44, 30, 4, T.oak),
    rect('face', 50, 112, 44, 8, 3, T.wood),
    rect('panel', 58, 90, 8, 9, 2, T.glass),
    // The near bench: its cushion beyond, its backrest's back nearest you.
    rect('panel', 46, 132, 52, 22, 5, T.cushion),
    path('rail', 'M72 136V150'),
    rect('face', 44, 148, 56, 18, 4, T.cushionDeep),
    // The window wall, the near wall, the doorway's wall either side of it and its posts.
    rect('panel', 136, 0, 8, 176, 2, T.podWall),
    rect('panel', 138, 62, 4, 72, 1.5, T.glass),
    rect('panel', 0, 168, 144, 8, 2, T.podWall),
    rect('panel', 0, 0, 8, SIDE_DOOR_FROM, 2, T.podWall),
    rect('panel', 0, SIDE_DOOR_TO, 8, 176 - SIDE_DOOR_TO, 2, T.podWall),
    rect('panel', 0, SIDE_DOOR_FROM - 4, 16, 6, 2, T.podWall),
    rect('panel', 0, SIDE_DOOR_TO - 2, 16, 6, 2, T.podWall),
  ],
};
