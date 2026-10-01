// Where the paste notice sits (docs/specs/020-import-export/board-scene.md "In the editor"): its own
// slot just above the whiteboard dock, so it never covers a dock button at any width. With no dock
// (a diagram tab, a read-only board) it takes the slot a dock would have: lifted above the
// bottom-right cluster's line until the window is wide enough for both side by side, as the dock
// is (WhiteboardDock: bottom 4.25rem, 1rem from 1760 px; whiteboard-dock blueprint D9).

// The gap between the notice and what it sits above.
export const NOTICE_GAP_PX = 8;
// The dock's own lift, mirrored for a canvas without one.
export const DOCKLESS_LIFT_PX = 68;
export const DOCKLESS_WIDE_LIFT_PX = 16;
export const DOCKLESS_WIDE_MIN_PX = 1760;

export type NoticeSlotInput = {
  viewportWidth: number;
  viewportHeight: number;
  // The dock's top edge in viewport px, when a dock is on screen.
  dockTop: number | null;
  // The canvas area's bottom edge in viewport px.
  canvasBottom: number;
};

/** The notice's distance from the viewport's bottom edge (CSS `bottom` of a fixed box), in px. */
export function noticeBottom(input: NoticeSlotInput): number {
  const above =
    input.dockTop ??
    input.canvasBottom -
      (input.viewportWidth >= DOCKLESS_WIDE_MIN_PX ? DOCKLESS_WIDE_LIFT_PX : DOCKLESS_LIFT_PX);
  return Math.max(0, input.viewportHeight - above + NOTICE_GAP_PX);
}
