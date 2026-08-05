'use client';

import { useMemo } from 'react';
import {
  r2,
  resolveSlide,
  slideBounds,
  svgArrow,
  svgBoxed,
  type Deck,
  type Tab,
} from '@livediagram/diagram';
import { resolveIconArtLoaded, resolveStickerArtLoaded } from '@/lib/icon-registry';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';

// Per-slide preview markup for the Slide Deck panel's rows (spec/31), from
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

export type SlideThumb = { markup: string; viewBox: string };

export function useSlideThumbnails(deck: Deck, tabs: Tab[]): Map<string, SlideThumb> {
  // Re-render once the async icon catalogues land so icon glyphs pop in.
  const iconsLoaded = useIconCatalogs();
  return useMemo(() => {
    const out = new Map<string, SlideThumb>();
    if (deck.slides.length === 0) return out;
    const byId = new Map(tabs.map((t) => [t.id, t]));
    for (const slide of deck.slides) {
      const tab = byId.get(slide.tabId);
      if (!tab) continue;
      const elements = resolveSlide(slide, tab);
      const bounds = slideBounds(elements);
      if (!bounds) continue;
      // Boxed first, then arrows, matching the canvas's own paint order so a
      // connector never disappears under the box it points at.
      const parts: string[] = [];
      for (const el of elements) {
        if (el.type !== 'arrow') {
          parts.push(svgBoxed(el, undefined, resolveIconArtLoaded, resolveStickerArtLoaded));
        }
      }
      for (const el of elements) {
        // Arrows resolve their endpoints against the WHOLE tab, not just the
        // slide: an arrow is on the slide because both its ends are, and it
        // still needs their real positions to draw itself.
        if (el.type === 'arrow') parts.push(svgArrow(el, tab.elements));
      }
      const pad = 8;
      out.set(slide.id, {
        markup: parts.join(''),
        viewBox: `${r2(bounds.x - pad)} ${r2(bounds.y - pad)} ${r2(bounds.w + pad * 2)} ${r2(
          bounds.h + pad * 2,
        )}`,
      });
    }
    return out;
    // iconsLoaded re-runs the build when the catalogue chunk lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, tabs, iconsLoaded]);
}
