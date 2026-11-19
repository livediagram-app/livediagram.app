'use client';

// Where the Tab Style popover sits (liveworkspace/docs/specs/011-workbench/tab-style.md "Placement"): hanging from the
// product's opener when it names one and it is on screen (its top just under it, its right edge on the opener's), else
// rising from the cluster's Theme & canvas button (its bottom just above the button, its right edge on the cluster's,
// keeping as much of the work as it can in view). Null with neither on screen, or on a phone (below 640 px), where it
// stays a dialog.
import { use, useState } from 'react';
import { browser } from 'react-dom';

/** The gap between the popover and what it hangs from. */
const ANCHOR_GAP_PX = 8;
/** Below this width the dialog is a bottom sheet. */
const PHONE_MAX_PX = 640;
/** The popover never meets the window's right edge. */
const EDGE_MIN_PX = 8;

export type TabStyleAnchor = { right: number; top: number } | { right: number; bottom: number };

/** Where the popover sits now, read once: nothing it hangs from moves while it is open. */
export function tabStyleAnchor(opener?: () => Element | null): TabStyleAnchor | null {
  if (window.innerWidth < PHONE_MAX_PX) return null;
  const from = opener?.()?.getBoundingClientRect();
  if (from && from.width > 0) {
    return {
      right: Math.max(EDGE_MIN_PX, Math.round(window.innerWidth - from.right)),
      top: Math.round(from.bottom + ANCHOR_GAP_PX),
    };
  }
  const brush = document.querySelector<HTMLElement>('[data-tour-id="canvas-theme"]');
  const box = brush?.getBoundingClientRect();
  if (!box || box.width === 0) return null;
  // The cluster's right edge (the zoom controls end it), else the brush's own.
  const cluster = document
    .querySelector<HTMLElement>('[data-zoom-cluster]')
    ?.getBoundingClientRect();
  const edge = cluster && cluster.width > 0 ? Math.max(cluster.right, box.right) : box.right;
  return {
    right: Math.max(EDGE_MIN_PX, Math.round(window.innerWidth - edge)),
    bottom: Math.round(window.innerHeight - box.top + ANCHOR_GAP_PX),
  };
}

/** The popover's place as the dialog opens, in the browser only (use(browser())). */
export function useTabStyleAnchor(opener?: () => Element | null): TabStyleAnchor | null {
  use(browser());
  const [anchor] = useState(() => tabStyleAnchor(opener));
  return anchor;
}
