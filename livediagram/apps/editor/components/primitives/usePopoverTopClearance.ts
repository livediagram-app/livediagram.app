'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import { usePaletteStripBox, useToolbarBox } from '@/components/chrome/PaletteTray';

// The gap a popover keeps under a toolbar it would otherwise run beneath.
const TOOLBAR_GAP_PX = 8;

// How far below its box's top a popover that opens UP from a bottom dock button (the Vote, the Poll, Layers) may
// reach, in screen px: `fallback` where nothing is in the way; under a toolbar across the canvas's top that its
// column meets, the palette strip or Draw's dock, the toolbar's bottom plus 8 px. On a phone the strip spans the
// width: a tall panel ran up under it and hid its own header (docs/specs/007-editor/toolbar-layout.md "Layout
// details").
export function usePopoverTopClearance(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  fallback = 12,
): number {
  const strip = usePaletteStripBox(active);
  const dock = useToolbarBox('[data-whiteboard-dock]', active);
  const [clear, setClear] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.offsetParent;
    if (!active || !el || !host) {
      setClear(fallback);
      return;
    }
    const box = host.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    let next = fallback;
    for (const bar of [strip, dock]) {
      // A toolbar at the top (Draw's dock can sit at the bottom) whose span meets the panel's column.
      if (!bar || bar.top > box.top + box.height / 2) continue;
      if (bar.left >= r.right || bar.left + bar.width <= r.left) continue;
      next = Math.max(next, bar.bottom - box.top + TOOLBAR_GAP_PX);
    }
    setClear(next);
  }, [ref, active, fallback, strip, dock]);
  return clear;
}
