// The Office Pod (livehuddle's docs/specs/009-elements/office.md "Office Pod"): a booth for two whose door closes by
// itself while both its seats are held. Its walls, the floor inside them (a call of its own), and whether its door is
// shut, all from the seat grid (seats.ts POD_SEATS) the drawing uses. Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import type { WallSegment } from './office-geometry';
import { drawnRect, POD_SEATS } from './seats';

// On the pod's grid (176 x 144): the outer walls' centre lines, the foot of the back wall's face, and the doorway's
// span along the front wall.
const POD_EDGE = 4;
const POD_BACK_FOOT = 36;
const POD_DOOR: readonly [number, number] = [54, 122];

/** How long the door takes to slide shut or open, in ms. */
export const POD_DOOR_MS = 600;

/** The doorway's span on the grid, for the drawing: [from, to] along the front wall. */
export const POD_DOOR_SPAN = POD_DOOR;

/** A pod as the walk reads it: its box and, set by `closePods`, whether its door is shut. */
export type PodBox = Rect & { podClosed?: boolean };

/**
 * A pod's walls as lines a character cannot cross, in canvas coordinates: round all four sides and along the foot of
 * the back wall's face, the front wall broken at the doorway unless the door is shut.
 */
export function podWalls(el: PodBox): WallSegment[] {
  const d = drawnRect(el, POD_SEATS);
  const s = d.width / POD_SEATS.width;
  const gx = (u: number) => d.x + u * s;
  const gy = (v: number) => d.y + v * s;
  const left = gx(POD_EDGE);
  const right = gx(POD_SEATS.width - POD_EDGE);
  const top = gy(POD_EDGE);
  const foot = gy(POD_BACK_FOOT);
  const front = gy(POD_SEATS.height - POD_EDGE);
  const walls: WallSegment[] = [
    { a: { x: left, y: top }, b: { x: right, y: top } },
    { a: { x: left, y: foot }, b: { x: right, y: foot } },
    { a: { x: left, y: top }, b: { x: left, y: front } },
    { a: { x: right, y: top }, b: { x: right, y: front } },
  ];
  if (el.podClosed) walls.push({ a: { x: left, y: front }, b: { x: right, y: front } });
  else {
    walls.push({ a: { x: left, y: front }, b: { x: gx(POD_DOOR[0]), y: front } });
    walls.push({ a: { x: gx(POD_DOOR[1]), y: front }, b: { x: right, y: front } });
  }
  return walls;
}

/** The floor inside a pod's walls: where a character counts as in the pod's call. */
export function podInterior(el: Rect): Rect {
  const d = drawnRect(el, POD_SEATS);
  const s = d.width / POD_SEATS.width;
  return {
    x: d.x + POD_EDGE * s,
    y: d.y + POD_BACK_FOOT * s,
    width: (POD_SEATS.width - 2 * POD_EDGE) * s,
    height: (POD_SEATS.height - POD_EDGE - POD_BACK_FOOT) * s,
  };
}

/** How far in front of a pod's doorway a character counts as at its door, in canvas px. */
export const POD_DOOR_FRONT_PX = 48;

/**
 * The strip in front of a pod's doorway where a character stands at its door (livehuddle's
 * docs/specs/012-collaboration/knock.md "Knocking"): the doorway's span, from the front wall's centre line outward.
 */
export function podDoorFront(el: Rect): Rect {
  const d = drawnRect(el, POD_SEATS);
  const s = d.width / POD_SEATS.width;
  return {
    x: d.x + POD_DOOR[0] * s,
    y: d.y + (POD_SEATS.height - POD_EDGE) * s,
    width: (POD_DOOR[1] - POD_DOOR[0]) * s,
    height: POD_DOOR_FRONT_PX,
  };
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
