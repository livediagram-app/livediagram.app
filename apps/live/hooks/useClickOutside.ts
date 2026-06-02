'use client';

import { useEffect, useRef, type RefObject } from 'react';

// Fire `onOutside` whenever a `pointerdown` lands anywhere that
// isn't a descendant of `ref.current`. Standard "click-outside to
// dismiss" pattern, used by AuthControls (close the account menu)
// and MovablePanel (collapse the mobile banner). Both consumers
// previously open-coded a near-identical 8-line useEffect; the gap
// between them (window+capture vs document+bubble, AuthControls'
// `target as Node` cast vs MovablePanel's `instanceof Node` guard)
// was an accident of order, not intent.
//
// Listener is registered on `window` in the capture phase: that
// fires before any descendant React `onClick` handlers, so we get
// a chance to dismiss before the user's "real" action runs. The
// in-panel target check still prevents dismissal when the click
// landed inside, so click-on-menu-item still works as expected.
//
// `enabled` lets the caller install the listener only while the
// surface is open (an inert button shouldn't pay for a window
// pointerdown listener every frame). When false, no listener is
// registered. `onOutside` is captured through a ref so the hook
// doesn't re-bind the listener on every render that produces a
// fresh callback identity.

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: (event: PointerEvent) => void,
  enabled: boolean = true,
): void {
  const cbRef = useRef(onOutside);
  useEffect(() => {
    cbRef.current = onOutside;
  });

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    const handler = (e: PointerEvent) => {
      const node = ref.current;
      if (!node) return;
      if (e.target instanceof Node && node.contains(e.target)) return;
      cbRef.current(e);
    };
    window.addEventListener('pointerdown', handler, true);
    return () => window.removeEventListener('pointerdown', handler, true);
  }, [enabled, ref]);
}
