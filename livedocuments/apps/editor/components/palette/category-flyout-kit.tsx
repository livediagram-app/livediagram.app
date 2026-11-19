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

// This editor's tiles, bound for the category flyout every editor shares
// (@liveworkspace/workbench/components/palette/CategoryFlyout, docs/specs/007-editor/toolbar-layout.md "The flyout"):
// how a tile places, arms, drags and tints, and how the categories are arranged (category-flyout-groups).

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
  // A tile with presets opens a side panel rather than placing.
  opensSide: (def) => !!def.variants?.length,
  groups: (_categoryId, tiles) => flyoutGroups(tiles),
  layout: flyoutLayout,
  columns: flyoutColumns,
  cardColumns: flyoutCardColumns,
  tagline: flyoutTagline,
  // A catalogue browses as two panes (PaletteCategoryRail), edge to edge.
  catalogue: (content) => (
    <BrowseLayoutContext.Provider value="rail">{content}</BrowseLayoutContext.Provider>
  ),
};
