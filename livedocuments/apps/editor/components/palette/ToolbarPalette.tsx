'use client';

import type { Element } from '@livedocuments/document';
import { useEffect, useEffectEvent, useMemo, useRef, type ReactNode } from 'react';
import { onToolbarSearchRequest } from '@/lib/toolbar-search-request';
import { atLeastInset, safeInlinePadding } from '@livedocuments/ui';
import { LANDSCAPE_HANDLE_ROOM } from '@/components/chrome/LandscapeBars';
import { track } from '@/lib/telemetry';
import { SnapWidth } from '@/components/primitives/SnapWidth';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { TOOLBAR_CARD } from '@/components/chrome/toolbar-surface';
import { PaletteTintProvider } from './palette-controls';
import { PaletteGroupProvider } from './palette-group-state';
import { PaletteDropdown } from './PaletteDropdown';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import { usePaletteCatalogue } from './usePaletteCatalogue';
import type { PaletteProps } from './palette.types';
import type { PaletteAddHandlers } from './palette-add-handlers';
import { StripPopover, useStripPopover } from './ToolbarStripPopover';
import { Divider } from './strip-rail-items';
import { TOOLBAR_SEARCH_SELECTOR, ToolbarSearchButton, ToolbarSearchPanel } from './ToolbarSearch';
import { BrowseMemoryContext, useBrowseMemory } from './PaletteCategoryBrowser';
import { setPalettePopoverOpen } from '@liveworkspace/workbench/lib/palette-popover-open';
import { useBarLabels } from './useBarLabels';
import { useStripCrowded } from './useStripCrowded';
import { barCategoriesFor } from './bar-categories';
import { CategoryBarButtons, CategoryBarFlyout, useCategoryBar } from './CategoryBar';
import { usePaletteKindMotion } from './usePaletteKindMotion';
import { ArticleDockSlot } from './ArticleDockSlot';
import { usePaletteKind } from '@/lib/palette-kind';

// The Palette (docs/specs/007-editor/toolbar-layout.md): one horizontal strip pinned to the top centre of the
// canvas, the way Excalidraw's tool bar works. The selection mode on the left, then the category bar (each
// category a button opening a flyout of its tiles), and Search at the far right, which finds any element. With the
// palette's kind Article, the article's formatting takes the bar's place.
//
// The tiles, handlers and category bodies come from usePaletteCatalogue, so this file is only layout.

type Props = Pick<
  PaletteProps,
  'canvasTool' | 'onSetCanvasTool' | 'onToggleZen' | 'canvasEmpty' | 'pendingDraw' | 'themeTint'
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
  };
// The strip's card, and the leading card beside it on a phone.
const CARD_CLASS = `${TOOLBAR_CARD} ${PHONE_TOOLBAR_ITEMS}`;

// On a phone's row, the menu card sits at the left gutter and the strip beside
// it rather than centred (docs/specs/007-editor/toolbar-layout.md "On a phone");
// held sideways there is no menu card and the strip starts at the gutter. Off a
// phone, the strip alone, centred by its parent.
function StripRow({ leading, children }: { leading?: ReactNode; children: ReactNode }) {
  if (leading === undefined) return <>{children}</>;
  return (
    <div
      // 12px gutters, or a landscape notch's inset where that is bigger (lib/safe-area). Held
      // sideways, the right gutter also clears the bars handle at the canvas's top-right corner
      // (LandscapeBarsHandle), so a long strip's bar scrolls short of it rather than under it.
      style={{
        ...safeInlinePadding('0.75rem'),
        paddingRight: `calc(${atLeastInset('0.75rem', 'right')} + var(--landscape-handle-room, 0px))`,
      }}
      className={`pointer-events-none flex w-full items-start gap-2 [&>*]:pointer-events-auto ${LANDSCAPE_HANDLE_ROOM}`}
    >
      {leading == null ? null : (
        <div data-strip-leading="" className={CARD_CLASS}>
          {leading}
        </div>
      )}
      {children}
    </div>
  );
}

// Centred alone (desktop), the card is whole-pixel wide with the canvas's
// parity (see SnapWidth). Beside the menu card (a phone) it is left-aligned
// and may shrink to the row, its bar scrolling, so it is not snapped there.
function CardWidth({ swipe, children }: { swipe: boolean; children: ReactNode }) {
  if (swipe) return <div className="flex min-w-0">{children}</div>;
  return <SnapWidth matchParentParity>{children}</SnapWidth>;
}

export function ToolbarPalette(props: Props) {
  const { canvasTool, themeTint, pendingDraw, leading } = props;
  // The phone's row: the strip at the left gutter, beside the menu card when there is one. Its category bar
  // swipes sideways (docs/specs/007-editor/toolbar-layout.md "On a phone").
  const swipe = leading !== undefined;
  const hidden = props.hidden;
  // The strip's popovers (ToolbarStripPopover): only the popover and its own button count as inside, so pressing
  // anything else on the strip closes it.
  const rootRef = useRef<HTMLDivElement>(null);
  const search = useStripPopover(rootRef, TOOLBAR_SEARCH_SELECTOR);
  // The category bar and its flyout (CategoryBar).
  const bar = useCategoryBar(rootRef);
  // Icons, Stickers and Tech reopen on the group they were left on, for the page load (BrowseMemory).
  const browseMemory = useBrowseMemory();
  // The template start steps aside while a popover hangs from the strip (palette-popover-open).
  const popoverOpen = bar.popover.open || search.open;
  useEffect(() => {
    setPalettePopoverOpen(popoverOpen);
    return () => setPalettePopoverOpen(false);
  }, [popoverOpen]);
  const { tabs, tileActions, canvasToolOptions, onCanvasToolChange } = usePaletteCatalogue({
    ...props,
    // A tile used from a flyout or Search closes it, so the canvas is clear to draw on.
    onTileUsed: () => {
      search.setOpen(false);
      bar.popover.setOpen(false);
    },
  });
  // With the palette's kind Article, the strip holds the article's formatting in place of the bar.
  const paletteKind = usePaletteKind();
  const articleDock = paletteKind === 'article';
  // A change of kind cascades its categories in (usePaletteKindMotion).
  usePaletteKindMotion(paletteKind, rootRef);
  // The bar's categories (bar-categories): one-word names.
  const barCategories = useMemo(() => barCategoriesFor(tabs), [tabs]);

  const isMobile = useIsMobileViewport();
  // UI scale (docs/specs/007-editor/ui-scale.md): the strip zooms at its root.
  const scale = useUiScale('toolbar');
  const cardRef = useRef<HTMLDivElement>(null);
  // The category bar names its categories while the strip has room for the names (useBarLabels); glyphs alone
  // otherwise, and always on a phone.
  const barLabels = useBarLabels(cardRef, {
    enabled: !isMobile,
    categoriesKey: barCategories.map((c) => c.label).join('|'),
    scale,
  });
  // Too wide to centre between the menu card's sides (a tablet): the strip sits at the right instead.
  const crowded = useStripCrowded(cardRef, leading == null);

  // Opening the Search starts a new choice: a tile armed to place (its "Click to drop" banner) is let go first.
  const beforeSearch = () => {
    if (pendingDraw) tileActions.cancelDraw?.();
  };
  // S asks for the Search (lib/toolbar-search-request): answered only while it is on show, so the
  // key keeps its Select meaning with the chrome away.
  const searchButtonRef = useRef<HTMLDivElement>(null);
  const openSearchFromKey = useEffectEvent(() => {
    const button = searchButtonRef.current?.querySelector<HTMLElement>(
      '[data-toolbar-search-button]',
    );
    if (!button || search.open) return;
    bar.popover.setOpen(false);
    beforeSearch();
    track('UI', 'Opened', 'ToolbarSearch');
    search.openFrom(button);
  });
  useEffect(() => {
    if (hidden) return;
    return onToolbarSearchRequest(() => openSearchFromKey());
  }, [hidden]);
  const toggleSearch = (button: HTMLElement) => {
    if (search.open) return search.setOpen(false);
    beforeSearch();
    track('UI', 'Opened', 'ToolbarSearch');
    search.openFrom(button);
  };

  return (
    <div
      ref={rootRef}
      data-toolbar-palette=""
      data-region="palette"
      // The strip is the Palette, so the panel-opacity preference (docs/specs/007-editor/user-preferences.md)
      // fades it like every other panel; hovering it restores it.
      data-panel-translucent=""
      // `hidden` (zen, the welcome flow) hides rather than unmounts, so the
      // strip keeps its state while the chrome goes away and back.
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
      // While one of its popovers is open (a category's flyout, Search) the strip rises to the popover layer,
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
            <StripRow leading={leading}>
              <CardWidth swipe={swipe}>
                {/* The tour's Palette anchor (docs/specs/007-editor/pages-tour.md) is the card, not the
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
                  // Beside the menu card only the bar gives way (and scrolls): the
                  // selection mode and Search keep their size.
                  className={
                    swipe
                      ? `${CARD_CLASS} min-w-0 [&>:not([data-strip-rail])]:shrink-0`
                      : CARD_CLASS
                  }
                >
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
                  {/* A phone's strip runs the selection mode and the bar together, sparing the room. */}
                  {swipe ? null : <Divider />}
                  {articleDock ? (
                    // The article's formatting, docked (lib/article/article-dock.ts).
                    <ArticleDockSlot />
                  ) : (
                    <CategoryBarButtons
                      bar={bar}
                      categories={barCategories}
                      labels={barLabels}
                      scrollable={swipe}
                    />
                  )}
                  {/* Search, last: any element type (docs/specs/007-editor/toolbar-layout.md
                      "Search: every element type"). The bar ends on its last category; Search brings its own
                      divider. */}
                  <Divider />
                  <div ref={searchButtonRef} className="flex">
                    <ToolbarSearchButton open={search.open} onToggle={toggleSearch} />
                  </div>
                </div>
              </CardWidth>
            </StripRow>
            <CategoryBarFlyout
              bar={bar}
              categories={barCategories}
              actions={tileActions}
              pendingDraw={pendingDraw ?? null}
              isMobile={isMobile}
              scale={scale}
            />
            {search.open ? (
              <StripPopover
                right={search.right}
                isMobile={isMobile}
                scale={scale}
                label="Search Elements"
                dataAttr="data-toolbar-search"
              >
                <ToolbarSearchPanel
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
