'use client';

import type { FlyoutKit } from '@liveworkspace/workbench/components/palette/category-flyout-kit';
import type { PendingDraw } from '@/lib/draw-mode';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';
import { tileDisplayName, type PaletteTileDef } from './palette-tile-defs';
import { tileActive, tileHandler, visibleTiles, type PaletteTileActions } from './PaletteTileGrid';
import { tileDragStart } from './palette-tile-drag';
import { useTileGlyph } from './PaletteIconButton';
import {
  flyoutCardColumns,
  flyoutColumns,
  flyoutGroups,
  flyoutLayout,
  flyoutTagline,
} from './category-flyout-groups';
import { BrowseLayoutContext } from './PaletteCategoryBrowser';
import { DesignComponentsBand } from './component-tiles';

// This editor's tiles, bound for the category flyout every editor shares
// (@liveworkspace/workbench/components/palette/CategoryFlyout, docs/specs/007-editor/toolbar-layout.md "The flyout"):
// how a tile places, arms, drags and tints, and how the categories are arranged (category-flyout-groups).

/** Whether pressing this tile opens a side panel (its presets, or what an opener stands for) rather than placing. */
// The Fill tool's side panel holds its colour (CategoryBar's sideExtra); a press still picks it up
// (CategoryBar's pressSide), save on a phone, where the panel is the only way to its colour.
export function opensSide(def: PaletteTileDef): boolean {
  return !!def.variants?.length || def.action.type === 'open' || def.action.type === 'fill';
}

export const FLYOUT_KIT: FlyoutKit<PaletteTileDef, PaletteTileActions, PendingDraw | null> = {
  displayName: tileDisplayName,
  visible: (tiles, actions) => visibleTiles([...tiles], actions.hasImage),
  press: (def, actions, pendingDraw) => tileHandler(def, actions, pendingDraw)(),
  active: tileActive,
  dragStart: (def) => tileDragStart(def.action),
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
  opensSide,
  footerLine: (def) => (def.action.type === 'open' ? `Browse ${def.label}.` : undefined),
  groups: flyoutGroups,
  layout: flyoutLayout,
  columns: flyoutColumns,
  cardColumns: flyoutCardColumns,
  tagline: flyoutTagline,
  // The design's own mains lead the Components category (docs/specs/009-elements/components.md).
  lead: (categoryId) =>
    categoryId === 'components' ? <DesignComponentsBand variant="flyout" /> : null,
  // A catalogue browses as two panes (PaletteCategoryRail), edge to edge.
  catalogue: (content) => (
    <BrowseLayoutContext.Provider value="rail">{content}</BrowseLayoutContext.Provider>
  ),
};
