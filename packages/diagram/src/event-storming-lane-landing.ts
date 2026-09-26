// Landing ARRIVING notes on the lanes (docs/specs/021-event-storming/event-storming.md "Always on a lane").
//
// A workshop note on an event-storming board always sits on a lane. A drag
// gets that from the snap it already runs every frame; everything else that
// puts notes on the board at once — a paste, a duplicate, an MCP call, a file
// import, an older board opened for the first time — lands them here.
//
// Two rules hold throughout: only the notes ARRIVING move (nothing already on
// the board is pushed to make room), and x is left alone unless a single note
// is landing on an occupied spot. Pure and React-free, like the rest of the
// lane geometry.

import {
  capturePlacement,
  ES_CANDIDATE_RADIUS_X,
  ES_LANES,
  ES_LANE_HEIGHT,
  isOnLane,
  laneCentre,
  laneIndexAt,
  nearestLaneTop,
} from './event-storming-lanes';
import { isEventStormingNote } from './event-storming';
import type { Element, ElementId } from './index';

export type LaneBox = { x: number; y: number; width: number; height: number };

// Where a row ends: a box more than half a lane's height below the row's FIRST
// box starts the next one. Measured from the first rather than the previous
// box, so a long sag cannot chain two rows into one.
const ROW_GAP = ES_LANE_HEIGHT / 2;

const centreY = (b: LaneBox) => b.y + b.height / 2;

// The rows of a set of boxes, top to bottom, each left to right, as indices.
export function groupRows(boxes: readonly LaneBox[]): number[][] {
  const order = boxes
    .map((_, i) => i)
    .sort((a, b) => centreY(boxes[a]!) - centreY(boxes[b]!) || boxes[a]!.x - boxes[b]!.x || a - b);
  const rows: number[][] = [];
  let first = -Infinity;
  for (const i of order) {
    const cy = centreY(boxes[i]!);
    if (rows.length === 0 || cy - first >= ROW_GAP) {
      rows.push([i]);
      first = cy;
    } else {
      rows[rows.length - 1]!.push(i);
    }
  }
  return rows.map((row) => row.sort((a, b) => boxes[a]!.x - boxes[b]!.x || a - b));
}

// A lane per row, in the rows' own order: each takes its nearest lane, but at
// least the lane below the row before it, so two rows never merge and a row
// pushed down pushes every row below it by the same lane. Returns each box's
// new top edge.
export function rowsToLanes(boxes: readonly LaneBox[]): number[] {
  const tops = boxes.map((b) => b.y);
  let shift = 0;
  let previous = -Infinity;
  for (const row of groupRows(boxes)) {
    const meanCy = row.reduce((sum, i) => sum + centreY(boxes[i]!), 0) / row.length;
    const nearest = laneIndexAt(meanCy, ES_LANES) + shift;
    const lane = Math.max(nearest, previous + 1);
    shift += lane - nearest;
    previous = lane;
    for (const i of row) tops[i] = laneCentre(lane, ES_LANES) - boxes[i]!.height / 2;
  }
  return tops;
}

// How a landing treats x.
//   keep      — a block, a staggered copy: x as it arrived.
//   free-slot — a lone note on an occupied spot moves to the nearest free
//               slot along its lane; anywhere else it stays.
//   capture   — a lone note placed as if it were dropped there: the rhythm
//               slot within reach takes it, as a drag would.
export type ArrivalX = 'keep' | 'free-slot' | 'capture';

export function landArrivals(
  elements: Element[],
  arrivalIds: ReadonlySet<ElementId>,
  opts: { x: ArrivalX },
): Element[] {
  const arriving = elements.filter(
    (el): el is Element & LaneBox => arrivalIds.has(el.id) && isEventStormingNote(el),
  );
  if (arriving.length === 0) return elements;
  const tops = rowsToLanes(arriving);
  const landed = new Map<ElementId, { x: number; y: number }>();
  arriving.forEach((el, i) => landed.set(el.id, { x: el.x, y: tops[i]! }));

  if (arriving.length === 1 && opts.x !== 'keep') {
    const only = arriving[0]!;
    const at = { ...only, y: tops[0]! };
    const radius = opts.x === 'capture' ? ES_CANDIDATE_RADIUS_X : 0;
    const slot = capturePlacement(at, elements, { exclude: arrivalIds, radius });
    if (slot) landed.set(only.id, { x: slot.x, y: at.y });
  }

  let changed = false;
  const out = elements.map((el) => {
    const next = landed.get(el.id);
    if (!next || !('x' in el)) return el;
    if (next.x === el.x && next.y === el.y) return el;
    changed = true;
    return { ...el, x: next.x, y: next.y };
  });
  return changed ? out : elements;
}

// The one-time settle of a board authored before lanes held notes: every
// workshop note off a lane moves to its nearest lane, y only. A locked note
// was pinned on purpose and stays. Returns the input array itself when nothing
// moved, so a caller can tell "nothing to do" by identity as well.
export function settleNotesOnLanes(elements: Element[]): {
  elements: Element[];
  movedIds: ElementId[];
} {
  const movedIds: ElementId[] = [];
  const out = elements.map((el) => {
    if (!isEventStormingNote(el) || el.locked || !('y' in el)) return el;
    if (!Number.isFinite(el.y) || !Number.isFinite(el.height) || isOnLane(el)) return el;
    movedIds.push(el.id);
    return { ...el, y: nearestLaneTop(el) };
  });
  return { elements: movedIds.length === 0 ? elements : out, movedIds };
}
