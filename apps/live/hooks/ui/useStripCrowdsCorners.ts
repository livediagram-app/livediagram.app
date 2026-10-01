'use client';

// Whether the Toolbar strip reaches into a top-corner panel stack
// (docs/specs/007-editor/toolbar-layout.md "The top corners give way to the strip"), MEASURED: the strip's
// real extent against each top corner's real extent, re-checked whenever
// either resizes (a panel docks, the strip gains a tile) or the window does.
// Moving the corners below the strip changes neither extent horizontally, so
// the answer can't feed back on itself.

import { useLayoutEffect, useState, type RefObject } from 'react';
import { stripCrowdsCorners } from '@/components/palette/toolbar-strip-tiles';

export function useStripCrowdsCorners(
  corners: RefObject<Partial<Record<string, HTMLElement | null>>>,
  enabled: boolean,
  // Changes whenever a top corner gains or loses panels: an empty corner
  // doesn't render, so there was nothing to observe until then.
  occupancy: string,
  // The UI scale the strip and panels are drawn at
  // (docs/specs/007-editor/ui-scale.md): a zoom change resizes no observed
  // box, so it re-measures here.
  scale: number,
): boolean {
  const [crowded, setCrowded] = useState(false);

  useLayoutEffect(() => {
    if (!enabled || typeof ResizeObserver === 'undefined') return;
    const strip = document.querySelector<HTMLElement>(
      '[data-toolbar-palette] [data-tour-id="palette"]',
    );
    const tops = [corners.current['top-left'], corners.current['top-right']].filter(
      (el): el is HTMLElement => !!el,
    );
    if (!strip) return;
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
  }, [corners, enabled, occupancy, scale]);

  // Off (no strip, or a phone, where it always spans): never crowded, whatever
  // the last measurement said.
  return enabled && crowded;
}
