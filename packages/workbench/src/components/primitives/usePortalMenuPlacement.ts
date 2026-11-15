'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { clampToViewport, VIEWPORT_EDGE_MARGIN } from '../../lib/clamp-to-viewport';
import { useReposition } from '../../hooks/canvas/useReposition';
import { besideSpot } from './beside-placement';

export type PortalMenuPlacement = 'above' | 'below' | 'above-start' | 'below-start';

// Right-align the menu's right edge with the anchor's right edge (or, `-start`, its left edge
// with the anchor's left edge, for a wide trigger such as a board's Add Card row) and place
// it above or below, with a small gap.
export const PLACEMENT_TRANSFORM: Record<PortalMenuPlacement, string> = {
  above: 'translate(-100%, calc(-100% - 4px))',
  below: 'translate(-100%, 4px)',
  'above-start': 'translate(0, calc(-100% - 4px))',
  'below-start': 'translate(0, 4px)',
};

/**
 * Where an anchored PortalMenu sits, and its outside-press dismissal: it hangs off the anchor's
 * bounding rect, is nudged back inside the viewport, and closes on a press outside both itself
 * and its anchor (the anchor's own click toggles it). `node` is the rendered menu, null until it
 * is placed. With `beside` (the card the menu belongs to), it opens beside that card instead,
 * out of its way (besideSpot), once it can measure itself, and hangs from the anchor only when
 * neither side has room. `flat` says the spot is its top-left corner, with no placement transform; `maxHeight`, set
 * only for a menu taller than the screen, is the height it is held to, scrolling inside.
 */
export function usePortalMenuPlacement(
  anchor: HTMLElement | null,
  placement: PortalMenuPlacement,
  node: HTMLElement | null,
  onClose: () => void,
  beside?: HTMLElement | null,
) {
  const [pos, setPos] = useState<{ left: number; top: number; flat?: boolean } | null>(null);
  const [adjust, setAdjust] = useState({ x: 0, y: 0 });

  const reposition = useCallback(() => {
    if (!anchor) return;
    if (beside && node) {
      const spot = besideSpot(
        beside.getBoundingClientRect(),
        node.offsetWidth,
        window.innerWidth,
        VIEWPORT_EDGE_MARGIN,
      );
      if (spot) return setPos({ ...spot, flat: true });
    }
    const r = anchor.getBoundingClientRect();
    const start = placement.endsWith('-start');
    const below = placement.startsWith('below');
    setPos({ left: start ? r.left : r.right, top: below ? r.bottom : r.top });
  }, [anchor, placement, beside, node]);
  useReposition(reposition);

  // A menu taller than the screen is held to it and scrolls inside itself (docs/specs/004-interface-design/menus.md
  // "A menu taller than the screen"): clamped as it stood, its top went above the screen's edge, out of reach (the
  // photo Blend modes on a 390 x 844 phone, Work Tracker 593). Read from the content's own height (`scrollHeight`),
  // which the cap leaves as it is, so applying it never undoes it.
  const [cap, setCap] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!node || !pos) return;
    const room = window.innerHeight - 2 * VIEWPORT_EDGE_MARGIN;
    const nextCap = node.scrollHeight > room ? room : null;
    // The cap first; the clamp runs again once it is drawn, on the menu's capped size.
    if (nextCap !== cap) return setCap(nextCap);
    // Clamped relative to the adjust already applied, so re-measuring after a nudge settles.
    const rect = node.getBoundingClientRect();
    setAdjust((prev) => {
      const next = clampToViewport(rect, prev);
      return next.x === prev.x && next.y === prev.y ? prev : next;
    });
  }, [pos, node, cap]);

  useEffect(() => {
    // A pointerdown, in the capture phase: the canvas cancels its own pointerdown (which stops the browser sending
    // mousedown at all) and a touch sends none, so either would leave the menu open.
    const handler = (e: PointerEvent) => {
      if (!node) return;
      // A MenuFlyoutSection portals its panel outside this menu but marks it
      // data-menu-flyout, so clicks inside the flyout count as inside the menu. An AnchoredPopover the menu opened
      // (the full colour picker of a colour row in it) is the menu's own too: closing here unmounted the picker
      // before its pick landed. A ConfirmPopover a row opens (portalled, marked data-confirm-popover) is the
      // menu's own the same way: its Confirm press would otherwise close the menu first.
      if (
        e.target instanceof Element &&
        e.target.closest('[data-menu-flyout], [data-anchored-popover], [data-confirm-popover]')
      )
        return;
      // Clicks anywhere INSIDE the anchor (including its inner svg / text
      // nodes) are the trigger's own toggle to handle — closing here too
      // made the toggle reopen the menu it had just closed.
      if (
        e.target instanceof Node &&
        !node.contains(e.target) &&
        !(anchor?.contains(e.target) ?? false)
      ) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [onClose, anchor, node]);

  return pos
    ? {
        left: pos.left + adjust.x,
        top: pos.top + adjust.y,
        flat: pos.flat ?? false,
        maxHeight: cap ?? undefined,
      }
    : null;
}
