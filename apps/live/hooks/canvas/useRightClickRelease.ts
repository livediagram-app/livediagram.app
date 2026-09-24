'use client';

import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

/**
 * Right-click opens a context menu on RELEASE, not on press.
 *
 * X11 and macOS fire `contextmenu` on mouse-DOWN, so opening straight from
 * that event made the menu appear under a still-held button: it jumped out
 * mid-gesture, and a right-drag left it stranded where the press began. Every
 * other affordance in the editor commits on release, so the menu should too.
 *
 * But the order is NOT the same everywhere, and that is what made the menu
 * unreliable (a trackpad two-finger tap "sometimes worked"):
 *
 *   - macOS / Linux: pointerdown, contextmenu, pointerup. Arm on contextmenu,
 *     open on the pointerup that follows.
 *   - Windows: pointerdown, pointerup, contextmenu. The release has ALREADY
 *     happened when contextmenu arrives, so an arm-then-wait-for-pointerup
 *     design never opened on the first click, then left the arm set so the
 *     NEXT click's pointerup opened a stale menu: alternate clicks worked.
 *   - The keyboard Menu key / Shift+F10: contextmenu with no pointer at all.
 *   - macOS Ctrl+click: the held button is the PRIMARY one (button 0), so a
 *     "button 2 only" release test never matched and nothing opened.
 *
 * So `contextmenu` reads `buttons` to tell which world it is in: a button is
 * still down means the release is still to come (arm, open on that button's
 * pointerup); no button down means the release already happened (or there was
 * none), so open now. `pendingRightClick` below is that decision, pure so it
 * can be tested without a DOM.
 *
 * An arm never outlives its press: a window pointerup clears it after the
 * target's own handler has had its chance, so a release that landed somewhere
 * else (a right-drag off the element) can't leave it primed to fire on some
 * later, unrelated click.
 */
// A right-press that travels further than this is a drag, not a click, so
// the armed menu is dropped rather than opening wherever the button came up.
const DRAG_SLOP_PX = 8;

export type RightClickDecision =
  { kind: 'open' } | { kind: 'arm'; button: number; x: number; y: number };

/** What a `contextmenu` event should do: open straight away (the release is
 *  already behind us, or there was never a pointer), or arm and wait for the
 *  release of the button that is still held. */
export function pendingRightClick(e: {
  button: number;
  buttons: number;
  clientX: number;
  clientY: number;
}): RightClickDecision {
  // `buttons` is a bitmask of what is held right now. 0 = nothing held.
  if (!e.buttons) return { kind: 'open' };
  return { kind: 'arm', button: e.button, x: e.clientX, y: e.clientY };
}

/** Does this release complete the armed press? Same button, and it didn't
 *  travel far enough to be a drag. */
export function completesRightClick(
  armed: { button: number; x: number; y: number },
  up: { button: number; clientX: number; clientY: number },
): boolean {
  if (up.button !== armed.button) return false;
  return Math.hypot(up.clientX - armed.x, up.clientY - armed.y) <= DRAG_SLOP_PX;
}

type OpenPoint = { clientX: number; clientY: number };

export function useRightClickRelease(
  open: (e: OpenPoint) => void,
  // The canvas surface is the last stop for a right-click, so it has nothing
  // to stop; elements stop it so the canvas doesn't also open the tab menu.
  { stopPropagation = true }: { stopPropagation?: boolean } = {},
) {
  const armedRef = useRef<{ button: number; x: number; y: number } | null>(null);
  const clearRef = useRef<(() => void) | null>(null);

  const dropWindowClear = () => {
    clearRef.current?.();
    clearRef.current = null;
  };
  useEffect(() => dropWindowClear, []);

  const onContextMenu = (e: ReactMouseEvent) => {
    e.preventDefault();
    if (stopPropagation) e.stopPropagation();
    dropWindowClear();
    const decision = pendingRightClick(e);
    if (decision.kind === 'open') {
      armedRef.current = null;
      open({ clientX: e.clientX, clientY: e.clientY });
      return;
    }
    armedRef.current = { button: decision.button, x: decision.x, y: decision.y };
    // Window bubble listeners run after React's root listener, so the
    // target's onPointerUp consumes the arm first; this only clears one the
    // target never saw (released elsewhere, or cancelled).
    const clear = () => {
      window.setTimeout(() => {
        armedRef.current = null;
      }, 0);
      dropWindowClear();
    };
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    clearRef.current = () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    const armed = armedRef.current;
    if (!armed) return;
    armedRef.current = null;
    // Deliberately NOT stopPropagation: gestures end on a WINDOW pointerup,
    // and React dispatches from the root container — stopping here means the
    // window never hears the release, so a drag armed by the press stays
    // live and the element follows the cursor after the button is up.
    if (!completesRightClick(armed, e)) return;
    open(e);
  };

  // Lets a caller cancel an armed open (e.g. the press became a drag).
  const disarm = () => {
    armedRef.current = null;
  };

  return { onContextMenu, onPointerUp, disarm };
}
