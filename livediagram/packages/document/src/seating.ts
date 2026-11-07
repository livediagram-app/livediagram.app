// Seating (docs/specs/009-elements/chair.md "Facing", "Desk and sofa"): the furniture an Avatar-mode
// character sits down in. The chair, the desk and the two-seater sofa are drawn in @liveworkspace/avatar/furniture-art, as one table of
// parts both renderers paint (the editor's FurnitureView and the headless svg-render-faces), so a desk
// on the canvas and a desk in an export are the same desk, and each has a drawing per facing rather
// than one drawing turned. Pure: no React, no DOM, safe in a worker.
//
// All three share `chairFacing` (where the furniture's back is) and the walk hook's arrival rule;
// what differs is the drawing, the facing it is drawn at, and how many seats it has.

import type { SeatingKind } from '@liveworkspace/avatar/office-geometry';
import { SHARED_SEATING_ART, type FurnitureArt } from '@liveworkspace/avatar/furniture-art';

// Which kinds seat a character, and where in each one, are the walk's questions too, so they are
// @liveworkspace/avatar's: every drawing takes its grid and its seats from there.
export { isSeatingShape, type SeatingKind } from '@liveworkspace/avatar/office-geometry';
export {
  DEFAULT_SEATING_FACING,
  facingView,
  nearestSeat,
  seatingFacing,
  seatPoints,
} from '@liveworkspace/avatar/seats';

// The arithmetic of a turn is every piece's (furniture-facing.ts, over @liveworkspace/avatar's facing.ts).
export { facingSwapsBox, facingTurn } from '@liveworkspace/avatar/facing';

// The drawings, their vocabulary (the part roles, the strokes, the shadow) and the frame a facing shows are shared
// with every product that draws furniture: @liveworkspace/avatar/furniture-art, re-exported here under the same names.
export {
  CHAIR_ART,
  DESK_ART,
  FURNITURE_FACE_SHADE,
  FURNITURE_GLINT,
  FURNITURE_LINE_STROKE,
  FURNITURE_PANEL_STROKE,
  FURNITURE_RAIL_OPACITY,
  FURNITURE_RAIL_STROKE,
  FURNITURE_SHADOW,
  FURNITURE_WEAVE,
  furnitureFrame,
  SOFA_ART,
  type FurnitureArt,
  type FurnitureDrawing,
  type FurniturePart,
  type FurniturePartRole,
} from '@liveworkspace/avatar/furniture-art';

export const FURNITURE_ART: Record<SeatingKind, FurnitureArt> = SHARED_SEATING_ART;
