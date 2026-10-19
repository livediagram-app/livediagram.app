'use client';

import { useCallback, useRef, useState, type CSSProperties } from 'react';
import { lucidePanelsTopLeft, lucideSettings } from '@livediagram/icons/lucide';
import { FirstPageChoice } from './FirstPageChoice';
import { layoutCardShows, LAYOUT_CARD_MARGIN } from './page-layout-card';
import { EMPTY_PAGE_LAYOUTS_WIDE_WIDTH, EmptyPageLayouts } from './EmptyPageLayouts';
import { PageDeckButton } from './PageDeckButton';
import { LogoGuidesSvg, showsLogoGuides } from './LogoPageGuides';
import { LogoTitleBar } from './LogoTitleBar';
import { PageLockButton } from './PageLockButton';
import { PageBackgroundButton } from './PageBackgroundButton';
import { PageLayoutsButton } from './PageLayoutsButton';
import { PageMotionLayer } from './PageMotionLayer';
import { WireframeDeviceSheet } from './WireframeDeviceSheet';
import { PageDeviceButton } from './wireframe/PageDeviceButton';
import { PageNotesButton } from './PageNotesButton';
import { PageTidyUpButton } from './PageTidyUpButton';
import { PageArticleButtons } from './PageArticleButtons';
import { LABEL_MIN, titleBarFixedRoom, titleBarNamed } from './page-title-bar-room';
import { track } from '@/lib/telemetry';
import { isArticleLocked } from '@/lib/article/article-lock';
import { GIF_OMIT_ATTR } from '@/lib/gif-export/gif-omit';
import {
  articleBodyLinePx,
  articleMarginPx,
  offersPageKindChoice,
  articleTopMarginPx,
  PAGE_GAP,
  pageIsDark,
  pageKindOf,
  pageLabel,
  pageScreenRect,
  pageUnits,
  resolveArticleStyle,
  resolveFontStack,
  type LaidOutPage,
} from '@livediagram/document';
import { HoverCard, lucideGlyph, Tooltip } from '@livediagram/ui';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { InfographicLayoutPreview } from './InfographicLayoutPreview';
import {
  laidOutUnits,
  usePageReorderDrag,
  type PageReorder,
} from '@/hooks/canvas/usePageReorderDrag';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useLogoPaletteSwitch } from '@/hooks/canvas/useLogoPaletteSwitch';
import { pageSheetStyle } from '@/lib/page-paint';
import { usePageImageSources } from './page-image-access';
import { PagePanel, type PagePanelTab } from './PagePanel';
import {
  PAGE_TOUR_HELP,
  PageShowMeButton,
  PageTourStage,
  usePageTour,
} from '@/components/tour/PageTour';
import { useFollowPagePanelRequests } from '@/lib/page-panel-request';
import { AddPageButton } from './AddPageButton';
import { ArticleStyleSection } from './article/ArticleStyleSection';
import { useStylePanelRequest } from '@/lib/article/article-editor-store';
import {
  previewedBackground,
  setPageBackgroundPreview,
  usePageBackgroundPreview,
} from '@/lib/page-background-preview';

const CogIcon = lucideGlyph(lucideSettings, 16);
const LayoutIcon = lucideGlyph(lucidePanelsTopLeft, 14);

// Canvas px the letterbox's black reaches past the presented sheet: past any screen at any zoom.
const LETTERBOX_SPREAD = 100_000;
// The empty page's layout button beside the cog: with its words, or just its icon.
const INVITE_WIDE = 150;
const INVITE_ICON = 30;

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
  onOpenTheme,
}: {
  view: PagesModeView;
  zoom: number;
  // The sheets alone, without their title bars or the add button (zen, presenting).
  bare?: boolean;
  // A palette tile is armed (tap to drop or drag to draw): the page is where it will land, so the in-page layout
  // card steps aside until the tool is put down.
  placing?: boolean;
  // Opens the Tab Style popover, from the Layout popover's Change Theme; absent where the session
  // may not restyle the tab.
  onOpenTheme?: (() => void) | undefined;
}) {
  const { pages, focusPage } = view;
  const articles = view.articles ?? null;
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
  // An article page's number, in its bottom margin, when its article has them.
  const pageNumberOf = (page: LaidOutPage) => {
    if (!page.flow || !articles?.flows[page.flow]) return null;
    const style = resolveArticleStyle(articleStyleOf(page));
    if (!style.pageNumbers) return null;
    const own = pages.filter((p) => p.flow === page.flow);
    return {
      n: own.findIndex((p) => p.id === page.id) + 1,
      bottom: articleMarginPx(articleStyleOf(page)) / 2 - 8,
      font: resolveFontStack(style.bodyFont),
    };
  };
  const edit = bare ? undefined : view.edit;
  // The open panel's page and the tab it opened on. Its cog is looked up live (cogs), so a cog
  // remounted by zen or a role change is the one the panel hangs from.
  // `seq`: a request to open on a tab (the toolbar's Article Style), so a panel already open
  // switches to it.
  const [opened, setOpened] = useState<{ id: string; tab: PagePanelTab; seq?: number } | null>(
    null,
  );
  const cogs = useRef(new Map<string, HTMLButtonElement>());
  const mobile = useIsMobileViewport();
  // Being on a logo page (opened on one, adding one, going to one, pressing into one) turns the
  // palette to its kind (lib/palette-kind.ts).
  const logoPalette = useLogoPaletteSwitch(pages, !!edit && !bare);
  const goToPage = (page: (typeof pages)[number]) => {
    focusPage(page.id);
    logoPalette.pageShown(page);
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
  // The empty page's own invitation opens its panel on Layouts.
  const openLayouts = (id: string) => setOpened({ id, tab: 'layouts' });
  // The pages whose in-page layout card was hidden, until the tab is next opened.
  const [layoutsHidden, setLayoutsHidden] = useState<ReadonlySet<string>>(() => new Set());
  // An empty infographic page shows its layouts inside itself (EmptyPageLayouts): never on the first
  // page while it offers its kind, under its open panel, while a palette tile is armed to place something on it, or
  // on a page too small on screen to hold the card.
  const showsLayoutCard = (page: LaidOutPage) =>
    layoutCardShows(page, {
      editable: !!edit,
      placing,
      contentCount: edit ? edit.contentCount(page.id) : 0,
      offersKind: offersPageKindChoice(pages, page.id, 0),
      panelOpen: openId === page.id,
      hidden: layoutsHidden.has(page.id),
      zoom,
    });
  // The page a layout is previewed on: its panel's, or its in-page card's.
  const previewed = view.layoutPreview
    ? pages.find((p) => p.id === view.layoutPreview!.pageId)
    : undefined;
  // An article's Style or Text sections (ArticleStyleSection), for the buttons beside an article page's cog.
  const articleSection = (flow: string, part: 'style' | 'text') =>
    articles?.flows[flow] ? (
      <ArticleStyleSection
        part={part}
        style={articles.flows[flow].style}
        themeAccent={view.themeAccent}
        onChange={(change) => articles.setStyle(flow, change)}
        onPreview={(style) => articles.setStylePreview(style ? { flow, style } : null)}
      />
    ) : null;
  const anchorOf = useCallback((id: string) => cogs.current.get(id), []);
  return (
    <>
      {pages.map((page) => {
        const background = previewedBackground(page, pages, preview);
        // No "Page n": the page navigator under the page says which it is.
        const label = pageLabel(page, page.index, 1);
        const number = pageNumberOf(page);
        // The label fits the page's on-screen width, less the title bar's buttons; too narrow, it
        // hides. The title bar's room on screen: the page's width at this zoom. The cog takes its
        // corner; an empty logo page's layout invite sits beside it, with its words while there is
        // room for them and the label, as an icon while there is room for that, else not at all.
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
          (page.kind === 'slide' ||
            page.kind === 'wireframe' ||
            pageKindOf(page) === 'infographic');
        // A wireframe page's Device, first beside its Layouts (PageDeviceButton).
        const deviceButton = pageButtons && page.kind === 'wireframe';
        // An infographic or slide page's Tidy, left of its Background, shown only while it would
        // change something.
        const tidyButton = pageButtons && edit.canTidy?.(page.id) === true;
        // An article page's Style, Text and Background sit beside its cog (PageArticleButtons); a locked page
        // offers none.
        const articleButtons = !!edit && !locked && !!page.flow && !!articles?.flows[page.flow];
        // A logo page's empty artboard invites its layouts (its panel's Layouts tab).
        const empty = !!edit && !locked && page.kind === 'logo' && edit.contentCount(page.id) === 0;
        // The first page, unchosen and empty, offers its kind first (FirstPageChoice).
        const choosing =
          !!edit &&
          !bare &&
          !locked &&
          offersPageKindChoice(pages, page.id, edit.contentCount(page.id));
        // A slide page's deck button sits beside its cog (PageDeckButton); any other page shows it
        // once the deck has a slide of it, so its eye is there wherever the page is presented.
        const deckButton =
          !!edit &&
          !!view.deck &&
          !mobile &&
          (page.kind === 'slide' || !!view.deck.slideOf(page.id));
        // Add Notes beside it once the deck has a slide of the page (PageNotesButton).
        const notesButton = deckButton && !!view.deck!.slideOf(page.id);
        const logoButtons = !!edit && page.kind === 'logo' && !!view.logo;
        // The title bar's fixed buttons (the cog, the lock, the deck button, a logo page's own and
        // an infographic or slide page's): the invite and the label share what they leave.
        const buttons = {
          edit: !!edit,
          locked,
          deck: deckButton,
          notes: notesButton,
          logo: logoButtons,
          page: pageButtons,
          article: articleButtons,
          tidy: tidyButton,
          device: deviceButton,
        };
        // The buttons name themselves on a desktop while the page is wide enough on screen to hold
        // them named; zoomed out further they drop to their icons, as a phone shows them.
        const labelled = titleBarNamed(room, buttons, mobile);
        const fixedRoom = titleBarFixedRoom(buttons, labelled);
        const invite =
          !empty || choosing
            ? null
            : !mobile && room - fixedRoom >= INVITE_WIDE + LABEL_MIN * 2
              ? 'wide'
              : room - fixedRoom >= INVITE_ICON + LABEL_MIN
                ? 'icon'
                : null;
        // A wireframe page's sheet is its device (WireframeDeviceSheet): the paint is its screen's.
        const device = page.kind === 'wireframe';
        const labelRoom =
          room -
          fixedRoom -
          (invite === 'wide' ? INVITE_WIDE : invite === 'icon' ? INVITE_ICON : 0);
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
              background?.fill || device
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
                : device
                  ? undefined
                  : '0 1px 3px rgb(15 23 42 / 0.14), 0 12px 32px rgb(15 23 42 / 0.12)',
              ...(device ? {} : pageSheetStyle(background, rulingOf(page), pictureOf)),
            }}
          >
            {device ? (
              <WireframeDeviceSheet
                page={page}
                background={background}
                resolveImage={pictureOf}
                frameTheme={view.frameTheme}
              >
                {/* Its screen's animated background, sized to the screen. */}
                {background?.fill?.kind === 'gradient' && background.fill.motion ? (
                  <PageMotionLayer
                    motion={background.fill.motion}
                    fill={background.fill}
                    width={pageScreenRect(page).width}
                    height={pageScreenRect(page).height}
                  />
                ) : null}
              </WireframeDeviceSheet>
            ) : null}
            {/* A slide's animated background, over its gradient and under all on it. */}
            {!device && background?.fill?.kind === 'gradient' && background.fill.motion ? (
              <PageMotionLayer
                motion={background.fill.motion}
                fill={background.fill}
                width={page.rect.width}
                height={page.rect.height}
              />
            ) : null}
            {/* An empty logo page's guides, under its own cards (LogoPageGuides draws them over
                the artwork once the page has some). */}
            {page.kind === 'logo' &&
            edit &&
            edit.contentCount(page.id) === 0 &&
            showsLogoGuides(view, bare, page.id) ? (
              <div
                {...{ [GIF_OMIT_ATTR]: '' }}
                className="pointer-events-none absolute"
                style={{ left: -page.rect.x, top: -page.rect.y }}
              >
                <LogoGuidesSvg page={page} tools={view.logo!} />
              </div>
            ) : null}
            <div
              className={`absolute left-0 flex items-center ${labelRoom < LABEL_MIN || bare ? 'hidden' : ''}`}
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
                  className={`pointer-events-auto block max-w-full truncate whitespace-nowrap rounded px-1 py-0.5 text-xs font-medium text-slate-500 transition hover:bg-white/80 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100 ${
                    edit && reorderable ? 'cursor-grab active:cursor-grabbing' : ''
                  }`}
                >
                  {label}
                </button>
              </HoverCard>
            </div>
            {edit ? (
              <div
                // The page's own controls: a press on them keeps an article's toolbar.
                data-article-keep-active=""
                className="absolute right-0 flex items-center gap-1"
                style={{ bottom: '100%', marginBottom: 6 / zoom, ...steady(zoom, 'bottom right') }}
              >
                {invite && openId !== page.id ? (
                  <LayoutInvite wide={invite === 'wide'} onOpen={() => openLayouts(page.id)} />
                ) : null}
                {/* A logo page's Tidy Up, Mirror and Guides (LogoTitleBar). */}
                {logoButtons && view.logo ? (
                  <LogoTitleBar pageId={page.id} tools={view.logo} labelled={labelled} />
                ) : null}
                {/* First, left of Layout and Background: this slide's place in the deck, and its
                    notes once it is in it. */}
                {deckButton && view.deck ? (
                  <PageDeckButton pageId={page.id} deck={view.deck} labelled={labelled} />
                ) : null}
                {notesButton && view.deck ? (
                  <PageNotesButton pageId={page.id} deck={view.deck} labelled={labelled} />
                ) : null}
                {/* An article page's Style and Text (PageArticleButtons), then its Background. */}
                {articleButtons && page.flow ? (
                  <PageArticleButtons
                    labelled={labelled}
                    styleRequest={styleRequestFor(page.id)}
                    section={(part) => articleSection(page.flow!, part)}
                  />
                ) : null}
                {/* A wireframe page's Device (PageDeviceButton). */}
                {deviceButton ? (
                  <PageDeviceButton
                    page={page}
                    labelled={labelled}
                    onDevice={(patch) => edit.setDevice(page.id, patch)}
                    frameTheme={view.frameTheme}
                  />
                ) : null}
                {/* An infographic or slide page's Layouts (PageLayoutsButton). */}
                {pageButtons ? (
                  <PageLayoutsButton
                    page={page}
                    labelled={labelled}
                    onApply={(layout) => void edit.applyLayout(page.id, layout)}
                    // A wireframe is drawn in wireframe greys: the theme is no choice of its layouts.
                    onChangeTheme={page.kind === 'wireframe' ? undefined : onOpenTheme}
                    onPreview={(layout) =>
                      view.setLayoutPreview(layout ? { pageId: page.id, layout } : null)
                    }
                  />
                ) : null}
                {/* An infographic, slide or article page's Background (PageBackgroundButton). */}
                {pageButtons || articleButtons ? (
                  <PageBackgroundButton
                    page={page}
                    labelled={labelled}
                    themePresets={view.themeBackgrounds}
                    onBackground={(patch) => edit.setBackground(page.id, patch)}
                    onPreview={(patch) => setPreview(patch ? { pageId: page.id, patch } : null)}
                    applyToAll={{
                      reach: edit.applyToAllReach(page.id),
                      onApply: () => edit.applyBackgroundToAll(page.id),
                    }}
                  />
                ) : null}
                {/* An infographic or slide page's Tidy, its icon alone, left of the lock and cog
                    (PageTidyUpButton), while it would change something. */}
                {tidyButton ? <PageTidyUpButton pageId={page.id} edit={edit} /> : null}
                {/* The page's lock, before the cog (PageLockButton). */}
                {edit ? (
                  <PageLockButton
                    locked={locked}
                    labelled={labelled}
                    onToggle={() => edit.setLocked(page.id, !locked)}
                  />
                ) : null}
                <PageCog
                  name={`${page.name ?? (pages.length > 1 ? `Page ${page.index + 1}` : 'Page')} settings`}
                  open={openId === page.id}
                  onToggle={() => toggle(page.id)}
                  cogRef={(el) => {
                    if (el) cogs.current.set(page.id, el);
                    else cogs.current.delete(page.id);
                  }}
                />
              </div>
            ) : null}
            {choosing && edit ? (
              <FirstPageChoice
                zoom={zoom}
                onChoose={(kind, device) => edit.choosePageKind(page.id, kind, device)}
              />
            ) : null}
            {number ? (
              <span
                aria-hidden
                data-page-number=""
                className="pointer-events-none absolute inset-x-0 text-center text-[12px] tabular-nums"
                style={{
                  bottom: number.bottom,
                  color: pageIsDark(page) ? 'rgb(255 255 255 / 0.55)' : 'rgb(71 85 105 / 0.8)',
                  fontFamily: number.font,
                }}
              >
                {number.n}
              </span>
            ) : null}
          </div>
        );
      })}
      {drag.reorder ? <ReorderMarker pages={pages} reorder={drag.reorder} zoom={zoom} /> : null}
      {edit?.addPage && edit.addPageLike ? (
        <AddPageButton last={last} zoom={zoom} onAdd={edit.addPage} onAddLike={edit.addPageLike} />
      ) : null}
      {previewed && view.layoutPreview ? (
        <InfographicLayoutPreview
          page={previewed}
          layout={view.layoutPreview.layout}
          tabFont={view.tabFont}
          elements={view.elements}
          pages={view.pages}
          frameTheme={view.frameTheme}
        />
      ) : null}
      {edit
        ? pages.filter(showsLayoutCard).map((page) => (
            <div
              key={page.id}
              // The in-page layout card is the editor's (lib/gif-export/gif-omit.ts).
              {...{ [GIF_OMIT_ATTR]: '' }}
              className="pointer-events-none absolute"
              style={{
                left: page.rect.x,
                top: page.rect.y,
                width: page.rect.width,
                height: page.rect.height,
              }}
            >
              <EmptyPageLayouts
                page={page}
                zoom={zoom}
                onApply={(layout) => void edit.applyLayout(page.id, layout)}
                onHide={() => {
                  track('UI', 'Closed', 'EmptyPageLayouts');
                  setLayoutsHidden((hidden) => new Set(hidden).add(page.id));
                }}
                onBlank={() => {
                  track('UI', 'Closed', 'EmptyPageLayoutsBlank');
                  edit.startBlank(page.id);
                }}
                wide={
                  page.rect.width * zoom >= EMPTY_PAGE_LAYOUTS_WIDE_WIDTH + LAYOUT_CARD_MARGIN * 2
                }
              />
            </div>
          ))
        : null}
      {open && opened && edit ? (
        <PagePanel
          // One panel per page: switching cogs starts the next page's panel afresh, its pending
          // Replace and previews going with the last one.
          key={`${open.id}:${opened.seq ?? 0}`}
          page={open}
          count={pages.length}
          heldByLock={isArticleLocked(pages, open.id)}
          getAnchor={() => anchorOf(open.id)}
          initialTab={opened.tab}
          themeBackgrounds={view.themeBackgrounds}
          edit={edit}
          onPreview={setPreview}
          onLayoutPreview={(layout) =>
            view.setLayoutPreview(layout ? { pageId: open.id, layout } : null)
          }
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
function PageCog({
  name,
  open,
  onToggle,
  cogRef,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
  cogRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <div
      className="pointer-events-auto"
      // A press here is the cog's, never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label={name}>
        <button
          ref={cogRef}
          type="button"
          aria-label={name}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-page-panel-trigger
          // The Pages tour's anchor (docs/specs/007-editor/pages-tour.md); the first page's leads.
          data-tour-id="page-cog"
          onClick={() => onToggle()}
          className={`touch-target-y relative flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
            open ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100' : ''
          }`}
        >
          <CogIcon />
        </button>
      </Tooltip>
    </div>
  );
}

// On an empty page, beside its cog: start it from a layout. Its words show on a wide screen with
// room in the title bar; on a phone, or when the page is small on screen, just the icon.
function LayoutInvite({ wide, onOpen }: { wide: boolean; onOpen: () => void }) {
  return (
    <div
      className="pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label="Start From a Layout">
        <button
          type="button"
          aria-label="Start From a Layout"
          onClick={onOpen}
          className="flex h-6 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <LayoutIcon />
          {wide ? (
            <span className="hidden whitespace-nowrap sm:inline">Start From a Layout</span>
          ) : null}
        </button>
      </Tooltip>
    </div>
  );
}

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
