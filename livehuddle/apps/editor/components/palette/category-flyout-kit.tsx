'use client';

import type { FlyoutKit } from '@liveworkspace/workbench/components/palette/category-flyout-kit';
import type { PendingDraw } from '@/lib/draw-mode';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';
import { tileDisplayName, type PaletteTileDef } from './palette-tile-defs';
import { tileActive, tileHandler, visibleTiles, type PaletteTileActions } from './PaletteTileGrid';
import { tileCarryStart, tileDragStart } from './palette-tile-drag';
import { useTileGlyph } from './PaletteIconButton';
import {
  flyoutCardColumns,
  flyoutColumns,
  flyoutGroups,
  flyoutLayout,
  flyoutTagline,
} from './category-flyout-groups';
import { BrowseLayoutContext } from './PaletteCategoryBrowser';

// This editor's tiles, bound for the category flyout every editor shares
// (@liveworkspace/workbench/components/palette/CategoryFlyout, docs/specs/007-editor/toolbar-layout.md "The category
// bar"): how a tile places, arms, carries, drags and tints, how the categories are arranged (category-flyout-groups),
// and where a side panel stops: clear of the tab bar, over the whole flyout on a phone, hidden at once while a tile is
// dragged out.

// How far clear of the canvas region's bottom (the tab bar below it) a side panel keeps.
const FLOOR_GAP_PX = 8;

/** The lowest a side panel may reach, in window px: the canvas region's bottom (above the tab bar), else the
 *  window's. */
export function sideFloor(panel: HTMLElement): number {
  const region = panel.ownerDocument.querySelector('[data-canvas-root]')?.getBoundingClientRect();
  const bottom = region && region.height > 0 ? region.bottom : window.innerHeight;
  return Math.min(bottom, window.innerHeight) - FLOOR_GAP_PX;
}

export const FLYOUT_KIT: FlyoutKit<PaletteTileDef, PaletteTileActions, PendingDraw | null> = {
  displayName: tileDisplayName,
  visible: (tiles, actions) => visibleTiles([...tiles], actions.hasImage),
  press: (def, actions, pendingDraw) => tileHandler(def, actions, pendingDraw)(),
  active: tileActive,
  dragStart: (def) => tileDragStart(def.action),
  // A piece that turns is carried by the pointer, so Space turns it on its way.
  carryStart: (def) => tileCarryStart(def.action),
  dragEnd: () => setPaletteDragPreview(null),
  useGlyph: (def, plain) => {
    const a = def.action;
    return useTileGlyph({
      dragKind: a.type === 'shape' ? a.kind : undefined,
      filled: def.filled,
      noTint: def.noTint,
      plain,
      finishAction: a,
    });
  },
  // A tile with presets opens a side panel rather than placing.
  opensSide: (def) => !!def.variants?.length,
  groups: flyoutGroups,
  layout: flyoutLayout,
  columns: flyoutColumns,
  cardColumns: flyoutCardColumns,
  tagline: flyoutTagline,
  // A catalogue browses as two panes (PaletteCategoryRail), edge to edge.
  catalogue: (content) => (
    <BrowseLayoutContext.Provider value="rail">{content}</BrowseLayoutContext.Provider>
  ),
  sideFloor,
  sideCoversFlyoutOnPhone: true,
  sideHidesOnDrag: true,
};
