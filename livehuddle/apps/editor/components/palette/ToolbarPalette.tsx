'use client';

import type { Element } from '@livehuddle/document';
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { onToolbarSearchRequest } from '@liveworkspace/workbench/lib/toolbar-search-request';
import { atLeastInset, safeInlinePadding } from '@livehuddle/ui';
import { LANDSCAPE_HANDLE_ROOM } from '@/components/chrome/LandscapeBars';
import { track } from '@/lib/telemetry';
import { SnapWidth } from '@liveworkspace/workbench/components/primitives/SnapWidth';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { TOOLBAR_CARD } from '@/components/chrome/toolbar-surface';
import { PaletteTintProvider } from './palette-controls';
import { PaletteGroupProvider } from '@liveworkspace/workbench/components/palette/palette-group-state';
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
import { TOOLBAR_SEARCH_SELECTOR, ToolbarSearchButton, ToolbarSearchPanel } from './ToolbarSearch';
import { BrowseMemoryContext, useBrowseMemory } from './PaletteCategoryBrowser';
import { setPalettePopoverOpen } from '@liveworkspace/workbench/lib/palette-popover-open';
import { useBarLabels } from '@liveworkspace/workbench/components/palette/useBarLabels';
import { useStripCrowded } from '@liveworkspace/workbench/components/palette/useStripCrowded';
import { barCategoriesFor } from './bar-categories';
import { CategoryBarButtons, CategoryBarFlyout, useCategoryBar } from './CategoryBar';

// The Toolbar layout's Palette (docs/specs/007-editor/toolbar-layout.md): one horizontal strip pinned to the
// top centre of the canvas, the way Excalidraw's tool bar works. The Edit | Walk toggle on the left, then the
// category bar (each category a button opening a flyout of its tiles, "The category bar"); Search, at the far
// right, finds any element.
//
// The tiles, handlers and category bodies come from
// usePaletteCatalogue, so this file is only layout.

type Props = Pick<PaletteProps, 'canvasTool' | 'onExitAvatarMode' | 'pendingDraw' | 'themeTint'> &
  PaletteAddHandlers & {
    // The Edit | Walk toggle (EditWalkToggle, docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle"), first
    // on the strip, a divider after it. Absent where the surface does not walk (an embed).
    editWalk?: ReactNode;
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
export const CARD_CLASS = `${TOOLBAR_CARD} ${PHONE_TOOLBAR_ITEMS}`;

// On a phone's row, the menu card sits at the left gutter and the strip beside
// it rather than centred (docs/specs/007-editor/toolbar-layout.md "On a phone");
// held sideways there is no menu card and the strip starts at the gutter. Off a
// phone, the strip alone, centred by its parent.
export function StripRow({
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
export function CardWidth({ swipe, children }: { swipe: boolean; children: ReactNode }) {
  if (swipe) return <div className="flex min-w-0">{children}</div>;
  return <SnapWidth matchParentParity>{children}</SnapWidth>;
}

// The strip's row across the top of the canvas, shared by the avatar palette (AvatarPalette): zoomed at its root, centred
// (or at the right where crowded), and, while one of its popovers is open (a category's flyout, Search), risen to
// the popover layer, so what hangs from it sits over everything on the canvas, an element's toolbar and menus included.
export function stripRootLayout({
  scale,
  crowded,
  popoverOpen,
  hidden,
}: {
  scale: number;
  crowded: boolean;
  popoverOpen: boolean;
  hidden?: boolean | undefined;
}): { style: CSSProperties; className: string } {
  return {
    style: {
      ...(scale === 1 ? {} : { ...uiScaleStyle(scale), top: toSurfacePx(12, scale) }),
      alignItems: crowded ? 'flex-end' : 'center',
      paddingRight: crowded ? '0.75rem' : 0,
    },
    className: `pointer-events-none absolute inset-x-0 top-3 ${
      popoverOpen ? 'z-[var(--z-popover)]' : 'z-[var(--z-toolbar)]'
    } flex-col [&>*]:pointer-events-auto ${hidden ? 'hidden' : 'flex'}`,
  };
}

export function ToolbarPalette(props: Props) {
  const { themeTint, pendingDraw, leading } = props;
  // The phone's row: the strip at the left gutter, beside the menu card when there is one.
  const phoneRow = leading !== undefined;
  const hidden = props.hidden;
  // The strip's Search popover (ToolbarStripPopover): only the popover and its own button count as inside, so
  // pressing anything else on the strip closes it.
  const rootRef = useRef<HTMLDivElement>(null);
  const search = useStripPopover(rootRef, TOOLBAR_SEARCH_SELECTOR);
  // The category bar and its flyout (CategoryBar).
  const bar = useCategoryBar(rootRef);
  // Stickers reopens on the group it was left on, for the page load (BrowseMemory).
  const browseMemory = useBrowseMemory();
  // The template start steps aside while a popover hangs from the strip (palette-popover-open).
  const popoverOpen = bar.popover.open || search.open;
  useEffect(() => {
    setPalettePopoverOpen(popoverOpen);
    return () => setPalettePopoverOpen(false);
  }, [popoverOpen]);
  const { tabs, tileActions } = usePaletteCatalogue({
    ...props,
    // A tile used from a flyout or the Search popover closes it, so the canvas is clear to draw on.
    onTileUsed: () => {
      search.setOpen(false);
      bar.popover.setOpen(false);
    },
  });
  // A Participant has no palette (docs/specs/013-workspace/share-roles.md "A Participant walks").
  // The bar has no Popular: with every category one press away, a pick from across them adds nothing.
  // The bar's categories (bar-categories): no Popular, one-word names.
  const barCategories = useMemo(() => barCategoriesFor(tabs), [tabs]);

  const isMobile = useIsMobileViewport();
  // UI scale (docs/specs/007-editor/ui-scale.md): the strip zooms at its root,
  // so a scaled tile takes more of the window.
  const scale = useUiScale('toolbar');
  const cardRef = useRef<HTMLDivElement>(null);
  // The category bar names its categories while the strip has room for the names (useBarLabels); on a phone, where the
  // bar swipes sideways, always (owner, 2026-11-07: "it scrolls so its not an issue that they don't all fit").
  const fittedLabels = useBarLabels(cardRef, {
    enabled: !isMobile,
    categoriesKey: barCategories.map((c) => c.label).join('|'),
    scale,
  });
  const leadingRef = useRef<HTMLDivElement>(null);
  // Too wide to centre between the menu card's sides (a tablet): the strip sits at the right instead.
  const crowded = useStripCrowded(cardRef, leading == null);
  // On a phone the strip swipes sideways (docs/specs/007-editor/toolbar-layout.md "On a phone").
  const swipe = phoneRow;
  const barLabels = fittedLabels || swipe;

  // Opening the Search starts a new choice: a tile armed to place (its "Click to drop" banner) is let go first.
  const beforeSearch = () => {
    if (pendingDraw) tileActions.cancelDraw?.();
  };
  // S asks for the Search (lib/toolbar-search-request): answered only while it is on show, so the
  // key keeps its Select meaning for a Participant or with the chrome away.
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
  // Hidden (Walk switched on, Zen), the strip lets go of whatever hung from it, so a flyout or Search open at
  // the switch is closed when the strip comes back rather than reappearing over the canvas.
  const closeBar = bar.popover.setOpen;
  const closeSearch = search.setOpen;
  useEffect(() => {
    if (!hidden) return;
    closeBar(false);
    closeSearch(false);
  }, [hidden, closeBar, closeSearch]);
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
      // The strip is the Palette in this layout, so the panel-opacity
      // preference (docs/specs/007-editor/user-preferences.md) fades it and its popovers
      // like every other panel; hovering any of them restores it.
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
      {...stripRootLayout({ scale, crowded, popoverOpen, hidden })}
      // While walking this strip is hidden and the avatar palette shows instead (AvatarPalette,
      // docs/specs/008-canvas/avatar-mode.md "The avatar palette").
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
                  // Beside the menu card only the category bar gives way (and scrolls): the Edit | Walk
                  // toggle and Search keep their size.
                  className={
                    swipe
                      ? `${CARD_CLASS} min-w-0 [&>:not([data-strip-rail])]:shrink-0`
                      : CARD_CLASS
                  }
                >
                  <>
                    {props.editWalk ? (
                      <>
                        {props.editWalk}
                        <Divider />
                      </>
                    ) : null}
                    <CategoryBarButtons
                      bar={bar}
                      categories={barCategories}
                      labels={barLabels}
                      scrollable={swipe}
                    />
                  </>
                  {/* Search, last: any element type the palette offers (docs/specs/007-editor/toolbar-layout.md
                    "Search: every element type"). */}
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
