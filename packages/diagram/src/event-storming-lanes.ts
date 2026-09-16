// Timeline lanes on an event-storming board (spec/139 Phase 6): the geometry
// of the horizontal lane stack a note snaps onto while it is being dragged.
//
// Phase 5 made the x axis something the board KNOWS — "between two notes" is a
// place you can drop something. This is the same move for y: an infinite stack
// of evenly pitched lanes, one note tall, so each lane is a row of the story.
// A note's CENTRE lands on a lane; nothing here touches x.
//
// X USED TO BE A LATTICE, and that was wrong. Columns every half note could
// only express gaps that were multiples of 100, but the board's own gutter is
// 72 (the template builds its rows with it, and the insertion ripple opens by
// it), so every row the product itself laid out was permanently off-lattice:
// dragging a note above one landed it 28px right, then 44px left, and the
// snap threshold was half a cell, which every x is within, so there was no
// "leave it where I put it" either. The lattice only ever agreed with a board
// whose notes were touching.
//
// So x is NEIGHBOUR-RELATIVE instead: a note lines up with the edges of the
// notes already there, or sits one gutter away from the one beside it, and is
// otherwise left alone. That is what a wall does — the rhythm is whatever the
// notes already on it agreed, not a lattice they have to obey.
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

// The gutter between two notes side by side. The board already had this
// number in two places — the event-storming template builds its starter row
// with it, and the insertion ripple opens a slot by it — so lanes use the same
// one rather than inventing a third rhythm.
export const ES_NOTE_GAP = 72;

// How close a note has to come before a neighbour claims its x. A real
// threshold, deliberately small: past it the note stays exactly where the hand
// put it, which is what "lanes are an aid, not a cage" has to mean on the axis
// where the author does the composing.
export const ES_NEIGHBOUR_SNAP_X = 12;

// y is a REAL threshold too — half the lane gap, so a note deliberately parked
// between two lanes stays there.
export const ES_LANE_SNAP_Y = ES_LANE_GAP / 2;

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

export type LaneSnap = {
  // The bounds' left edge, untouched: a lane is a row and has no opinion
  // about x. Carried so a caller can use one shape for the whole placement.
  x: number;
  // The bounds' new top edge.
  y: number;
  laneIndex: number;
};

// Snap a dragged note's bounds onto the lane stack: y only. Null when the note
// is further from every lane than the threshold, so a caller can fall through
// to the next rung of the placement ladder without comparing numbers.
export function snapToLane(
  bounds: { x: number; y: number; width: number; height: number },
  timeline: EsTimeline,
  threshold: number = ES_LANE_SNAP_Y,
): LaneSnap | null {
  // Centred on the lane, not hung from its top edge: that is what lets the
  // 180-tall prose kinds and the 140-tall actor read as one row beside the
  // 200-tall squares, exactly as they do on a wall.
  const centreY = bounds.y + bounds.height / 2;
  const laneIndex = laneIndexAt(centreY, timeline);
  const targetY = laneCentre(laneIndex, timeline) - bounds.height / 2;
  if (Math.abs(targetY - bounds.y) > threshold) return null;
  return { x: bounds.x, y: targetY, laneIndex };
}

// ---------------------------------------------------------------------
// X: what the neighbours say
// ---------------------------------------------------------------------

type NoteBox = {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  esDock?: { hostId: string };
};

const stickyBoxes = (elements: readonly Element[]): NoteBox[] =>
  elements.filter((el): el is Element & NoteBox => el.type === 'sticky');

// Two notes joined by a docking are ONE phrase, and the 16px between them is a
// seam rather than a gutter. Counting it would drag the board's measured
// rhythm towards the seam, and then every note dropped beside another would be
// offered a docked pair's spacing.
const docked = (a: NoteBox, b: NoteBox): boolean =>
  (a.esDock?.hostId !== undefined && a.esDock.hostId === b.id) ||
  (b.esDock?.hostId !== undefined && b.esDock.hostId === a.id);

// The gutter THIS board is working to, measured rather than assumed: the
// median clear space between notes that sit side by side in the same row. A
// board whose author works at 40 keeps 40; a board with nothing to measure
// (one note, a fresh board, a row of docked pairs) gets the board default.
//
// Touching and overlapping pairs are excluded on purpose: a docked seam is a
// join, not a gap, and counting it would drag the rhythm towards zero.
export function prevailingNoteGap(elements: readonly Element[]): number {
  const notes = stickyBoxes(elements);
  const gaps: number[] = [];
  for (const a of notes) {
    for (const b of notes) {
      if (a === b || b.x < a.x) continue;
      // Same row: their vertical spans overlap by more than half.
      const overlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (overlap < Math.min(a.height, b.height) / 2) continue;
      if (docked(a, b)) continue;
      const gap = b.x - (a.x + a.width);
      if (gap > 0 && gap < ES_LANE_PITCH) gaps.push(gap);
    }
  }
  if (gaps.length === 0) return ES_NOTE_GAP;
  const sorted = gaps.sort((p, q) => p - q);
  return sorted[Math.floor(sorted.length / 2)]!;
}

export type NeighbourSnap = {
  x: number;
  // Which relationship claimed it, so the overlay can draw the right hint:
  // an alignment line for an edge, the gutter for a gutter.
  reason: 'edge' | 'gutter';
  // The note that claimed it.
  neighbourId?: string;
};

// How far above / below a note another one can be and still pull its x. Two
// lanes: a column is a relationship between neighbouring rows, and a note six
// rows down is a different part of the story.
const NEIGHBOUR_REACH_LANES = 2;

// Where the notes already on the board want this one's left edge.
//
// Two relationships, in order of precedence:
//   EDGE   — left edge to a neighbour's left edge, or right edge to its right
//            edge: the column the author can see, whatever the widths are.
//   GUTTER — one gutter clear of the note beside it in the same row: the
//            breathing room stickies get on a wall, which the old lattice
//            could not express at all.
//
// Edges win, because aligning with a column that exists beats inventing a new
// gap beside it. Null when nothing is within reach, and then the note stays
// exactly where it was put.
export function snapToNeighbours(
  bounds: { x: number; y: number; width: number; height: number },
  elements: readonly Element[],
  opts: {
    gap?: number;
    exclude?: ReadonlySet<string>;
    threshold?: number;
  } = {},
): NeighbourSnap | null {
  const gap = opts.gap ?? ES_NOTE_GAP;
  const threshold = opts.threshold ?? ES_NEIGHBOUR_SNAP_X;
  const reach = NEIGHBOUR_REACH_LANES * ES_LANE_PITCH;
  const centreY = bounds.y + bounds.height / 2;

  let best: (NeighbourSnap & { distance: number }) | null = null;
  const offer = (x: number, reason: NeighbourSnap['reason'], neighbourId?: string) => {
    const distance = Math.abs(x - bounds.x);
    if (distance > threshold) return;
    // Edges beat gutters at equal reach; otherwise the nearer answer wins.
    const better =
      !best ||
      (reason === 'edge' && best.reason === 'gutter') ||
      (reason === best.reason && distance < best.distance);
    if (better) best = { x, reason, neighbourId, distance };
  };

  for (const note of stickyBoxes(elements)) {
    if (note.id && opts.exclude?.has(note.id)) continue;
    if (Math.abs(note.y + note.height / 2 - centreY) > reach) continue;
    offer(note.x, 'edge', note.id);
    offer(note.x + note.width - bounds.width, 'edge', note.id);
    // A gutter is a relationship within ONE row, so only a note this one
    // would actually sit beside offers it.
    const sameRow =
      Math.min(bounds.y + bounds.height, note.y + note.height) - Math.max(bounds.y, note.y) >
      Math.min(bounds.height, note.height) / 2;
    if (!sameRow) continue;
    offer(note.x + note.width + gap, 'gutter', note.id);
    offer(note.x - gap - bounds.width, 'gutter', note.id);
  }
  if (!best) return null;
  const { x, reason, neighbourId } = best;
  return { x, reason, neighbourId };
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
