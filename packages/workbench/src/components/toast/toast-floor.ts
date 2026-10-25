// Where the toast stack stands (docs/specs/004-interface-design/toasts.md "Placement"): 16px off the
// bottom edge, or 8px above the highest bottom chrome that overlaps its column (the editor's tab bar,
// bottom-right cluster and a whiteboard dock where the editor has one, the Explorer's bottom bar, the sign-in banner). Pure: the
// hook measures, this decides.

/**
 * The editor's own bottom chrome: the tab bar, the bottom-right cluster (Undo / Redo, the Session strip's Timer, Vote
 * and Poll, Layers, Zoom) and the whiteboard dock. The sign-in banner stands on it, so it never covers them
 * (docs/specs/014-identity/sign-in-encouragement.md "Where it shows").
 */
export const BOTTOM_CHROME_SELECTOR =
  '[data-editor-tabbar], [data-zoom-cluster], [data-whiteboard-dock]';

/** Bottom chrome the stack clears: the editor's, plus anything that opts in with `data-toast-floor`. */
export const TOAST_FLOOR_SELECTOR = `[data-toast-floor], ${BOTTOM_CHROME_SELECTOR}`;

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

export type FloorRect = { top: number; left: number; right: number; width: number; height: number };

/**
 * The CSS `bottom`, in px, of a centred column (the toast stack, or the sign-in banner with its own `columnWidth`)
 * that stands on whatever bottom chrome sits beneath it.
 */
export function toastFloor(input: {
  viewportWidth: number;
  viewportHeight: number;
  obstacles: readonly FloorRect[];
  // The column's widest from 640px up; a toast's by default.
  columnWidth?: number;
}): number {
  const { viewportWidth: w, viewportHeight: h } = input;
  const phone = w <= TOAST_PHONE_MAX_PX;
  const half = phone
    ? w / 2 - TOAST_EDGE_PX
    : Math.min(input.columnWidth ?? TOAST_MAX_WIDTH_PX, w) / 2;
  const left = w / 2 - half;
  const right = w / 2 + half;
  let floor = TOAST_EDGE_PX;
  for (const r of input.obstacles) {
    if (r.width <= 0 || r.height <= 0) continue; // hidden, or mounted with nothing in it
    if (r.top >= h || r.top < h / 2) continue; // off screen, or not bottom chrome (a dock moved to the top)
    if (r.right <= left || r.left >= right) continue; // beside the column, not beneath it
    floor = Math.max(floor, h - r.top + TOAST_FLOOR_GAP_PX);
  }
  return Math.round(floor);
}
