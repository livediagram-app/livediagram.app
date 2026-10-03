'use client';

// Whether a bar across the top of the canvas reaches into a top-corner panel stack, MEASURED: the
// Toolbar strip (docs/specs/007-editor/toolbar-layout.md "The top corners give way to the strip") or
// a whiteboard's dock at the top (docs/specs/023-draw-mode/draw-mode.md "Where the dock sits").
// The bar's real extent against each top corner's real extent, re-checked whenever
// either resizes (a panel docks, the strip gains a tile) or the window does.
// Moving the corners below the strip changes neither extent horizontally, so
// the answer can't feed back on itself.

import { useLayoutEffect, useState, type RefObject } from 'react';
import { stripCrowdsCorners } from '@/components/palette/toolbar-strip-tiles';

// The Toolbar layout's strip: its tile row, not the full-width positioning layer around it.
export const STRIP_SELECTOR = '[data-toolbar-palette] [data-tour-id="palette"]';

export function useStripCrowdsCorners(
  corners: RefObject<Partial<Record<string, HTMLElement | null>>>,
  // The bar to measure; null when there is none (or on a phone, where the strip always spans).
  selector: string | null,
  // Changes whenever a top corner gains or loses panels: an empty corner
  // doesn't render, so there was nothing to observe until then.
  occupancy: string,
  // Changes whenever the UI scale of the strip or the panels does
  // (docs/specs/007-editor/ui-scale.md): a zoom change resizes no observed
  // box, so it re-measures here.
  scaleKey: string,
): boolean {
  const [crowded, setCrowded] = useState(false);

  useLayoutEffect(() => {
    if (!selector || typeof ResizeObserver === 'undefined') return;
    const strip = document.querySelector<HTMLElement>(selector);
    const tops = [corners.current['top-left'], corners.current['top-right']].filter(
      (el): el is HTMLElement => !!el,
    );
    if (!strip) {
      console.warn('[top-bar] nothing to measure against the top corners', selector);
      return;
    }
    const measure = () => {
      const s = strip.getBoundingClientRect();
      setCrowded(
        stripCrowdsCorners(
          s,
          tops.map((el) => el.getBoundingClientRect()),
        ),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    tops.forEach((el) => observer.observe(el));
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [corners, selector, occupancy, scaleKey]);

  // Off (no bar, or a phone, where the strip always spans): never crowded, whatever the last
  // measurement said.
  return selector !== null && crowded;
}
