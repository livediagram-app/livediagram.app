'use client';

import { useMemo } from 'react';
import type { Deck, Tab } from '@livediagram/document';
import { useIconCatalogs } from '@liveworkspace/workbench/hooks/ui/useIconCatalogs';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { slideThumbFor, type SlideThumb } from '@/lib/slide-thumb';

export type { SlideThumb } from '@/lib/slide-thumb';

// Per-slide preview markup for the Slide Deck panel's rows (docs/specs/012-collaboration/presentation-mode.md), from
// the SAME headless renderer the Map, the exports and the Layers panel's own
// previews use. A deck row without a picture is a list of names, and the
// whole point of a slide sorter is seeing the shape of the talk.
//
// One difference from the layer previews, and it is the reason this is its own
// hook rather than a parameter on that one: every layer preview shares ONE
// viewBox (the whole tab's content bounds) so each band shows where its
// elements actually sit. Slides cannot do that — a deck spans tabs, and two
// tabs share no coordinate space — so each slide is framed to ITS OWN bounds,
// which is also what the presentation does when it runs.
//
// The markup is our own renderer's output (user text is xmlEscaped inside it),
// so injecting it into an <svg> is safe.

export function useSlideThumbnails(deck: Deck, tabs: Tab[]): Map<string, SlideThumb> {
  // Re-render once the async icon catalogues land so icon glyphs pop in.
  const iconsLoaded = useIconCatalogs();
  // The canvas's surface: a slide is pictured on the paper as the canvas shows it.
  const surface = useCanvasSurface();
  return useMemo(() => {
    const out = new Map<string, SlideThumb>();
    if (deck.slides.length === 0) return out;
    const byId = new Map(tabs.map((t) => [t.id, t]));
    for (const slide of deck.slides) {
      const tab = byId.get(slide.tabId);
      if (!tab) continue;
      const thumb = slideThumbFor(slide, tab, {
        iconsLoaded,
        surface,
      });
      if (thumb) out.set(slide.id, thumb);
    }
    return out;
  }, [deck, tabs, iconsLoaded, surface]);
}
