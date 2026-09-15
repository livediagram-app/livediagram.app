'use client';

import { useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

/**
 * Right-click opens a context menu on RELEASE, not on press.
 *
 * X11 fires `contextmenu` on mouse-DOWN (Windows fires it on up), so opening
 * straight from that event made the menu appear under a still-held button:
 * it jumped out mid-gesture, and a right-drag left it stranded where the
 * press began. Every other affordance in the editor commits on release, so
 * the menu should too.
 *
 * The `contextmenu` handler therefore only suppresses the native menu and
 * ARMS the gesture; the pointerup that follows fires the open. Arming (rather
 * than just listening for button 2 on pointerup) keeps the existing bail-outs
 * intact: if `contextmenu` never fired — a modifier-click the browser routes
 * elsewhere, a right-drag that left the target — nothing opens.
 */
// A right-press that travels further than this is a drag, not a click, so
// the armed menu is dropped rather than opening wherever the button came up.
const DRAG_SLOP_PX = 8;

export function useRightClickRelease(open: (e: ReactPointerEvent) => void) {
  const armedRef = useRef(false);
  const originRef = useRef({ x: 0, y: 0 });

  const onContextMenu = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    armedRef.current = true;
    originRef.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (e.button !== 2 || !armedRef.current) return;
    armedRef.current = false;
    // Deliberately NOT stopPropagation: gestures end on a WINDOW pointerup,
    // and React dispatches from the root container — stopping here means the
    // window never hears the release, so a drag armed by the press stays
    // live and the element follows the cursor after the button is up.
    const { x, y } = originRef.current;
    if (Math.hypot(e.clientX - x, e.clientY - y) > DRAG_SLOP_PX) return;
    open(e);
  };

  // Lets a caller cancel an armed open (e.g. the press became a drag).
  const disarm = () => {
    armedRef.current = false;
  };

  return { onContextMenu, onPointerUp, disarm };
}
