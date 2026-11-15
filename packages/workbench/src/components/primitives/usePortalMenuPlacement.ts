'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { POPOVER_VIEWPORT_MARGIN } from '@liveworkspace/ui';
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
 * only for a menu taller than the screen, is the height it is held to, scrolling inside. `placement` is the side it
 * opens on: the one asked for, or the other side when the menu does not fit there and the other side has more room
 * (flipSide), so a menu opened from a control low on the screen opens above it rather than being nudged up over it.
 */
// The gap between the anchor and the menu (PLACEMENT_TRANSFORM's 4px).
const ANCHOR_GAP_PX = 4;

// The side a menu `height` tall opens on, from an anchor at `top` to `bottom` on a screen `viewport` tall: the side
// asked for while the menu fits there, else the other side when it has more room (docs/specs/004-interface-design/
// menus.md "Opening on the side with room"). Worked out from the anchor and the menu's own height only, so a
// re-placement never flips it back.
export function flipSide(
  placement: PortalMenuPlacement,
  anchor: { top: number; bottom: number },
  height: number,
  viewport: number,
  margin: number,
): PortalMenuPlacement {
  const below = placement.startsWith('below');
  const roomBelow = viewport - anchor.bottom - ANCHOR_GAP_PX - margin;
  const roomAbove = anchor.top - ANCHOR_GAP_PX - margin;
  const [room, other] = below ? [roomBelow, roomAbove] : [roomAbove, roomBelow];
  if (height <= room || other <= room) return placement;
  const start = placement.endsWith('-start') ? '-start' : '';
  return `${below ? 'above' : 'below'}${start}` as PortalMenuPlacement;
}

export function usePortalMenuPlacement(
  anchor: HTMLElement | null,
  placement: PortalMenuPlacement,
  node: HTMLElement | null,
  onClose: () => void,
  beside?: HTMLElement | null,
) {
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    flat?: boolean;
    side: PortalMenuPlacement;
  } | null>(null);
  const [adjust, setAdjust] = useState({ x: 0, y: 0 });

  // A menu taller than the screen is held to it and scrolls inside itself (docs/specs/004-interface-design/menus.md
  // "A menu taller than the screen"): clamped as it stood, its top went above the screen's edge, out of reach (the
  // photo Blend modes on a 390 x 844 phone, Work Tracker 593). Read from the content's own height (`scrollHeight`),
  // which the cap leaves as it is, so applying it never undoes it; the clamp below runs again on the capped size.
  const [cap, setCap] = useState<number | null>(null);

  const reposition = useCallback(() => {
    if (!anchor) return;
    if (node) {
      // The edge inset read from @liveworkspace/ui itself (VIEWPORT_EDGE_MARGIN's source), which the products' menu
      // tests leave unmocked when they stub clampToViewport.
      const room = window.innerHeight - 2 * POPOVER_VIEWPORT_MARGIN;
      setCap(node.scrollHeight > room ? room : null);
    }
    if (beside && node) {
      const spot = besideSpot(
        beside.getBoundingClientRect(),
        node.offsetWidth,
        window.innerWidth,
        VIEWPORT_EDGE_MARGIN,
      );
      if (spot) return setPos({ ...spot, flat: true, side: placement });
    }
    const r = anchor.getBoundingClientRect();
    const side = node
      ? flipSide(
          placement,
          r,
          Math.min(node.scrollHeight, window.innerHeight - 2 * POPOVER_VIEWPORT_MARGIN),
          window.innerHeight,
          POPOVER_VIEWPORT_MARGIN,
        )
      : placement;
    const start = side.endsWith('-start');
    const below = side.startsWith('below');
    setPos({ left: start ? r.left : r.right, top: below ? r.bottom : r.top, side });
  }, [anchor, placement, beside, node]);
  useReposition(reposition);

  useLayoutEffect(() => {
    if (!node || !pos) return;
    // Clamped relative to the adjust already applied, so re-measuring after a nudge settles; again once a cap is
    // drawn, on the menu's capped size.
    const clamp = () => {
      const rect = node.getBoundingClientRect();
      setAdjust((prev) => {
        const next = clampToViewport(rect, prev);
        return next.x === prev.x && next.y === prev.y ? prev : next;
      });
    };
    clamp();
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
        placement: pos.side,
        maxHeight: cap ?? undefined,
      }
    : null;
}
