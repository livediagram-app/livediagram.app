// The toast stack's own keys (liveworkspace/docs/specs/016-notifications/toasts.md "Keyboard and screen readers"): a key
// pressed with focus in a toast is the toast's, so a surface's window-wide Escape (a popover's, a drawer's) leaves it
// alone, whichever listener the page added first.

/** Marks the toast stack's root. */
export const TOAST_STACK_ATTR = 'data-toast-stack';

/** Whether a key was pressed with focus in the toast stack. */
export function keyInToastStack(e: Event): boolean {
  return e.target instanceof Element && e.target.closest(`[${TOAST_STACK_ATTR}]`) !== null;
}
