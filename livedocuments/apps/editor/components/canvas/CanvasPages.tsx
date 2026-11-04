'use client';

import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FirstPageChoice } from './FirstPageChoice';
import { PageLockButton } from '@liveworkspace/workbench/components/canvas/PageLockButton';
import { PageCog, PageTitleBar } from '@liveworkspace/workbench/components/canvas/PageTitleBar';
import { PageBackgroundButton } from './PageBackgroundButton';
import { PageTabStyleButton } from './PageTabStyleButton';
import { appearanceRows, PageAppearanceButton } from './PageAppearanceButton';
import { openTabStyleFrom, useTabStyleOpen } from '@/lib/tab-style-opener';
import { PageLayoutsButton } from './PageLayoutsButton';
import { EmptyPageInvite } from '@liveworkspace/workbench/components/canvas/EmptyPageInvite';
import { useSettledElements } from '@/hooks/canvas/useSettledElements';
import { elementsByPage } from '@/lib/elements-by-page';
import { layoutInviteShows } from '@/lib/layout-invite';
import { track } from '@/lib/telemetry';
import { PageMotionLayer } from './PageMotionLayer';
import { PageNotesButton } from './PageNotesButton';
import { PageTidyUpButton } from './PageTidyUpButton';
import { PageArticleButtons } from './PageArticleButtons';
import {
  appearanceNamed,
  LABEL_MIN,
  titleBarFixedRoom,
  titleBarNamed,
} from './page-title-bar-room';
import { isArticleLocked } from '@/lib/article/article-lock';
import {
  articleBodyLinePx,
  articleMarginPx,
  offersPageKindChoice,
  articleTopMarginPx,
  PAGE_GAP,
  pageIsDark,
  pageKindOf,
  pageLabel,
  pageUnits,
  resolveArticleStyle,
  resolveFontStack,
  type Element,
  type LaidOutPage,
} from '@livedocuments/document';
import { HoverCard } from '@livedocuments/ui';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { LayoutPreviewHost } from './InfographicLayoutPreview';
import {
  laidOutUnits,
  usePageReorderDrag,
  type PageReorder,
} from '@/hooks/canvas/usePageReorderDrag';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useCurrentPageFollow } from '@/hooks/canvas/useCurrentPageFollow';
import { pageSheetStyle } from '@/lib/page-paint';
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
import { FlashcardFooter, FlashcardStackSheets, PageStackNav } from './FlashcardStack';
import { FLASHCARD_STACK_MAX } from '@/lib/flashcard-stack';
import { ArticleStyleSection } from './article/ArticleStyleSection';
import { useStylePanelRequest } from '@/lib/article/article-editor-store';
import { pageBandLayout, useBandDocumentName } from '@/lib/article/article-band-layout';
import { PageBands } from './article/PageBands';
import {
  previewedBackground,
  setPageBackgroundPreview,
  usePageBackgroundPreview,
} from '@/lib/page-background-preview';

// What a view without elements reads: one array, so the settled elements and the empty pages keep still.
const NO_ELEMENTS: Element[] = [];

// Canvas px the letterbox's black reaches past the presented sheet: past any screen at any zoom.
const LETTERBOX_SPREAD = 100_000;

// Held at one screen size whatever the zoom: counter-scaled about the given corner.
const steady = (zoom: number, origin: string): CSSProperties => ({
  transform: `scale(${1 / zoom})`,
  transformOrigin: origin,
});

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
  // An article page's Lines pattern ruled on its writing's baselines, inside its margins.
  const rulingOf = (page: LaidOutPage) =>
    page.flow && articles?.flows[page.flow]
      ? {
          pitch: articleBodyLinePx(articleStyleOf(page)),
          inset: articleMarginPx(articleStyleOf(page)),
          top: articleTopMarginPx(articleStyleOf(page)),
        }
      : undefined;
  // An article page's header and footer (its page number among them), when its article has them. A card
  // says its place in the stack instead (FlashcardFooter).
  const documentName = useBandDocumentName();
  const bandsOf = (page: LaidOutPage) =>
    page.flow && articles?.flows[page.flow]
      ? pageBandLayout(
          articleStyleOf(page),
          pages.filter((p) => p.flow === page.flow),
          page,
          documentName,
        )
      : null;
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
  // A label dragged sideways reorders the pages (usePageReorderDrag).
  const drag = usePageReorderDrag({ pages, zoom, onMove: edit?.movePageTo });
  // A label drags only when there is something to swap with: two units (a page, or a whole article).
  const reorderable = pageUnits(pages).length > 1;
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
  // An article's Style or Text sections (ArticleStyleSection), for the buttons beside an article page's cog.
  const articleSection = (flow: string, part: 'style' | 'text', card: boolean) =>
    articles?.flows[flow] ? (
      <ArticleStyleSection
        part={part}
        card={card}
        style={articles.flows[flow].style}
        themeAccent={view.themeAccent}
        onChange={(change) => articles.setStyle(flow, change)}
        onPreview={(style) => articles.setStylePreview(style ? { flow, style } : null)}
      />
    ) : null;
  const anchorOf = useCallback((id: string) => cogs.current.get(id), []);
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
        const background = previewedBackground(page, pages, preview);
        // No "Page n": the page navigator under the page says which it is.
        // Its name: its own, else (an article page or a card) its article's title.
        const shownName = shownPageName(page, flowTitles);
        const label = pageLabel({ ...page, name: shownName }, page.index, 1);
        // The name (when the page has one) and the rest (its size and kind), as pageLabel joins them.
        const labelParts = shownName
          ? { name: shownName, rest: label.slice(shownName.length + 3) }
          : { name: '', rest: label };
        const bands = bandsOf(page);
        // The label fits the page's on-screen width, less the title bar's buttons; too narrow, it
        // hides. The title bar's room on screen: the page's width at this zoom. The cog takes its
        // corner.
        const room = page.rect.width * zoom;
        // A locked page offers nothing to add (docs/specs/007-editor/pages-mode.md
        // "Locking a page"): no Layouts, no layout invite, no kind choice.
        const locked = page.locked === true;
        // An infographic or slide page's Layouts and Background sit beside its cog, always; a
        // locked page offers neither.
        const pageButtons =
          !!edit &&
          !locked &&
          !page.flow &&
          (page.kind === 'slide' || pageKindOf(page) === 'infographic');
        // An infographic or slide page's Tidy, left of its Background, shown only while it would
        // change something.
        const tidyButton = pageButtons && edit.canTidy?.(page.id) === true;
        // An article page's Style, Text and Background sit beside its cog (PageArticleButtons); a locked page
        // offers none.
        const articleButtons = !!edit && !locked && !!page.flow && !!articles?.flows[page.flow];
        // The first page, unchosen and empty, offers its kind first (FirstPageChoice). Judged on the whole row: on a
        // stack `pages` holds the page in front alone, which is not the tab's only page.
        const choosing =
          !!edit &&
          !bare &&
          !locked &&
          offersPageKindChoice(row, page.id, edit.contentCount(page.id));
        // Notes, first, once the deck has a slide of the page (PageNotesButton), on a phone too,
        // so note cards can be written anywhere (docs/specs/012-collaboration/speaker-note-cards.md
        // "Writing note cards"). Its place in the deck is in Contents' ⋯ menu (page-row-slides).
        const notesButton = !!edit && !!view.deck && !!view.deck.slideOf(page.id);
        // The title bar's fixed buttons (the cog, the lock, Notes and an infographic or slide
        // page's): the label has what they leave.
        // Tab Style, first in the looks group; an article page's own Style leads with it instead.
        const styleButton = !!edit && !!tabStyleOpen && !articleButtons;
        const buttons = {
          edit: !!edit,
          locked,
          notes: notesButton,
          page: pageButtons,
          article: articleButtons,
          style: styleButton,
          tidy: tidyButton,
        };
        // The buttons name themselves on a desktop while the page is wide enough on screen to hold
        // them named; zoomed out further they drop to their icons, as a phone shows them.
        const labelled = titleBarNamed(room, buttons, mobile);
        // A phone's Appearance is named while the page on screen holds it (appearanceNamed).
        const appearanceLabelled = mobile && appearanceNamed(room, buttons);
        const fixedRoom = titleBarFixedRoom(
          buttons,
          mobile ? appearanceLabelled : labelled,
          mobile,
        );
        const labelRoom = room - fixedRoom;
        return (
          <div
            key={page.id}
            data-page={page.orientation}
            data-page-id={page.id}
            // The Pages tour picks its track from the page's kind (docs/specs/007-editor/pages-tour.md).
            data-page-kind={pageKindOf(page)}
            data-page-locked={locked ? '' : undefined}
            className={`pointer-events-none absolute transition-[left,top,width,height,opacity] duration-200 ease-out motion-reduce:transition-none ${
              drag.reorder?.pageIds.includes(page.id) ? 'opacity-60' : ''
            } ${
              background?.fill
                ? ''
                : 'bg-white text-slate-900/10 dark:bg-slate-900 dark:text-white/10'
            }`}
            style={{
              left: page.rect.x,
              top: page.rect.y,
              width: page.rect.width,
              height: page.rect.height,
              // Presenting a page slide, a spread shadow blacks out the whole surround.
              boxShadow: view.letterbox
                ? `0 0 0 ${LETTERBOX_SPREAD}px #000`
                : '0 1px 3px rgb(15 23 42 / 0.14), 0 12px 32px rgb(15 23 42 / 0.12)',
              ...pageSheetStyle(background, rulingOf(page), pictureOf),
            }}
          >
            {/* A slide's animated background, over its gradient and under all on it. */}
            {background?.fill?.kind === 'gradient' && background.fill.motion ? (
              <PageMotionLayer
                motion={background.fill.motion}
                fill={background.fill}
                width={page.rect.width}
                height={page.rect.height}
              />
            ) : null}
            <div
              // As tall as the title bar beside it, so the two sit on one line.
              // None on a phone ("Beside the cog"): the name is in Contents and the cog sheet.
              className={`absolute left-0 flex h-[34px] items-center ${labelRoom < LABEL_MIN || bare || mobile ? 'hidden' : ''}`}
              style={{
                bottom: '100%',
                marginBottom: 6 / zoom,
                maxWidth: labelRoom,
                ...steady(zoom, 'bottom left'),
              }}
            >
              <HoverCard
                title={label}
                description="Press to fit this page to the screen."
                className="min-w-0 max-w-full"
              >
                <button
                  type="button"
                  // The Pages tour's anchor (docs/specs/007-editor/pages-tour.md); the first page's leads.
                  data-tour-id="page-name"
                  {...drag.handlers(page.id)}
                  onClick={() => {
                    if (!drag.endsDrag()) goToPage(page);
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className={`group/label pointer-events-auto block max-w-full truncate whitespace-nowrap rounded-md px-1.5 py-1 text-xs text-slate-500 transition hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800/80 ${
                    edit && reorderable ? 'cursor-grab active:cursor-grabbing' : ''
                  }`}
                >
                  {/* Its name leads, the size and kind after it quieter, so a row of pages scans by name. */}
                  {labelParts.name ? (
                    <span className="font-semibold text-slate-700 group-hover/label:text-slate-900 dark:text-slate-200 dark:group-hover/label:text-white">
                      {labelParts.name}
                    </span>
                  ) : null}
                  {labelParts.name && labelParts.rest ? ' · ' : null}
                  <span className="font-medium group-hover/label:text-slate-600 dark:group-hover/label:text-slate-300">
                    {labelParts.rest}
                  </span>
                </button>
              </HoverCard>
            </div>
            {edit ? (
              // The page's own controls, one toolbar card in three groups (PageTitleBar): how the
              // page looks, then tools, then the page itself at its corner. A press on them keeps an
              // article's toolbar.
              <PageTitleBar
                keepArticleActive
                className="absolute right-0"
                style={{ bottom: '100%', marginBottom: 6 / zoom, ...steady(zoom, 'bottom right') }}
                groups={[
                  [
                    // On a phone the looks gather under Appearance, their own controls mounted headless.
                    mobile ? (
                      <PageAppearanceButton
                        key="appearance"
                        rows={appearanceRows(buttons)}
                        article={articleButtons}
                        labelled={appearanceLabelled}
                        onPick={(row, from) =>
                          row === 'style' && !articleButtons
                            ? openTabStyleFrom(from)
                            : ask(page.id, row)
                        }
                      />
                    ) : null,
                    // Tab Style (PageTabStyleButton): the whole tab's look.
                    styleButton && !mobile ? (
                      <PageTabStyleButton key="style" labelled={labelled} />
                    ) : null,
                    // An article page's Style (leading with Tab Style) and Text (PageArticleButtons).
                    articleButtons && page.flow ? (
                      <PageArticleButtons
                        key="article"
                        tabStyle={!!tabStyleOpen}
                        labelled={labelled}
                        headless={mobile}
                        styleRequest={styleRequestFor(page.id) + askOf(page.id, 'style')}
                        textRequest={askOf(page.id, 'text')}
                        section={(part) =>
                          articleSection(page.flow!, part, page.kind === 'flashcard')
                        }
                      />
                    ) : null,
                    // An infographic or slide page's Layouts (PageLayoutsButton).
                    pageButtons ? (
                      <PageLayoutsButton
                        key="layouts"
                        page={page}
                        labelled={labelled}
                        headless={mobile}
                        openRequest={
                          (layoutsRequest?.pageId === page.id ? layoutsRequest.seq : 0) +
                          askOf(page.id, 'layout')
                        }
                        onOpenChange={(isOpen) =>
                          setLayoutsOpenFor((was) =>
                            isOpen ? page.id : was === page.id ? null : was,
                          )
                        }
                        onApply={(layout) => void edit.applyLayout(page.id, layout)}
                        onPreview={(layout) =>
                          view.setLayoutPreview(layout ? { pageId: page.id, layout } : null)
                        }
                      />
                    ) : null,
                    // An infographic, slide or article page's Background (PageBackgroundButton).
                    pageButtons || articleButtons ? (
                      <PageBackgroundButton
                        key="background"
                        page={page}
                        labelled={labelled}
                        themePresets={view.themeBackgrounds}
                        headless={mobile}
                        openRequest={askOf(page.id, 'background')}
                        onBackground={(patch) => edit.setBackground(page.id, patch)}
                        onPreview={(patch) => setPreview(patch ? { pageId: page.id, patch } : null)}
                        applyToAll={{
                          reach: edit.applyToAllReach(page.id),
                          onApply: () => edit.applyBackgroundToAll(page.id),
                        }}
                      />
                    ) : null,
                  ],
                  [
                    // This slide's notes once it is in the deck (PageNotesButton).
                    notesButton && view.deck ? (
                      <PageNotesButton
                        key="notes"
                        pageId={page.id}
                        deck={view.deck}
                        labelled={labelled}
                      />
                    ) : null,
                    // An infographic or slide page's Tidy, while it would change something; never on a phone.
                    tidyButton && !mobile ? (
                      <PageTidyUpButton
                        key="tidy"
                        pageId={page.id}
                        edit={edit}
                        labelled={labelled}
                      />
                    ) : null,
                  ],
                  [
                    // No lock on a phone: the cog sheet holds it (PagePanel's actions).
                    mobile ? null : (
                      <PageLockButton
                        key="lock"
                        locked={locked}
                        labelled={labelled}
                        onToggle={() => edit.setLocked(page.id, !locked)}
                      />
                    ),
                    <PageCog
                      key="cog"
                      name={`${shownName ?? (pages.length > 1 ? `Page ${page.index + 1}` : 'Page')} settings`}
                      open={openId === page.id}
                      onToggle={() => toggle(page.id)}
                      cogRef={(el) => {
                        if (el) cogs.current.set(page.id, el);
                        else cogs.current.delete(page.id);
                      }}
                    />,
                  ],
                ]}
              />
            ) : null}
            {pageButtons &&
            layoutInviteShows(page, {
              editable: !!edit,
              placing,
              empty: emptyPages?.has(page.id) === true,
              choosing,
              previewing: view.layoutPreview?.pageId === page.id,
              layoutsOpen: layoutsOpenFor === page.id,
              zoom,
            }) ? (
              <EmptyPageInvite
                pageId={page.id}
                zoom={zoom}
                label="Use a Layout"
                onOpen={() => {
                  track('UI', 'Opened', 'EmptyPageInvite');
                  setLayoutsRequest((r) => ({ pageId: page.id, seq: (r?.seq ?? 0) + 1 }));
                }}
              />
            ) : null}
            {choosing && edit ? (
              <FirstPageChoice
                zoom={zoom}
                onChoose={(kind) => edit.choosePageKind(page.id, kind)}
              />
            ) : null}
            {bands ? <PageBands layout={bands} dark={pageIsDark(page)} /> : null}
            {stack && page.flow ? (
              <FlashcardFooter
                card={page}
                stack={stack}
                row={row}
                // Zen shows the card alone: its place, no buttons.
                {...(bare ? {} : { onGo: view.focusPage })}
                flow={articles?.flows[page.flow]}
                margin={articleMarginPx(articleStyleOf(page))}
                font={resolveFontStack(resolveArticleStyle(articleStyleOf(page)).bodyFont)}
              />
            ) : null}
          </div>
        );
      })}
      {/* An infographic stack's Previous and Next, under the page in front (pages-mode.md "Stacked infographics"). */}
      {stack && pages[0] && !pages[0].flow && !bare ? (
        <PageStackNav page={pages[0]} stack={stack} row={row} zoom={zoom} onGo={view.focusPage} />
      ) : null}
      {drag.reorder ? <ReorderMarker pages={pages} reorder={drag.reorder} zoom={zoom} /> : null}
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

// The cog that opens the page's panel (PagePanel).
// Where a dragged page will land: a bar in the gap at its slot, the pages' height, held at one
// screen width.
function ReorderMarker({
  pages,
  reorder,
  zoom,
}: {
  pages: readonly LaidOutPage[];
  reorder: PageReorder;
  zoom: number;
}) {
  const others = laidOutUnits(pages).filter((u) => !u.pageIds.includes(reorder.pageId));
  const before = others[reorder.slot - 1];
  const after = others[reorder.slot];
  const x = before
    ? before.rect.x + before.rect.width + PAGE_GAP / 2
    : after
      ? after.rect.x - PAGE_GAP / 2
      : 0;
  const top = Math.min(...pages.map((p) => p.rect.y));
  const bottom = Math.max(...pages.map((p) => p.rect.y + p.rect.height));
  return (
    <div
      aria-hidden
      data-page-reorder-marker
      className="pointer-events-none absolute rounded-full bg-brand-500"
      style={{ left: x - 2 / zoom, top, width: 4 / zoom, height: bottom - top }}
    />
  );
}
