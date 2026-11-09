// Fences in Avatar mode (docs/specs/009-elements/fence.md "Blocking"): the pure maths that stops a
// walking character at a fence. No React, no DOM, so the rule is unit-testable without a canvas.
//
// Each fence blocks a CAPSULE: every point within FENCE_REACH of its line. A step that would enter
// a capsule from outside is refused, tested against the whole step rather than where it lands, so
// a fast step cannot tunnel through, and two fences whose ends are closer than twice the reach leave
// no gap to squeeze through. A refused step slides along the fence instead, the way people walk
// along a wall.

import { distToSegment, type Rect } from '@liveworkspace/model-core/geometry-primitives';
import { segmentDistance as sharedSegmentDistance } from '@liveworkspace/model-core/segment-geometry';
import { fenceLine, type FencePoint } from './fence';
import { boxEdges, officeFootprint, roomWalls } from './office-geometry';
import { cutByDoors, doorLine } from './room-outline';
import { corridorWalls } from './corridor';
import { podWalls } from './pod';
import { isSceneShape, type AvatarSceneElement } from './scene';

// How close a character's feet may come to a fence's line, in canvas px: about the feet's own
// half-width, so a character stops AT a fence rather than standing in it. Measured on the Regular
// character (its sprite scale, FENCE_REACH_SCALE); a Small or Tall one keeps its own feet's width.
export const FENCE_REACH = 12;
const FENCE_REACH_SCALE = 1.5;

/** The reach of a character drawn at `scale` (avatarScale of its Size). */
export function fenceReachFor(scale: number): number {
  return (FENCE_REACH * scale) / FENCE_REACH_SCALE;
}

// Progress smaller than this share of the frame's own step is no progress: a click-walk pressed
// against a fence stops, and a step meeting a fence this close to head-on does not slide. A share of
// the step, not a distance, so a display's refresh rate (a 4.3 px step a frame at 60 Hz, 1.1 px at
// 240 Hz) never decides whether a walk slides. 0.06 is the 0.25 px of a 60 Hz step it replaced: about
// 3.4 degrees off head-on.
const FENCE_STALL_SHARE = 0.06;

/** Whether a frame that moved `moved` px of a wanted `step` px made no progress. */
export function fenceStalled(moved: number, step: number): boolean {
  return moved < FENCE_STALL_SHARE * step;
}

// `solid`: the footprint a scenery edge outlines (office.md), which a character can be inside of, unlike a line.
export type FenceSegment = { a: FencePoint; b: FencePoint; solid?: Rect };

/** How far inside a box a point is: its distance to the nearest side, negative outside. */
function depthIn(p: FencePoint, box: Rect): number {
  return Math.min(p.x - box.x, box.x + box.width - p.x, p.y - box.y, box.y + box.height - p.y);
}

/**
 * Every line on the tab a character cannot cross, in paint order: each fence's run, each room's walls (broken
 * at its doorway), and the outline of each piece of scenery's footprint (docs/specs/009-elements/office.md), all
 * blocked the same way.
 */
/** Whether two fence lists draw the same lines, in the same order: an edit that moved no wall keeps the old list. */
export function sameFences(p: readonly FenceSegment[], q: readonly FenceSegment[]): boolean {
  if (p === q) return true;
  if (p.length !== q.length) return false;
  for (let i = 0; i < p.length; i++) {
    const s = p[i]!;
    const t = q[i]!;
    if (s.a.x !== t.a.x || s.a.y !== t.a.y || s.b.x !== t.b.x || s.b.y !== t.b.y) return false;
    const r = s.solid;
    const u = t.solid;
    if (
      r !== u &&
      (!r || !u || r.x !== u.x || r.y !== u.y || r.width !== u.width || r.height !== u.height)
    )
      return false;
  }
  return true;
}

export function fenceSegments(elements: readonly AvatarSceneElement[]): FenceSegment[] {
  const out: FenceSegment[] = [];
  // Doors (docs/specs/009-elements/room-builder.md "Door") cut the room walls they stand on.
  const doors: FenceSegment[] = [];
  // A closed one does not (room-builder.md "Opening and closing"): its wall stays whole.
  for (const el of elements)
    if (
      isSceneShape(el) &&
      el.shape === 'door' &&
      (el as { doorClosed?: boolean }).doorClosed !== true
    )
      doors.push(doorLine(el));
  for (const el of elements) {
    if (!isSceneShape(el)) continue;
    // A garden fence (docs/specs/009-elements/office.md "Garden Fence") blocks as a fence does.
    if (el.shape === 'fence' || el.shape === 'garden-fence') out.push(fenceLine(el));
    else if (el.shape === 'room') out.push(...cutByDoors(roomWalls(el), doors));
    // A Corridor (docs/specs/009-elements/corridor.md): the walls down its sides, cut by its doors.
    else if (el.shape === 'corridor') out.push(...cutByDoors(corridorWalls(el), doors));
    // An Office Pod (office.md "Office Pod"): its walls, its doorway shut while both seats are held.
    else if (el.shape === 'office-pod') out.push(...podWalls(el));
    else {
      const footprint = officeFootprint(el);
      if (footprint)
        for (const edge of boxEdges(footprint)) out.push({ ...edge, solid: footprint });
    }
  }
  return out;
}

/** The lines of the tab's shut Doors (room-builder.md "Opening and closing"), for routing a walk to one's outside. */
export function shutDoorLines(elements: readonly AvatarSceneElement[]): FenceSegment[] {
  const out: FenceSegment[] = [];
  for (const el of elements)
    if (
      isSceneShape(el) &&
      el.shape === 'door' &&
      (el as { doorClosed?: boolean }).doorClosed === true
    )
      out.push(doorLine(el));
  return out;
}

const cross = (o: FencePoint, a: FencePoint, b: FencePoint) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Distance from a point to a segment (the shared geometry's distToSegment). */
export function pointSegmentDistance(p: FencePoint, s: FenceSegment): number {
  return distToSegment(p, s.a, s.b);
}

/** Whether two segments cross or touch. */
export function segmentsIntersect(p: FenceSegment, q: FenceSegment): boolean {
  const d1 = cross(q.a, q.b, p.a);
  const d2 = cross(q.a, q.b, p.b);
  const d3 = cross(p.a, p.b, q.a);
  const d4 = cross(p.a, p.b, q.b);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))
    return true;
  // Collinear or touching cases: an end lying on the other segment.
  const onSegment = (s: FenceSegment, r: FencePoint, d: number) =>
    d === 0 &&
    Math.min(s.a.x, s.b.x) <= r.x &&
    r.x <= Math.max(s.a.x, s.b.x) &&
    Math.min(s.a.y, s.b.y) <= r.y &&
    r.y <= Math.max(s.a.y, s.b.y);
  return (
    onSegment(q, p.a, d1) || onSegment(q, p.b, d2) || onSegment(p, q.a, d3) || onSegment(p, q.b, d4)
  );
}

/** The closest two segments come to each other (0 when they cross): the shared geometry's segmentDistance. */
export function segmentDistance(p: FenceSegment, q: FenceSegment): number {
  return sharedSegmentDistance(p.a, p.b, q.a, q.b);
}

// Closer to a fence's line than this, a character's feet stand in the fence itself (a room's wall is drawn 5 px either
// side of its line). No walk ends this close: the narrowest reach, the Small character's, is 9.2 px. So a character
// here was put here (a spawn, or a fence or room moved onto it), and the fence lets it off to either side.
export const FENCE_ON_LINE = 8;

/**
 * Whether one fence refuses a step. From outside its reach: any step that comes within the reach.
 * From inside it (a fence dropped on top of a character): only a step that crosses the line, ending
 * strictly on its far side, or closes in on it, so the character can always step away, even one
 * standing exactly on the line (where every step touches it, and would otherwise be refused). In the
 * fence itself (within FENCE_ON_LINE), nothing is refused: a character left standing in a room's wall
 * walks out of it toward a click on either side, rather than refusing every click into the room.
 * Inside a footprint's box (a seat tucked under a bar's counter, scenery dropped on a character), its edges refuse
 * only a step that goes deeper in, so the character walks along it and out of it, never further in nor stuck.
 */
export function fenceRefuses(
  from: FencePoint,
  to: FencePoint,
  fence: FenceSegment,
  reach = FENCE_REACH,
): boolean {
  if (fence.solid) {
    const depth = depthIn(from, fence.solid);
    if (depth > 0) return depthIn(to, fence.solid) > depth + FENCE_EPSILON;
  }
  const before = pointSegmentDistance(from, fence);
  if (before >= reach) return segmentDistance({ a: from, b: to }, fence) < reach;
  if (before < FENCE_ON_LINE) return false;
  const crosses =
    cross(fence.a, fence.b, from) * cross(fence.a, fence.b, to) < 0 &&
    segmentsIntersect({ a: from, b: to }, fence);
  // Closer by more than rounding: a step along the fence measures the same distance give or take an ulp, and an
  // exact comparison refused such a slide at random.
  return crosses || pointSegmentDistance(to, fence) < before - FENCE_EPSILON;
}

// Rounding's share of a distance measured in canvas px, never a real step closer.
const FENCE_EPSILON = 1e-6;

function firstRefusal(
  from: FencePoint,
  to: FencePoint,
  fences: readonly FenceSegment[],
  reach: number,
): FenceSegment | null {
  for (const fence of fences) if (fenceRefuses(from, to, fence, reach)) return fence;
  return null;
}

/**
 * The fences that could refuse a step from `from` reaching no further than `radius` (the step's length plus the
 * reach), in their order: those whose box comes within `radius`, and a footprint whose box `from` stands inside (its
 * edges refuse a step deeper in however far they are). A big board's list is looked up in a grid of its fences, built
 * once per list, so a step reads only the cells around it rather than every wall on the board.
 */
export function fencesNear(
  from: FencePoint,
  radius: number,
  fences: readonly FenceSegment[],
): FenceSegment[] {
  const left = from.x - radius;
  const right = from.x + radius;
  const top = from.y - radius;
  const bottom = from.y + radius;
  const near = (fence: FenceSegment) => {
    const { a, b } = fence;
    return (
      (Math.max(a.x, b.x) >= left &&
        Math.min(a.x, b.x) <= right &&
        Math.max(a.y, b.y) >= top &&
        Math.min(a.y, b.y) <= bottom) ||
      (fence.solid !== undefined && depthIn(from, fence.solid) > 0)
    );
  };
  const x0 = Math.floor(left / FENCE_CELL);
  const x1 = Math.floor(right / FENCE_CELL);
  const y0 = Math.floor(top / FENCE_CELL);
  const y1 = Math.floor(bottom / FENCE_CELL);
  // A short list, or a reach wider than the grid helps with, scans the list.
  if (fences.length < FENCE_INDEX_MIN || !((x1 - x0 + 1) * (y1 - y0 + 1) <= FENCE_CELLS_MAX))
    return fences.filter(near);
  const index = fenceIndexOf(fences);
  const seen = new Set<number>(index.big);
  for (let cx = x0; cx <= x1; cx++)
    for (let cy = y0; cy <= y1; cy++) {
      const cell = index.cells.get(cellKey(cx, cy));
      if (cell) for (const i of cell) seen.add(i);
    }
  const out: FenceSegment[] = [];
  for (const i of [...seen].sort((p, q) => p - q)) if (near(fences[i]!)) out.push(fences[i]!);
  return out;
}

// Below this many fences a scan of the list is as quick as the grid.
const FENCE_INDEX_MIN = 64;
// The grid's cell, in canvas px: a room's wall spans a few, a step's box one to four.
const FENCE_CELL = 256;
// A fence whose box (a footprint's included) covers more cells than this is checked on every step instead.
const FENCE_CELLS_MAX = 1024;

type FenceIndex = { cells: Map<number, number[]>; big: number[] };
const fenceIndexes = new WeakMap<readonly FenceSegment[], FenceIndex>();

// Two cells may share a key far apart: harmless, as every fence a lookup finds is still checked by its box.
function cellKey(cx: number, cy: number): number {
  return cx * 1_000_003 + cy;
}

function fenceIndexOf(fences: readonly FenceSegment[]): FenceIndex {
  const known = fenceIndexes.get(fences);
  if (known) return known;
  const index: FenceIndex = { cells: new Map(), big: [] };
  fences.forEach((fence, i) => {
    const { a, b, solid } = fence;
    let minX = Math.min(a.x, b.x);
    let maxX = Math.max(a.x, b.x);
    let minY = Math.min(a.y, b.y);
    let maxY = Math.max(a.y, b.y);
    if (solid) {
      minX = Math.min(minX, solid.x);
      maxX = Math.max(maxX, solid.x + solid.width);
      minY = Math.min(minY, solid.y);
      maxY = Math.max(maxY, solid.y + solid.height);
    }
    const x0 = Math.floor(minX / FENCE_CELL);
    const x1 = Math.floor(maxX / FENCE_CELL);
    const y0 = Math.floor(minY / FENCE_CELL);
    const y1 = Math.floor(maxY / FENCE_CELL);
    if (!((x1 - x0 + 1) * (y1 - y0 + 1) <= FENCE_CELLS_MAX)) {
      index.big.push(i);
      return;
    }
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const key = cellKey(cx, cy);
        const cell = index.cells.get(key);
        if (cell) cell.push(i);
        else index.cells.set(key, [i]);
      }
  });
  fenceIndexes.set(fences, index);
  return index;
}

/**
 * One step of walking with fences in the way: the step itself when nothing refuses it, else the
 * part of it that runs along the refusing fence when that is clear, else no step at all.
 */
export function fenceStep(
  from: FencePoint,
  to: FencePoint,
  allFences: readonly FenceSegment[],
  reach = FENCE_REACH,
): { pos: FencePoint; blocked: boolean } {
  if (allFences.length === 0) return { pos: to, blocked: false };
  // Every point this step tests (the step's end, a slide along a fence, the approach's halvings) lies within the
  // step's length of `from`, so only the fences near it can refuse any of them: test those, in the same order, rather
  // than every wall on the board up to nine times a frame.
  const fences = fencesNear(from, Math.hypot(to.x - from.x, to.y - from.y) + reach, allFences);
  if (fences.length === 0) return { pos: to, blocked: false };
  const fence = firstRefusal(from, to, fences, reach);
  if (!fence) return { pos: to, blocked: false };
  const fx = fence.b.x - fence.a.x;
  const fy = fence.b.y - fence.a.y;
  const len = Math.hypot(fx, fy);
  if (len > 0) {
    const ux = fx / len;
    const uy = fy / len;
    const along = (to.x - from.x) * ux + (to.y - from.y) * uy;
    const slid = { x: from.x + ux * along, y: from.y + uy * along };
    const step = Math.hypot(to.x - from.x, to.y - from.y);
    if (!fenceStalled(Math.abs(along), step) && !firstRefusal(from, slid, fences, reach)) {
      return { pos: slid, blocked: true };
    }
  }
  // Nothing to slide along: close in on the fence as far as the step allows, so a character walking
  // straight at it stops at the reach rather than a step short of it.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < FENCE_APPROACH_STEPS; i++) {
    const mid = (lo + hi) / 2;
    const at = { x: from.x + (to.x - from.x) * mid, y: from.y + (to.y - from.y) * mid };
    if (firstRefusal(from, at, fences, reach)) hi = mid;
    else lo = mid;
  }
  return {
    pos: { x: from.x + (to.x - from.x) * lo, y: from.y + (to.y - from.y) * lo },
    blocked: true,
  };
}

// How many halvings the approach takes: a 13 px step (the longest a frame walks) to within 0.1 px.
const FENCE_APPROACH_STEPS = 7;

// How many nudges clearOfFences makes: one per fence it lands beside, so a corner (two walls) takes two.
const FENCE_CLEAR_ROUNDS = 4;
// How far past the reach a nudge puts the feet, so rounding never leaves them a hair inside it.
const FENCE_CLEAR_MARGIN = 0.5;

/** The point on a segment nearest `p`. */
function nearestOnSegment(p: FencePoint, s: FenceSegment): FencePoint {
  const fx = s.b.x - s.a.x;
  const fy = s.b.y - s.a.y;
  const len2 = fx * fx + fy * fy;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - s.a.x) * fx + (p.y - s.a.y) * fy) / len2));
  return { x: s.a.x + fx * t, y: s.a.y + fy * t };
}

/**
 * Where a character put down at `p` should stand instead (docs/specs/009-elements/fence.md "What does not walk"). A
 * character put within a fence's reach but not in the fence itself could only step away from it, so a click past the
 * fence did nothing: it is nudged straight off each such fence, to the side its feet were on, until none is left.
 * One in a fence (within FENCE_ON_LINE) stays, free to walk off either side, and so does a point no nudge clears (a
 * gap narrower than a character): nudging it further could only push it through something. So does one inside a
 * footprint (a seat on a stool tucked under a bar's counter): a nudge "to the side its feet were on" would push it
 * deeper in, and it walks out on its own (fenceRefuses).
 */
export function clearOfFences(
  p: FencePoint,
  fences: readonly FenceSegment[],
  reach = FENCE_REACH,
): FencePoint {
  let at = p;
  for (let round = 0; ; round++) {
    const fence = fences.find((f) => {
      if (f.solid && depthIn(at, f.solid) > 0) return false;
      const d = pointSegmentDistance(at, f);
      return d >= FENCE_ON_LINE && d < reach;
    });
    if (!fence) return at;
    if (round === FENCE_CLEAR_ROUNDS) return p;
    // Beside the line, never on it, so the way off is the way from the line to the feet.
    const near = nearestOnSegment(at, fence);
    const dx = at.x - near.x;
    const dy = at.y - near.y;
    const out = (reach + FENCE_CLEAR_MARGIN) / Math.hypot(dx, dy);
    const next = { x: near.x + dx * out, y: near.y + dy * out };
    // Never nudged through another fence: out of a box too small to stand in is out of the box.
    if (fences.some((f) => f !== fence && segmentsIntersect({ a: at, b: next }, f))) return p;
    at = next;
  }
}
