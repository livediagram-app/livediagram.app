// Where the toast stack stands (liveworkspace/docs/specs/016-notifications/toasts.md "Placement"): 16px off the
// bottom edge, or 8px above the highest bottom chrome that overlaps its column (the editor's tab bar,
// bottom-right cluster and a whiteboard dock where the editor has one, the Explorer's bottom bar). Pure: the hook
// measures, this decides.

/**
 * The editor's own bottom chrome: the tab bar, the bottom-right cluster (Undo / Redo, the Session strip's Timer, Vote
 * and Poll, Layers, Zoom) and the whiteboard dock.
 */
export const BOTTOM_CHROME_SELECTOR =
  '[data-editor-tabbar], [data-zoom-cluster], [data-whiteboard-dock]';

/** Bottom chrome the stack clears: the editor's, a template start's foot row (the Save switch, on a phone sheet), plus
 *  anything that opts in with `data-toast-floor` (the Explorer's bottom bar, a popover opened up from the bottom chrome). */
export const TOAST_FLOOR_SELECTOR = `[data-toast-floor], [data-start-footer], [data-toast-side], ${BOTTOM_CHROME_SELECTOR}`;

/** The stack's distance from the bottom edge with nothing beneath it, and from the screen's sides on a phone. */
export const TOAST_EDGE_PX = 16;
/** The gap between the stack and the chrome it stands on. */
export const TOAST_FLOOR_GAP_PX = 8;
/** A toast's widest, from 640px up (`sm:max-w-[36rem]`). */
export const TOAST_MAX_WIDTH_PX = 576;
/** Below Tailwind's `sm`, toasts span the screen. */
export const TOAST_PHONE_MAX_PX = 639;

/**
 * Said on `window` by bottom chrome that comes or goes without resizing anything the stack watches (the sign-in
 * banner, the whiteboard dock), so a toast already up moves to stand on it, or back down.
 */
export const TOAST_FLOOR_CHANGED_EVENT = 'lvd:toast-floor-changed';

export function announceToastFloorChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TOAST_FLOOR_CHANGED_EVENT));
}

/**
 * Marks a popover risen from the bottom chrome (`data-toast-floor="popover"`): a floor while it is open, however high it
 * reaches, since its foot stands on that chrome.
 */
export const TOAST_FLOOR_POPOVER = 'popover';
/** A popover risen from the bottom chrome, among the measured floors. */
export const TOAST_RISEN_SELECTOR = `[data-toast-floor=${TOAST_FLOOR_POPOVER}]`;

export type FloorRect = {
  top: number;
  left: number;
  right: number;
  width: number;
  height: number;
  // Risen from the bottom chrome (TOAST_FLOOR_POPOVER): a floor even with its top above the middle of the screen.
  rises?: boolean;
  // A floor on a phone only (TOAST_PHONE_FLOOR_SELECTOR): from 640px it is not bottom chrome.
  phoneOnly?: boolean;
};

/** Floors that count on a phone alone: a template start's foot row, which is the screen's foot only where the start
 *  is a bottom sheet. From 640px the start is a centred dialog, and the stack standing on its foot row put the toast
 *  over the dialog, away from the Undo row (the owner, 2026-11-20). */
export const TOAST_PHONE_FLOOR_SELECTOR = '[data-start-footer]';

/**
 * The CSS `bottom`, in px, of a centred column a toast wide that stands on whatever bottom chrome sits beneath it.
 */
export function toastFloor(input: {
  viewportWidth: number;
  viewportHeight: number;
  obstacles: readonly FloorRect[];
}): number {
  const { viewportWidth: w, viewportHeight: h } = input;
  const phone = w <= TOAST_PHONE_MAX_PX;
  const half = phone ? w / 2 - TOAST_EDGE_PX : Math.min(TOAST_MAX_WIDTH_PX, w) / 2;
  const left = w / 2 - half;
  const right = w / 2 + half;
  let floor = TOAST_EDGE_PX;
  for (const r of input.obstacles) {
    if (r.width <= 0 || r.height <= 0) continue; // hidden, or mounted with nothing in it
    if (r.top >= h) continue; // off screen
    if (r.top < h / 2 && !r.rises) continue; // not bottom chrome (a dock moved to the top)
    if (r.right <= left || r.left >= right) continue; // beside the column, not beneath it
    floor = Math.max(floor, h - r.top + TOAST_FLOOR_GAP_PX);
  }
  return Math.round(floor);
}

/** Bottom chrome the stack sits beside, not above, from 640px: the canvas's bottom-right cluster (Undo, Redo, Zoom), and
 *  anything that opts in with `data-toast-side` (liveknowledge's Edit, Cancel and Save buttons). */
export const TOAST_SIDE_SELECTOR = '[data-zoom-cluster], [data-toast-side]';

export type ToastPlacement = {
  /** The stack's CSS `bottom`, in px. */
  bottom: number;
  /** The stack's CSS `right`, in px, when it stands beside a side (its toasts aligned to that edge); null: centred. */
  right: number | null;
};

/**
 * Where the toast stack stands ("Placement"): on its floors, and from 640px on the bottom-right cluster's line (its
 * bottom level with the cluster's, so a toast and Undo read as one row), and left of the cluster where it would sit
 * beneath the centred column. On a phone a side is one more floor.
 */
export function toastPlacement(input: {
  viewportWidth: number;
  viewportHeight: number;
  floors: readonly FloorRect[];
  sides: readonly FloorRect[];
}): ToastPlacement {
  const { viewportWidth: w, viewportHeight: h, floors, sides } = input;
  if (w <= TOAST_PHONE_MAX_PX) {
    return {
      bottom: toastFloor({ viewportWidth: w, viewportHeight: h, obstacles: [...floors, ...sides] }),
      right: null,
    };
  }
  let bottom = toastFloor({
    viewportWidth: w,
    viewportHeight: h,
    obstacles: floors.filter((r) => !r.phoneOnly),
  });
  const half = Math.min(TOAST_MAX_WIDTH_PX, w) / 2;
  const left = w / 2 - half;
  const right = w / 2 + half;
  let edge: number | null = null;
  for (const r of sides) {
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.top >= h || r.top < h / 2) continue;
    // On the cluster's line wherever it is: a centred toast 8px lower than Undo read as out of line.
    bottom = Math.max(bottom, h - (r.top + r.height));
    if (r.right <= left || r.left >= right) continue;
    edge = Math.max(edge ?? 0, w - r.left + TOAST_FLOOR_GAP_PX);
  }
  return { bottom: Math.round(bottom), right: edge === null ? null : Math.round(edge) };
}
