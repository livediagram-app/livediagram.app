import { DEFAULT_EDITOR_MODE, type EmbedProvider } from '@livehuddle/document';
import { useState } from 'react';
import type { PaletteTileActions } from '@/components/palette/PaletteTileGrid';
import { getLineArtIconCatalog } from '@/lib/icons';
import { searchStickers } from '@liveworkspace/workbench/lib/stickers';
import { useIconCatalogs } from '@liveworkspace/workbench/hooks/ui/useIconCatalogs';
import type { CanvasTool, PaletteProps } from './palette.types';
import { buildCanvasToolOptions } from './canvas-tool-options';
import { withTileActionPreamble } from './palette-tile-actions';
import { paletteCategoryTabs } from './palette-category-tabs';
import type { PaletteAddHandlers } from './palette-add-handlers';
import {
  paletteCategoriesFor,
  participantPaletteCategories,
  PARTICIPANT_CANVAS_TOOLS,
} from './palette-layouts';
import type { WhiteboardPenId } from '@/lib/whiteboard-prefs';
import type { AddShapeOptions } from '@/lib/draw-mode';

// Everything a palette SURFACE needs that isn't how it is drawn: the tile
// add-handler bundle, the category catalogue with each category's body, the
// three searchable catalogues' state, and the canvas-tool picker's options.
// The strip (docs/specs/007-editor/toolbar-layout.md), its More popover and its Search all read
// from this one catalogue, so they never drift apart.
//
// `onTileUsed` is the host's hook into "a tile was used": the strip closes
// its More popover. Every add-handler calls it, so a tile behaves the same
// from any category and any surface.
type Deps = Pick<
  PaletteProps,
  | 'canvasTool'
  | 'onSetCanvasTool'
  | 'onExitAvatarMode'
  | 'canvasEmpty'
  | 'pendingDraw'
  | 'onTileUsed'
> &
  PaletteAddHandlers & {
    // A Participant (docs/specs/013-workspace/share-roles.md): the Participate category alone, and its selection
    // modes only.
    participant?: boolean;
  };

export function usePaletteCatalogue({
  canvasTool,
  onSetCanvasTool,
  onExitAvatarMode,
  canvasEmpty,
  onAddShape,
  onAddIcon,
  onAddSticker,
  onAddTechIcon,
  onAddText,
  onAddSticky,
  onAddTable,
  onAddAnnotation,
  onAddLinkCard,
  onAddVideo,
  onAddBanner,
  onAddHero,
  onAddHeader,
  onAddCallout,
  onAddStatRow,
  onAddProcess,
  onAddAvatar,
  onAddImage,
  onAddArrow,
  onBeginFreehand,
  onBeginHighlighter,
  onBeginMarker,
  onCancelDraw,
  onBeginShapePen,
  onBeginPolygon,
  onBeginRoomWalls,
  pendingDraw,
  onTileUsed,
  participant = false,
}: Deps) {
  // The editor mode picks the palette layout (palette-layouts): Workshop, the one mode.
  const editorMode = DEFAULT_EDITOR_MODE;
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
  // Icons, stickers and tech icons arm the draw gesture too (they ride the
  // shape intent carrying the glyph id).
  const addIcon = (iconId: string) => armed(() => onAddIcon(iconId))();
  const addSticker = (stickerId: string) => armed(() => onAddSticker(stickerId))();
  const addTechIcon = (iconId: string) => armed(() => onAddTechIcon(iconId))();
  const addText = armed(onAddText);
  const addSticky = armed(onAddSticky);
  const addTable = armed(onAddTable);
  // The annotation is the ONE tile that still places instantly (docs/specs/009-elements/annotations.md): a
  // fixed 44x44 marker has no box to draw.
  const addAnnotation = armed(onAddAnnotation);
  const addLinkCard = armed(onAddLinkCard);
  const addVideo = (provider?: EmbedProvider) => armed(() => onAddVideo(provider))();
  // Components arm the draw gesture (tap-or-drag) and close a popover
  // palette so the canvas is clear to draw on.
  const addArrow = (ends?: import('@livehuddle/document').ArrowEnds) =>
    armed(() => onAddArrow(ends))();
  const beginFreehand = armed(onBeginFreehand);
  const beginHighlighter = armed(onBeginHighlighter);
  const beginMarker = (penId: WhiteboardPenId) => armed(() => onBeginMarker(penId))();
  const beginShapePen = armed(onBeginShapePen);
  const beginPolygon = armed(onBeginPolygon);
  const beginRoomWalls = armed(() => onBeginRoomWalls?.());
  const addImage = armed(() => onAddImage?.());
  // One handler per composite-component kind, so the tile catalogue can
  // address them by kind (see PaletteTileGrid).
  const addComponent = (kind: import('@livehuddle/document').ComponentKind) => {
    const byKind = {
      avatar: onAddAvatar,
      banner: onAddBanner,
      hero: onAddHero,
      header: onAddHeader,
      callout: onAddCallout,
      stat: onAddStatRow,
      process: onAddProcess,
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
      beginMarker,
      beginShapePen,
      beginPolygon,
      beginRoomWalls,
      addArrow,
      addSticky,
      addTable,
      addImage,
      addAnnotation,
      addLinkCard,
      addVideo,
      addSticker,
      addComponent,
      addIcon,
      addTechIcon,
      cancelDraw: onCancelDraw,
      hasImage: !!onAddImage,
    },
    () => {
      if (canvasTool === 'avatar') onExitAvatarMode?.();
    },
  );
  // Icon-picker search query (Icons tab). Filters the catalogue
  // by label / keyword as the user types.
  const [iconQuery, setIconQuery] = useState('');
  // Both icon catalogues load as one async chunk (@liveworkspace/workbench/lib/icon-registry.ts).
  // Subscribing here re-renders the palette when the data lands, so the two
  // result lists below re-derive from the populated catalogue; until then
  // they're empty and the picker tabs show a brief "Loading icons" note
  // (via `iconCatalogsLoaded`) instead of a false "no matches".
  const iconCatalogsLoaded = useIconCatalogs();
  // Search hits across the WHOLE line-art catalogue — the tab browses by
  // category (docs/specs/010-palette/palette-category-browse.md) rather than filtering by one, so narrowing here would
  // make a search silently miss the categories you weren't looking at. It is
  // the line-art half specifically: stickers share the catalogue but have
  // their own category (docs/specs/010-palette/stickers.md), and showing them in both would be the
  // duplication that move removed.
  const iconResults = getLineArtIconCatalog().filter((i) => {
    const q = iconQuery.trim().toLowerCase();
    if (!q) return true;
    return i.label.toLowerCase().includes(q) || i.keywords.includes(q) || i.id.includes(q);
  });
  // Stickers tab (docs/specs/010-palette/stickers.md): colour emoji, browsed in ten groups. Same shape
  // as the Icons tab — a search box over a drill-in browse.
  const [stickerQuery, setStickerQuery] = useState('');
  const stickerResults = searchStickers(stickerQuery);

  // Ordered by BAND (docs/specs/010-palette/palette-top-level-categories.md): Common, then Decorate, then Dynamic
  // (the headings CATEGORY_BANDS names).
  // It renders the dropdown straight from this order, so the array IS
  // the grid layout.
  // The mode's palette layout (palette-layouts): its categories, in order, with their tiles.
  const categories = participant
    ? participantPaletteCategories()
    : paletteCategoriesFor(editorMode);
  const tabs = paletteCategoryTabs({
    categories,
    pendingDraw,
    tileActions,
    addIcon,
    iconQuery,
    setIconQuery,
    iconResults,
    loading: !iconCatalogsLoaded,
    addSticker,
    stickerQuery,
    setStickerQuery,
    stickerResults,
  });

  // The canvas-tool picker's options (canvas-tool-options), and its change handler.
  const allCanvasToolOptions = buildCanvasToolOptions({ canvasEmpty });
  const canvasToolOptions = participant
    ? allCanvasToolOptions.filter((o) => PARTICIPANT_CANVAS_TOOLS.includes(o.id))
    : allCanvasToolOptions;
  const onCanvasToolChange = (id: string) => onSetCanvasTool(id as CanvasTool);

  return {
    tileActions,
    tabs,
    editorMode,
    canvasToolOptions,
    onCanvasToolChange,
    iconCatalogsLoaded,
  };
}
