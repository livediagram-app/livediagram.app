'use client';

import { onPaletteCategoryRequest } from '@/lib/palette-category-request';
import type { Element } from '@livediagram/document';
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { onToolbarSearchRequest } from '@liveworkspace/workbench/lib/toolbar-search-request';
import {
  ChevronDownIcon,
  EllipsisIcon,
  HoverCard,
  atLeastInset,
  safeInlinePadding,
} from '@livediagram/ui';
import { LANDSCAPE_HANDLE_ROOM } from '@/components/chrome/LandscapeBars';
import { track } from '@/lib/telemetry';
import { SnapWidth } from '@liveworkspace/workbench/components/primitives/SnapWidth';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { TOOLBAR_CARD } from '@/components/chrome/toolbar-surface';
import { PaletteTintProvider } from './palette-controls';
import { PaletteGroupProvider } from '@liveworkspace/workbench/components/palette/palette-group-state';
import { PaletteDropdown, TOOLBAR_TRIGGER_TONE } from './PaletteDropdown';
import { CATEGORY_BANDS } from './palette-category-bands';
import { EsPhotoStripButton } from './EsPhotoStripButton';
import { desktopStripTileLimit, phoneStripTileLimit, stripTilesFor } from './toolbar-strip-tiles';
import { useStripTileLimit } from './useStripTileLimit';
import { useViewportWidth } from '@liveworkspace/workbench/hooks/ui/useViewportWidth';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import { RAIL_LEAVE_MS, ToolbarStripRail } from './ToolbarStripRail';
import { usePaletteCatalogue } from './usePaletteCatalogue';
import { paletteLandingCategory } from './palette-layouts';
import type { PaletteProps } from './palette.types';
import type { PaletteAddHandlers } from './palette-add-handlers';
import { StripPopover, useStripPopover } from '@liveworkspace/workbench/components/palette/ToolbarStripPopover';
import { catalogueStripGroups } from './catalogue-strip-groups';
import { StripOpenerPanel } from './StripOpenerPanel';
import {
  Divider,
  groupItems,
  StripOpenedBody,
  tileItems,
  useStripOpeners,
} from './strip-rail-items';
import { TOOLBAR_SEARCH_SELECTOR, ToolbarSearchButton, ToolbarSearchPanel } from './ToolbarSearch';
import { BrowseMemoryContext, useBrowseMemory } from './PaletteCategoryBrowser';
import { CATEGORY_BAR_MODES } from './category-flyout-groups';
import { setPalettePopoverOpen } from '@liveworkspace/workbench/lib/palette-popover-open';
import { useBarLabels } from '@liveworkspace/workbench/components/palette/useBarLabels';
import { useStripCrowded } from '@liveworkspace/workbench/components/palette/useStripCrowded';
import { SessionBrowse } from './session-category';
import { barCategoriesFor } from './bar-categories';
import { CategoryBarButtons, CategoryBarFlyout, useCategoryBar } from './CategoryBar';
import { usePaletteKindMotion } from './usePaletteKindMotion';

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
    // them in a corner card above the strip. Given at all (null included), the
    // strip takes the phone's row; null is that row with no menu card (a phone
    // held sideways, docs/specs/007-editor/editor-app.md "A phone held sideways").
    leading?: ReactNode;
    // The active tab's elements: Search lists their element types before anything is typed.
    tabElements?: readonly Element[];
    // A Participant (docs/specs/013-workspace/share-roles.md): the Participate category alone, its selection
    // modes, and no Search (it would offer every element type).
    participant?: boolean;
  };
// The strip's card, and the leading card beside it on a phone.
const CARD_CLASS = `${TOOLBAR_CARD} ${PHONE_TOOLBAR_ITEMS}`;

// On a phone's row, the menu card sits at the left gutter and the strip beside
// it rather than centred (docs/specs/007-editor/toolbar-layout.md "On a phone");
// held sideways there is no menu card and the strip starts at the gutter. Off a
// phone, the strip alone, centred by its parent.
function StripRow({
  leading,
  leadingRef,
  children,
}: {
  leading?: ReactNode;
  leadingRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  if (leading === undefined) return <>{children}</>;
  return (
    <div
      // 12px gutters, or a landscape notch's inset where that is bigger (lib/safe-area). Held
      // sideways, the right gutter also clears the bars handle at the canvas's top-right corner
      // (LandscapeBarsHandle), so a long strip's rail scrolls short of it rather than under it.
      style={{
        ...safeInlinePadding('0.75rem'),
        paddingRight: `calc(${atLeastInset('0.75rem', 'right')} + var(--landscape-handle-room, 0px))`,
      }}
      className={`pointer-events-none flex w-full items-start gap-2 [&>*]:pointer-events-auto ${LANDSCAPE_HANDLE_ROOM}`}
    >
      {leading == null ? null : (
        <div ref={leadingRef} data-strip-leading="" className={CARD_CLASS}>
          {leading}
        </div>
      )}
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

export function ToolbarPalette(props: Props) {
  const { canvasTool, esBoard, themeTint, pendingDraw, leading } = props;
  // The phone's row: the strip at the left gutter, beside the menu card when there is one.
  const phoneRow = leading !== undefined;
  const hidden = props.hidden;
  const participant = !!props.participant;
  // The strip's two popovers (ToolbarStripPopover): only the popover and its own button count as
  // inside, so pressing anything else on the strip closes it.
  const rootRef = useRef<HTMLDivElement>(null);
  const more = useStripPopover(rootRef, '[data-toolbar-more], [data-toolbar-more-button]');
  const search = useStripPopover(rootRef, TOOLBAR_SEARCH_SELECTOR);
  // The category bar and its flyout (CategoryBar).
  const bar = useCategoryBar(rootRef);
  // Icons, Stickers and Tech reopen on the group they were left on, for the page load (BrowseMemory).
  const browseMemory = useBrowseMemory();
  const moreOpen = more.open;
  // The template start steps aside while a popover hangs from the strip (palette-popover-open).
  const popoverOpen = bar.popover.open || more.open || search.open;
  useEffect(() => {
    setPalettePopoverOpen(popoverOpen);
    return () => setPalettePopoverOpen(false);
  }, [popoverOpen]);
  const setMoreOpen = more.setOpen;
  const { tabs, tileActions, canvasToolOptions, onCanvasToolChange, editorMode } =
    usePaletteCatalogue({
      ...props,
      // A tile used from the More or Search popover closes it, so the canvas is clear to draw on.
      onTileUsed: () => {
        more.setOpen(false);
        search.setOpen(false);
        bar.popover.setOpen(false);
      },
    });
  // The landing rule (palette-layouts, docs/specs/021-event-storming/event-storming.md): the
  // mode's Popular, or the notation on an event-storming board. A Participant lands on Participate.
  // Diagram shows its categories on the strip, each opening a flyout of its tiles, rather than one category's tiles
  // (docs/specs/007-editor/toolbar-layout.md "The category bar"). Not on an event-storming board, whose
  // notation is the palette, nor for a Participant, whose palette is one category.
  const categoryBar = CATEGORY_BAR_MODES.has(editorMode) && !esBoard && !participant;
  // A change of mode cascades its categories in (usePaletteKindMotion).
  usePaletteKindMotion(editorMode, rootRef);
  const defaultId = participant ? 'participate' : paletteLandingCategory(editorMode, !!esBoard);
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
  // The bar has no Popular: with every category one press away, a pick from across them adds nothing.
  // The bar's categories (bar-categories): no Popular, one-word names, Session.
  const barCategories = useMemo(
    () =>
      barCategoriesFor(tabs, (groups) => (
        <SessionBrowse groups={groups} actions={tileActions} pendingDraw={pendingDraw ?? null} />
      )),
    [tabs, tileActions, pendingDraw],
  );
  // A category this mode does not offer (one picked in another mode) shows the mode's landing.
  const category =
    tabs.find((t) => t.id === categoryId) ?? tabs.find((t) => t.id === defaultId) ?? tabs[0];

  // The strip holds as many tiles as the window fits, up to twelve; the rest
  // of the category is behind More.
  const isMobile = useIsMobileViewport();
  const viewportWidth = useViewportWidth();
  // UI scale (docs/specs/007-editor/ui-scale.md): the strip zooms at its root,
  // so a scaled tile takes more of the window.
  const scale = useUiScale('toolbar');
  // The category bar names its categories where the window has room for every name; glyphs alone otherwise.
  // Measured from the strip itself (useStripTileLimit); the estimate only
  // covers the first paint.
  const cardRef = useRef<HTMLDivElement>(null);
  // The category bar names its categories while the strip has room for the names (useBarLabels).
  const barLabels = useBarLabels(cardRef, {
    enabled: categoryBar && !isMobile,
    categoriesKey: barCategories.map((c) => c.label).join('|'),
    scale,
  });
  const leadingRef = useRef<HTMLDivElement>(null);
  // Too wide to centre between the menu card's sides (a tablet): the strip sits at the right instead.
  const crowded = useStripCrowded(cardRef, leading == null);
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
  const swipe = phoneRow;
  const tileLimit = swipe ? Infinity : stripLimit;
  const categoryTiles = category?.tiles;
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
  // Icons, Stickers and Technology show their groups instead of tiles, each opening a popover of its entries
  // (docs/specs/007-editor/toolbar-layout.md "More"); a desktop strip shows as many as fit, More the rest.
  const allGroups = category ? catalogueStripGroups(category.id) : null;
  const groups = allGroups && !swipe ? allGroups.slice(0, Math.floor(stripLimit)) : allGroups;
  // What the More popover shows: its own body, or what a group tile or an opener opened (strip-rail-items).
  const openers = useStripOpeners(more);
  const { moreShown, openMore } = openers;
  // The category an opener or group opened, and, for a whole category of tiles (an opener's), its card panel.
  const openedTab = openers.opened
    ? tabs.find((t) => t.id === openers.opened!.category)
    : undefined;
  // A tile's presets (docs/specs/009-elements/card.md "Card presets") show in the same panel as an opener's category.
  const openedVariants = openers.opened?.variants;
  const openedPanel = openedVariants
    ? {
        label: openers.opened!.label,
        description: openedVariants.description,
        tiles: openedVariants.tiles,
      }
    : openers.opened && !openers.opened.group && openedTab?.tiles
      ? openedTab
      : null;
  // On a phone only My shapes keeps More: the swipe reaches every other category's tiles or groups.
  const showMore = swipe ? category?.id === 'my-shapes' : hasMore;

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
  // A catalogue leaves as the groups it showed.
  const leavingGroups = leavingId ? catalogueStripGroups(leavingId) : null;
  const leaving = leavingId
    ? stripTilesFor(leavingId, {
        hasImage: tileActions.hasImage,
        limit: tileLimit,
        tiles: tabs.find((t) => t.id === leavingId)?.tiles,
      })
    : null;

  // Opening the Search starts a new choice: a tile armed to place (its "Click to drop" banner) is let go first.
  const beforeSearch = () => {
    if (pendingDraw) tileActions.cancelDraw?.();
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
    bar.popover.setOpen(false);
    beforeSearch();
    track('UI', 'Opened', 'ToolbarSearch');
    search.openFrom(button);
  });
  useEffect(() => {
    if (esBoard || participant || hidden) return;
    return onToolbarSearchRequest(() => openSearchFromKey());
  }, [esBoard, participant, hidden]);
  const toggleSearch = (button: HTMLElement) => {
    if (search.open) return search.setOpen(false);
    beforeSearch();
    track('UI', 'Opened', 'ToolbarSearch');
    search.openFrom(button);
  };
  const moreButton = (
    <button
      type="button"
      data-toolbar-more-button=""
      aria-label={`More ${category?.label ?? ''}`.trim()}
      aria-expanded={moreShown}
      onClick={(e) => {
        if (moreShown) setMoreOpen(false);
        else openMore(e.currentTarget);
      }}
      className={`flex h-9 items-center gap-1 rounded-md px-2 transition ${
        moreShown
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : TOOLBAR_TRIGGER_TONE
      }`}
    >
      {/* An ellipsis rather than the word: the hover card and aria-label name
          it, and a glyph sits with the icon tiles instead of reading as a
          stray label among them. */}
      <EllipsisIcon />
      <ChevronDownIcon className={`transition-transform ${moreShown ? 'rotate-180' : ''}`} />
    </button>
  );

  return (
    <div
      ref={rootRef}
      data-toolbar-palette=""
      data-region="palette"
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
      style={{
        ...(scale === 1 ? {} : { ...uiScaleStyle(scale), top: toSurfacePx(12, scale) }),
        alignItems: crowded ? 'flex-end' : 'center',
        paddingRight: crowded ? '0.75rem' : 0,
      }}
      // While one of its popovers is open (a category's flyout, More, Search) the strip rises to the popover layer,
      // so what hangs from it sits over everything on the canvas, an element's toolbar and menus included.
      className={`pointer-events-none absolute inset-x-0 top-3 ${
        popoverOpen ? 'z-[var(--z-popover)]' : 'z-[var(--z-toolbar)]'
      } flex-col [&>*]:pointer-events-auto ${hidden ? 'hidden' : 'flex'}`}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <BrowseMemoryContext.Provider value={browseMemory}>
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
                  // any panel (@liveworkspace/workbench/lib/canvas-pointer.ts, PaletteDragGhost, usePaletteDrop).
                  data-floating-panel=""
                  // Slides across with the rest of the chrome when a split moves the editor
                  // (docs/specs/007-editor/split-view.md).
                  data-split-chrome=""
                  // Beside the menu card only the rail gives way (and scrolls): the
                  // selection mode, the category picker and More keep their size.
                  className={
                    swipe
                      ? `${CARD_CLASS} min-w-0 [&>:not([data-strip-rail])]:shrink-0`
                      : CARD_CLASS
                  }
                >
                  {/* Event-storming boards hide the selection mode (docs/specs/021-event-storming/event-storming.md): the
                notation is the palette there. */}
                  {/* ...and lead with the board's own control instead, as the Event Storming
                category's body does. */}
                  {esBoard && !participant && props.esBoardControls?.onImportPhoto ? (
                    <>
                      <EsPhotoStripButton controls={props.esBoardControls} />
                      <Divider />
                    </>
                  ) : null}
                  {esBoard && !participant ? null : (
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
                      {/* A phone's strip runs the two pickers together, sparing the room for tiles. */}
                      {swipe ? null : <Divider />}
                      {categoryBar ? (
                        <CategoryBarButtons
                          bar={bar}
                          categories={barCategories}
                          labels={barLabels}
                          scrollable={swipe}
                        />
                      ) : (
                        <>
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
                        </>
                      )}
                      {/* The bar ends on its last category; Search brings its own divider. */}
                      {categoryBar ? null : <Divider />}
                    </>
                  )}
                  {categoryBar ? null : (
                    <>
                      <ToolbarStripRail
                        scrollable={swipe}
                        railKey={category?.id ?? defaultId}
                        items={
                          groups && category
                            ? groupItems(category.id, groups, openers)
                            : tileItems(
                                tiles,
                                dividersAfter,
                                tileActions,
                                pendingDraw ?? null,
                                openers,
                              )
                        }
                        leavingItems={
                          leavingId && leavingGroups
                            ? groupItems(leavingId, leavingGroups)
                            : leaving
                              ? tileItems(leaving.tiles, leaving.dividersAfter, tileActions, null)
                              : null
                        }
                      />
                      {/* Outside the rail so it rides the rail's width change rather
                than popping out and back in with the tiles. Only there when
                the category has more than the strip shows. On a phone only for My shapes (showMore). */}
                      {showMore ? (
                        <>
                          <Divider />
                          {/* Switched off while open rather than left out, so the button is not remounted as
                                More opens: Escape hands focus back to it (ToolbarStripPopover). */}
                          <HoverCard
                            disabled={moreShown}
                            title={`More ${category?.label ?? ''}`.trim()}
                            description={category?.description ?? 'Everything in this category.'}
                          >
                            {moreButton}
                          </HoverCard>
                        </>
                      ) : null}
                    </>
                  )}
                  {/* Search, last: any element type, this mode's and the others' (docs/specs/007-editor/toolbar-layout.md
                    "Search: every element type"). Not on an event-storming board, whose notation is
                    its palette. */}
                  {esBoard || participant ? null : (
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
            {categoryBar ? (
              <CategoryBarFlyout
                bar={bar}
                categories={barCategories}
                mode={editorMode}
                actions={tileActions}
                pendingDraw={pendingDraw ?? null}
                isMobile={isMobile}
                scale={scale}
              />
            ) : null}
            {moreOpen && category && !categoryBar ? (
              // The category's full Palette body (usePaletteCatalogue), or what a group tile or an opener opened.
              <StripPopover
                right={more.right}
                isMobile={isMobile}
                scale={scale}
                // A category opener's panel names itself; a group's popover is the group; More's is the category.
                label={openedPanel ? undefined : (openers.opened?.label ?? category.label)}
                dataAttr="data-toolbar-more"
              >
                {openedPanel ? (
                  <StripOpenerPanel
                    label={openedPanel.label}
                    description={openedPanel.description}
                    tiles={openedPanel.tiles ?? []}
                    actions={tileActions}
                    pendingDraw={pendingDraw ?? null}
                  />
                ) : (
                  <StripOpenedBody
                    opened={openers.opened}
                    content={(openers.opened ? openedTab : category)?.content}
                  />
                )}
              </StripPopover>
            ) : null}
            {search.open && !esBoard && !participant ? (
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
                  tabElements={props.tabElements ?? []}
                />
              </StripPopover>
            ) : null}
          </PaletteTintProvider>
        </PaletteGroupProvider>
      </BrowseMemoryContext.Provider>
    </div>
  );
}
