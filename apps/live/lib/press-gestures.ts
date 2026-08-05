// When does a press become a drag?
//
// Every draggable control in the editor chrome has to answer this: a slide-deck
// row, a favourites tile, a dockable panel, the quick-connect ring, the
// isometric orbit button, an avatar. Six of them answered it separately, with
// six constants (`ROW_DRAG_SLOP_PX`, `DRAG_THRESHOLD_PX`,
// `DOCK_DRAG_THRESHOLD_PX`, `CLICK_SLOP_PX`, and `DRAG_SLOP_PX` twice), and the
// copies had already come apart in two ways:
//
//   - One said 5px where the other five said 4.
//   - One tested `Math.abs(dx) > T || Math.abs(dy) > T` where the others tested
//     `Math.hypot(dx, dy) < T`. Those are a SQUARE and a CIRCLE: a diagonal
//     slip of (4, 4) is 5.66px of travel, still a tap under the square test and
//     already a drag under every other control's.
//
// So the shared thing here is the PREDICATE, not just the number — publishing
// only the constant would have left the square/circle split in place. One
// tolerance, measured one way, so the same finger movement means the same thing
// wherever it lands.
//
// Screen pixels, deliberately: these are chrome controls at a fixed size, not
// canvas content, so the threshold must not change with zoom.

/** Pointer travel still counted as a press rather than a drag. Roughly a shaky
 *  hand or a trackpad micro-slip; beyond it the movement was meant. */
export const PRESS_DRAG_SLOP_PX = 4;

/** Did this pointer travel far enough to be a drag? `dx`/`dy` are screen-pixel
 *  deltas from where the press started. Radial, so the tolerance is the same in
 *  every direction. */
export function isDragTravel(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= PRESS_DRAG_SLOP_PX;
}

// NOT unified into this module, on purpose — each is a different gesture with a
// deliberately different tolerance, and folding them in would change behaviour
// rather than align it:
//
//   - `MOVE_SLOP_PX = 10` (hooks/ui/useLongPress) is how far a finger may drift
//     DURING a half-second hold before the long-press is abandoned. A hold is
//     touch-only and lasts much longer than a click, so it has to be looser.
//   - `TAP_TRAVEL_PX = 16` (lib/draw-commit) is measured in CANVAS px, which
//     scale with zoom, and gates what a press on the canvas draws.
//   - `ARROW_SNAP_THRESHOLD_PX = 12` (lib/canvas) is a snapping distance, not a
//     gesture threshold at all.
