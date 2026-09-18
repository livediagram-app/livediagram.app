import {
  alignmentGuides,
  distributionSnap,
  snapToAlignment,
  capturePlacement,
  snapToLane,
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
  // Lanes claim the row, the neighbours claim x — the same ladder the
  // note-drag resolver follows, two entry points.
  const laneSnap = timeline ? snapToLane(candidate, timeline) : null;
  const gutterSnap = laneSnap
    ? capturePlacement({ ...candidate, y: laneSnap.y }, elements, {})
    : null;
  // On a lanes board the lane resolver is the ONLY source of x: the ordinary
  // alignment and distribution snaps were adding places the rhythm does not
  // have (flush against a neighbour, on top of it, half-way along), and the
  // note-drag path gates them off for the same reason.
  if (timeline) {
    return {
      dx: gutterSnap ? gutterSnap.x - candidate.x : 0,
      dy: laneSnap ? laneSnap.y - candidate.y : 0,
      guides: [],
      distGuides: [],
      lane: laneSnap
        ? {
            laneIndex: laneSnap.laneIndex,
            originY: timeline.originY,
            ...(gutterSnap ? { ghost: { x: gutterSnap.x, y: laneSnap.y, width, height } } : {}),
          }
        : null,
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
  // Timeline is null here (the early return above owns every lane frame), so
  // x and y are the ordinary alignment / distribution answers alone.
  return { dx, dy, guides, distGuides, lane: null };
}
