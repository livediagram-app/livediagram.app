// The Office Pod (livehuddle's docs/specs/009-elements/office.md "Office Pod"): a booth for two whose door closes by
// itself while both its seats are held. Its walls, the floor inside them (a call of its own), its doorway and whether
// its door is shut, all on the grids its drawings use (seats.ts POD_SEATS and its turned grids), so they turn with
// the pod (livehuddle's docs/specs/009-elements/furniture-facing.md "What blocks turns with it"). Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import type { WallSegment } from './office-geometry';
import { facingView, type SeatFacing, type SeatView, type ViewGrid } from './facing';
import { drawnRect, POD_SEATS, POD_SEATS_BACK, POD_SEATS_SIDE } from './seats';

// On the front grid (176 x 144): the outer walls' centre lines, the foot of the back wall's face, and the doorway's
// span along the front wall.
const POD_EDGE = 4;
const POD_BACK_FOOT = 36;
const POD_DOOR: readonly [number, number] = [54, 122];
// On the side grid (144 x 176) the doorway is in the left wall, centred on the floor between the far wall's foot and
// the near wall.
const POD_SIDE_DOOR: readonly [number, number] = [68, 136];

/** How long the door takes to slide shut or open, in ms. */
export const POD_DOOR_MS = 600;

/** The doorway's span on the front grid, for the drawing: [from, to] along the front wall. */
export const POD_DOOR_SPAN = POD_DOOR;
/** The doorway's span on the side grid: [from, to] down the left wall. */
export const POD_SIDE_DOOR_SPAN = POD_SIDE_DOOR;

/** A pod as the walk reads it: its box, its facing and, set by `closePods`, whether its door is shut. */
export type PodBox = Rect & { podClosed?: boolean; chairFacing?: SeatFacing };

// A wall's centre line on a drawing's grid: [x1, y1, x2, y2].
type GridLine = readonly [number, number, number, number];

// One drawing's walk geometry, in its grid's units: the walls that always block, the doorway's lines (blocking only
// while the door is shut), the floor inside, and the doorway as a line on its wall with the way out of it.
type PodPlan = {
  grid: ViewGrid;
  walls: readonly GridLine[];
  shut: readonly GridLine[];
  interior: { x: number; y: number; w: number; h: number };
  doorway: GridLine;
  out: { x: number; y: number };
};

function frontPlan(): PodPlan {
  const { width: W, height: H } = POD_SEATS;
  const E = POD_EDGE;
  const [a, b] = POD_DOOR;
  return {
    grid: POD_SEATS,
    walls: [
      [E, E, W - E, E],
      [E, POD_BACK_FOOT, W - E, POD_BACK_FOOT],
      [E, E, E, H - E],
      [W - E, E, W - E, H - E],
      [E, H - E, a, H - E],
      [b, H - E, W - E, H - E],
    ],
    shut: [[a, H - E, b, H - E]],
    interior: { x: E, y: POD_BACK_FOOT, w: W - 2 * E, h: H - E - POD_BACK_FOOT },
    doorway: [a, H - E, b, H - E],
    out: { x: 0, y: 1 },
  };
}

// From behind, the doorway is in the far wall, whose face stands from its top to its foot: both are broken at the
// doorway, and the doorway's jambs close the wall's thickness either side, so the only way through is the doorway.
function backPlan(): PodPlan {
  const { width: W, height: H } = POD_SEATS_BACK;
  const E = POD_EDGE;
  const F = POD_BACK_FOOT;
  const [a, b] = POD_DOOR;
  return {
    grid: POD_SEATS_BACK,
    walls: [
      [E, E, a, E],
      [b, E, W - E, E],
      [E, F, a, F],
      [b, F, W - E, F],
      [a, E, a, F],
      [b, E, b, F],
      [E, E, E, H - E],
      [W - E, E, W - E, H - E],
      [E, H - E, W - E, H - E],
    ],
    shut: [
      [a, E, b, E],
      [a, F, b, F],
    ],
    interior: { x: E, y: F, w: W - 2 * E, h: H - E - F },
    doorway: [a, E, b, E],
    out: { x: 0, y: -1 },
  };
}

// Facing left, the doorway is in the left wall; the far wall (the front's left side wall) shows its face.
function sidePlan(): PodPlan {
  const { width: W, height: H } = POD_SEATS_SIDE;
  const E = POD_EDGE;
  const F = POD_BACK_FOOT;
  const [a, b] = POD_SIDE_DOOR;
  return {
    grid: POD_SEATS_SIDE,
    walls: [
      [E, E, W - E, E],
      [E, F, W - E, F],
      [W - E, E, W - E, H - E],
      [E, H - E, W - E, H - E],
      [E, E, E, a],
      [E, b, E, H - E],
    ],
    shut: [[E, a, E, b]],
    interior: { x: E, y: F, w: W - 2 * E, h: H - E - F },
    doorway: [E, a, E, b],
    out: { x: -1, y: 0 },
  };
}

const PLANS: Record<SeatView, PodPlan> = { front: frontPlan(), back: backPlan(), side: sidePlan() };

// A pod's plan in canvas coordinates: grid points scaled into its drawn box, mirrored for facing right.
function placed(el: PodBox) {
  const { view, mirrored } = facingView(el.chairFacing ?? 'n');
  const plan = PLANS[view];
  const d = drawnRect(el, plan.grid);
  const s = d.width / plan.grid.width;
  const gx = (u: number) => d.x + (mirrored ? plan.grid.width - u : u) * s;
  const gy = (v: number) => d.y + v * s;
  const line = ([x1, y1, x2, y2]: GridLine): WallSegment => ({
    a: { x: gx(x1), y: gy(y1) },
    b: { x: gx(x2), y: gy(y2) },
  });
  return { plan, s, gx, gy, line, mirrored };
}

/**
 * A pod's walls as lines a character cannot cross, in canvas coordinates: round all four sides and along the foot of
 * the far wall's face, the doorway's wall broken at the doorway unless the door is shut.
 */
export function podWalls(el: PodBox): WallSegment[] {
  const { plan, line } = placed(el);
  const walls = plan.walls.map(line);
  if (el.podClosed) walls.push(...plan.shut.map(line));
  return walls;
}

/** The floor inside a pod's walls: where a character counts as in the pod's call. */
export function podInterior(el: PodBox): Rect {
  const { plan, s, gx, gy } = placed(el);
  const r = plan.interior;
  const x0 = gx(r.x);
  const x1 = gx(r.x + r.w);
  return { x: Math.min(x0, x1), y: gy(r.y), width: r.w * s, height: r.h * s };
}

/** How far in front of a pod's doorway a character counts as at its door, in canvas px. */
export const POD_DOOR_FRONT_PX = 48;

/**
 * A pod's doorway in canvas coordinates: its middle on its wall's centre line, its width, and the way out through it
 * (a unit step), which wherever the pod faces is the way its front faces.
 */
export function podDoorway(el: PodBox): {
  at: { x: number; y: number };
  width: number;
  out: { x: number; y: number };
} {
  const { plan, line, s, mirrored } = placed(el);
  const { a, b } = line(plan.doorway);
  const [x1, y1, x2, y2] = plan.doorway;
  return {
    at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    width: Math.hypot(x2 - x1, y2 - y1) * s,
    out: { x: mirrored ? -plan.out.x : plan.out.x, y: plan.out.y },
  };
}

/**
 * The strip in front of a pod's doorway where a character stands at its door (livehuddle's
 * docs/specs/012-collaboration/knock.md "Knocking"): the doorway's span, from its wall's centre line outward.
 */
export function podDoorFront(el: PodBox): Rect {
  const { at, width, out } = podDoorway(el);
  const D = POD_DOOR_FRONT_PX;
  if (out.y !== 0) return { x: at.x - width / 2, y: out.y > 0 ? at.y : at.y - D, width, height: D };
  return { x: out.x > 0 ? at.x : at.x - D, y: at.y - width / 2, width: D, height: width };
}

/** Whether a pod with this many sitters has its door shut: every seat held. */
export function podClosed(sitters: number): boolean {
  return sitters >= POD_SEATS.seats.length;
}

/**
 * The board as the walk should see it: each pod whose seats `peers` all hold marked `podClosed`, so its doorway
 * blocks. The same array back when no pod is shut, so a memo over it holds.
 */
export function closePods<E extends { readonly id: string; readonly type: string }>(
  elements: readonly E[],
  peers: readonly { seatedOn?: string | null }[],
): readonly E[] {
  const seated = new Map<string, number>();
  for (const peer of peers)
    if (peer.seatedOn) seated.set(peer.seatedOn, (seated.get(peer.seatedOn) ?? 0) + 1);
  if (seated.size === 0) return elements;
  let changed = false;
  const out = elements.map((el) => {
    const shape = (el as { shape?: unknown }).shape;
    if (el.type !== 'shape' || shape !== 'office-pod' || !podClosed(seated.get(el.id) ?? 0))
      return el;
    changed = true;
    return { ...el, podClosed: true };
  });
  return changed ? out : elements;
}
