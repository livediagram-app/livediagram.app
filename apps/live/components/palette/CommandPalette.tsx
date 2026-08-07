import type { EmbedProvider } from '@livediagram/diagram';
import { useEffect, useState } from 'react';
import { MOBILE_BREAKPOINT_PX, isMobileViewportSync } from '@/lib/responsive';
import { PaletteTintProvider } from '@/components/palette/palette-controls';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { PaletteSettingsPopover } from '@/components/palette/PaletteSettingsPopover';
import { PaletteTabBar } from '@/components/palette/PaletteTabBar';
import { PaletteGroupProvider } from '@/components/palette/palette-group-state';
import { PaletteDropdown } from '@/components/palette/PaletteDropdown';
import type { PaletteTileActions } from '@/components/palette/PaletteTileGrid';
import { getLineArtIconCatalog } from '@/lib/icons';
import { searchStickers } from '@/lib/stickers';
import { searchTechIcons } from '@/lib/tech-icons';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';

import type { CanvasTool, CommandPaletteProps } from './CommandPalette.types';
import { buildCanvasToolOptions } from './canvas-tool-options';
import { withTileActionPreamble } from './palette-tile-actions';
import { paletteCategoryTabs } from '@/components/palette/palette-category-tabs';

export type { CanvasTool };

export function CommandPalette({
  position,
  canvasTool,
  onSetCanvasTool,
  onExitAvatarMode,
  onToggleZen,
  onMoveTo,
  onReset,
  minimalPanels,
  onToggleMinimalPanels,
  settings,
  onChangeSettings,
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
  onSize,
  mobileTopOverridePx,
  mobileOpenOverride,
  onMobileClose,
  onDrawArmed,
  mobileDockAnchor,
  forceDockMode,
  themeTint,
  dock,
}: CommandPaletteProps) {
  // Spotlight (spec/09) is desktop-only: it relies on hover-tracking the
  // cursor and on left/right-click to resize the light, none of which map to
  // touch — so drop it from the tool picker on mobile viewports. Reactive
  // (mirrors MovablePanel) so the option appears / disappears as the viewport
  // crosses the breakpoint, with a sync initial read to avoid a flicker.
  const [isMobile, setIsMobile] = useState(isMobileViewportSync);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    if (!mq) return;
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
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
  const addShape = (
    kind: import('@livediagram/diagram').ShapeKind,
    opts?: {
      session?: import('@livediagram/diagram').SessionTool;
      reaction?: import('@livediagram/diagram').Reaction;
      mode?: import('@livediagram/diagram').SelectionMode;
      estimateScale?: import('@livediagram/diagram').EstimateScale;
    },
  ) => {
    onAddShape(kind, opts);
    onDrawArmed?.();
    onMobileClose?.();
  };
  // Icons arm the draw gesture too (they ride the shape intent carrying the
  // glyph id), so they signal onDrawArmed like the sticker below — without it
  // the mobile palette never reopened after an icon landed.
  const addIcon = (iconId: string) => {
    onAddIcon(iconId);
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addSticker = (stickerId: string) => {
    onAddSticker(stickerId);
    // Draw-armed like a shape: a sticker taps or drags to place, so the
    // mobile dock reopens the palette once the drop lands.
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addTechIcon = (iconId: string) => {
    onAddTechIcon(iconId);
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addText = () => {
    onAddText();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addSticky = () => {
    onAddSticky();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addTable = () => {
    onAddTable();
    onDrawArmed?.();
    onMobileClose?.();
  };
  // The annotation is the ONE tile that still places instantly (spec/38): a
  // fixed 44x44 marker has no box to draw, so there is no armed gesture for
  // the mobile dock to wait on.
  const addAnnotation = () => {
    onAddAnnotation();
    onMobileClose?.();
  };
  const addLinkCard = () => {
    onAddLinkCard();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addVideo = (provider?: EmbedProvider) => {
    onAddVideo(provider);
    onDrawArmed?.();
    onMobileClose?.();
  };
  // Components arm the draw gesture (tap-or-drag), so they signal onDrawArmed
  // like shapes do (so the mobile palette reopens once the draw lands) and
  // close the mobile dock so the canvas is clear to draw on.
  const addBanner = () => {
    onAddBanner();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addHero = () => {
    onAddHero();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addHeader = () => {
    onAddHeader();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addCallout = () => {
    onAddCallout();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addStatRow = () => {
    onAddStatRow();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addProcess = () => {
    onAddProcess();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addAvatar = () => {
    onAddAvatar();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addArrow = () => {
    onAddArrow();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const beginFreehand = () => {
    onBeginFreehand();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const beginShapePen = () => {
    onBeginShapePen();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const beginPolygon = () => {
    onBeginPolygon();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addImage = () => {
    onAddImage?.();
    onDrawArmed?.();
    onMobileClose?.();
  };
  // One handler per composite-component kind, so the tile catalogue can
  // address them by kind (see PaletteTileGrid).
  const addComponent = (kind: import('@livediagram/diagram').ComponentKind) => {
    const byKind = {
      avatar: addAvatar,
      banner: addBanner,
      hero: addHero,
      header: addHeader,
      callout: addCallout,
      stat: addStatRow,
      process: addProcess,
    } as const;
    byKind[kind]();
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
  // Per-element + tab formatting now lives in the right-click context
  // menus (element / canvas / tab) and the Tab Appearance modal, not in a
  // side panel. The palette now hosts the canvas-tool toggle row at the
  // top, then a single category picker: Favourites (spec/78, open by
  // default — the user's own go-to tiles), Shapes, Tools, Components,
  // Devices, Icons, Technology.
  // PaletteTabBar owns the active-category state, so the palette stays
  // compact no matter how many categories we add.
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
  return (
    <MovablePanel
      helpArticle="palette"
      // Above the other panels by default (spec/09): the palette is the one
      // you reach for while another panel happens to be open.
      elevated
      title="Palette"
      dataTourId="palette"
      position={position}
      defaultCorner="top-right"
      width="w-auto sm:w-64"
      onSize={onSize}
      mobileTopOverridePx={mobileTopOverridePx}
      mobileOpenOverride={mobileOpenOverride}
      onMobileClose={onMobileClose}
      mobileDockAnchor={mobileDockAnchor}
      forceDockMode={forceDockMode}
      flushTop
      growBody
      onMoveTo={onMoveTo}
      {...dock}
      // The settings popover is the palette's only header affordance besides
      // minimise: it now hosts the panel-layout toggle and the reset-position
      // action that each used to be their own header button.
      headerActions={
        <PaletteSettingsPopover
          settings={settings}
          onChange={onChangeSettings}
          minimalPanels={minimalPanels}
          onToggleMinimalPanels={onToggleMinimalPanels}
          onResetPosition={onReset}
          // Reset is offered only once the palette has left its home
          // (free-dragged, or docked in a corner other than its top-right
          // default): at rest the option would be a no-op.
          resettable={
            position !== null || (dock?.docked === true && dock.dockedCorner !== 'top-right')
          }
        />
      }
      collapsible
      // The category / canvas-tool dropdowns portal their menus to
      // <body>, so a mobile tap on a menu option lands outside the panel
      // DOM; without this it would trip the outside-tap auto-collapse and
      // shut the palette mid-selection.
      outsideExceptSelector="[data-palette-dropdown-menu]"
    >
      {/* Header band: canvas-tool picker (Select / Hand / Laser) on the
          left, category picker on the right. The tool dropdown is a mode
          switch, not an element-add control, so it stays a permanent
          fixture; Select is the default and Space pans regardless of the
          active tool, mirroring Figma. Favourites is the default category
          (the user's own go-to tiles, spec/78). */}
      {/* At most one collapsible tile group open across the palette
          (palette-group-state): Behaviour's two groups hold eight tiles
          between them and both open ran the category past the panel. */}
      <PaletteGroupProvider>
        <PaletteTintProvider tint={themeTint}>
          <PaletteTabBar
            // No storageKey: the palette always opens on Favourites when a
            // diagram loads (the user's go-to tiles, spec/78) rather than
            // restoring the last-used category across diagrams. See spec/09.
            defaultOpenId="favourites"
            leading={
              <PaletteDropdown
                ariaLabel="Canvas tool"
                dataTourId="canvas-tool"
                value={canvasTool}
                variant="flush"
                autoHeight
                // Tile grid (spec/108): nine tools in one column was a lot of
                // travel for a flat choice between equal-weight modes.
                grid
                // The three bands the tools fall into (spec/108): what you do TO
                // the diagram, what you do in front of an audience, and the
                // whole-canvas views.
                groupLabels={{ 0: 'Edit', 1: 'Present', 2: 'Preview' }}
                // 'zen' is an action entry, not a tool: fire the toggle and
                // keep the current tool selected (see canvas-tool-options).
                onChange={(id) => {
                  if (id === 'zen') onToggleZen?.();
                  else onSetCanvasTool(id as CanvasTool);
                }}
                options={buildCanvasToolOptions({
                  canvasEmpty,
                  isMobile,
                  includeZen: !!onToggleZen,
                })}
              />
            }
            // Ordered by BAND (spec/110): Common, then Decorate, then Dynamic
            // (the headings PaletteTabBar's CATEGORY_BANDS actually renders).
            // It renders the dropdown straight from this order, so the array IS
            // the grid layout.
            tabs={paletteCategoryTabs({
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
            })}
          />
        </PaletteTintProvider>
      </PaletteGroupProvider>
    </MovablePanel>
  );
}
