'use client';

import { useCallback, useRef, useState, type CSSProperties } from 'react';
import { lucidePanelsTopLeft, lucideSettings } from '@livediagram/icons/lucide';
import { FirstPageChoice } from './FirstPageChoice';
import {
  EMPTY_PAGE_LAYOUTS_WIDE_WIDTH,
  EMPTY_PAGE_LAYOUTS_WIDTH,
  EmptyPageLayouts,
} from './EmptyPageLayouts';
import { PageDeckButton } from './PageDeckButton';
import { LogoGuidesSvg, showsLogoGuides } from './LogoPageGuides';
import { LogoTitleBar, logoTitleBarRoom } from './LogoTitleBar';
import { PageLockButton, pageLockRoom } from './PageLockButton';
import { track } from '@/lib/telemetry';
import { isArticleLocked } from '@/lib/article/article-lock';
import { PageNavigator } from './PageNavigator';
import {
  articleBodyLinePx,
  articleMarginPx,
  offersPageKindChoice,
  articleTopMarginPx,
  ILLUSTRATE_PAGE_GAP,
  pageIsDark,
  pageLabel,
  pageUnits,
  resolveArticleStyle,
  resolveFontStack,
  type LaidOutPage,
} from '@livediagram/document';
import { HoverCard, lucideGlyph, Tooltip } from '@livediagram/ui';
import type { IllustratePagesView } from '@/hooks/editor/useIllustratePages';
import { InfographicLayoutPreview } from './InfographicLayoutPreview';
import {
  laidOutUnits,
  usePageReorderDrag,
  type PageReorder,
} from '@/hooks/canvas/usePageReorderDrag';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useLogoPaletteSwitch } from '@/hooks/canvas/useLogoPaletteSwitch';
import { pageSheetStyle } from '@/lib/illustrate-page-paint';
import { IllustratePagePanel, type PagePanelTab } from './IllustratePagePanel';
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

// Screen px: the cog's width plus a gap, and the narrowest a label is still worth showing.
const COG_ROOM = 32;
// The deck button beside a slide page's cog: its 24 px and the gap.
const DECK_ROOM = 28;
const LABEL_MIN = 40;
// Canvas px the letterbox's black reaches past the presented sheet: past any screen at any zoom.
const LETTERBOX_SPREAD = 100_000;
// The empty page's layout button beside the cog: with its words, or just its icon.
const INVITE_WIDE = 150;
const INVITE_ICON = 30;

// Screen px an empty page needs round the in-page layout card (EmptyPageLayouts), and the least
// height on screen that holds it.
const LAYOUT_CARD_MARGIN = 16;
// Six categories make three rows of cards.
const LAYOUT_CARD_MIN_HEIGHT = 440;

// Held at one screen size whatever the zoom: counter-scaled about the given corner.
const steady = (zoom: number, origin: string): CSSProperties => ({
  transform: `scale(${1 / zoom})`,
  transformOrigin: origin,
});

// Illustrate mode's pages (docs/specs/007-editor/illustrate-pages.md): sheets in a row, painted
// in canvas space under every element so they pan and zoom with them, on the tab's own canvas,
// which stays the surround. Each sheet wears its own background (a hover in its panel previews
// one). A change of size, turn or removal eases the sheets to their new places. The sheets take no
// pointer events: a press on one is a press on the canvas. Each page's label sits above its
// top-left corner (a press frames the page) and its settings cog above its top-right; the
// add-a-page button follows the last page; all held at one screen size.
export function IllustratePages({
  view,
  zoom,
  bare = false,
}: {
  view: IllustratePagesView;
  zoom: number;
  // The sheets alone, without their title bars or the add button (zen, presenting).
  bare?: boolean;
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
  // palette to its Logo category.
  const logoPalette = useLogoPaletteSwitch(pages, !!edit && !bare);
  const goToPage = (page: (typeof pages)[number]) => {
    focusPage(page.id);
    logoPalette.pageShown(page);
  };
  // A background hovered in a page's panel: a shared preview (page-background-preview), so the
  // writing and the elements on the page take its ink too.
  const preview = usePageBackgroundPreview();
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
  // The page toolbar's Article Style button opens the page's panel on Style.
  const styleRequest = useStylePanelRequest();
  const [seenStyleRequest, setSeenStyleRequest] = useState(styleRequest.seq);
  if (styleRequest.seq !== seenStyleRequest) {
    setSeenStyleRequest(styleRequest.seq);
    if (styleRequest.pageId)
      setOpened({ id: styleRequest.pageId, tab: 'style', seq: styleRequest.seq });
  }
  // The empty page's own invitation opens its panel on Layouts.
  const openLayouts = (id: string) => setOpened({ id, tab: 'layouts' });
  // The pages whose in-page layout card was hidden, until the tab is next opened.
  const [layoutsHidden, setLayoutsHidden] = useState<ReadonlySet<string>>(() => new Set());
  // An empty infographic page shows its layouts inside itself (EmptyPageLayouts): never on the first
  // page while it offers its kind, under its open panel, or on a page too small on screen to hold
  // the card.
  const showsLayoutCard = (page: LaidOutPage) =>
    !!edit &&
    page.locked !== true &&
    page.startedBlank !== true &&
    !page.flow &&
    page.kind !== 'article' &&
    edit.contentCount(page.id) === 0 &&
    !offersPageKindChoice(pages, page.id, 0) &&
    openId !== page.id &&
    !layoutsHidden.has(page.id) &&
    page.rect.width * zoom >= EMPTY_PAGE_LAYOUTS_WIDTH + LAYOUT_CARD_MARGIN * 2 &&
    page.rect.height * zoom >= LAYOUT_CARD_MIN_HEIGHT;
  // The page a layout is previewed on: its panel's, or its in-page card's.
  const previewed = view.layoutPreview
    ? pages.find((p) => p.id === view.layoutPreview!.pageId)
    : undefined;
  const anchorOf = useCallback((id: string) => cogs.current.get(id), []);
  return (
    <>
      {pages.map((page) => {
        const background = previewedBackground(page, pages, preview);
        const label = pageLabel(page, page.index, pages.length);
        const number = pageNumberOf(page);
        // The label fits the page's on-screen width, less the cog's room; too narrow, it hides.
        // The title bar's room on screen: the page's width at this zoom. The cog takes its corner;
        // an empty page's layout button sits beside it, with its words while there is room for
        // them and the label, as an icon while there is room for that, else not at all.
        const room = page.rect.width * zoom;
        // Layouts are for infographic pages: an article page never invites one.
        // A locked page offers nothing to add (docs/specs/007-editor/illustrate-pages.md
        // "Locking a page"): no layout invite, no kind choice.
        const locked = page.locked === true;
        const empty = !!edit && !locked && !page.flow && edit.contentCount(page.id) === 0;
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
        const logoButtons = !!edit && page.kind === 'logo' && !!view.logo;
        // The title bar's fixed buttons (the cog, the lock, the deck button, a logo page's own):
        // the invite and the label share what they leave.
        const fixedRoom =
          (edit ? COG_ROOM + pageLockRoom(locked, !mobile) : 0) +
          (deckButton ? DECK_ROOM : 0) +
          (logoButtons ? logoTitleBarRoom(true, !mobile) : 0);
        const invite =
          !empty || choosing
            ? null
            : !mobile && room - fixedRoom >= INVITE_WIDE + LABEL_MIN * 2
              ? 'wide'
              : room - fixedRoom >= INVITE_ICON + LABEL_MIN
                ? 'icon'
                : null;
        const labelRoom =
          room -
          fixedRoom -
          (invite === 'wide' ? INVITE_WIDE : invite === 'icon' ? INVITE_ICON : 0);
        return (
          <div
            key={page.id}
            data-illustrate-page={page.orientation}
            data-illustrate-page-id={page.id}
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
              ...pageSheetStyle(background, rulingOf(page)),
            }}
          >
            {/* An empty logo page's guides, under its own cards (LogoPageGuides draws them over
                the artwork once the page has some). */}
            {page.kind === 'logo' &&
            edit &&
            edit.contentCount(page.id) === 0 &&
            showsLogoGuides(view, bare, page.id) ? (
              <div
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
                  <LogoTitleBar pageId={page.id} tools={view.logo} />
                ) : null}
                {/* The page's lock, before the cog (PageLockButton). */}
                {edit ? (
                  <PageLockButton
                    locked={locked}
                    labelled={!mobile}
                    onToggle={() => edit.setLocked(page.id, !locked)}
                  />
                ) : null}
                {/* Beside the cog: this slide's place in the deck. */}
                {deckButton && view.deck ? (
                  <PageDeckButton pageId={page.id} deck={view.deck} />
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
            {!bare && pages.length > 1 ? (
              <PageNavigator
                index={page.index}
                count={pages.length}
                zoom={zoom}
                onGo={(i) => {
                  const to = pages[i];
                  if (to) goToPage(to);
                }}
              />
            ) : null}
            {choosing && edit ? (
              <FirstPageChoice
                zoom={zoom}
                onChoose={(kind) => edit.choosePageKind(page.id, kind)}
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
      {edit?.addPage ? (
        <AddPageButton lastRight={last.rect.x + last.rect.width} zoom={zoom} onAdd={edit.addPage} />
      ) : null}
      {previewed && view.layoutPreview ? (
        <InfographicLayoutPreview
          page={previewed}
          layout={view.layoutPreview.layout}
          tabFont={view.tabFont}
        />
      ) : null}
      {edit
        ? pages.filter(showsLayoutCard).map((page) => (
            <div
              key={page.id}
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
                onApply={(layout) => edit.applyLayout(page.id, layout)}
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
        <IllustratePagePanel
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
          articleStyle={(part) =>
            open.flow && articles?.flows[open.flow] ? (
              <ArticleStyleSection
                part={part}
                style={articles.flows[open.flow]!.style}
                themeAccent={view.themeAccent}
                onChange={(change) => articles.setStyle(open.flow!, change)}
                onPreview={(style) =>
                  articles.setStylePreview(style ? { flow: open.flow!, style } : null)
                }
              />
            ) : null
          }
        />
      ) : null}
    </>
  );
}

// The cog that opens the page's panel (IllustratePagePanel).
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
          onClick={() => onToggle()}
          className={`flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
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
      <Tooltip label="Start from a layout">
        <button
          type="button"
          aria-label="Start from a layout"
          onClick={onOpen}
          className="flex h-6 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <LayoutIcon />
          {wide ? (
            <span className="hidden whitespace-nowrap sm:inline">Start from a layout</span>
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
    ? before.rect.x + before.rect.width + ILLUSTRATE_PAGE_GAP / 2
    : after
      ? after.rect.x - ILLUSTRATE_PAGE_GAP / 2
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
