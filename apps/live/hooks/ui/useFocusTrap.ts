'use client';

import { useEffect, type RefObject } from 'react';

// Keep keyboard focus inside an open modal and hand it back when the modal
// closes. Spread the returned ref onto the dialog container (which needs
// `tabIndex={-1}` so it can hold focus when it has no focusable children):
//   const ref = useRef<HTMLDivElement>(null);
//   useFocusTrap(ref);
//   <div ref={ref} role="dialog" tabIndex={-1}> ... </div>
//
// On mount it focuses the first focusable control (or the container), wraps
// Tab / Shift+Tab at the ends so focus can't escape behind the modal, and on
// unmount restores focus to whatever was focused before it opened (the
// trigger button). Escape / click-outside close are left to the caller.

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Visible, focusable descendants in DOM order. `offsetParent === null`
    // filters elements hidden via display:none (e.g. a collapsed accordion).
    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );

    (focusables()[0] ?? node).focus({ preventScroll: true });

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
        if (active === first || !node.contains(active)) {
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
      // Only restore if focus is still inside the (closing) modal, so we don't
      // yank focus away from wherever the user has since clicked.
      if (node.contains(document.activeElement)) {
        previouslyFocused?.focus?.({ preventScroll: true });
      }
    };
  }, [ref]);
}
