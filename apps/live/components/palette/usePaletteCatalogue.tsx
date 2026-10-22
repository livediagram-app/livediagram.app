import type { PaletteTileDef } from './palette-tile-defs';
import { usePaletteKind } from '@/lib/palette-kind';
import {
  DEFAULT_EDITOR_MODE,
  type EmbedProvider,
  type EventStormingNoteKind,
} from '@liveplanner/document';
import { useState } from 'react';
import type { PaletteTileActions } from '@/components/palette/PaletteTileGrid';
import { getLineArtIconCatalog } from '@/lib/icons';
import { searchStickers } from '@/lib/stickers';
import { searchTechIcons } from '@/lib/tech-icons';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import type { CanvasTool, PaletteProps } from './palette.types';
import { buildCanvasToolOptions } from './canvas-tool-options';
import { restoresMaximised, withTileActionPreamble } from './palette-tile-actions';
import { paletteCategoryTabs } from './palette-category-tabs';
import { useShapeLibraries } from '@/components/primitives/ShapeLibraryProvider';
import type { PaletteAddHandlers } from './palette-add-handlers';
import { useLogoMarkerTiles } from './PaletteLogoTab';
import {
  coveredPaletteCategories,
  dashboardPaletteCategories,
  paletteCategoriesFor,
  participantPaletteCategories,
  PARTICIPANT_CANVAS_TOOLS,
} from './palette-layouts';
import { useBoardFillingTab, usePlanTabKind } from '@/hooks/plan/plan-cover-store';
import { usePlanTabList } from '@/hooks/plan/plan-tab-list-store';
import { dashboardTabTiles } from './palette-dashboard-tiles';
import { getMaximisedPlanId, restorePlanElement } from '@/hooks/plan/maximised-plan';
import type { WhiteboardPenId } from '@/lib/whiteboard-prefs';
import type { AddShapeOptions } from '@/lib/draw-mode';
import { useEditorModeState } from '@/components/chrome/editor-mode/editor-mode-context';

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
  | 'onToggleZen'
  | 'canvasEmpty'
  | 'pendingDraw'
  | 'esBoard'
  | 'esBoardControls'
  | 'onTileUsed'
> &
  PaletteAddHandlers & {
    // A Participant (docs/specs/013-workspace/share-roles.md): the Participate category alone, and its selection
    // modes only.
    participant?: boolean;
  };

export function usePaletteCatalogue({
  onSetCanvasTool,
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
  onAddFlowchart,
  onAddAvatar,
  onAddImage,
  onAddArrow,
  onBeginFreehand,
  onBeginHighlighter,
  onBeginMarker,
  onCancelDraw,
  onBeginShapePen,
  onBeginPolygon,
  onBeginPath,
  pendingDraw,
  esBoard,
  esBoardControls,
  onTileUsed,
  participant = false,
}: Deps) {
  const { libraries } = useShapeLibraries();
  // The viewer's editor mode picks the palette layout (palette-layouts).
  const editorMode = useEditorModeState()?.mode ?? DEFAULT_EDITOR_MODE;
  // Close a popover palette after adding a shape / tool so the user can draw
  // immediately without dismissing it manually.
  // `opts` is the creation-time choice for the kinds that have one: which
  // session tool (docs/specs/012-collaboration/session-button.md). It has to be forwarded
  // rather than dropped — this adapter silently swallowing it is what made
  // every session tile place a timer.
  const armed = (fn: () => void) => () => {
    fn();
    onTileUsed?.();
  };
  const addShape = (kind: import('@liveplanner/document').ShapeKind, opts?: AddShapeOptions) =>
    armed(() => onAddShape(kind, opts))();
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
  const addArrow = (ends?: import('@liveplanner/document').ArrowEnds) =>
    armed(() => onAddArrow(ends))();
  const beginFreehand = armed(onBeginFreehand);
  const beginHighlighter = armed(onBeginHighlighter);
  const beginMarker = (penId: WhiteboardPenId, once?: boolean) =>
    armed(() => (once ? onBeginMarker(penId, true) : onBeginMarker(penId)))();
  const beginShapePen = armed(onBeginShapePen);
  const beginPolygon = armed(onBeginPolygon);
  const beginPath = armed(onBeginPath);
  const addImage = armed(() => onAddImage?.());
  // One handler per composite-component kind, so the tile catalogue can
  // address them by kind (see PaletteTileGrid).
  const addComponent = (kind: import('@liveplanner/document').ComponentKind) => {
    const byKind = {
      avatar: onAddAvatar,
      banner: onAddBanner,
      hero: onAddHero,
      header: onAddHeader,
      callout: onAddCallout,
      stat: onAddStatRow,
      process: onAddProcess,
      flowchart: onAddFlowchart,
    } as const;
    armed(byKind[kind])();
  };
  // The add-handler bundle every catalogue-driven tile grid consumes
  // (palette-tile-defs). All handlers above already wrap the mobile-close /
  // draw-armed behaviour, so a tile behaves the same from any tab. Wrapping the
  // bundle covers every tile, including ones added later.
  const tileActions: PaletteTileActions = withTileActionPreamble<PaletteTileActions>(
    {
      addShape,
      addText,
      beginFreehand,
      beginHighlighter,
      beginMarker,
      beginShapePen,
      beginPolygon,
      beginPath,
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
    (action, args) => {
      // A maximised board, view or Sheet gives the canvas back for anything but a card (docs/specs/026-plan/
      // plan-board.md "The palette follows what fills the screen"), so the tool is ready where it lands.
      if (getMaximisedPlanId() !== null && restoresMaximised(action, args)) restorePlanElement();
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
  // (the headings CATEGORY_BANDS names).
  // It renders the dropdown straight from this order, so the array IS
  // the grid layout.
  // The mode's palette layout (palette-layouts): its categories, in order, with their tiles. My
  // shapes shows only when the owner has a shape to place (docs/specs/013-workspace/shape-libraries.md);
  // Event Storming only on an ES board (docs/specs/021-event-storming/event-storming.md).
  const hasLibraryShapes = libraries.some((l) => l.items.length > 0);
  // A board filling its tab: cards land only on a board (a maximised one keeps the mode's palette).
  const boardFillingTab = useBoardFillingTab();
  // A Dashboard tab's palette is what fills a slot (docs/specs/026-plan/plan-tabs.md "Dashboard tab").
  const dashboardTab = usePlanTabKind() === 'dashboard';
  // Its Tabs category: the document's Board and Sheet tabs (plan-tab-list-store), gone while it has none.
  const planTabList = usePlanTabList();
  // In Pages mode, the palette's kind (lib/palette-kind.ts): the page someone is on's. Each kind is its own layout
  // (palette-layouts.ts).
  const paletteKind = usePaletteKind();
  const pages = editorMode === 'pages';
  // Logo's Draw takes this person's markers, as tiles in their colours and widths (useLogoMarkerTiles).
  const markers = useLogoMarkerTiles(pages && paletteKind === 'logo');
  // While a Plan board fills its tab, only Cards (coveredPaletteCategories).
  const categories = participant
    ? participantPaletteCategories(editorMode, !!esBoard)
    : boardFillingTab
      ? coveredPaletteCategories()
      : dashboardTab
        ? dashboardPaletteCategories().flatMap((c) =>
            c.id !== 'dashboard-tabs'
              ? [c]
              : planTabList.length
                ? [{ ...c, tiles: dashboardTabTiles(planTabList) }]
                : [],
          )
        : paletteCategoriesFor(editorMode, {
            esBoard: !!esBoard,
            ...(pages ? { pagesKind: paletteKind } : {}),
          })
            .filter((c) => hasLibraryShapes || c.id !== 'my-shapes')
            .map((c) =>
              c.id === 'draw' && markers.length
                ? { ...c, tiles: [...withGroupEnd(c.tiles ?? []), ...markers] }
                : c,
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
  const allCanvasToolOptions = buildCanvasToolOptions({
    canvasEmpty,
    includeZen: !!onToggleZen,
    planMode: editorMode === 'plan',
  });
  const canvasToolOptions = participant
    ? allCanvasToolOptions.filter((o) => PARTICIPANT_CANVAS_TOOLS.includes(o.id))
    : allCanvasToolOptions;
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

// `tiles` with its last ending a group, so what is added after it (Logo's markers) is a group of its own.
function withGroupEnd(tiles: readonly PaletteTileDef[]): PaletteTileDef[] {
  const last = tiles.at(-1);
  return last && !last.dividerAfter
    ? [...tiles.slice(0, -1), { ...last, dividerAfter: true }]
    : [...tiles];
}
