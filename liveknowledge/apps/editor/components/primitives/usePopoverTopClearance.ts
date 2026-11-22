'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import { usePaletteStripBox } from '@liveworkspace/workbench/components/chrome/PaletteTray';

// The gap a popover keeps under a toolbar it would otherwise run beneath.
const TOOLBAR_GAP_PX = 8;

// How far below its box's top a popover that opens UP from a bottom dock button (the Vote, Layers) may
// reach, in screen px: `fallback` where nothing is in the way; under the palette strip, where it runs across the
// canvas's top and meets the popover's column, the strip's bottom plus 8 px. On a phone the strip spans the
// width: a tall panel ran up under it and hid its own header (docs/specs/007-editor/toolbar-layout.md "Layout
// details").
export function usePopoverTopClearance(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  fallback = 12,
): number {
  const strip = usePaletteStripBox(active);
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
    // The strip at the top whose span meets the panel's column.
    if (
      strip &&
      strip.top <= box.top + box.height / 2 &&
      strip.left < r.right &&
      strip.left + strip.width > r.left
    ) {
      next = Math.max(next, strip.bottom - box.top + TOOLBAR_GAP_PX);
    }
    setClear(next);
  }, [ref, active, fallback, strip]);
  return clear;
}
