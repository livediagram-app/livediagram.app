'use client';

import { pageRulingOf, pageWritingBars } from '@/lib/doc/doc-export';
import { docOpsToSvg } from '@/lib/doc/doc-draw';
import { useMemo } from 'react';
import {
  r2,
  resolveSlide,
  slideFrame,
  illustratePagesOf,
  layOutIllustratePages,
  arrowLabelFontStack,
  arrowLabelPass,
  svgArrow,
  svgBoxed,
  type Deck,
  type Tab,
} from '@livediagram/document';
import { resolveIconArtLoaded, resolveStickerArtLoaded } from '@/lib/icon-registry';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import { pageExportFrame } from '@/lib/export-page';

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

export type SlideThumb = { markup: string; viewBox: string };

export function useSlideThumbnails(deck: Deck, tabs: Tab[]): Map<string, SlideThumb> {
  // Re-render once the async icon catalogues land so icon glyphs pop in.
  const iconsLoaded = useIconCatalogs();
  return useMemo(() => {
    // The resolvers find nothing until the catalogues land; gating them on the
    // flag makes the rebuild on landing a real input of this memo.
    const art = iconsLoaded
      ? { resolveIconArt: resolveIconArtLoaded, resolveStickerArt: resolveStickerArtLoaded }
      : {};
    const out = new Map<string, SlideThumb>();
    if (deck.slides.length === 0) return out;
    const byId = new Map(tabs.map((t) => [t.id, t]));
    for (const slide of deck.slides) {
      const tab = byId.get(slide.tabId);
      if (!tab) continue;
      const elements = resolveSlide(slide, tab);
      // A page slide is its page: framed to it, painted on its background.
      const bounds = slideFrame(slide, tab);
      if (!bounds) continue;
      // Boxed first, then arrows, matching the canvas's own paint order so a
      // connector never disappears under the box it points at.
      const parts: string[] = [];
      const page = slide.pageId
        ? layOutIllustratePages(illustratePagesOf(tab)).find((p) => p.id === slide.pageId)
        : undefined;
      if (page) {
        parts.push(
          pageExportFrame(page, {
            idPrefix: `lvd-slide-${slide.id}`,
            ruling: pageRulingOf(tab, page),
          }).backgroundSvg,
        );
        // A document page's writing, as lines of text.
        const bars = pageWritingBars(page);
        if (bars.length) parts.push(docOpsToSvg(bars));
      }
      for (const el of elements) {
        if (el.type !== 'arrow') {
          parts.push(
            svgBoxed(el, {
              ...art,
              tabFont: tab.font,
            }),
          );
        }
      }
      // Labels are laid out against the whole tab, as the canvas lays them out.
      const labels = arrowLabelPass(tab.elements, {
        fontFamilyOf: (a) => arrowLabelFontStack(a, tab.font),
      });
      for (const el of elements) {
        // Arrows resolve their endpoints against the WHOLE tab, not just the
        // slide: an arrow is on the slide because both its ends are, and it
        // still needs their real positions to draw itself.
        if (el.type === 'arrow')
          parts.push(
            // Breaks only around the slide's own boxes, the ones drawn here.
            svgArrow(
              el,
              tab.elements,
              'light',
              tab.font,
              labels,
              `lvd-slide-${slide.id}-ko-`,
              elements,
            ),
          );
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
  }, [deck, tabs, iconsLoaded]);
}
