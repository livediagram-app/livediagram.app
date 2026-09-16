// Timeline lanes on an event-storming board (spec/139 Phase 6): the geometry
// of the horizontal lane stack a note snaps onto while it is being dragged.
//
// Phase 5 made the x axis something the board KNOWS — "between two notes" is a
// place you can drop something. This is the same move for y: an infinite stack
// of evenly pitched lanes, one note tall, so each lane is a row of the story
// and each half-note column a moment. A note's CENTRE lands on a lane and its
// LEFT EDGE on a grid column, which is the whole of "either exactly above the
// note on the lane above, or staggered by half a note".
//
// Pure and React-free: the palette drag, the drag of a note already on the
// board, the overlay that lights the lane and the drop all ask the same
// functions, so the preview can never disagree with the result (spec/58).

import { ES_NOTE_SIZE_PX } from './event-storming';
import type { Element, ElementId } from './index';

// Where the lane stack is anchored, and whether it is in use. The PITCH is a
// constant, not a field: one rhythm per board is the point, and a board with
// two lane heights is a board with no lanes.
//
// `enabled` is explicit rather than "presence means on" because the ORIGIN has
// to outlive an off: it is chosen once, from the board as it stood, and
// switching lanes off and on again must not re-anchor the whole board to
// whatever note happens to be top-left by then. So absence means "this board
// has never had lanes" (and therefore no origin), and the two states a board
// that HAS had them can be in are both carried by the one field.
export type EsTimeline = {
  // Canvas x of grid column 0.
  originX: number;
  // Canvas y of lane 0's TOP edge.
  originY: number;
  enabled: boolean;
};

// The lane stack a tab is actually working to, or null when lanes are off.
// ONE predicate, so the switch, the two drag resolvers, the overlay and the
// export can't disagree about whether lanes are in play.
export function activeTimeline(tab: { esTimeline?: EsTimeline } | undefined): EsTimeline | null {
  return tab?.esTimeline?.enabled ? tab.esTimeline : null;
}

// A lane is one standard note tall, and the gap between two lanes is the
// breathing room stickies get when they are pressed onto a wall in rows.
// Calibrated by eye on a live board, like the tilt was.
export const ES_LANE_HEIGHT = ES_NOTE_SIZE_PX.square.height;
export const ES_LANE_GAP = 40;
export const ES_LANE_PITCH = ES_LANE_HEIGHT + ES_LANE_GAP;

// Half a standard note: two columns per square note, so a note can sit exactly
// above its neighbour on the lane before it or staggered by half a note, and
// nothing in between. That IS the arrangement choice — made per note, by where
// it is dropped, rather than by a mode the author has to set first.
export const ES_GRID_CELL = ES_NOTE_SIZE_PX.square.width / 2;

// Default snap thresholds. y is a REAL threshold — half the lane gap, so a
// note deliberately parked between two lanes stays there (lanes are an aid,
// not a cage). x is half a cell, which every x is within by definition, so the
// grid always claims the left edge: a grid that only sometimes applied would
// leave a row half on the columns and half off them.
export const ES_LANE_SNAP_Y = ES_LANE_GAP / 2;
export const ES_LANE_SNAP_X = ES_GRID_CELL / 2;

export function laneTop(index: number, timeline: EsTimeline): number {
  return timeline.originY + index * ES_LANE_PITCH;
}

export function laneCentre(index: number, timeline: EsTimeline): number {
  return laneTop(index, timeline) + ES_LANE_HEIGHT / 2;
}

// The lane NEAREST a canvas y. The gaps between lanes belong to no lane, but a
// snap still needs an answer there, and "the nearest one" is the answer the
// hand expects. Exact inverse of `laneCentre`.
export function laneIndexAt(y: number, timeline: EsTimeline): number {
  return Math.round((y - laneCentre(0, timeline)) / ES_LANE_PITCH);
}

export function cellIndexAt(x: number, timeline: EsTimeline): number {
  return Math.round((x - timeline.originX) / ES_GRID_CELL);
}

export function cellLeft(index: number, timeline: EsTimeline): number {
  return timeline.originX + index * ES_GRID_CELL;
}

export type LaneSnap = {
  // The bounds' new left / top edge. Unchanged on an axis that did not snap.
  x: number;
  y: number;
  // The lane / column claimed, or null on an axis that did not snap.
  laneIndex: number | null;
  cellIndex: number | null;
  snappedX: boolean;
  snappedY: boolean;
};

// Snap a dragged note's bounds onto the lane stack. The two axes are resolved
// INDEPENDENTLY — a note can land on a column without joining a lane — and
// each answers only within its own threshold. Returns null when neither axis
// moved, so a caller can fall through to the next rung of the placement ladder
// without comparing numbers.
export function snapToLanes(
  bounds: { x: number; y: number; width: number; height: number },
  timeline: EsTimeline,
  threshold: { x: number; y: number } = { x: ES_LANE_SNAP_X, y: ES_LANE_SNAP_Y },
): LaneSnap | null {
  // Centred on the lane, not hung from its top edge: that is what lets the
  // 180-tall prose kinds and the 140-tall actor read as one row beside the
  // 200-tall squares, exactly as they do on a wall.
  const centreY = bounds.y + bounds.height / 2;
  const laneIndex = laneIndexAt(centreY, timeline);
  const targetY = laneCentre(laneIndex, timeline) - bounds.height / 2;
  const snappedY = Math.abs(targetY - bounds.y) <= threshold.y;

  const cellIndex = cellIndexAt(bounds.x, timeline);
  const targetX = cellLeft(cellIndex, timeline);
  const snappedX = Math.abs(targetX - bounds.x) <= threshold.x;

  if (!snappedX && !snappedY) return null;
  return {
    x: snappedX ? targetX : bounds.x,
    y: snappedY ? targetY : bounds.y,
    laneIndex: snappedY ? laneIndex : null,
    cellIndex: snappedX ? cellIndex : null,
    snappedX,
    snappedY,
  };
}

// Where the stack is anchored when lanes are switched ON: the top-left corner
// of the board's top-most (ties broken by left-most) note, so the lanes arrive
// already lined up with the work that is already there. `(0, 0)` on an empty
// board. Written ONCE and then kept, so switching lanes off and on again
// doesn't re-anchor the board to whatever note happens to be top-left by then.
//
// Notes on a hidden or locked layer are ignored: you cannot line lanes up with
// work you cannot see.
export function initialTimelineOrigin(
  elements: Element[],
  inertIds?: ReadonlySet<ElementId>,
): EsTimeline {
  let best: { x: number; y: number } | null = null;
  for (const el of elements) {
    // A sticky is boxed by type, so its x / y are always there to read.
    if (el.type !== 'sticky') continue;
    if (inertIds?.has(el.id)) continue;
    if (!best || el.y < best.y || (el.y === best.y && el.x < best.x)) {
      best = { x: el.x, y: el.y };
    }
  }
  return { originX: best?.x ?? 0, originY: best?.y ?? 0, enabled: true };
}

// The lanes whose BAND intersects a canvas-space viewport, in order. The stack
// is infinite, so this is what bounds any drawing of it. A viewport sitting
// entirely inside a gap sees no lane at all, which is the truth.
export function visibleLaneIndices(
  viewport: { top: number; bottom: number },
  timeline: EsTimeline,
): number[] {
  const first = Math.floor((viewport.top - timeline.originY) / ES_LANE_PITCH);
  const last = Math.ceil((viewport.bottom - timeline.originY) / ES_LANE_PITCH);
  const out: number[] = [];
  for (let i = first; i <= last; i += 1) {
    const top = laneTop(i, timeline);
    if (top <= viewport.bottom && top + ES_LANE_HEIGHT >= viewport.top) out.push(i);
  }
  return out;
}
