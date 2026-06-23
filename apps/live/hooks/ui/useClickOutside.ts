'use client';

import { useEffect, useRef, type RefObject } from 'react';

// Fire `onOutside` whenever a `pointerdown` lands anywhere that
// isn't a descendant of `ref.current`. Standard "click-outside to
// dismiss" pattern. The original two consumers were AuthControls
// (close the account menu) and MovablePanel (collapse the mobile
// banner), and the extraction was driven by their accidentally-
// divergent open-coded implementations: window+capture vs
// document+bubble, `target as Node` cast vs `instanceof Node`
// guard, an accident of order, not intent. Today four surfaces
// share the hook (AuthControls + MovablePanel + ShareDialog +
// CommentThreadPopover) and any new modal / popover should reach
// for it rather than rebuilding the listener from scratch.
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
  // Optional CSS selector. Targets matching `closest(insideSelector)`
  // are treated as inside even if they aren't a DOM descendant of
  // `ref`. Lets a callee whitelist portal-mounted children (an
  // ellipsis menu's PortalMenu lives under document.body, so the
  // ref.contains() check above misses it; whitelisting via
  // `data-prevent-outside-close` keeps the menu's items from
  // triggering the panel's own dismissal).
  insideSelector?: string,
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
      if (
        insideSelector &&
        e.target instanceof Element &&
        e.target.closest(insideSelector) !== null
      ) {
        return;
      }
      cbRef.current(e);
    };
    window.addEventListener('pointerdown', handler, true);
    return () => window.removeEventListener('pointerdown', handler, true);
  }, [enabled, ref, insideSelector]);
}
