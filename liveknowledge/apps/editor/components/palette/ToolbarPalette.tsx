'use client';

import { PHONE_EDGE_LEFT_IN_ROW } from '@liveworkspace/workbench/components/chrome/MenuCardLogo';
import type { Page } from '@liveknowledge/document';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { atLeastInset, safeInlinePadding } from '@liveknowledge/ui';
import { LANDSCAPE_HANDLE_ROOM } from '@/components/chrome/LandscapeBars';
import { SnapWidth } from '@liveworkspace/workbench/components/primitives/SnapWidth';
import { PACKED_TOOLBAR_ITEMS } from '@liveworkspace/workbench/components/chrome/phone-toolbar-items';
import { TOOLBAR_CARD } from '@liveworkspace/workbench/components/chrome/toolbar-surface';
import { PaletteTintProvider } from './palette-controls';
import { PaletteGroupProvider } from '@liveworkspace/workbench/components/palette/palette-group-state';
import { PaletteDropdown } from '@liveworkspace/workbench/components/palette/PaletteDropdown';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import { usePaletteCatalogue } from './usePaletteCatalogue';
import type { PaletteProps } from './palette.types';
import type { PaletteAddHandlers } from './palette-add-handlers';
import {
  StripPopover,
  useStripPopover,
} from '@liveworkspace/workbench/components/palette/ToolbarStripPopover';
import { Divider } from './strip-rail-items';
import {
  TOOLBAR_LIBRARY_SELECTOR,
  ToolbarLibraryButton,
} from '@liveworkspace/workbench/components/palette/ToolbarLibraryButton';
import { BrowseMemoryContext, useBrowseMemory } from './PaletteCategoryBrowser';
import { setPalettePopoverOpen } from '@liveworkspace/workbench/lib/palette-popover-open';
import { useBarFold } from '@liveworkspace/workbench/components/palette/useBarFold';
import { useBarLabels } from '@liveworkspace/workbench/components/palette/useBarLabels';
import {
  crowdedPaddingRight,
  useStripCrowding,
} from '@liveworkspace/workbench/components/palette/useStripCrowded';
import { barCategoriesFor } from './bar-categories';
import { CategoryBarButtons, CategoryBarFlyout, useCategoryBar } from './CategoryBar';
import { usePaletteKindMotion } from './usePaletteKindMotion';
import { ArticleDockSlot } from './ArticleDockSlot';
import { docksPageToolbar, usePaletteKind } from '@/lib/palette-kind';

// The Palette (docs/specs/007-editor/toolbar-layout.md): one horizontal strip pinned to the top centre of the
// canvas, the way Excalidraw's tool bar works. The selection mode on the left, then the category bar (each
// category a button opening a flyout of its tiles). With the palette's kind Article, the article's formatting takes
// the bar's place. The fork's Search (every element type, on S) is not here: a knowledgebase is searched by its pages
// (Cmd or Ctrl K, docs/specs/030-knowledgebase/search-and-ask.md), and a key typed outside the writing opens nothing.
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
    // The screen width of Pages mode's Contents sidebar while the menu box heads it (docs/specs/007-editor/pages-mode.md
    // "Joined to the menu box"): the strip centres in what shows beside it, as a page is framed beside it.
    besideWidth?: number;
    // The tab's pages in Pages mode, whose kind is the palette's (lib/palette-kind.ts).
    tabPages?: readonly Pick<Page, 'kind'>[] | null;
  };
// The strip's card, and the leading card beside it on a phone. Its 36px items are packed 2px apart, so on a touch
// screen each gets a full 44 x 44 pad behind it and a tap in a gap still picks a tile (PACKED_TOOLBAR_ITEMS,
// docs/specs/004-interface-design/touch-targets.md); the category flyouts hang beside the card, not in it, so the
// card's own stacking context traps none of them.
const CARD_CLASS = `${TOOLBAR_CARD} ${PACKED_TOOLBAR_ITEMS}`;

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
        // 6px on a phone's row (experiment: no header bar), so the strip has every pixel it can.
        ...safeInlinePadding('0.375rem'),
        // Clear of the top-right corner card instead where there is one (EditorCornerActions sets --corner-card-room,
        // its width and the row's 6 px gap: the card now meets the screen's edge, so the gutter is not added to it).
        paddingRight: `calc(max(${atLeastInset('0.375rem', 'right')}, var(--corner-card-room, 0px)) + var(--landscape-handle-room, 0px))`,
      }}
      className={`pointer-events-none flex w-full items-start gap-1.5 [&>*]:pointer-events-auto ${LANDSCAPE_HANDLE_ROOM}`}
    >
      {leading == null ? null : (
        <div data-strip-leading="" className={`${CARD_CLASS} ${PHONE_EDGE_LEFT_IN_ROW}`}>
          {leading}
        </div>
      )}
      {children}
    </div>
  );
}

// Centred alone (desktop), the card is whole-pixel wide with the canvas's
// parity (see SnapWidth). Beside the menu card (a phone), or an article's
// formatting crowded clear of it, it may shrink to the room, its rail
// scrolling, so it is not snapped there.
function CardWidth({ swipe, children }: { swipe: boolean; children: ReactNode }) {
  if (swipe) return <div className="flex min-w-0 max-w-full">{children}</div>;
  return <SnapWidth matchParentParity>{children}</SnapWidth>;
}

export function ToolbarPalette(props: Props) {
  const { canvasTool, themeTint, pendingDraw, leading, besideWidth } = props;
  // The phone's row: the strip at the left gutter, beside the menu card when there is one. Its category bar
  // swipes sideways (docs/specs/007-editor/toolbar-layout.md "On a phone").
  const swipe = leading !== undefined;
  const hidden = props.hidden;
  // The strip's popovers (ToolbarStripPopover): only the popover and its own button count as inside, so pressing
  // anything else on the strip closes it.
  const rootRef = useRef<HTMLDivElement>(null);
  // The Library, icon only at the strip's end, not a category (liveworkspace/docs/specs/006-media/libraries.md).
  const library = useStripPopover(rootRef, TOOLBAR_LIBRARY_SELECTOR);
  // The category bar and its flyout (CategoryBar).
  // The selection mode's menu, held here so a category opening closes it (useCategoryBar's onOpen).
  const [selectionModeOpen, setSelectionModeOpen] = useState(false);
  // A category opening closes the strip's other popovers (docs/specs/007-editor/toolbar-layout.md "One popover at a
  // time"), as moving between categories swaps one flyout for the next.
  const bar = useCategoryBar(rootRef, {
    onOpen: () => {
      library.setOpen(false);
      setSelectionModeOpen(false);
    },
  });
  // Icons, Stickers and Tech reopen on the group they were left on, for the page load (BrowseMemory).
  const browseMemory = useBrowseMemory();
  // The template start steps aside while a popover hangs from the strip (palette-popover-open).
  const popoverOpen = bar.popover.open || library.open;
  useEffect(() => {
    setPalettePopoverOpen(popoverOpen);
    return () => setPalettePopoverOpen(false);
  }, [popoverOpen]);
  // The palette's kind: the tab's (lib/palette-kind.ts), right on the first paint.
  const paletteKind = usePaletteKind(props.tabPages);
  const {
    tabs: catalogueTabs,
    tileActions,
    canvasToolOptions,
    onCanvasToolChange,
  } = usePaletteCatalogue({
    ...props,
    paletteKind,
    // A tile used from a flyout closes it, so the canvas is clear to draw on.
    onTileUsed: () => {
      library.setOpen(false);
      bar.popover.setOpen(false);
    },
  });
  // The Library leaves the categories for its own button at the strip's end.
  const libraryTab = catalogueTabs.find((t) => t.id === 'library');
  const tabs = useMemo(() => catalogueTabs.filter((t) => t.id !== 'library'), [catalogueTabs]);
  const toggleLibrary = (button: HTMLElement) => {
    if (library.open) return library.setOpen(false);
    bar.popover.setOpen(false);
    library.openFrom(button);
  };
  // With the palette's kind Article, the strip holds the page's formatting in place of the bar.
  const articleDock = docksPageToolbar(paletteKind);
  // The Library's button (libraries.md). On a phone it ends the category row and swipes with it, rather than taking
  // room beside Search for good; an article's docked formatting has no category row, so it stays beside Search there.
  const libraryButton = libraryTab ? (
    <ToolbarLibraryButton
      open={library.open}
      onToggle={toggleLibrary}
      icon={libraryTab.icon}
      description={libraryTab.description}
    />
  ) : null;
  const libraryInBar = swipe && !articleDock;
  // A change of kind cascades its categories in (usePaletteKindMotion).
  usePaletteKindMotion(paletteKind, rootRef);
  // The bar's categories (bar-categories): one-word names.
  const barCategories = useMemo(() => barCategoriesFor(tabs), [tabs]);

  const isMobile = useIsMobileViewport();
  // UI scale (docs/specs/007-editor/ui-scale.md): the strip zooms at its root.
  const scale = useUiScale('toolbar');
  const cardRef = useRef<HTMLDivElement>(null);
  // The category bar names its categories while the strip has room for the names (useBarLabels); on a phone,
  // where the bar swipes sideways, always (owner, 2026-11-09: "on mobile, show the labels on the palette categories, its okay, we can scroll"; livehuddle
  // has since 2026-11-07).
  const fittedLabels = useBarLabels(cardRef, {
    enabled: !isMobile,
    categoriesKey: barCategories.map((c) => c.label).join('|'),
    scale,
  });
  // Still too wide once the names are gone (a narrow window beside the docked Contents): the bar shows its first
  // categories and folds the rest behind More (useBarFold, docs/specs/007-editor/toolbar-layout.md "The strip's
  // room").
  const barShown = useBarFold(cardRef, {
    enabled: !isMobile && !fittedLabels,
    categoriesKey: barCategories.map((c) => c.id).join('|'),
    scale,
  });
  // Too wide to centre between the menu card's sides (a tablet): the strip sits at the right instead. An article's
  // docked formatting, wider still than the room beside the card (a narrow window, a side by side pane), starts
  // clear of the card and its controls scroll, as on a phone's row, rather than running under the card.
  const { crowded, clear, clearRight } = useStripCrowding(cardRef, leading == null);
  // Experiment (no header bar): centred in the gap between the menu box (or the Contents sidebar it heads) and the
  // corner card, as livediagram's is.
  const between = leading == null;
  const dockGivesWay = crowded && articleDock;
  const giveWay = swipe || dockGivesWay;

  return (
    <div
      ref={rootRef}
      data-toolbar-palette=""
      data-region="palette"
      // Experiment (no header bar): centred between the menu box and the corner card (STRIP_BETWEEN).
      data-strip-between={between ? '' : undefined}
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
        // An article's docked formatting, wider than the gap, fills it and scrolls (dockGivesWay).
        alignItems: dockGivesWay ? 'flex-end' : 'center',
        ...(between
          ? {
              paddingLeft: toSurfacePx(Math.max(clear, besideWidth ?? 0, 12), scale),
              paddingRight: crowdedPaddingRight(clearRight, scale),
            }
          : besideWidth
            ? { paddingLeft: toSurfacePx(besideWidth, scale) }
            : {}),
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
              <CardWidth swipe={giveWay}>
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
                    giveWay
                      ? `${CARD_CLASS} min-w-0 [&>:not([data-strip-rail])]:shrink-0`
                      : CARD_CLASS
                  }
                >
                  <PaletteDropdown
                    ariaLabel="Selection mode"
                    open={selectionModeOpen}
                    onOpenChange={setSelectionModeOpen}
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
                      labels={fittedLabels || swipe}
                      shown={barShown}
                      scrollable={swipe}
                      trailing={
                        libraryInBar ? (
                          <>
                            <Divider />
                            {libraryButton}
                          </>
                        ) : null
                      }
                    />
                  )}
                  {/* The Library, last, behind its own divider when it does not ride in the bar. */}
                  {libraryInBar || !libraryButton ? null : (
                    <>
                      <Divider />
                      {libraryButton}
                    </>
                  )}
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
            {library.open && libraryTab ? (
              <StripPopover
                right={library.right}
                isMobile={isMobile}
                scale={scale}
                label="Library"
                dataAttr="data-toolbar-library"
              >
                <div className="px-2 py-2.5">{libraryTab.content}</div>
              </StripPopover>
            ) : null}
          </PaletteTintProvider>
        </PaletteGroupProvider>
      </BrowseMemoryContext.Provider>
    </div>
  );
}
