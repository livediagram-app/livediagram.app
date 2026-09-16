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

// THE GUTTER between two notes side by side, and the one number the whole
// board works to: the event-storming template builds its starter row with it,
// the insertion ripple opens a slot by it, and the lane rhythm steps by it.
// Sixteen, which is the operator's own wall: stickies pressed up close, a
// finger's width of paper showing between them, not an airy layout.
export const ES_NOTE_GAP = 16;

// The smallest distance that counts as a gutter when measuring a board, and
// the bucket the measurement rounds into (sub-pixel drift is not a different
// rhythm). It has to sit UNDER the gutter itself, or the board could never
// measure its own rhythm.
export const MIN_MEASURED_GUTTER = 8;
const GUTTER_BUCKET_PX = 4;

// How near a suggested slot has to be before it takes the note: HALF A
// STANDARD NOTE.
//
// It was 12px, and 12px is a snap rather than a suggestion — nobody lands
// within 12px of anything by accident, so in practice the board never offered
// the slots its own notes implied. A radius this wide only works because the
// slot is DRAWN while it is live (see the preview): the author sees where the
// note is going before letting go, so a wide capture reads as help rather than
// as the board moving things about.
export const ES_CANDIDATE_RADIUS_X = ES_NOTE_SIZE_PX.square.width / 2;

// How far above / below a note another one can be and still suggest a slot.
// Two lanes: a column is a relationship between neighbouring rows, and a note
// six rows down is a different part of the story.
export const ES_CANDIDATE_REACH_LANES = 2;

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
      // Sub-gutter distances are not gutters. Two notes a few pixels apart are
      // an accident of dragging, a seam, or a near miss — and on a board with
      // a handful of them the MEDIAN gap lands on the accidents, which is
      // exactly how a board came to offer "right edge plus 44" as its rhythm
      // when every deliberate gap on it was 72.
      if (gap >= MIN_MEASURED_GUTTER && gap < ES_LANE_PITCH) gaps.push(gap);
    }
  }
  if (gaps.length === 0) return ES_NOTE_GAP;
  // The MOST REPEATED gap, not the middle one: a rhythm is a thing a board
  // does over and over, so the spacing the author used most is the spacing
  // they meant. Ties go to whichever is closest to the board default, because
  // a tie carries no evidence either way.
  const counts = new Map<number, number>();
  for (const gap of gaps) {
    const bucket = Math.round(gap / GUTTER_BUCKET_PX) * GUTTER_BUCKET_PX;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  let best = ES_NOTE_GAP;
  let bestCount = 0;
  for (const [bucket, count] of counts) {
    const better =
      count > bestCount ||
      (count === bestCount && Math.abs(bucket - ES_NOTE_GAP) < Math.abs(best - ES_NOTE_GAP));
    if (better) {
      best = bucket;
      bestCount = count;
    }
  }
  return best;
}

// A place the notes already on the board suggest this one could go.
export type LaneCandidate = {
  // The left edge on offer.
  x: number;
  // Which relationship suggested it — kept for the spec, the tests and any
  // future hint that wants to word itself differently per kind. None of the
  // three outranks another: distance decides.
  //   gutter    — one clear gutter along, in the SAME row.
  //   aligned   — squarely under / over a note in the row next door.
  //   staggered — the brick pattern: centred under that note's gutter.
  kind: 'gutter' | 'aligned' | 'staggered';
  neighbourId?: string;
};

const sameRow = (a: { y: number; height: number }, b: { y: number; height: number }): boolean =>
  Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > Math.min(a.height, b.height) / 2;

// THE RHYTHM, in one place.
//
// Where a note may sit along a row that already has one in it: the first slot
// is the neighbour's own right edge plus a gutter, and every slot after it is
// one more empty place with a gutter on both sides. So a wide note simply
// occupies a longer stretch and the rhythm resumes after it, and the empty
// places between notes are sized by the note being placed.
//
// The two facts this encodes — the first step is the NEIGHBOUR's silhouette,
// every step after it is the PLACED note's — are the ones to revisit if the
// notation's stationery should tile differently. They are deliberately not
// spread across the file.
const RHYTHM_SLOTS_EACH_WAY = 4;

function rhythmSlots(
  neighbour: { x: number; width: number },
  width: number,
  gap: number,
): number[] {
  const step = width + gap;
  const firstRight = neighbour.x + neighbour.width + gap;
  const firstLeft = neighbour.x - gap - width;
  const out: number[] = [];
  for (let k = 0; k < RHYTHM_SLOTS_EACH_WAY; k += 1) {
    out.push(firstRight + k * step);
    out.push(firstLeft - k * step);
  }
  return out;
}

// Where a note sits when it is centred on the GAP beside a neighbour — the
// brick, read across lanes. Two notes a gutter apart share one gap, and both
// of them name its centre, so the pair's brick falls out of the same rule as a
// lone note's.
function gutterCentres(
  neighbour: { x: number; width: number },
  width: number,
  gap: number,
): number[] {
  const rightCentre = neighbour.x + neighbour.width + gap / 2;
  const leftCentre = neighbour.x - gap / 2;
  return [rightCentre - width / 2, leftCentre - width / 2];
}

// Every slot the board is offering this note, from the notes within two lanes
// of it. Existing notes never move to make one — a candidate is a place that
// is already free.
//
// Two events side by side imply four kinds of place, and this is all of them:
// after the pair, before the pair, under each event, and under the gutter
// between them. The stagger is measured from the NEIGHBOUR's silhouette, not
// the dragged note's, because the rhythm belongs to the row that is already
// there — which is what lets a 300-wide policy take its place under two square
// events without inventing a third rhythm.
export function laneCandidates(
  bounds: { x: number; y: number; width: number; height: number },
  elements: readonly Element[],
  opts: { gap?: number; exclude?: ReadonlySet<string> } = {},
): LaneCandidate[] {
  const gap = opts.gap ?? ES_NOTE_GAP;
  const reach = ES_CANDIDATE_REACH_LANES * ES_LANE_PITCH;
  const centreY = bounds.y + bounds.height / 2;
  const notes = stickyBoxes(elements);
  const live = notes.filter((n) => !(n.id && opts.exclude?.has(n.id)));

  const out: LaneCandidate[] = [];
  const offer = (x: number, kind: LaneCandidate['kind'], neighbourId?: string) => {
    // A slot whose footprint lands on a note that is already there is not a
    // slot. Opening the row to make one is the Alt insertion (Phase 5), a
    // different verb with a different gesture — so the space BETWEEN two
    // touching events is never offered here.
    const clashes = live.some(
      (n) =>
        n.id !== neighbourId && sameRow(bounds, n) && x < n.x + n.width && x + bounds.width > n.x,
    );
    if (clashes) return;
    out.push({ x, kind, neighbourId });
  };

  for (const note of live) {
    if (Math.abs(note.y + note.height / 2 - centreY) > reach) continue;
    if (sameRow(bounds, note)) {
      // ALONG THE ROW: the rhythm, and only the rhythm. Nothing touching,
      // nothing at half a pitch — in one row there is no such position.
      for (const x of rhythmSlots(note, bounds.width, gap)) offer(x, 'gutter', note.id);
      continue;
    }
    // THE ROW NEXT DOOR: squarely under (or over) the note, or squarely under
    // the GAP beside it. Nothing else — a neighbouring row says which columns
    // line up, not where along this row a note may sit.
    offer(note.x, 'aligned', note.id);
    for (const x of gutterCentres(note, bounds.width, gap)) offer(x, 'staggered', note.id);
  }
  return out;
}

// The slot that takes the note, or null when the hand is further from all of
// them than the capture radius — and then the note stays exactly where it was
// put. Nearest wins; no kind outranks another.
// Takes the whole bounds, though only the left edge decides: callers hand the
// note they are dragging, and a parameter narrower than the thing every caller
// has is a paper cut at each of them.
// THE PLACEMENT, in one call: what the board offers this note, and which of
// those offers takes it. Both drag paths ask this and nothing else.
//
// The extra rule here is OVERLAP. Sliding a note back until it touches the one
// before it is how an author says "right behind this", and the gesture
// overshoots by its nature: the hand ends up INSIDE the previous note, which
// is further from the next slot than the capture radius. Notes were landing
// loose at 4px, 16px, 60px — the author's "as close as possible" turned into an
// irregular row. A footprint lying on top of a note in the same row is not a
// resting place on a board of paper, so it is always resolved to the nearest
// slot, however far that is.
export function capturePlacement(
  bounds: { x: number; y: number; width: number; height: number },
  elements: readonly Element[],
  opts: { gap?: number; exclude?: ReadonlySet<string>; radius?: number } = {},
): LaneCandidate | null {
  const candidates = laneCandidates(bounds, elements, opts);
  const overlapsNeighbour = stickyBoxes(elements).some(
    (n) =>
      !(n.id && opts.exclude?.has(n.id)) &&
      sameRow(bounds, n) &&
      bounds.x < n.x + n.width &&
      bounds.x + bounds.width > n.x,
  );
  if (overlapsNeighbour) {
    // Lying on a note in this row means "right behind that one", and the
    // answer is this ROW's rhythm at any distance — not the nearest column or
    // brick from the row next door, which is how a row of events came out at
    // 72, 72, 36, 12 while the row below it looked perfectly tidy.
    const rhythm = candidates.filter((c) => c.kind === 'gutter');
    return (
      captureCandidate(bounds, rhythm, Infinity) ?? captureCandidate(bounds, candidates, Infinity)
    );
  }
  return captureCandidate(bounds, candidates, opts.radius);
}

export function captureCandidate(
  bounds: { x: number; y?: number; width?: number; height?: number },
  candidates: readonly LaneCandidate[],
  radius: number = ES_CANDIDATE_RADIUS_X,
): LaneCandidate | null {
  // THE ROW THIS NOTE IS IN COMES FIRST.
  //
  // A note joining a row that already has notes in it wants that row's rhythm,
  // full stop — "place a few events behind each other and they should simply
  // take the regular gap". The columns and bricks offered by the row NEXT DOOR
  // are real places too, but when both are in reach they were winning on raw
  // distance and leaving the row itself irregular: gaps of 36 and 12 in a row
  // whose own rhythm is 72.
  //
  // So: rank first (own row beats next door), distance second. Within a rank
  // nothing outranks anything — an aligned column and a brick are still equals.
  const rank = (candidate: LaneCandidate) => (candidate.kind === 'gutter' ? 0 : 1);
  let best: LaneCandidate | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate.x - bounds.x);
    if (distance > radius) continue;
    if (best && rank(candidate) > rank(best)) continue;
    if (best && rank(candidate) === rank(best) && distance >= bestDistance) continue;
    best = candidate;
    bestDistance = distance;
  }
  return best;
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
