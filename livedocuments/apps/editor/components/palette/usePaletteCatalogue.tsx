import { usePaletteKind } from '@/lib/palette-kind';
import type { EmbedProvider } from '@livedocuments/document';
import { useEffect, useState } from 'react';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import type { PaletteTileActions } from '@/components/palette/PaletteTileGrid';
import { getLineArtIconCatalog } from '@/lib/icons';
import { searchStickers } from '@liveworkspace/workbench/lib/stickers';
import { searchTechIcons } from '@liveworkspace/workbench/lib/tech-icons';
import { useIconCatalogs } from '@liveworkspace/workbench/hooks/ui/useIconCatalogs';
import type { CanvasTool, PaletteProps } from './palette.types';
import { buildCanvasToolOptions } from './canvas-tool-options';
import { paletteCategoryTabs } from './palette-category-tabs';
import type { PaletteAddHandlers } from './palette-add-handlers';
import { paletteCategoriesFor } from './palette-layouts';
import type { AddShapeOptions } from '@/lib/draw-mode';

// Everything a palette SURFACE needs that isn't how it is drawn: the tile
// add-handler bundle, the category catalogue with each category's body, the
// three searchable catalogues' state, and the canvas-tool picker's options.
// The strip (docs/specs/007-editor/toolbar-layout.md), its category flyouts and its Search all read
// from this one catalogue, so they never drift apart.
//
// `onTileUsed` is the host's hook into "a tile was used": the strip closes
// its open flyout or Search. Every add-handler calls it, so a tile behaves the same
// from any category and any surface.
type Deps = Pick<
  PaletteProps,
  'canvasTool' | 'onSetCanvasTool' | 'onToggleZen' | 'canvasEmpty' | 'pendingDraw' | 'onTileUsed'
> &
  PaletteAddHandlers;

export function usePaletteCatalogue({
  canvasTool,
  onSetCanvasTool,
  onToggleZen,
  canvasEmpty,
  onAddShape,
  onAddIcon,
  onAddSticker,
  onAddTechIcon,
  onAddText,
  onAddSticky,
  onAddTable,
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
  onCancelDraw,
  onBeginPolygon,
  pendingDraw,
  onTileUsed,
}: Deps) {
  // Spotlight (docs/specs/008-canvas/canvas-and-palette.md) is desktop-only: it relies on hover-tracking the
  // cursor and on left/right-click to resize the light, none of which map to
  // touch — so drop it from the tool picker on mobile viewports. Reactive
  // (the shared useIsMobileViewport, as MovablePanel uses) so the option
  // appears / disappears as the viewport crosses the breakpoint; a client
  // mount reads it synchronously, so there's no flicker.
  const isMobile = useIsMobileViewport();
  // If the viewport shrinks into mobile while Spotlight is active (desktop ->
  // resize / rotate), revert to Select: the option has just left the picker,
  // so leaving the tool on spotlight would strand it (the trigger would
  // mislabel as Select while the canvas stayed shrouded).
  useEffect(() => {
    if (isMobile && canvasTool === 'spotlight') onSetCanvasTool('select');
  }, [isMobile, canvasTool, onSetCanvasTool]);
  // Close a popover palette after adding a shape / tool so the user can draw
  // immediately without dismissing it manually.
  // `opts` is the creation-time choice for the kinds that have one: which
  // variant (a Funnel, the Callout card). It has to be forwarded rather than dropped.
  const armed = (fn: () => void) => () => {
    fn();
    onTileUsed?.();
  };
  const addShape = (kind: import('@livedocuments/document').ShapeKind, opts?: AddShapeOptions) =>
    armed(() => onAddShape(kind, opts))();
  // Icons, stickers and tech icons arm the draw gesture too (they ride the
  // shape intent carrying the glyph id).
  const addIcon = (iconId: string) => armed(() => onAddIcon(iconId))();
  const addSticker = (stickerId: string) => armed(() => onAddSticker(stickerId))();
  const addTechIcon = (iconId: string) => armed(() => onAddTechIcon(iconId))();
  const addText = armed(onAddText);
  const addSticky = armed(onAddSticky);
  const addTable = armed(onAddTable);
  const addLinkCard = armed(onAddLinkCard);
  const addVideo = (provider?: EmbedProvider) => armed(() => onAddVideo(provider))();
  // Components arm the draw gesture (tap-or-drag) and close a popover
  // palette so the canvas is clear to draw on.
  const addArrow = (ends?: import('@livedocuments/document').ArrowEnds) =>
    armed(() => onAddArrow(ends))();
  const beginPolygon = armed(onBeginPolygon);
  const addImage = armed(() => onAddImage?.());
  // One handler per composite-component kind, so the tile catalogue can
  // address them by kind (see PaletteTileGrid).
  const addComponent = (kind: import('@livedocuments/document').ComponentKind) => {
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
  const tileActions: PaletteTileActions = {
    addShape,
    addText,
    beginPolygon,
    addArrow,
    addSticky,
    addTable,
    addImage,
    addLinkCard,
    addVideo,
    addSticker,
    addComponent,
    addIcon,
    addTechIcon,
    cancelDraw: onCancelDraw,
    hasImage: !!onAddImage,
  };
  // Icon-picker search query (Icons tab). Filters the catalogue
  // by label / keyword as the user types.
  const [iconQuery, setIconQuery] = useState('');
  // Both icon catalogues load as one async chunk (lib/icon-registry.ts).
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
  // Technology tab (docs/specs/010-palette/technology-icons.md): full-colour brand icons. Mirrors the Icons
  // tab — a search box over provider categories.
  const [techQuery, setTechQuery] = useState('');
  const techResults = searchTechIcons(techQuery, 'all');

  // Ordered by band (docs/specs/010-palette/palette-top-level-categories.md): the category bar draws a divider
  // where the band changes, so the array IS the bar's order.
  // In Pages mode, the palette's kind (lib/palette-kind.ts): the page someone is on's. Each kind is its own layout
  // (palette-layouts.ts).
  const paletteKind = usePaletteKind();
  const categories = paletteCategoriesFor({ pagesKind: paletteKind });
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
    addTechIcon,
    techQuery,
    setTechQuery,
    techResults,
  });

  // The canvas-tool picker's options, and its change handler: 'zen' is an
  // action entry, not a tool, so it fires the toggle and keeps the current
  // tool selected (see canvas-tool-options).
  const canvasToolOptions = buildCanvasToolOptions({
    canvasEmpty,
    isMobile,
    includeZen: !!onToggleZen,
  });
  const onCanvasToolChange = (id: string) => {
    if (id === 'zen') onToggleZen?.();
    else onSetCanvasTool(id as CanvasTool);
  };

  return {
    tileActions,
    tabs,
    canvasToolOptions,
    onCanvasToolChange,
    iconCatalogsLoaded,
  };
}
