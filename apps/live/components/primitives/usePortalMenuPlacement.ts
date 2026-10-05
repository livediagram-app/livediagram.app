'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { clampToViewport } from '@/lib/clamp-to-viewport';
import { useReposition } from '@/hooks/canvas/useReposition';

export type PortalMenuPlacement = 'above' | 'below';

// Right-align the menu's right edge with the anchor's right edge and place
// it above or below, with a small gap.
export const PLACEMENT_TRANSFORM: Record<PortalMenuPlacement, string> = {
  above: 'translate(-100%, calc(-100% - 4px))',
  below: 'translate(-100%, 4px)',
};

/**
 * Where an anchored PortalMenu sits, and its outside-press dismissal: it hangs off the anchor's
 * bounding rect, is nudged back inside the viewport, and closes on a press outside both itself
 * and its anchor (the anchor's own click toggles it). `node` is the rendered menu, null until it
 * is placed.
 */
export function usePortalMenuPlacement(
  anchor: HTMLElement | null,
  placement: PortalMenuPlacement,
  node: HTMLElement | null,
  onClose: () => void,
) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [adjust, setAdjust] = useState({ x: 0, y: 0 });

  const reposition = useCallback(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    setPos({ left: r.right, top: placement === 'below' ? r.bottom : r.top });
  }, [anchor, placement]);
  useReposition(reposition);

  useLayoutEffect(() => {
    if (!node || !pos) return;
    // Clamped relative to the adjust already applied, so re-measuring after a nudge settles.
    const clamp = () => {
      const rect = node.getBoundingClientRect();
      setAdjust((prev) => {
        const next = clampToViewport(rect, prev);
        return next.x === prev.x && next.y === prev.y ? prev : next;
      });
    };
    clamp();
  }, [pos, node]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!node) return;
      // A MenuFlyoutSection portals its panel outside this menu but marks it
      // data-menu-flyout, so clicks inside the flyout count as inside the menu.
      if (e.target instanceof Element && e.target.closest('[data-menu-flyout]')) return;
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
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchor, node]);

  return pos ? { left: pos.left + adjust.x, top: pos.top + adjust.y } : null;
}
