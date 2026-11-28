import {
  alignmentGuides,
  applyShapeVariant,
  createShape,
  distributionSnap,
  ROOM_WALL_SNAP_THRESHOLD,
  sharesWallsByBox,
  snapRoomWalls,
  snapToAlignment,
  type AlignmentGuide,
  type DistributionGuide,
  type Element,
} from '@livehuddle/document';
import { ALIGN_SNAP_THRESHOLD } from '@/lib/canvas';

// Alignment help BEFORE the drop (docs/specs/008-canvas/canvas-and-palette.md): a palette tile dragged over the
// canvas snaps to its neighbours like a moved element does, and shows the
// same guide lines, so an element lands aligned instead of landing and then
// needing a nudge.
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
  room = false,
}: {
  // The cursor in canvas coords. The footprint is CENTRED on it, matching
  // where the drop actually places the element.
  canvasX: number;
  canvasY: number;
  width: number;
  height: number;
  elements: Element[];
  // A Room being placed also snaps wall to wall (docs/specs/009-elements/office.md "Rooms line up").
  room?: boolean;
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
  const edge = snapToAlignment(candidate, elements, NO_EXCLUDE, ALIGN_SNAP_THRESHOLD);
  // Sharing a neighbouring room's wall line, within its wider reach, wins its axis over the box-edge snap: box edge to
  // box edge beside a room is a double wall (office.md "Rooms line up").
  const walls = room
    ? snapRoomWalls(candidate, elements, NO_EXCLUDE, ROOM_WALL_SNAP_THRESHOLD)
    : null;
  const wallX = !!walls?.snappedX;
  const wallY = !!walls?.snappedY;
  const snap = {
    dx: wallX ? walls.dx : edge.dx,
    dy: wallY ? walls.dy : edge.dy,
    snappedX: edge.snappedX || wallX,
    snappedY: edge.snappedY || wallY,
  };
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
  const guides = [
    ...alignmentGuides(snapped, elements, NO_EXCLUDE),
    ...(walls && (wallX || wallY)
      ? snapRoomWalls(snapped, elements, NO_EXCLUDE, 0.5).guides.filter((g) =>
          g.axis === 'x' ? wallX : wallY,
        )
      : []),
  ];
  // Only for the axis distribution actually drove.
  const distGuides = dist.guides.filter((g) =>
    g.axis === 'x' ? !snap.snappedX && dist.dx !== 0 : !snap.snappedY && dist.dy !== 0,
  );
  return { dx, dy, guides, distGuides };
}

// Where an armed Room lands with the pointer at `at`: its box at its own size (its preset's, `variant`) centred there,
// snapped to its neighbours' edges and, when its walls are on its box, their wall lines (paletteDragSnapAt with
// `room`). Shared by the preview and the tap's commit, so the room lands where its preview stood.
export function armedRoomSnap(
  at: { x: number; y: number },
  elements: readonly Element[],
  variant?: string,
) {
  const piece = applyShapeVariant(createShape('room', 0, 0), variant);
  return paletteDragSnapAt({
    canvasX: at.x,
    canvasY: at.y,
    width: piece.width,
    height: piece.height,
    elements: elements as Element[],
    room: sharesWallsByBox(piece),
  });
}

/** Whether a Room preset (`variant`) shares walls by its box: a rectangle does, a shaped one does not. */
export function roomVariantSharesWalls(variant: string | undefined): boolean {
  return sharesWallsByBox(applyShapeVariant(createShape('room', 0, 0), variant));
}
