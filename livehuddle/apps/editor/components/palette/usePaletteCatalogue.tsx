import { useState } from 'react';
import type { PaletteTileActions } from '@/components/palette/PaletteTileGrid';
import { searchStickers } from '@liveworkspace/workbench/lib/stickers';
import { useIconCatalogs } from '@liveworkspace/workbench/hooks/ui/useIconCatalogs';
import type { PaletteProps } from './palette.types';
import { withTileActionPreamble } from './palette-tile-actions';
import { paletteCategoryTabs } from './palette-category-tabs';
import type { PaletteAddHandlers } from './palette-add-handlers';
import { paletteCategories } from './palette-layouts';
import type { AddShapeOptions } from '@/lib/draw-mode';

// Everything a palette SURFACE needs that isn't how it is drawn: the tile
// add-handler bundle, the category catalogue with each category's body, and the
// searchable catalogues' state.
// The strip (docs/specs/007-editor/toolbar-layout.md), its More popover and its Search all read
// from this one catalogue, so they never drift apart.
//
// `onTileUsed` is the host's hook into "a tile was used": the strip closes
// its More popover. Every add-handler calls it, so a tile behaves the same
// from any category and any surface.
type Deps = Pick<PaletteProps, 'canvasTool' | 'onExitAvatarMode' | 'pendingDraw' | 'onTileUsed'> &
  PaletteAddHandlers;

export function usePaletteCatalogue({
  canvasTool,
  onExitAvatarMode,
  onAddShape,
  onAddSticker,
  onAddText,
  onAddSticky,
  onAddAnnotation,
  onAddLinkCard,
  onAddAvatar,
  onAddImage,
  onAddArrow,
  onBeginFreehand,
  onBeginHighlighter,
  onCancelDraw,
  onBeginShapePen,
  onBeginPolygon,
  onBeginRoomWalls,
  pendingDraw,
  onTileUsed,
}: Deps) {
  // Close a popover palette after adding a shape / tool so the user can draw
  // immediately without dismissing it manually.
  // `opts` is the creation-time choice for the kinds that have one: which
  // mode (docs/specs/009-elements/mode-button.md). It has to be forwarded rather than dropped: this adapter
  // silently swallowing it once made every choice tile place the factory default.
  const armed = (fn: () => void) => () => {
    fn();
    onTileUsed?.();
  };
  const addShape = (kind: import('@livehuddle/document').ShapeKind, opts?: AddShapeOptions) =>
    armed(() => onAddShape(kind, opts))();
  // Stickers arm the draw gesture too (they ride the shape intent carrying the sticker id).
  const addSticker = (stickerId: string) => armed(() => onAddSticker(stickerId))();
  const addText = armed(onAddText);
  const addSticky = armed(onAddSticky);
  // The annotation is the ONE tile that still places instantly (docs/specs/009-elements/annotations.md): a
  // fixed 44x44 marker has no box to draw.
  const addAnnotation = armed(onAddAnnotation);
  const addLinkCard = armed(onAddLinkCard);
  // Components arm the draw gesture (tap-or-drag) and close a popover
  // palette so the canvas is clear to draw on.
  const addArrow = (ends?: import('@livehuddle/document').ArrowEnds) =>
    armed(() => onAddArrow(ends))();
  const beginFreehand = armed(onBeginFreehand);
  const beginHighlighter = armed(onBeginHighlighter);
  const beginShapePen = armed(onBeginShapePen);
  const beginPolygon = armed(onBeginPolygon);
  const beginRoomWalls = armed(() => onBeginRoomWalls?.());
  const addImage = armed(() => onAddImage?.());
  // One handler per composite-component kind, so the tile catalogue can
  // address them by kind (see PaletteTileGrid).
  const addComponent = (kind: import('@livehuddle/document').ComponentKind) => {
    const byKind = {
      avatar: onAddAvatar,
    } as const;
    armed(byKind[kind])();
  };
  // The add-handler bundle every catalogue-driven tile grid consumes
  // (palette-tile-defs). All handlers above already wrap the mobile-close /
  // draw-armed behaviour, so a tile behaves the same from any tab.
  // Avatar mode (docs/specs/008-canvas/avatar-mode.md) is read-only, so reaching for a tile means the user
  // wants to edit again: every add leaves the mode first (back to whichever
  // tool preceded it) and then drops as normal. Wrapping the bundle covers
  // every tile, including ones added later.
  const tileActions: PaletteTileActions = withTileActionPreamble<PaletteTileActions>(
    {
      addShape,
      addText,
      beginFreehand,
      beginHighlighter,
      beginShapePen,
      beginPolygon,
      beginRoomWalls,
      addArrow,
      addSticky,
      addImage,
      addAnnotation,
      addLinkCard,
      addSticker,
      addComponent,
      cancelDraw: onCancelDraw,
      hasImage: !!onAddImage,
    },
    () => {
      if (canvasTool === 'avatar') onExitAvatarMode?.();
    },
  );
  // The catalogues (stickers among them) load as one async chunk (@liveworkspace/workbench/lib/icon-registry.ts).
  // Subscribing here re-renders the palette when the data lands, so the sticker results below re-derive from the
  // populated catalogue; until then they're empty and the Stickers browse shows a brief loading note (via
  // `iconCatalogsLoaded`) instead of a false "no matches". No Icons category
  // (docs/specs/002-project-scope/not-in-livehuddle.md "Icons").
  const iconCatalogsLoaded = useIconCatalogs();
  // Stickers tab (docs/specs/010-palette/stickers.md): colour emoji, browsed in groups: a search box over a
  // drill-in browse.
  const [stickerQuery, setStickerQuery] = useState('');
  const stickerResults = searchStickers(stickerQuery);

  // Ordered by BAND (docs/specs/010-palette/palette-top-level-categories.md): Common, then Decorate, then Dynamic
  // (the headings CATEGORY_BANDS names).
  // It renders the dropdown straight from this order, so the array IS
  // the grid layout.
  // The palette's layout (palette-layouts): its categories, in order, with their tiles.
  const categories = paletteCategories();
  const tabs = paletteCategoryTabs({
    categories,
    pendingDraw,
    tileActions,
    loading: !iconCatalogsLoaded,
    addSticker,
    stickerQuery,
    setStickerQuery,
    stickerResults,
  });

  return {
    tileActions,
    tabs,
    iconCatalogsLoaded,
  };
}
