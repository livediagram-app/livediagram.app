'use client';

import { useArticleLaidOutSeq } from '@/lib/article/article-editor-store';
import { useMemo } from 'react';
import type { Deck, Tab } from '@livediagram/document';
import type { Item, ItemTypeDef } from '@livediagram/items';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
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

// The document's items and types, so a Plan board on a slide draws its cards (docs/specs/012-collaboration/
// presentation-mode.md "Board slides").
export type ThumbnailPlan = { items: ReadonlyMap<string, Item>; types: readonly ItemTypeDef[] };

// Whether any slide names a Plan board, so item edits redraw the thumbnails only for a deck that shows one.
function deckShowsBoard(deck: Deck, tabs: Tab[]): boolean {
  const byId = new Map(tabs.map((t) => [t.id, t]));
  return deck.slides.some((s) => {
    const tab = byId.get(s.tabId);
    if (!tab || s.elementIds.length === 0) return false;
    const ids = new Set(s.elementIds);
    return tab.elements.some(
      (e) => ids.has(e.id) && e.type === 'shape' && e.shape === 'plan-board',
    );
  });
}

export function useSlideThumbnails(
  deck: Deck,
  tabs: Tab[],
  plan?: ThumbnailPlan,
): Map<string, SlideThumb> {
  // Re-render once the async icon catalogues land so icon glyphs pop in.
  const iconsLoaded = useIconCatalogs();
  // An article's writing laid out for the first time: its lines of text can be drawn now.
  const laidOut = useArticleLaidOutSeq();
  const showsBoard = useMemo(() => deckShowsBoard(deck, tabs), [deck, tabs]);
  const items = showsBoard ? plan?.items : undefined;
  const itemTypes = showsBoard ? plan?.types : undefined;
  return useMemo(() => {
    // Read so the pictures redraw once the writing they draw has been laid out.
    void laidOut;
    const out = new Map<string, SlideThumb>();
    if (deck.slides.length === 0) return out;
    const byId = new Map(tabs.map((t) => [t.id, t]));
    for (const slide of deck.slides) {
      const tab = byId.get(slide.tabId);
      if (!tab) continue;
      const thumb = slideThumbFor(slide, tab, {
        iconsLoaded,
        ...(items ? { items } : {}),
        ...(itemTypes ? { itemTypes } : {}),
      });
      if (thumb) out.set(slide.id, thumb);
    }
    return out;
  }, [deck, tabs, iconsLoaded, laidOut, items, itemTypes]);
}
