// What each element on a page with a fill of its own is drawn for (docs/specs/011-theme/light-and-dark.md
// "A page's own paper"): the page's surface, and the tab theme's map for each surface. Undefined off Pages
// mode or where no page has a fill, so the canvas keeps its one-map fast path.
import { useMemo } from 'react';
import { elementPageSurfaces, type Element, type LaidOutPage } from '@livepages/document';
import type { PageView } from '@/lib/stock-colour-projector';
import { themeViewMap } from '@/lib/themes';

export function usePageView(
  elements: Element[],
  pages: readonly LaidOutPage[] | undefined,
  themeId: string | undefined,
): PageView | undefined {
  // The theme in each half: themeViewMap caches per theme and half, so the pair keeps its identity
  // until the theme (or a custom theme's registered colours) changes.
  const light = themeViewMap(themeId, 'light');
  const dark = themeViewMap(themeId, 'dark');
  const maps = useMemo(() => ({ light, dark }), [light, dark]);
  return useMemo(() => {
    if (!pages) return undefined;
    const surfaces = elementPageSurfaces(elements, pages);
    return surfaces.size ? { surfaces, maps } : undefined;
  }, [elements, pages, maps]);
}
