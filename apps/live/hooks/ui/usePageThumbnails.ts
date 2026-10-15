'use client';

// Every page's picture for the Contents popover (docs/specs/007-editor/illustrate-pages.md
// "Contents"): each page drawn as a page slide is drawn in the Slide Deck, so a page looks the same
// in both. Only while the popover is open (the caller mounts this then); redrawn when the tab's
// elements or pages change, with the tab's arrow labels laid out once rather than once a page.
import { useMemo } from 'react';
import type { Slide, Tab } from '@livediagram/document';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import { slideThumbFor, tabArrowLabels, type SlideThumb } from '@/lib/slide-thumb';

export type PageThumbTab = Pick<
  Tab,
  'id' | 'name' | 'elements' | 'pages' | 'layers' | 'font' | 'finish' | 'articles'
>;

export function usePageThumbnails(
  tab: PageThumbTab,
  pageIds: readonly string[],
): Map<string, SlideThumb> {
  const iconsLoaded = useIconCatalogs();
  const key = pageIds.join(',');
  return useMemo(() => {
    const full = tab as Tab;
    const labels = full.elements.some((e) => e.type === 'arrow') ? tabArrowLabels(full) : undefined;
    const out = new Map<string, SlideThumb>();
    for (const pageId of pageIds) {
      const slide: Slide = { id: `contents-${pageId}`, tabId: tab.id, elementIds: [], pageId };
      const thumb = slideThumbFor(slide, full, { iconsLoaded, ...(labels ? { labels } : {}) });
      if (thumb) out.set(pageId, thumb);
    }
    return out;
    // Redrawn on the inputs a picture shows, not on the tab object's identity.
    // oxlint-disable-next-line react-hooks-js/exhaustive-deps
  }, [tab.elements, tab.pages, tab.layers, tab.font, tab.finish, tab.articles, key, iconsLoaded]);
}
