'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useStableCallbacks } from '@liveworkspace/workbench/hooks/ui/useStableCallbacks';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useTabStyleOpen } from '@/lib/tab-style-opener';
import { useSettledElements } from '@/hooks/canvas/useSettledElements';
import { elementsByPage } from '@/lib/elements-by-page';
import { isArticleLocked } from '@/lib/article/article-lock';
import {
  offersPageKindChoice,
  pageKindOf,
  type Element,
  type LaidOutPage,
} from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { LayoutPreviewHost } from './InfographicLayoutPreview';
import { useCurrentPageFollow } from '@/hooks/canvas/useCurrentPageFollow';
import { usePageImageSources } from './page-image-access';
import { PagePanel, type PagePanelTab } from './PagePanel';
import { articleTitlesOf, shownPageName } from '@/lib/article-page-name';
import {
  PAGE_TOUR_HELP,
  PageShowMeButton,
  PageTourStage,
  usePageTour,
} from '@/components/tour/PageTour';
import { useFollowPagePanelRequests } from '@/lib/page-panel-request';
import { AddPageButton } from './AddPageButton';
import { FlashcardStackSheets, PageStackNav } from './FlashcardStack';
import { FLASHCARD_STACK_MAX } from '@/lib/flashcard-stack';
import { useStylePanelRequest } from '@/lib/article/article-editor-store';
import { useBandDocumentName } from '@/lib/article/article-band-layout';
import {
  previewedBackground,
  setPageBackgroundPreview,
  usePageBackgroundPreview,
} from '@/lib/page-background-preview';
import { CanvasPageSheet, type PageSheetActions } from './CanvasPageSheet';

// What a view without elements reads: one array, so the settled elements and the empty pages keep still.
const NO_ELEMENTS: Element[] = [];

// Pages mode's pages (docs/specs/007-editor/pages-mode.md): sheets in a row, painted
// in canvas space under every element so they pan and zoom with them, on the tab's own canvas,
// which stays the surround. Each sheet wears its own background (a hover in its panel previews
// one). A change of size, turn or removal eases the sheets to their new places. The sheets take no
// pointer events: a press on one is a press on the canvas. Each page's label sits above its
// top-left corner (a press frames the page) and its settings cog above its top-right; the
// add-a-page button follows the last page; all held at one screen size.
export function CanvasPages({
  view,
  zoom,
  bare = false,
  placing = false,
}: {
  view: PagesModeView;
  zoom: number;
  // The sheets alone, without their title bars or the add button (zen, presenting).
  bare?: boolean;
  // A palette tool is armed (tap to drop or drag to draw): an empty page's Use a Layout invite steps aside.
  placing?: boolean;
}) {
  const { pages, focusPage } = view;
  const articles = view.articles ?? null;
  // An unnamed article page's or card's name is its article's title (docs/specs/007-editor/
  // pages-mode.md "Page names"): read once per change of the articles, not per page per render.
  const flowTitles = useMemo(() => articleTitlesOf(articles?.flows), [articles?.flows]);
  // An article page's style (a hover in its Style tab previews one).
  const articleStyleOf = (page: LaidOutPage) =>
    page.flow
      ? articles?.stylePreview?.flow === page.flow
        ? articles.stylePreview.style
        : articles?.flows[page.flow]?.style
      : undefined;
  // An article page's header and footer name the document (pageBandLayout).
  const documentName = useBandDocumentName();
  const edit = bare ? undefined : view.edit;
  // Tab Style's door, offered to whoever may style the tab (lib/tab-style-opener.ts).
  const tabStyleOpen = useTabStyleOpen();
  // The open panel's page and the tab it opened on. Its cog is looked up live (cogs), so a cog
  // remounted by zen or a role change is the one the panel hangs from.
  // `seq`: a request to open on a tab (the toolbar's Article Style), so a panel already open
  // switches to it.
  const [opened, setOpened] = useState<{ id: string; tab: PagePanelTab; seq?: number } | null>(
    null,
  );
  const cogs = useRef(new Map<string, HTMLButtonElement>());
  const mobile = useIsMobileViewport();
  // Being on a page (opened on one, adding one, going to one, pressing into one) turns the palette
  // to its kind (lib/palette-kind.ts).
  // Followed over the whole row: on a stack `pages` is the page in front alone, and the row coming back would read as
  // every other page added (the first of them taken for the page someone is on).
  const pageFollow = useCurrentPageFollow(view.rowPages ?? pages, !!edit && !bare);
  // The pages with nothing on them, for their Use a Layout invite (docs/specs/007-editor/pages-mode.md "An empty
  // page offers a layout, quietly"): one pass over the elements as they settle (not every frame of a drag), O(n log
  // p), only while someone may edit.
  const settled = useSettledElements(view.elements ?? NO_ELEMENTS);
  const emptyPages = useMemo(() => {
    if (!edit) return null;
    const byPage = elementsByPage(pages, settled);
    return new Set(pages.filter((p) => byPage.get(p.id)?.length === 0).map((p) => p.id));
  }, [edit, pages, settled]);
  // A press on a page's invite opens its title bar's Layouts popover (PageLayoutsButton's openRequest).
  const [layoutsRequest, setLayoutsRequest] = useState<{ pageId: string; seq: number } | null>(
    null,
  );
  // A phone's Appearance (PageAppearanceButton): each page's look control opened from its sheet, a count per page and
  // control that only rises, summed into that control's open request.
  const [appearanceAsks, setAppearanceAsks] = useState<Readonly<Record<string, number>>>({});
  const askOf = (pageId: string, row: string) => appearanceAsks[`${pageId}:${row}`] ?? 0;
  const ask = (pageId: string, row: string) =>
    setAppearanceAsks((was) => ({
      ...was,
      [`${pageId}:${row}`]: (was[`${pageId}:${row}`] ?? 0) + 1,
    }));
  // The page whose Layouts popover is open: its invite steps aside meanwhile.
  const [layoutsOpenFor, setLayoutsOpenFor] = useState<string | null>(null);
  const goToPage = (page: (typeof pages)[number]) => {
    focusPage(page.id);
    pageFollow.pageShown(page);
  };
  // A background hovered in a page's panel: a shared preview (page-background-preview), so the
  // writing and the elements on the page take its ink too.
  const preview = usePageBackgroundPreview();
  // The pages' pictures, each fetched once (Image backgrounds).
  const pictureOf = usePageImageSources(pages);
  const setPreview = (next: Parameters<typeof setPageBackgroundPreview>[0]) => {
    setPageBackgroundPreview(next);
    edit?.previewInk(next);
  };
  const last = pages[pages.length - 1]!;
  const openId = opened?.id ?? null;
  const open = edit && opened ? pages.find((p) => p.id === opened.id) : undefined;
  // The panel goes with its page, and with the right to edit (zen, a lock, a view role): it never
  // comes back on its own, hung from a cog that is no longer there.
  if (opened && !open) setOpened(null);
  const close = useCallback(
    (restoreFocus: boolean) => {
      if (restoreFocus && opened) cogs.current.get(opened.id)?.focus();
      setOpened(null);
    },
    [opened],
  );
  const toggle = (id: string) => setOpened((o) => (o?.id === id ? null : { id, tab: 'page' }));
  // Show Me on a page (pages-tour.md, show-me.md): its kind's track, ended with its page (gone or locked).
  const pageTour = usePageTour(
    (id) => !!edit && pages.some((p) => p.id === id && p.locked !== true),
  );
  // A tour opens a page's panel on the tab a step is about, afresh, or closes it (lib/page-panel-request.ts).
  useFollowPagePanelRequests(setOpened);
  // The page toolbar's Article Style button opens the page's panel on Style.
  const styleRequest = useStylePanelRequest();
  // The article toolbar's Style command opens the Style beside that page's cog (PageArticleButtons).
  const styleRequestFor = (pageId: string) =>
    styleRequest.pageId === pageId ? styleRequest.seq : 0;
  // The page a layout is previewed on: its panel's, or its Layout popover's.
  const previewed = view.layoutPreview
    ? pages.find((p) => p.id === view.layoutPreview!.pageId)
    : undefined;
  const anchorOf = useCallback((id: string) => cogs.current.get(id), []);
  // What each page's sheet does, through handles that keep their identity, so a render of the row re-renders only
  // the sheets whose own props changed (canvas-performance.md "A render of the pages re-renders only the pages it
  // changed"). Each runs the newest version when called.
  const act = useStableCallbacks<PageSheetActions>({
    goToPage,
    toggle,
    ask,
    cogRef: (id, el) => {
      if (el) cogs.current.set(id, el);
      else cogs.current.delete(id);
    },
    layoutsOpenChange: (id, isOpen) =>
      setLayoutsOpenFor((was) => (isOpen ? id : was === id ? null : was)),
    requestLayouts: (id) => setLayoutsRequest((r) => ({ pageId: id, seq: (r?.seq ?? 0) + 1 })),
    applyLayout: (id, layout) => void edit?.applyLayout(id, layout),
    previewLayout: (id, layout) => view.setLayoutPreview(layout ? { pageId: id, layout } : null),
    setBackground: (id, patch) => edit?.setBackground(id, patch),
    previewBackground: (id, patch) => setPreview(patch ? { pageId: id, patch } : null),
    applyBackgroundToAll: (id) => edit?.applyBackgroundToAll(id),
    setLocked: (id, locked) => edit?.setLocked(id, locked),
    choosePageKind: (id, kind) => edit?.choosePageKind(id, kind),
    setArticleStyle: (flow, change) => articles?.setStyle(flow, change),
    previewArticleStyle: (flow, style) => articles?.setStylePreview(style ? { flow, style } : null),
    focusPage: (id) => view.focusPage(id),
  });
  // A stack (flashcards, infographic pages): the page in front's place, and the pages still to come behind it.
  const stack = view.cardStack;
  const row = view.rowPages ?? pages;
  return (
    <>
      {stack && pages[0] ? (
        <FlashcardStackSheets
          card={pages[0]}
          behind={row.slice(stack.index + 1, stack.index + 1 + FLASHCARD_STACK_MAX)}
        />
      ) : null}
      {pages.map((page) => {
        // A layout invite, a Tidy, an Apply to All: asked of the edits only while the page's buttons can show them.
        const locked = page.locked === true;
        const pageButtons =
          !!edit &&
          !locked &&
          !page.flow &&
          (page.kind === 'slide' || pageKindOf(page) === 'infographic');
        const hasArticle = !!page.flow && !!articles?.flows[page.flow];
        const articleButtons = !!edit && !locked && hasArticle;
        const tidy = pageButtons && edit.canTidy?.(page.id) === true;
        // The first page, unchosen and empty, offers its kind first (FirstPageChoice). Judged on the whole row: on a
        // stack `pages` holds the page in front alone, which is not the tab's only page.
        const choosing =
          !!edit &&
          !bare &&
          !locked &&
          offersPageKindChoice(row, page.id, edit.contentCount(page.id));
        const notes = !!edit && !!view.deck && !!view.deck.slideOf(page.id);
        return (
          <CanvasPageSheet
            key={page.id}
            page={page}
            pages={pages}
            many={pages.length > 1}
            zoom={zoom}
            bare={bare}
            placing={placing}
            mobile={mobile}
            letterbox={!!view.letterbox}
            background={previewedBackground(page, pages, preview)}
            pictureOf={pictureOf}
            // Its name: its own, else (an article page or a card) its article's title.
            shownName={shownPageName(page, flowTitles)}
            articleStyle={articleStyleOf(page)}
            storedArticleStyle={page.flow ? articles?.flows[page.flow]?.style : undefined}
            hasArticle={hasArticle}
            documentName={documentName}
            themeAccent={view.themeAccent}
            themePresets={view.themeBackgrounds}
            editable={!!edit}
            tabStyle={!!tabStyleOpen}
            tidy={tidy}
            choosing={choosing}
            deck={notes ? view.deck : undefined}
            tidyEdit={tidy ? edit : undefined}
            applyReach={edit && (pageButtons || articleButtons) ? edit.applyToAllReach(page.id) : 0}
            open={openId === page.id}
            styleRequest={styleRequestFor(page.id) + askOf(page.id, 'style')}
            textRequest={askOf(page.id, 'text')}
            layoutsRequest={
              (layoutsRequest?.pageId === page.id ? layoutsRequest.seq : 0) +
              askOf(page.id, 'layout')
            }
            backgroundRequest={askOf(page.id, 'background')}
            empty={emptyPages?.has(page.id) === true}
            previewing={view.layoutPreview?.pageId === page.id}
            layoutsOpen={layoutsOpenFor === page.id}
            stack={stack}
            row={stack ? row : undefined}
            flow={stack && page.flow ? articles?.flows[page.flow] : undefined}
            act={act}
          />
        );
      })}
      {/* An infographic stack's Previous and Next, under the page in front (pages-mode.md "Stacked infographics"). */}
      {stack && pages[0] && !pages[0].flow && !bare ? (
        <PageStackNav page={pages[0]} stack={stack} row={row} zoom={zoom} onGo={view.focusPage} />
      ) : null}
      {edit?.addPage && edit.addPageLike ? (
        <AddPageButton last={last} zoom={zoom} onAddLike={edit.addPageLike} />
      ) : null}
      {/* The hovered layout on its page, crossfading between tiles and fading out after. */}
      <LayoutPreviewHost
        page={previewed}
        layout={view.layoutPreview?.layout}
        tabFont={view.tabFont}
        elements={view.elements}
        pages={view.pages}
      />
      {open && opened && edit ? (
        <PagePanel
          // One panel per page: switching cogs starts the next page's panel afresh, its pending
          // Replace and previews going with the last one.
          key={`${open.id}:${opened.seq ?? 0}`}
          page={open}
          count={pages.length}
          heldByLock={isArticleLocked(pages, open.id)}
          getAnchor={() => anchorOf(open.id)}
          titleName={open.flow ? flowTitles.get(open.flow) : undefined}
          edit={edit}
          onClose={close}
          // A locked page has nothing to show: its controls are held (pages-mode.md "Locking a page").
          showMe={
            open.locked === true
              ? undefined
              : {
                  button: (
                    <PageShowMeButton
                      tour={pageTour.tour}
                      kind={pageKindOf(open)}
                      onStart={() => pageTour.freeze(open.id, pageKindOf(open))}
                    />
                  ),
                  article: PAGE_TOUR_HELP[pageKindOf(open)].article,
                }
          }
        />
      ) : null}
      <PageTourStage tour={pageTour.tour} kind={pageTour.kind} />
    </>
  );
}
