'use client';

import { useEffect, type RefObject } from 'react';

// Keep keyboard focus inside an open modal and hand it back when the modal
// closes. Spread the returned ref onto the dialog container (which needs
// `tabIndex={-1}` so it can hold focus when it has no focusable children):
//   const ref = useRef<HTMLDivElement>(null);
//   useFocusTrap(ref);
//   <div ref={ref} role="dialog" tabIndex={-1}> ... </div>
//
// On mount it focuses the first focusable control (or the container; always
// the container on a touch screen), wraps
// Tab / Shift+Tab at the ends so focus can't escape behind the modal, and on
// unmount restores focus to whatever was focused before it opened (the
// trigger button). Escape / click-outside close are left to the caller.
//
// `active` (default true) re-engages the trap when it flips true, for the
// shared Dialog primitive that stays mounted and toggles `open` rather than
// unmounting — pass `open` so focus is captured the moment the dialog shows
// and handed back when it hides.

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Whether the primary pointer is a finger (phones, tablets). Read once per open, not subscribed: an open dialog
// never re-places its initial focus.
const coarsePointer = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

// Where focus lands on open: the first control ('first'), or the container itself ('container') for a panel
// whose first control is not where anyone starts (the Plan card panel's type picker); Tab then enters the
// controls from the top.
export type FocusTrapInitial = 'first' | 'container';

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active = true,
  initial: FocusTrapInitial = 'first',
): void {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Visible, focusable descendants in DOM order. `offsetParent === null`
    // filters elements hidden via display:none (e.g. a collapsed accordion).
    // `tabIndex >= 0` drops a control taken out of the Tab order (`tabindex="-1"` on a button or a
    // link, which the selectors above still match): it is never an end of the loop.
    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null && el.tabIndex >= 0,
      );

    // A control that already took focus as the modal opened (an `autoFocus` field) keeps it; otherwise the first.
    // On a touch screen the container takes it instead: focusing the first control there highlights it and can
    // raise the on-screen keyboard for a field nobody tapped (docs/specs/007-editor/live-app.md).
    if (!node.contains(document.activeElement)) {
      (coarsePointer() || initial === 'container' ? node : (focusables()[0] ?? node)).focus({
        preventScroll: true,
      });
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        // Nothing to focus but the container: keep focus pinned here.
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey) {
        // From the container itself, Shift+Tab would leave the modal: wrap to the last control.
        if (active === first || active === node || !node.contains(active)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (active === last || !node.contains(active)) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      // Restore when focus is still inside the (closing) modal, or has been lost
      // to the page: React runs this cleanup after an unmounting modal has left
      // the DOM, by when its focused control is gone and focus sits on <body>.
      // Never yank focus away from somewhere the user has since clicked.
      const now = document.activeElement;
      const lost = now === null || now === document.body;
      if ((lost || node.contains(now)) && previouslyFocused?.isConnected) {
        previouslyFocused.focus?.({ preventScroll: true });
      }
    };
  }, [ref, active, initial]);
}
