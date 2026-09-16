import {
  alignmentGuides,
  distributionSnap,
  snapToAlignment,
  snapToLanes,
  type AlignmentGuide,
  type DistributionGuide,
  type Element,
  type EsTimeline,
} from '@livediagram/diagram';
import { ALIGN_SNAP_THRESHOLD } from '@/lib/canvas';
import type { LanePreview } from '@/lib/lane-preview';

// Alignment help BEFORE the drop (spec/139): a palette tile dragged over the
// canvas snaps to its neighbours like a moved element does, and shows the
// same guide lines — so a note lands aligned instead of landing and then
// needing a nudge. On a low-threshold capture board every correction after
// the fact is friction.
//
// Pure geometry, shared by the three surfaces that must agree: the ghost
// (draws at the snapped spot), the guide overlay (draws the lines), and the
// drop (commits at the snapped point). Nothing to exclude — the element
// doesn't exist yet, so every neighbour is a candidate.
const NO_EXCLUDE: Set<string> = new Set();

export function paletteDragSnapAt({
  canvasX,
  canvasY,
  width,
  height,
  elements,
  timeline = null,
}: {
  // The cursor in canvas coords. The footprint is CENTRED on it, matching
  // where the drop actually places the element.
  canvasX: number;
  canvasY: number;
  width: number;
  height: number;
  elements: Element[];
  // Timeline lanes (spec/139 Phase 6), when this drag is eligible for them: a
  // note, on an event-storming board, with lanes on. Null otherwise — the
  // caller owns that decision, exactly as the note-drag path's does.
  timeline?: EsTimeline | null;
}): {
  dx: number;
  dy: number;
  guides: AlignmentGuide[];
  distGuides: DistributionGuide[];
  lane: LanePreview | null;
} {
  const candidate = {
    x: canvasX - width / 2,
    y: canvasY - height / 2,
    width,
    height,
  };
  // The lane rung sits above alignment, the same order the note-drag resolver
  // follows — one ladder, two entry points.
  const laneSnap = timeline ? snapToLanes(candidate, timeline) : null;
  if (laneSnap?.snappedX && laneSnap.snappedY) {
    return {
      dx: laneSnap.x - candidate.x,
      dy: laneSnap.y - candidate.y,
      guides: [],
      distGuides: [],
      lane: { laneIndex: laneSnap.laneIndex, cellIndex: laneSnap.cellIndex },
    };
  }
  const snap = snapToAlignment(candidate, elements, NO_EXCLUDE, ALIGN_SNAP_THRESHOLD);
  let dx = snap.dx;
  let dy = snap.dy;
  // Equal-spacing (distribution) helpers fill the axes alignment didn't
  // claim, so a note dragged into a row lands evenly spaced rather than
  // merely edge-aligned. Same composition as a move drag (boxed-drag-
  // resolve), including its shortcut: skip the O(k²) scan when alignment
  // already owns both axes, and key the hand-off off `snappedX/Y` rather
  // than a zero delta so an EXACT alignment still wins.
  const dist =
    snap.snappedX && snap.snappedY
      ? { dx: 0, dy: 0, guides: [] }
      : distributionSnap(candidate, elements, NO_EXCLUDE, ALIGN_SNAP_THRESHOLD);
  if (!snap.snappedX) dx = dist.dx;
  if (!snap.snappedY) dy = dist.dy;
  // Guides describe the box that will LAND (post-snap), so a line appears
  // exactly when a snap is in effect — the same derivation the move /
  // resize path uses.
  const snapped = { ...candidate, x: candidate.x + dx, y: candidate.y + dy };
  const guides = alignmentGuides(snapped, elements, NO_EXCLUDE);
  // Only for the axis distribution actually drove.
  const distGuides = dist.guides.filter((g) =>
    g.axis === 'x' ? !snap.snappedX && dist.dx !== 0 : !snap.snappedY && dist.dy !== 0,
  );
  if (!laneSnap) return { dx, dy, guides, distGuides, lane: null };
  // One axis claimed by the lane, the other left to alignment — and the
  // claimed axis drops its guide line, which would otherwise promise an edge
  // the note is not landing on.
  const keep = <T extends { axis: 'x' | 'y' }>(gs: T[]): T[] =>
    gs.filter((g) => (g.axis === 'x' ? !laneSnap.snappedX : !laneSnap.snappedY));
  return {
    dx: laneSnap.snappedX ? laneSnap.x - candidate.x : dx,
    dy: laneSnap.snappedY ? laneSnap.y - candidate.y : dy,
    guides: keep(guides),
    distGuides: keep(distGuides),
    lane: { laneIndex: laneSnap.laneIndex, cellIndex: laneSnap.cellIndex },
  };
}
