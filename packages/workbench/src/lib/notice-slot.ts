// The editor's notice slot (liveworkspace/docs/specs/016-notifications/callouts.md "Floating callouts"), where
// livediagram's paste notice (its docs/specs/020-import-export/board-scene.md "In the editor") and every app's
// suggestions (016-notifications/suggestions.md) sit: its own slot just above the whiteboard dock, so it never covers a dock button at any width. With no dock
// (a diagram tab, a read-only board) it takes the slot a dock would have: lifted above the
// bottom-right cluster's line until the window is wide enough for both side by side, as the dock
// is (WhiteboardDock: bottom 4.25rem, 1rem from 1760 px; whiteboard-dock blueprint D9).

// The gap between the notice and what it sits above.
export const NOTICE_GAP_PX = 8;
// The dock's own lift, mirrored for a canvas without one.
const DOCKLESS_LIFT_PX = 68;
const DOCKLESS_WIDE_LIFT_PX = 16;
const DOCKLESS_WIDE_MIN_PX = 1760;

type NoticeSlotInput = {
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

// Who holds the slot now: one floating notice at a time. A notice that shows claims it; a suggestion shows only while
// nothing holds it (suggestions.md "One at a time").
const holders = new Set<symbol>();
const listeners = new Set<() => void>();
const tell = () => {
  for (const l of [...listeners]) l();
};

/** Claims the slot for a notice on show; answers the release. */
export function holdNoticeSlot(): () => void {
  const key = Symbol('notice');
  holders.add(key);
  tell();
  return () => {
    if (holders.delete(key)) tell();
  };
}

/** Whether a notice holds the slot. */
export const noticeSlotHeld = (): boolean => holders.size > 0;

/** Hears the slot taken or freed; answers the unsubscribe. */
export function onNoticeSlot(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
