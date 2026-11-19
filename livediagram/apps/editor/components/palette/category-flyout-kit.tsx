'use client';

import type {
  FlyoutGroup,
  FlyoutKit,
} from '@liveworkspace/workbench/components/palette/category-flyout-kit';
import type { EditorMode } from '@livediagram/document';
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
import { OptionalFlyoutGroup } from './OptionalFlyoutGroup';
import { BrowseLayoutContext } from './PaletteCategoryBrowser';

// This editor's tiles, bound for the category flyout every editor shares
// (@liveworkspace/workbench/components/palette/CategoryFlyout, docs/specs/007-editor/toolbar-layout.md "The category
// bar"): how a tile places, arms, drags and tints, and how the categories are arranged (category-flyout-groups). One
// kit per mode, since a mode words some categories' lines its own way (flyoutTagline).

type Kit = FlyoutKit<PaletteTileDef, PaletteTileActions, PendingDraw | null>;

/** Whether pressing this tile opens a side panel (its presets, or what an opener stands for) rather than placing. */
export function opensSide(def: PaletteTileDef): boolean {
  return !!def.variants?.length || def.action.type === 'open';
}

/** The category's groups; an optional notation group (BPMN) draws as a header row, closed until opened. */
function groups(
  categoryId: string,
  tiles: readonly PaletteTileDef[],
): FlyoutGroup<PaletteTileDef>[] {
  return flyoutGroups(categoryId, tiles).map(({ optional, ...group }) => {
    const title = group.title;
    return title && optional
      ? {
          ...group,
          frame: (items) => (
            <OptionalFlyoutGroup title={title} count={group.tiles.length} {...optional}>
              {items}
            </OptionalFlyoutGroup>
          ),
        }
      : group;
  });
}

const KIT: Omit<Kit, 'tagline'> = {
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
  groups,
  layout: flyoutLayout,
  columns: flyoutColumns,
  cardColumns: flyoutCardColumns,
  // A catalogue browses as two panes (PaletteCategoryRail), edge to edge; My shapes keeps its padding.
  catalogue: (content, categoryId) => (
    <BrowseLayoutContext.Provider value="rail">
      {categoryId === 'my-shapes' ? <div className="px-2 py-2.5">{content}</div> : content}
    </BrowseLayoutContext.Provider>
  ),
};

const KITS = new Map<EditorMode, Kit>();

/** The flyout kit for a mode, made once and kept, so the flyout's props stay the same object across renders. */
export function flyoutKit(mode: EditorMode): Kit {
  let kit = KITS.get(mode);
  if (!kit) {
    kit = { ...KIT, tagline: (id, fallback) => flyoutTagline(id, fallback, mode) };
    KITS.set(mode, kit);
  }
  return kit;
}
