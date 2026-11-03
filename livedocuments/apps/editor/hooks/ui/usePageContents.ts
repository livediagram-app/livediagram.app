'use client';

// Pages mode's Contents as state (docs/specs/007-editor/pages-mode.md "Contents"): the shared hook
// (@liveworkspace/workbench/hooks/ui/usePageContents) bound to this editor's pages. What is
// livedocuments' own is handed in here: the rows (a slide's place in the deck, an article's title, a
// card's speaking time), the words on each page (an article's writing too), where a dropped page
// lands (an article's pages move as one), the page's place in the deck on its ⋯ menu, and the
// pictures, drawn as the Slide Deck draws them.
import { useCallback, useMemo } from 'react';
import { MAX_PAGES, type LaidOutPage, type PageKind } from '@livedocuments/document';
import {
  usePageContents as useSharedPageContents,
  type PageContents as SharedPageContents,
} from '@liveworkspace/workbench/hooks/ui/usePageContents';
import { usePageThumbnails, type PageThumbTab } from '@/hooks/ui/usePageThumbnails';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { contentsDropUnit, contentsRows, type ContentsRow } from '@/lib/page-contents';
import { pageTexts } from '@/lib/page-texts';
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
  const flows = view.articles?.flows;
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
      }),
    [pages, deck, view.articles],
  );
  const readTexts = useCallback(
    () => pageTexts(pages, tab.elements, flows),
    [pages, tab.elements, flows],
  );
  const contents = useSharedPageContents({
    view,
    rows,
    readTexts,
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
