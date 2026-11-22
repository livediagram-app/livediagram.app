'use client';

import { useEffect, useMemo, useRef } from 'react';
import { PACKED_TOOLBAR_ITEMS } from '@liveworkspace/workbench/components/chrome/phone-toolbar-items';
import { PaletteTintProvider } from './palette-controls';
import { PaletteGroupProvider } from '@liveworkspace/workbench/components/palette/palette-group-state';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { usePaletteCatalogue } from './usePaletteCatalogue';
import type { PaletteProps } from './palette.types';
import type { PaletteAddHandlers } from './palette-add-handlers';
import { BrowseMemoryContext, useBrowseMemory } from './PaletteCategoryBrowser';
import { setPalettePopoverOpen } from '@liveworkspace/workbench/lib/palette-popover-open';
import { barCategoriesFor } from './bar-categories';
import { CategoryBarButtons, CategoryBarFlyout, useCategoryBar } from './CategoryBar';

// A drawing's tools (docs/specs/030-knowledgebase/page-surface.md "The formatting bar"): the strip a knowledgebase
// page shows in the top row, in the formatting controls' place, while a drawing zone is being edited, and only
// then. It holds the drawing categories alone (each a button opening a flyout of its tiles): no Selection mode (the
// pointer always selects), no Library and no Search. A knowledgebase is searched by its pages (Cmd or Ctrl K,
// docs/specs/030-knowledgebase/search-and-ask.md), and pictures, charts and embeds are added from Insert.
//
// The tiles, handlers and category bodies come from usePaletteCatalogue, so this file is only layout.

type Props = Pick<PaletteProps, 'pendingDraw' | 'themeTint'> &
  PaletteAddHandlers & {
    // The chrome is hidden (zen, the welcome flow). Hidden rather than
    // unmounted, so the strip keeps its state for the page load.
    hidden?: boolean;
  };

// A drawing is drawn with the palette's Design kind (lib/palette-kind.ts), whatever the page around it is.
const DRAWING_KIND = 'design' as const;
/** The categories the strip offers: what a drawing is drawn with. */
export const DRAWING_CATEGORIES: ReadonlySet<string> = new Set([
  'shapes',
  'write',
  'concepts',
  'icons',
]);

export function ToolbarPalette(props: Props) {
  const { themeTint, pendingDraw } = props;
  const hidden = props.hidden;
  const isMobile = useIsMobileViewport();
  // The strip's popovers (ToolbarStripPopover): only the popover and its own button count as inside, so pressing
  // anything else on the strip closes it.
  const rootRef = useRef<HTMLDivElement>(null);
  // The category bar and its flyout (CategoryBar).
  const bar = useCategoryBar(rootRef);
  // Icons, Stickers and Tech reopen on the group they were left on, for the page load (BrowseMemory).
  const browseMemory = useBrowseMemory();
  // The template start steps aside while a popover hangs from the strip (palette-popover-open).
  const popoverOpen = bar.popover.open;
  useEffect(() => {
    setPalettePopoverOpen(popoverOpen);
    return () => setPalettePopoverOpen(false);
  }, [popoverOpen]);
  const { tabs: catalogueTabs, tileActions } = usePaletteCatalogue({
    ...props,
    paletteKind: DRAWING_KIND,
    // A tile used from a flyout closes it, so the page is clear to draw on.
    onTileUsed: () => bar.popover.setOpen(false),
  });
  // What a drawing is made of. The Library is not in liveknowledge, and pictures, charts, tables and embeds are the
  // writing's own, added from Insert and the slash menu.
  const tabs = useMemo(
    () => catalogueTabs.filter((t) => DRAWING_CATEGORIES.has(t.id)),
    [catalogueTabs],
  );
  // The bar's categories (bar-categories): one-word names.
  const barCategories = useMemo(() => barCategoriesFor(tabs), [tabs]);
  // UI scale (docs/specs/007-editor/ui-scale.md): the flyout is laid out against it.
  const scale = useUiScale('toolbar');

  return (
    <div
      ref={rootRef}
      data-toolbar-palette=""
      data-region="palette"
      // `hidden` (zen, the welcome flow) hides rather than unmounts, so the strip keeps its state while the chrome
      // goes away and back. While a flyout is open the strip rises to the popover layer, so what hangs from it
      // sits over everything on the page.
      className={`relative min-w-0 flex-1 flex-col justify-center self-stretch ${
        popoverOpen ? 'z-[var(--z-popover)]' : ''
      } ${hidden ? 'hidden' : 'flex'}`}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <BrowseMemoryContext.Provider value={browseMemory}>
        <PaletteGroupProvider>
          <PaletteTintProvider tint={themeTint}>
            <div
              data-tour-id="palette"
              // Chrome, not canvas: a paste, a drop or a drag ghost over the strip treats it like any panel
              // (@liveworkspace/workbench/lib/canvas-pointer.ts, PaletteDragGhost, usePaletteDrop).
              data-floating-panel=""
              // In the row, not a card of its own: the categories scroll sideways where the row is narrow.
              className={`flex min-w-0 items-center gap-0.5 ${PACKED_TOOLBAR_ITEMS}`}
            >
              <CategoryBarButtons
                bar={bar}
                categories={barCategories}
                labels
                shown={undefined}
                scrollable
                trailing={null}
              />
            </div>
            <CategoryBarFlyout
              bar={bar}
              categories={barCategories}
              actions={tileActions}
              pendingDraw={pendingDraw ?? null}
              isMobile={isMobile}
              scale={scale}
            />
          </PaletteTintProvider>
        </PaletteGroupProvider>
      </BrowseMemoryContext.Provider>
    </div>
  );
}
