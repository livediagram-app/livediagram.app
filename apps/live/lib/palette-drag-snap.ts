import {
  alignmentGuides,
  distributionSnap,
  snapToAlignment,
  type AlignmentGuide,
  type DistributionGuide,
  type Element,
} from '@livediagram/diagram';
import { ALIGN_SNAP_THRESHOLD } from '@/lib/canvas';

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
}: {
  // The cursor in canvas coords. The footprint is CENTRED on it, matching
  // where the drop actually places the element.
  canvasX: number;
  canvasY: number;
  width: number;
  height: number;
  elements: Element[];
}): {
  dx: number;
  dy: number;
  guides: AlignmentGuide[];
  distGuides: DistributionGuide[];
} {
  const candidate = {
    x: canvasX - width / 2,
    y: canvasY - height / 2,
    width,
    height,
  };
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
  return {
    dx,
    dy,
    guides: alignmentGuides(snapped, elements, NO_EXCLUDE),
    // Only for the axis distribution actually drove.
    distGuides: dist.guides.filter((g) =>
      g.axis === 'x' ? !snap.snappedX && dist.dx !== 0 : !snap.snappedY && dist.dy !== 0,
    ),
  };
}
