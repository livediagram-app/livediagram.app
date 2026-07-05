'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { MovablePanelProps } from './MovablePanel.types';

// The floating panel's geometry measurement, lifted out of MovablePanel:
// the body max-height cap (so the scrollable body never runs under the
// tab bar / zoom controls) and the onSize publish the Palette uses so
// stacked panels can align below it. Returns the computed cap.
export function useMovablePanelMeasure({
  ref,
  headerRef,
  position,
  stackBelowY,
  defaultCorner,
  docked,
  dockedCorner,
  onSize,
}: {
  ref: RefObject<HTMLDivElement | null>;
  headerRef: RefObject<HTMLDivElement | null>;
  position: MovablePanelProps['position'];
  stackBelowY: MovablePanelProps['stackBelowY'];
  defaultCorner: MovablePanelProps['defaultCorner'];
  docked: boolean;
  dockedCorner: MovablePanelProps['dockedCorner'];
  onSize: MovablePanelProps['onSize'];
}): number | null {
  // Max height for the panel body so it never extends below the viewport.
  // Recomputed on mount, on resize, and whenever the panel's position
  // changes (drag end updates `position`; stackBelowY changes move it too).
  const [bodyMaxH, setBodyMaxH] = useState<number | null>(null);

  // Constrain panel body to the remaining viewport space below its header.
  // Uses rAF so the panel has painted at its new position before we measure.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const compute = () => {
      const panel = ref.current;
      if (!panel) return;
      const panelRect = panel.getBoundingClientRect();
      const headerH = headerRef.current?.getBoundingClientRect().height ?? 36;
      // Grow the scrollable body to the most space actually available,
      // rather than a fixed reserve. The hard bottom edge is the top of
      // the TabBar (the canvas's real bottom; falls back to the viewport
      // bottom on routes without one). If the panel overlaps the floating
      // zoom controls' column, stop above those too so its last rows stay
      // clickable. Previously a fixed 16px reserve let long panels (Theme /
      // Canvas accordions on a laptop) run under the tab bar / behind the
      // zoom bar.
      const GAP = 12;
      // A panel anchored at a BOTTOM corner grows UPWARD, so its top edge
      // moves with its own body content. Measuring the body cap from
      // panelRect.top there would feed back through the ResizeObserver
      // below (taller body -> higher top -> bigger cap -> ...) AND, because
      // the downward space to the tab bar gets clamped against the zoom
      // controls in the bottom-right, would shrink the panel to almost
      // nothing. Its bottom edge is stable, so measure the space up from
      // there instead. This covers both the legacy CSS bottom corner
      // (position null + a bottom defaultCorner) and a panel DOCKED into a
      // bottom corner (spec/63), whose live corner is dockedCorner.
      const bottomAnchored = docked
        ? dockedCorner === 'bottom-left' || dockedCorner === 'bottom-right'
        : position === null && defaultCorner.startsWith('bottom');
      if (bottomAnchored) {
        setBodyMaxH(Math.max(panelRect.bottom - headerH - GAP * 2, 80));
        return;
      }
      const tabbar = document.querySelector('[data-editor-tabbar]');
      let bottomLimit = tabbar ? tabbar.getBoundingClientRect().top : window.innerHeight;
      const zoom = document.querySelector('[data-zoom-controls]');
      if (zoom) {
        const z = zoom.getBoundingClientRect();
        const overlapsX = panelRect.right > z.left && panelRect.left < z.right;
        if (overlapsX) bottomLimit = Math.min(bottomLimit, z.top);
      }
      setBodyMaxH(Math.max(bottomLimit - panelRect.top - headerH - GAP, 80));
    };
    const raf = requestAnimationFrame(compute);
    window.addEventListener('resize', compute);
    // Re-measure on any layout shift of the panel itself — accordions
    // expanding/collapsing, the panel settling into its stacked position,
    // or the zoom bar / tab bar mounting after first paint. Safe from a
    // feedback loop: bodyMaxH is derived from the panel's TOP and the
    // chrome below it, never from the body content, so once the layout
    // settles compute returns the same value and React bails on the set.
    const panel = ref.current;
    const ro = panel ? new ResizeObserver(() => compute()) : null;
    ro?.observe(panel!);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', compute);
      ro?.disconnect();
    };
    // Re-measure after drag (position changes) or dynamic stacking
    // (stackBelowY changes). The two refs are stable; listed to satisfy
    // exhaustive-deps now they're props of this hook.
  }, [position, stackBelowY, defaultCorner, docked, dockedCorner, ref, headerRef]);

  // Publish the panel's bounding box upward whenever it changes
  // (the Palette uses this so the Comments / AI panels can stack below).
  // Cheap when no caller subscribes: the observer just never fires
  // a callback if `onSize` is undefined.
  useEffect(() => {
    if (!onSize) return;
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.contentRect;
      // offsetTop + offsetHeight gives the bottom edge in the
      // offsetParent's coordinate space. Both the Palette and the
      // stacked Editor share the same offsetParent (Canvas's main
      // element), so handing this value back as `stackBelowY` lets
      // the lower panel align below regardless of the upper panel's
      // own top-utility class.
      onSize({
        width: rect.width,
        height: rect.height,
        bottomY: node.offsetTop + node.offsetHeight,
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onSize, ref]);

  return bodyMaxH;
}
