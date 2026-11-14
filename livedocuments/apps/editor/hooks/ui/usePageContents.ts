'use client';

// Pages mode's Contents as state (docs/specs/007-editor/pages-mode.md "Contents"): the shared hook
// (@liveworkspace/workbench/hooks/ui/usePageContents) bound to this editor's pages. What is
// livedocuments' own is handed in here: the rows (a slide's place in the deck, an article's title, a
// card's speaking time), where a dropped page lands (an article's pages move as one), the page's place in the deck on its ⋯ menu, and the
// pictures, each page framed as its slide.
import { useMemo } from 'react';
import {
  MAX_PAGES,
  pageKindOf,
  slideBuildOrders,
  type LaidOutPage,
  type PageKind,
} from '@livedocuments/document';
import {
  usePageContents as useSharedPageContents,
  type PageContents as SharedPageContents,
} from '@liveworkspace/workbench/hooks/ui/usePageContents';
import { usePageThumbnails, type PageThumbTab } from '@/hooks/ui/usePageThumbnails';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { contentsDropUnit, contentsRows, type ContentsRow } from '@/lib/page-contents';
import { elementsByPage } from '@/lib/elements-by-page';
import { pageTitleOf } from '@/lib/page-title';
import { useSettledElements } from '@/hooks/canvas/useSettledElements';
import { track } from '@/lib/telemetry';
import { pageRowSlides } from '@/components/canvas/page-row-slides';
import { requestPagePanel } from '@/lib/page-panel-request';

export function usePageContents({
  view,
  tab,
  here,
  settleMs = 0,
  onWent,
}: {
  view: PagesModeView;
  tab: PageThumbTab;
  // The page in view as the list opens, scrolled to and marked.
  here: string | undefined;
  // How long the tab rests before the thumbnails redraw (usePageThumbnails); 0 redraws at once.
  settleMs?: number;
  // After a press went to a page (the phone's sheet closes then).
  onWent?: () => void;
}): PageContents {
  const { pages, deck } = view;
  // Each unnamed slide's and infographic's title, read from its words as they settle (not every frame
  // of a drag or every key of a peer's typing): one pass over the tab's elements, O(n log n).
  const settled = useSettledElements(tab.elements);
  const titles = useMemo(() => {
    const unnamed = pages.filter((p) => !p.name?.trim() && !p.flow);
    if (unnamed.length === 0) return null;
    const byPage = elementsByPage(pages, settled);
    return new Map(unnamed.map((p) => [p.id, pageTitleOf(byPage.get(p.id) ?? [])]));
  }, [pages, settled]);
  // Each slide page's builds, read from its elements as they settle; nothing is read on a tab where nothing builds.
  const builds = useMemo(() => {
    const slides = pages.filter((p) => pageKindOf(p) === 'slide');
    if (slides.length === 0 || !settled.some((el) => 'build' in el && el.build)) return null;
    const byPage = elementsByPage(pages, settled);
    return new Map(slides.map((p) => [p.id, slideBuildOrders(byPage.get(p.id) ?? []).length]));
  }, [pages, settled]);
  const rows = useMemo(
    () =>
      contentsRows(pages, {
        ...(deck
          ? {
              inDeck: (id: string) => !!deck.slideOf(id),
              hiddenInSlides: (id: string) => deck.slideOf(id)?.hidden === true,
            }
          : {}),
        ...(view.articles ? { articles: view.articles.flows } : {}),
        ...(titles ? { titleOf: (id: string) => titles.get(id) } : {}),
        ...(builds ? { buildsOf: (id: string) => builds.get(id) ?? 0 } : {}),
      }),
    [pages, deck, view.articles, titles, builds],
  );
  const contents = useSharedPageContents({
    view,
    rows,
    dropUnit: (id, drop) => contentsDropUnit(pages, id, drop),
    // Another page like the last (its kind and shape).
    lastPage: pages.at(-1),
    maxPages: MAX_PAGES,
    openSettings: requestPagePanel,
    extraActions: (row) => pageRowSlides(row, deck),
    track: (type) => track('UI', 'Used', type),
    here,
    onWent,
  });
  const thumbs = usePageThumbnails(tab, contents.drawnIds, settleMs);
  return { ...contents, thumbs };
}

export type PageContents = SharedPageContents<ContentsRow, LaidOutPage, [kind: PageKind]>;
