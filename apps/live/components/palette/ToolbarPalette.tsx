'use client';

import { onPaletteCategoryRequest } from '@/lib/palette-category-request';
import type { Element, PageKind } from '@livediagram/document';
import { AddPageStripButton } from './AddPageStripButton';
import {
  Fragment,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { onToolbarSearchRequest } from '@/lib/toolbar-search-request';
import { ChevronDownIcon, EllipsisIcon, HoverCard, safeInlinePadding } from '@livediagram/ui';
import { track } from '@/lib/telemetry';
import { SnapWidth } from '@/components/primitives/SnapWidth';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { TOOLBAR_CARD } from '@/components/chrome/toolbar-surface';
import { PaletteTintProvider } from './palette-controls';
import { PaletteGroupProvider } from './palette-group-state';
import { PaletteDropdown, TOOLBAR_TRIGGER_TONE } from './PaletteDropdown';
import { CATEGORY_BANDS } from './palette-category-bands';
import { EsPhotoStripButton } from './EsPhotoStripButton';
import { PaletteTile } from './PaletteTileGrid';
import { usePlan } from '@/components/plan/PlanContext';
import { planCardTile } from './palette-plan-tiles';
import { EditCardsStripButton } from './EditCardsStripButton';
import { desktopStripTileLimit, phoneStripTileLimit, stripTilesFor } from './toolbar-strip-tiles';
import { useStripTileLimit } from './useStripTileLimit';
import { useViewportWidth } from '@/hooks/ui/useViewportWidth';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';
import { RAIL_LEAVE_MS, ToolbarStripRail } from './ToolbarStripRail';
import { usePaletteCatalogue } from './usePaletteCatalogue';
import { paletteLandingCategory } from './palette-layouts';
import type { PaletteProps } from './palette.types';
import type { PaletteAddHandlers } from './palette-add-handlers';
import { STRIP_DIVIDER_ATTR } from './useEdgeDividers';
import { StripPopover, useStripPopover } from './ToolbarStripPopover';
import { TOOLBAR_SEARCH_SELECTOR, ToolbarSearchButton, ToolbarSearchPanel } from './ToolbarSearch';

// The Toolbar layout's Palette (docs/specs/007-editor/toolbar-layout.md): one horizontal strip pinned to the
// top centre of the canvas, the way Excalidraw's tool bar works. Selection
// mode on the left, then the category picker, then that category's first
// tiles, and a More popover holding the category's full Palette body for
// everything that doesn't fit; Search, at the far right, finds any element.
//
// The tiles, handlers and category bodies come from
// usePaletteCatalogue, so this file is only layout.

type Props = Pick<
  PaletteProps,
  | 'canvasTool'
  | 'onSetCanvasTool'
  | 'onExitAvatarMode'
  | 'onToggleZen'
  | 'canvasEmpty'
  | 'pendingDraw'
  | 'esBoard'
  | 'esBoardControls'
  | 'themeTint'
> &
  PaletteAddHandlers & {
    // The chrome is hidden (zen, the welcome flow). Hidden rather than
    // unmounted, so the strip keeps its state for the page load.
    hidden?: boolean;
    // Its own card at the far left of the strip's row, the strip beside it: the
    // Explorer menu button and mode switch on a phone, which has no room for
    // them in a corner card above the strip.
    leading?: ReactNode;
    // Illustrate mode: a + at the strip's end adds a page (AddPageStripButton).
    onAddPage?: (kind: PageKind) => void;
    // The active tab's elements: Search lists their element types before anything is typed.
    tabElements?: readonly Element[];
  };
// The strip's card, and the leading card beside it on a phone.
const CARD_CLASS = `${TOOLBAR_CARD} ${PHONE_TOOLBAR_ITEMS}`;

// With a leading card (a phone), the menu card sits at the left gutter and the
// strip beside it rather than centred (docs/specs/007-editor/toolbar-layout.md
// "On a phone"). Without one, the strip alone, centred by its parent.
function StripRow({
  leading,
  leadingRef,
  children,
}: {
  leading?: ReactNode;
  leadingRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  if (!leading) return <>{children}</>;
  return (
    <div
      // 12px gutters, or a landscape notch's inset where that is bigger (lib/safe-area).
      style={safeInlinePadding('0.75rem')}
      className="pointer-events-none flex w-full items-start gap-2 [&>*]:pointer-events-auto"
    >
      <div ref={leadingRef} data-strip-leading="" className={CARD_CLASS}>
        {leading}
      </div>
      {children}
    </div>
  );
}

// Centred alone (desktop), the card is whole-pixel wide with the canvas's
// parity (see SnapWidth). Beside the menu card (a phone) it is left-aligned
// and may shrink to the row, its rail scrolling, so it is not snapped there.
function CardWidth({ swipe, children }: { swipe: boolean; children: ReactNode }) {
  if (swipe) return <div className="flex min-w-0">{children}</div>;
  return <SnapWidth matchParentParity>{children}</SnapWidth>;
}

function Divider() {
  // Hairline margins on a phone, where every pixel of the strip is a tile's.
  return (
    <span
      aria-hidden
      {...{ [STRIP_DIVIDER_ATTR]: '' }}
      className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 phone:mx-px dark:bg-slate-700"
    />
  );
}

export function ToolbarPalette(props: Props) {
  const { canvasTool, esBoard, themeTint, pendingDraw, hidden, leading } = props;
  // The strip's two popovers (ToolbarStripPopover): only the popover and its own button count as
  // inside, so pressing anything else on the strip closes it.
  const rootRef = useRef<HTMLDivElement>(null);
  const more = useStripPopover(rootRef, '[data-toolbar-more], [data-toolbar-more-button]');
  const search = useStripPopover(rootRef, TOOLBAR_SEARCH_SELECTOR);
  const moreOpen = more.open;
  const setMoreOpen = more.setOpen;
  const { tabs, tileActions, canvasToolOptions, onCanvasToolChange, editorMode } =
    usePaletteCatalogue({
      ...props,
      // A tile used from the More or Search popover closes it, so the canvas is clear to draw on.
      onTileUsed: () => {
        more.setOpen(false);
        search.setOpen(false);
      },
    });
  // The landing rule (palette-layouts, docs/specs/021-event-storming/event-storming.md): the
  // mode's Popular, or the notation on an event-storming board.
  const defaultId = paletteLandingCategory(editorMode, !!esBoard);
  // Crossing an ES / non-ES tab boundary re-lands on the right default: the
  // host keys this component on `esBoard`, so a board change re-lands the category.
  const [categoryId, setCategoryId] = useState(defaultId);
  // Another surface asking for a category (a board's + asks for Widgets).
  useEffect(
    () =>
      onPaletteCategoryRequest((id) => {
        if (tabs.some((t) => t.id === id)) setCategoryId(id);
      }),
    [tabs],
  );
  const category = tabs.find((t) => t.id === categoryId) ?? tabs[0];

  // The strip holds as many tiles as the window fits, up to twelve; the rest
  // of the category is behind More.
  const isMobile = useIsMobileViewport();
  const viewportWidth = useViewportWidth();
  // UI scale (docs/specs/007-editor/ui-scale.md): the strip zooms at its root,
  // so a scaled tile takes more of the window.
  const scale = useUiScale('toolbar');
  // Measured from the strip itself (useStripTileLimit); the estimate only
  // covers the first paint.
  const cardRef = useRef<HTMLDivElement>(null);
  const leadingRef = useRef<HTMLDivElement>(null);
  const stripLimit = useStripTileLimit(cardRef, {
    leadingRef,
    isMobile,
    scale,
    fallback: isMobile
      ? phoneStripTileLimit(viewportWidth)
      : desktopStripTileLimit(viewportWidth / scale),
  });
  // On a phone the strip holds the WHOLE category and swipes sideways
  // (docs/specs/007-editor/toolbar-layout.md "On a phone"); the fitted count
  // still decides whether More is needed for what is out of view.
  const swipe = leading != null;
  const tileLimit = swipe ? Infinity : stripLimit;
  // Plan mode's Cards follow the document's item types (docs/specs/026-plan/item-types.md).
  const plan = usePlan();
  const planCardTiles = plan?.types.map(planCardTile);
  const categoryTiles =
    category?.id === 'plan-cards' && planCardTiles ? planCardTiles : category?.tiles;
  const fitted = stripTilesFor(category?.id ?? defaultId, {
    hasImage: tileActions.hasImage,
    limit: stripLimit,
    // The category's tiles in this mode's layout (palette-layouts).
    tiles: categoryTiles,
  });
  const { tiles, dividersAfter } = swipe
    ? stripTilesFor(category?.id ?? defaultId, {
        hasImage: tileActions.hasImage,
        limit: tileLimit,
        tiles: categoryTiles,
      })
    : fitted;
  const { hasMore } = fitted;

  // The category being switched AWAY from, while its tiles animate out
  // (ToolbarStripRail). Rebuilt from data rather than kept as stale nodes, and
  // cleared once the exit has played.
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const leaveTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    },
    [],
  );
  // The category picker: the strip swaps to the new tiles (animated) and any
  // open More popover closes, since it was showing the old category.
  const switchCategory = (id: string) => {
    if (id === categoryId) return;
    setLeavingId(categoryId);
    setCategoryId(id);
    setMoreOpen(false);
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setLeavingId(null), RAIL_LEAVE_MS);
    track('UI', 'Changed', 'ToolbarCategory');
  };
  const leaving = leavingId
    ? stripTilesFor(leavingId, {
        hasImage: tileActions.hasImage,
        limit: tileLimit,
        tiles: tabs.find((t) => t.id === leavingId)?.tiles,
      })
    : null;

  const openMore = (button: HTMLElement) => {
    track('UI', 'Opened', 'ToolbarMore');
    more.openFrom(button);
  };
  // S asks for the Search (lib/toolbar-search-request): answered only while it is on show, so the
  // key keeps its Select meaning on an event-storming board or with the chrome away.
  const searchButtonRef = useRef<HTMLDivElement>(null);
  const openSearchFromKey = useEffectEvent(() => {
    const button = searchButtonRef.current?.querySelector<HTMLElement>(
      '[data-toolbar-search-button]',
    );
    if (!button || search.open) return;
    more.setOpen(false);
    track('UI', 'Opened', 'ToolbarSearch');
    search.openFrom(button);
  });
  useEffect(() => {
    if (esBoard || hidden) return;
    return onToolbarSearchRequest(() => openSearchFromKey());
  }, [esBoard, hidden]);
  const toggleSearch = (button: HTMLElement) => {
    if (search.open) return search.setOpen(false);
    track('UI', 'Opened', 'ToolbarSearch');
    search.openFrom(button);
  };
  const moreButton = (
    <button
      type="button"
      data-toolbar-more-button=""
      aria-label={`More ${category?.label ?? ''}`.trim()}
      aria-expanded={moreOpen}
      onClick={(e) => {
        if (moreOpen) setMoreOpen(false);
        else openMore(e.currentTarget);
      }}
      className={`flex h-9 items-center gap-1 rounded-md px-2 transition ${
        moreOpen
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : TOOLBAR_TRIGGER_TONE
      }`}
    >
      {/* An ellipsis rather than the word: the hover card and aria-label name
          it, and a glyph sits with the icon tiles instead of reading as a
          stray label among them. */}
      <EllipsisIcon />
      <ChevronDownIcon className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
    </button>
  );

  return (
    <div
      ref={rootRef}
      data-toolbar-palette=""
      // The strip is the Palette in this layout, so the panel-opacity
      // preference (docs/specs/007-editor/user-preferences.md) fades it and its More popover
      // like every other panel; hovering either restores it.
      data-panel-translucent=""
      // `hidden` (zen, the welcome flow) hides rather than unmounts, so the
      // chosen category survives the chrome going away and back.
      //
      // Centred by flexbox across the full width, not `left-1/2
      // -translate-x-1/2`: a translate of half an odd width leaves the whole
      // strip on a half pixel, and every icon in it soft. The row itself lets
      // clicks through; the card and the popover take them.
      // Zoomed at the root, which still spans the canvas, so the card stays
      // centred; `top` is restated so the strip keeps its 12px from the top.
      style={scale === 1 ? undefined : { ...uiScaleStyle(scale), top: toSurfacePx(12, scale) }}
      className={`pointer-events-none absolute inset-x-0 top-3 z-[var(--z-toolbar)] flex-col items-center [&>*]:pointer-events-auto ${hidden ? 'hidden' : 'flex'}`}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <PaletteGroupProvider>
        <PaletteTintProvider tint={themeTint}>
          {/* Whole-pixel wide where centred (see CardWidth). */}
          <StripRow leading={leading} leadingRef={leadingRef}>
            <CardWidth swipe={swipe}>
              {/* The tour's Palette anchor (docs/specs/007-editor/editor-tour.md) is the card, not the
                full-width row around it, so the ring frames the strip. */}
              <div
                ref={cardRef}
                data-tour-id="palette"
                // Chrome, not canvas: a paste, a drop or a drag ghost over the strip treats it like
                // any panel (lib/canvas-pointer.ts, PaletteDragGhost, usePaletteDrop).
                data-floating-panel=""
                // Slides across with the rest of the chrome when a split moves the editor
                // (docs/specs/007-editor/split-view.md).
                data-split-chrome=""
                // Beside the menu card only the rail gives way (and scrolls): the
                // selection mode, the category picker and More keep their size.
                className={
                  swipe ? `${CARD_CLASS} min-w-0 [&>:not([data-strip-rail])]:shrink-0` : CARD_CLASS
                }
              >
                {/* Event-storming boards hide the selection mode (docs/specs/021-event-storming/event-storming.md): the
                notation is the palette there. */}
                {/* ...and lead with the board's own control instead, as the Event Storming
                category's body does. */}
                {esBoard && props.esBoardControls?.onImportPhoto ? (
                  <>
                    <EsPhotoStripButton controls={props.esBoardControls} />
                    <Divider />
                  </>
                ) : null}
                {esBoard ? null : (
                  <>
                    <PaletteDropdown
                      ariaLabel="Selection mode"
                      dataTourId="canvas-tool"
                      hoverCardTitle="Selection Mode"
                      hoverCardDescription="Choose how the pointer acts on the canvas."
                      value={canvasTool}
                      variant="toolbar"
                      iconOnly
                      autoHeight
                      grid
                      menuClassName=""
                      groupLabels={{ 0: 'Edit', 1: 'Present', 2: 'Preview' }}
                      onChange={onCanvasToolChange}
                      options={canvasToolOptions}
                    />
                    <Divider />
                    {/* The category picker sits between the selection mode and the
                    tiles it chooses, so it reads as a label for them (docs/specs/007-editor/toolbar-layout.md).
                    Its width follows its label's text, which is fractional:
                    snapped, so the tiles after it stay on whole pixels. */}
                    <SnapWidth>
                      <PaletteDropdown
                        ariaLabel="Palette category"
                        dataTourId="palette-category"
                        value={category?.id ?? defaultId}
                        variant="toolbar"
                        // A phone shows the category's icon alone, so the
                        // strip has room for more tiles.
                        iconOnly={isMobile}
                        autoHeight
                        grid
                        menuClassName=""
                        groupLabels={CATEGORY_BANDS}
                        onChange={switchCategory}
                        options={tabs.map((tab) => ({
                          id: tab.id,
                          label: tab.label,
                          icon: tab.icon,
                          group: tab.group,
                          fullWidth: tab.fullWidth,
                        }))}
                      />
                    </SnapWidth>
                    <Divider />
                  </>
                )}
                <ToolbarStripRail
                  scrollable={swipe}
                  railKey={category?.id ?? defaultId}
                  items={[
                    ...tiles.map((def) => {
                      const tile = (
                        <PaletteTile
                          def={def}
                          actions={tileActions}
                          pendingDraw={pendingDraw}
                          compact
                        />
                      );
                      // A fixed divider rides with the tile it follows.
                      return dividersAfter.has(def.id) ? (
                        <span key={def.id} className="flex items-center">
                          {tile}
                          <Divider />
                        </span>
                      ) : (
                        <Fragment key={def.id}>{tile}</Fragment>
                      );
                    }),
                  ]}
                  leavingItems={
                    leaving
                      ? [
                          ...leaving.tiles.map((def) => (
                            <span key={def.id} className="flex items-center">
                              <PaletteTile
                                def={def}
                                actions={tileActions}
                                pendingDraw={null}
                                compact
                              />
                              {leaving.dividersAfter.has(def.id) ? <Divider /> : null}
                            </span>
                          )),
                        ]
                      : null
                  }
                />
                {/* Outside the rail so it rides the rail's width change rather
                than popping out and back in with the tiles. Only there when
                the category has more than the strip shows. */}
                {hasMore ? (
                  <>
                    <Divider />
                    {moreOpen ? (
                      moreButton
                    ) : (
                      <HoverCard
                        title={`More ${category?.label ?? ''}`.trim()}
                        description={category?.description ?? 'Everything in this category.'}
                      >
                        {moreButton}
                      </HoverCard>
                    )}
                  </>
                ) : null}
                {/* Not on a phone: the strip has no room to spare, and the row's own + (after the
                    last page) adds one there. */}
                {category?.id === 'plan-cards' && plan?.canEdit && !isMobile ? (
                  <>
                    <Divider />
                    <EditCardsStripButton />
                  </>
                ) : null}
                {props.onAddPage && !isMobile ? (
                  <>
                    <Divider />
                    <AddPageStripButton onAdd={props.onAddPage} />
                  </>
                ) : null}
                {/* Search, last: any element type, this mode's and the others' (docs/specs/007-editor/toolbar-layout.md
                    "Search: every element type"). Not on an event-storming board, whose notation is
                    its palette. */}
                {esBoard ? null : (
                  <>
                    <Divider />
                    <div ref={searchButtonRef} className="flex">
                      <ToolbarSearchButton open={search.open} onToggle={toggleSearch} />
                    </div>
                  </>
                )}
              </div>
            </CardWidth>
          </StripRow>
          {moreOpen && category ? (
            // The category's full Palette body (usePaletteCatalogue).
            <StripPopover
              right={more.right}
              isMobile={isMobile}
              scale={scale}
              label={category.label}
              dataAttr="data-toolbar-more"
            >
              {category.content}
            </StripPopover>
          ) : null}
          {search.open && !esBoard ? (
            <StripPopover
              right={search.right}
              isMobile={isMobile}
              scale={scale}
              label="Search Elements"
              dataAttr="data-toolbar-search"
            >
              <ToolbarSearchPanel
                mode={editorMode}
                actions={tileActions}
                pendingDraw={pendingDraw}
                planCardTiles={editorMode === 'plan' && plan ? planCardTiles : undefined}
                tabElements={props.tabElements ?? []}
              />
            </StripPopover>
          ) : null}
        </PaletteTintProvider>
      </PaletteGroupProvider>
    </div>
  );
}
