import {
  DEFAULT_EDITOR_MODE,
  type EmbedProvider,
  type EventStormingNoteKind,
} from '@livediagram/document';
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
import { useShapeLibraries } from '@/components/primitives/ShapeLibraryProvider';
import type { PaletteAddHandlers } from './palette-add-handlers';
import { paletteCategoriesFor } from './palette-layouts';
import type { WhiteboardPenId } from '@/lib/whiteboard-prefs';
import { useEditorModeState } from '@/components/chrome/editor-mode/editor-mode-context';

// Everything a palette SURFACE needs that isn't how it is drawn: the tile
// add-handler bundle, the category catalogue with each category's body, the
// three searchable catalogues' state, and the canvas-tool picker's options.
// Lifted out of CommandPalette so the floating Palette and the Toolbar
// layout's top strip (docs/specs/007-editor/toolbar-layout.md) are two renderings of one palette rather
// than two palettes that drift.
//
// `onTileUsed` is the host's hook into "a tile was used": the strip closes
// its More popover. Every add-handler calls it, so a tile behaves the same
// from any category and any surface.
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
  | 'onTileUsed'
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
  onInsertLibraryShape,
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
  onBeginShapePen,
  onBeginPolygon,
  pendingDraw,
  esBoard,
  esBoardControls,
  onTileUsed,
}: Deps) {
  // Spotlight (docs/specs/008-canvas/canvas-and-palette.md) is desktop-only: it relies on hover-tracking the
  // cursor and on left/right-click to resize the light, none of which map to
  // touch — so drop it from the tool picker on mobile viewports. Reactive
  // (the shared useIsMobileViewport, as MovablePanel uses) so the option
  // appears / disappears as the viewport crosses the breakpoint; a client
  // mount reads it synchronously, so there's no flicker.
  const { libraries } = useShapeLibraries();
  // The viewer's editor mode picks the palette layout (palette-layouts).
  const editorMode = useEditorModeState()?.mode ?? DEFAULT_EDITOR_MODE;
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
  // session tool, which reaction (docs/specs/012-collaboration/session-button.md, docs/specs/009-elements/reaction-pad.md). It has to be forwarded
  // rather than dropped — this adapter silently swallowing it is what made
  // every session tile place a timer and every reaction tile place confetti.
  const armed = (fn: () => void) => () => {
    fn();
    onTileUsed?.();
  };
  const addShape = (
    kind: import('@livediagram/document').ShapeKind,
    opts?: {
      session?: import('@livediagram/document').SessionTool;
      reaction?: import('@livediagram/document').Reaction;
      mode?: import('@livediagram/document').SelectionMode;
      estimateScale?: import('@livediagram/document').EstimateScale;
      plan?: string;
    },
  ) => armed(() => onAddShape(kind, opts))();
  // Icons, stickers and tech icons arm the draw gesture too (they ride the
  // shape intent carrying the glyph id).
  const addIcon = (iconId: string) => armed(() => onAddIcon(iconId))();
  const addSticker = (stickerId: string) => armed(() => onAddSticker(stickerId))();
  const addTechIcon = (iconId: string) => armed(() => onAddTechIcon(iconId))();
  const addText = armed(onAddText);
  const addSticky = (fill?: string, esKind?: EventStormingNoteKind) =>
    armed(() => onAddSticky(fill, esKind))();
  const addTable = armed(onAddTable);
  // The annotation is the ONE tile that still places instantly (docs/specs/009-elements/annotations.md): a
  // fixed 44x44 marker has no box to draw.
  const addAnnotation = armed(onAddAnnotation);
  const addLinkCard = armed(onAddLinkCard);
  const addVideo = (provider?: EmbedProvider) => armed(() => onAddVideo(provider))();
  // Components arm the draw gesture (tap-or-drag) and close a popover
  // palette so the canvas is clear to draw on.
  const addArrow = (ends?: import('@livediagram/document').ArrowEnds) =>
    armed(() => onAddArrow(ends))();
  const beginFreehand = armed(onBeginFreehand);
  const beginHighlighter = armed(onBeginHighlighter);
  const beginMarker = (penId: WhiteboardPenId) => armed(() => onBeginMarker(penId))();
  const beginShapePen = armed(onBeginShapePen);
  const beginPolygon = armed(onBeginPolygon);
  const addImage = armed(() => onAddImage?.());
  // One handler per composite-component kind, so the tile catalogue can
  // address them by kind (see PaletteTileGrid).
  const addComponent = (kind: import('@livediagram/document').ComponentKind) => {
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

  // Ordered by BAND (docs/specs/010-palette/palette-top-level-categories.md): Common, then Decorate, then Dynamic
  // (the headings PaletteTabBar's CATEGORY_BANDS actually renders).
  // It renders the dropdown straight from this order, so the array IS
  // the grid layout.
  // The mode's palette layout (palette-layouts): its categories, in order, with their tiles. My
  // shapes shows only when the owner has a shape to place (docs/specs/013-workspace/shape-libraries.md);
  // Event Storming only on an ES board (docs/specs/021-event-storming/event-storming.md).
  const hasLibraryShapes = libraries.some((l) => l.items.length > 0);
  const categories = paletteCategoriesFor(editorMode, { esBoard: !!esBoard }).filter(
    (c) => hasLibraryShapes || c.id !== 'my-shapes',
  );
  const tabs = paletteCategoryTabs({
    categories,
    pendingDraw,
    tileActions,
    // Only on an ES board: a board switch anywhere else means nothing.
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
    insertLibraryShape: (item) => armed(() => onInsertLibraryShape(item))(),
  });

  // The canvas-tool picker's options, and its change handler: 'zen' is an
  // action entry, not a tool, so it fires the toggle and keeps the current
  // tool selected (see canvas-tool-options).
  const canvasToolOptions = buildCanvasToolOptions({
    canvasEmpty,
    isMobile,
    includeZen: !!onToggleZen,
    planMode: editorMode === 'plan',
  });
  const onCanvasToolChange = (id: string) => {
    if (id === 'zen') onToggleZen?.();
    else onSetCanvasTool(id as CanvasTool);
  };

  return {
    tileActions,
    tabs,
    editorMode,
    canvasToolOptions,
    onCanvasToolChange,
    iconCatalogsLoaded,
  };
}
