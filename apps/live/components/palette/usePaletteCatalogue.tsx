import type { EmbedProvider, EventStormingNoteKind } from '@livediagram/diagram';
import { useEffect, useState } from 'react';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import type { PaletteTileActions } from '@/components/palette/PaletteTileGrid';
import { getLineArtIconCatalog } from '@/lib/icons';
import { searchStickers } from '@/lib/stickers';
import { searchTechIcons } from '@/lib/tech-icons';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import type { CanvasTool, CommandPaletteProps } from './CommandPalette.types';
import { buildCanvasToolOptions } from './canvas-tool-options';
import { withTileActionPreamble } from './palette-tile-actions';
import { paletteCategoryTabs } from './palette-category-tabs';
import type { PaletteAddHandlers } from './palette-add-handlers';

// Everything a palette SURFACE needs that isn't how it is drawn: the tile
// add-handler bundle, the category catalogue with each category's body, the
// three searchable catalogues' state, and the canvas-tool picker's options.
// Lifted out of CommandPalette so the floating Palette and the Toolbar
// layout's top strip (spec/148) are two renderings of one palette rather
// than two palettes that drift.
//
// `onDrawArmed` / `onMobileClose` are the host's hooks into "a tile was
// used": the dock reopens after a draw lands and closes its popover, the
// strip closes its More popover. Every add-handler calls both, so a tile
// behaves the same from any category and any surface.
type Deps = Pick<
  CommandPaletteProps,
  | 'canvasTool'
  | 'onSetCanvasTool'
  | 'onExitAvatarMode'
  | 'onToggleZen'
  | 'canvasEmpty'
  | 'pendingDraw'
  | 'esBoard'
  | 'esBoardControls'
  | 'onDrawArmed'
  | 'onMobileClose'
> &
  PaletteAddHandlers;

export function usePaletteCatalogue({
  canvasTool,
  onSetCanvasTool,
  onExitAvatarMode,
  onToggleZen,
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
  onBeginShapePen,
  onBeginPolygon,
  pendingDraw,
  esBoard,
  esBoardControls,
  onDrawArmed,
  onMobileClose,
}: Deps) {
  // Spotlight (spec/09) is desktop-only: it relies on hover-tracking the
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
  // On mobile (dock popover mode) close the palette after adding a
  // shape/tool so the user can draw immediately without dismissing manually.
  // Draw-to-place tools also signal onDrawArmed so the parent can reopen the
  // palette once the draw lands; immediate drops (icon/table/...) don't.
  // `opts` is the creation-time choice for the kinds that have one: which
  // session tool, which reaction (spec/105, spec/135). It has to be forwarded
  // rather than dropped — this adapter silently swallowing it is what made
  // every session tile place a timer and every reaction tile place confetti.
  const armed = (fn: () => void) => () => {
    fn();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addShape = (
    kind: import('@livediagram/diagram').ShapeKind,
    opts?: {
      session?: import('@livediagram/diagram').SessionTool;
      reaction?: import('@livediagram/diagram').Reaction;
      mode?: import('@livediagram/diagram').SelectionMode;
      estimateScale?: import('@livediagram/diagram').EstimateScale;
    },
  ) => armed(() => onAddShape(kind, opts))();
  // Icons arm the draw gesture too (they ride the shape intent carrying the
  // glyph id), so they signal onDrawArmed like the sticker below — without it
  // the mobile palette never reopened after an icon landed.
  const addIcon = (iconId: string) => armed(() => onAddIcon(iconId))();
  // Draw-armed like a shape: a sticker taps or drags to place, so the
  // mobile dock reopens the palette once the drop lands.
  const addSticker = (stickerId: string) => armed(() => onAddSticker(stickerId))();
  const addTechIcon = (iconId: string) => armed(() => onAddTechIcon(iconId))();
  const addText = armed(onAddText);
  const addSticky = (fill?: string, esKind?: EventStormingNoteKind) =>
    armed(() => onAddSticky(fill, esKind))();
  const addTable = armed(onAddTable);
  // The annotation is the ONE tile that still places instantly (spec/38): a
  // fixed 44x44 marker has no box to draw, so there is no armed gesture for
  // the mobile dock to wait on.
  const addAnnotation = () => {
    onAddAnnotation();
    onMobileClose?.();
  };
  const addLinkCard = armed(onAddLinkCard);
  const addVideo = (provider?: EmbedProvider) => armed(() => onAddVideo(provider))();
  // Components arm the draw gesture (tap-or-drag), so they signal onDrawArmed
  // like shapes do (so the mobile palette reopens once the draw lands) and
  // close the mobile dock so the canvas is clear to draw on.
  const addArrow = armed(onAddArrow);
  const beginFreehand = armed(onBeginFreehand);
  const beginShapePen = armed(onBeginShapePen);
  const beginPolygon = armed(onBeginPolygon);
  const addImage = armed(() => onAddImage?.());
  // One handler per composite-component kind, so the tile catalogue can
  // address them by kind (see PaletteTileGrid).
  const addComponent = (kind: import('@livediagram/diagram').ComponentKind) => {
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
  // (spec/78). All handlers above already wrap the mobile-close /
  // draw-armed behaviour, so a tile behaves the same from any tab.
  // Avatar mode (spec/101) is read-only, so reaching for a tile means the user
  // wants to edit again: every add leaves the mode first (back to whichever
  // tool preceded it) and then drops as normal. Wrapping the bundle covers
  // every tile, including ones added later.
  const tileActions: PaletteTileActions = withTileActionPreamble<PaletteTileActions>(
    {
      addShape,
      addText,
      beginFreehand,
      beginShapePen,
      beginPolygon,
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
      hasImage: !!onAddImage,
    },
    () => {
      if (canvasTool === 'avatar') onExitAvatarMode?.();
    },
  );
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
  // category (spec/109) rather than filtering by one, so narrowing here would
  // make a search silently miss the categories you weren't looking at. It is
  // the line-art half specifically: stickers share the catalogue but have
  // their own category (spec/116), and showing them in both would be the
  // duplication that move removed.
  const iconResults = getLineArtIconCatalog().filter((i) => {
    const q = iconQuery.trim().toLowerCase();
    if (!q) return true;
    return i.label.toLowerCase().includes(q) || i.keywords.includes(q) || i.id.includes(q);
  });
  // Stickers tab (spec/116): colour emoji, browsed in ten groups. Same shape
  // as the Icons tab — a search box over a drill-in browse.
  const [stickerQuery, setStickerQuery] = useState('');
  const stickerResults = searchStickers(stickerQuery);
  // Technology tab (spec/41): full-colour brand icons. Mirrors the Icons
  // tab — a search box over provider categories.
  const [techQuery, setTechQuery] = useState('');
  const techResults = searchTechIcons(techQuery, 'all');

  // Ordered by BAND (spec/110): Common, then Decorate, then Dynamic
  // (the headings PaletteTabBar's CATEGORY_BANDS actually renders).
  // It renders the dropdown straight from this order, so the array IS
  // the grid layout.
  const tabs = paletteCategoryTabs({
    pendingDraw,
    tileActions,
    // Only on an ES board: the category renders elsewhere too (a favourited
    // note kind), where a board switch means nothing.
    esBoardControls: esBoard ? esBoardControls : undefined,
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
