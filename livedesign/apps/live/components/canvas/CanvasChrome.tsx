import { mirroredLogoPages } from '@/hooks/editor/useLogoTools';
import { useViewportStore } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { ViewZoomControls } from '@/components/canvas/view-readers';
import { computeDrawGuides } from '@/components/canvas/canvas-draw-guides';
import { CanvasGuideOverlay } from '@/components/canvas/CanvasGuideOverlay';
import { CanvasDrawPreview } from '@/components/canvas/CanvasDrawPreview';
import { TopCenterChrome } from '@/components/chrome/TopCenterChrome';
// Lazy-load the visitor name prompt the same way ExportTabDialog + ShareDialog already are. It is gated on
// `showIdentityPrompt`, false on the common path (the owner opening their own design); for a visitor the empty
// canvas underneath has already rendered, so the prompt fades in a frame later rather than blocking the route on its JS.
import dynamic from 'next/dynamic';
const IdentityPrompt = dynamic(
  () => import('@/components/palette/IdentityPrompt').then((m) => m.IdentityPrompt),
  { ssr: false },
);

import { OffscreenContentHint } from '@/components/canvas/OffscreenContentHint';
import { ToolbarPalette } from '@/components/palette/ToolbarPalette';
import { pickPaletteAddHandlers } from '@/components/palette/palette-add-handlers';
import { ToolbarExplorerButton } from '@/components/chrome/ToolbarExplorerButton';
import { WorkbenchBackButton } from '@/components/chrome/WorkbenchChrome';
import { SlidesClusterSegment } from '@/components/canvas/SlidesClusterSegment';
import { toolbarTopClearancePx } from '@/lib/canvas-chrome';
import { CONTENTS_SIDEBAR_WIDTH, contentsSidebarClearancePx } from '@/lib/contents-placement';
import { ContentsClusterSegment } from './ContentsClusterSegment';
import { PhotoClusterSegment } from './PhotoClusterSegment';
import { PagesClusterStrip } from './PagesClusterStrip';
import { PageNavigatorClusterStrip } from './PageNavigatorClusterStrip';
import { LayersThemeStrip } from '@/components/canvas/LayersThemeStrip';
import { UndoRedoClusterStrip } from '@/components/canvas/UndoRedoClusterStrip';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { Fragment, useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { DockAnchor, DockPanel } from '@/hooks/canvas/useDockPopovers';
import { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import { PanelSnapSlot } from '@liveworkspace/workbench/components/canvas/PanelSnapSlot';
import { useCanvasChromePanels } from './useCanvasChromePanels';
import { usePaletteDragGuides } from '@/hooks/canvas/usePaletteDragGuides';
import { PANEL_CORNERS, PANEL_IDS, cornerBottomInset, type PanelCorner } from '@/lib/panel-layout';
import { atLeastInset } from '@livedesign/ui';
import { STRIP_SELECTOR, useStripCrowdsCorners } from '@/hooks/ui/useStripCrowdsCorners';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { PHONE_CLUSTER_BUTTON_WIDTH } from '@/components/chrome/phone-toolbar-items';
import { useSnapHaptic } from '@/hooks/canvas/useSnapHaptic';
import { CollaborateClusterButton } from './CollaborateClusterButton';
import { kindCounts } from '@/components/panels/collaborate/collaborate-model';
import { panelEnabled } from '@/lib/user-preferences';
import { loadPhotoChrome } from '@/lib/editor-deferred-code';
import { usePhotoStripTools } from './usePhotoStripTools';
import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';
import { useSnapGuides } from '@/hooks/canvas/useSnapGuideState';

// A photo page's chrome shows only while one is in focus, so its code loads on demand
// (lib/editor-deferred-code.ts).
const PhotoChrome = dynamic(loadPhotoChrome, { ssr: false });

// Values the Canvas computes (selection projection + layout/dock/zoom
// state) and threads into the chrome alongside its own props.
type ChromeExtras = {
  // The canvas <main>'s measured size (the Map's current-view window reads it; see Minimap.tsx).
  mainSize: { width: number; height: number };
  // True when every element has scrolled out of view: show the nudge above
  // the Fit button (useOffscreenContent in Canvas).
  offscreenContent: boolean;
  marquee: { startX: number; startY: number; currentX: number; currentY: number } | null;
  drawDrag: { startX: number; startY: number; currentX: number; currentY: number } | null;
  // Snapped pointer position while a draw is armed but not yet started
  // (pre-press start-snap preview); null when not armed / not snapped.
  drawHover: { x: number; y: number } | null;
  penPoints: { x: number; y: number }[] | null;
  // Polygon tool in-flight state (docs/specs/008-canvas/polygon-tool.md): the placed vertices and
  // the live rubber-band cursor position, both canvas coords.
  polygonVertices: { x: number; y: number }[];
  polygonCursor: { x: number; y: number } | null;
  wrapperRef: RefObject<HTMLDivElement | null>;
  activeDockPanel: DockPanel | null;
  setActiveDockPanel: Dispatch<SetStateAction<DockPanel | null>>;
  activeDockAnchor: DockAnchor | null;
  setActiveDockAnchor: Dispatch<SetStateAction<DockAnchor | null>>;
  handleDockButtonClick: (id: DockPanel, button: HTMLElement, above?: boolean) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleSetZoom: (zoom: number) => void;
  // Begin an isometric orbit drag from the given screen coordinates
  // (wired to `isoCamera.startOrbit`). Drives the dock orbit button,
  // which only renders while the isometric tool is active.
  onIsoOrbit: (clientX: number, clientY: number) => void;
  // Reset the isometric camera to its default angle (wired to
  // `isoCamera.reset`) — fired when the dock orbit button is clicked.
  onIsoReset: () => void;
  // Laser Panel (docs/specs/008-canvas/laser-panel.md): the pen, owned by useLaserConfig in Canvas (it
  // persists per browser) and edited down here.
  laserConfig?: import('@/lib/laser-config').LaserConfig;
  onChangeLaserField?: <K extends keyof import('@/lib/laser-config').LaserConfig>(
    field: K,
    value: import('@/lib/laser-config').LaserConfig[K],
  ) => void;
  laserPanelPosition?: { x: number; y: number } | null;
  onMoveLaserPanel?: (x: number, y: number) => void;
  onResetLaserPanel?: () => void;
  // Spotlight Panel (docs/specs/008-canvas/spotlight-panel.md): the light's look, owned by useSpotlightConfig
  // in Canvas, plus the live radius the canvas clicks also change.
  spotlightConfig?: import('@/lib/spotlight-config').SpotlightConfig;
  onChangeSpotlightField?: <K extends keyof import('@/lib/spotlight-config').SpotlightConfig>(
    field: K,
    value: import('@/lib/spotlight-config').SpotlightConfig[K],
  ) => void;
  spotlightRadius?: number;
  onSetSpotlightRadius?: (radius: number) => void;
  spotlightPanelPosition?: { x: number; y: number } | null;
  onMoveSpotlightPanel?: (x: number, y: number) => void;
  onResetSpotlightPanel?: () => void;
  // Eraser Panel (docs/specs/008-canvas/eraser-panel.md): the brush's settings, owned by useEraserConfig in
  // Canvas (the erase gesture reads it too).
  eraserConfig?: import('@/lib/eraser-config').EraserConfig;
  onChangeEraserField?: <K extends keyof import('@/lib/eraser-config').EraserConfig>(
    field: K,
    value: import('@/lib/eraser-config').EraserConfig[K],
  ) => void;
  eraserPanelPosition?: { x: number; y: number } | null;
  onMoveEraserPanel?: (x: number, y: number) => void;
  onResetEraserPanel?: () => void;
  // Slide Deck panel (docs/specs/012-collaboration/presentation-mode.md): the sixth tool panel.
  slideDeckPanelPosition?: { x: number; y: number } | null;
  onMoveSlideDeckPanel?: (x: number, y: number) => void;
  onResetSlideDeckPanel?: () => void;
  slideDeck?: import('@/app/design/[id]/useSlideDeck').SlideDeckState;
  // Format Panel (docs/specs/008-canvas/format-panel.md): what the painter copies, owned in editor state
  // (the paint lives there), plus a description of the loaded element.
  formatConfig?: import('@/lib/format-config').FormatConfig;
  onToggleFormatGroup?: (group: import('@/lib/format-config').FormatGroup) => void;
  onSetFormatMode?: (mode: import('@/lib/format-config').FormatMode) => void;
  formatBrushSource?: import('@/components/panels/FormatPanel').FormatBrushSource | null;
  formatPanelPosition?: { x: number; y: number } | null;
  onMoveFormatPanel?: (x: number, y: number) => void;
  onResetFormatPanel?: () => void;
};

export type CanvasChromeProps = CanvasProps & ChromeExtras;

// Per-corner stack container classes (docs/specs/007-editor/panel-docking.md). Each is an absolute,
// pointer-inert flex column pinned to one corner of the dock layer
// (inset 16px = the `*-4` resting inset). Top corners stack downward,
// bottom corners upward (flex-col-reverse) so the first panel always
// sits flush to the corner and the rest flow away from it.
// When the Toolbar strip reaches the top corners (always on a phone, docs/specs/007-editor/toolbar-layout.md
// "On a phone"; on a desktop window too narrow for a centred strip to clear a
// docked panel, stripCrowdsTopCorners) the TOP corner stacks start below it
// rather than at the 16px inset, or a panel docked there (the Collaborate
// banner) renders underneath the strip where it can't be reached
// (toolbarTopClearancePx, lib/canvas-chrome.ts).

const DOCK_CORNER_CLASS: Record<PanelCorner, string> = {
  'top-left': 'left-4 top-4 flex-col items-start',
  'top-right': 'right-4 top-4 flex-col items-end',
  'bottom-left': 'left-4 bottom-4 flex-col-reverse items-start',
  // bottom-right omits `bottom-4`; its bottom is set inline to clear the
  // fixed zoom controls (cornerBottomInset), so panels docked there sit
  // above the zoom bar instead of overlapping it.
  'bottom-right': 'right-4 flex-col-reverse items-end',
};

// The chrome layer of the canvas: empty-state prompt, template picker,
// multi-select toolbar, mode banners, the menu button and Explorer, the
// corner panels, the palette strip, and the zoom / undo cluster. Extracted from Canvas.tsx verbatim; consumes
// Canvas's props plus the computed ChromeExtras.

export function CanvasChrome(props: CanvasChromeProps) {
  const {
    activeDockPanel,
    canRedo,
    canUndo,
    canvasTool,
    designName,
    drawDrag,
    drawHover,
    elements,
    handleDockButtonClick,
    handleSetZoom,
    handleZoomIn,
    handleZoomOut,
    marquee,
    commentRows,
    actionRows,
    onOpenCanvasTheme,
    onConfirmIdentity,
    offscreenContent,
    onFitToScreen,
    onRedo,
    onIsoOrbit,
    onIsoReset,
    onCancelIdentity,
    onUndo,
    pendingDraw,
    penPoints,
    polygonVertices,
    polygonCursor,
    readOnly,
    selfParticipant,
    settings,
    snapGuideStore,
    showIdentityPrompt,
    tabThemeId,
    identityLockedName,
    welcomeOpen,
    wrapperRef,
    zenMode,
    onToggleZen,
  } = props;
  // The view is not a prop here: the parts that show it read it from the viewport store, so a pan or
  // zoom renders them and not this chrome or its panels (docs/specs/008-canvas/blueprints/viewport-store.md).
  const viewport = useViewportStore();
  const readZoom = useCallback(() => viewport.get().zoom, [viewport]);
  // Zen / focus mode (docs/specs/007-editor/zen-mode.md): hide all floating chrome. `chromeHidden`
  // folds it in next to the welcome-flow gate that already suppresses
  // the same panels, so each panel stays hidden in either state.
  const chromeHidden = welcomeOpen || zenMode === true;
  // Panels turned off in Settings (docs/specs/007-editor/user-preferences.md) take their cluster
  // buttons with them (Undo / Redo stay). Read once here and handed to
  // useCanvasChromePanels, so a button and its panel share one value.
  const panelsOn = {
    // Not in Pages mode: a page is laid out by its pages, not layers
    // (docs/specs/007-editor/pages-mode.md).
    layers: panelEnabled(settings, 'layersPanelEnabled') && !props.pagesMode,
    collaborate: panelEnabled(settings, 'collaboratePanelEnabled'),
  };

  // --- Corner docking (docs/specs/007-editor/panel-docking.md) — see useCornerDocking. ---
  const { isMobile, dock, dockLayerRef, cornerRefs, dockingActive, panelWiringFor } =
    useCornerDocking({ zenMode: zenMode === true });
  // Alignment guides while a palette tile is being dragged in (docs/specs/010-palette/palette-drag-ghost.md):
  // the same faint lines a move shows, BEFORE the element exists. The hook
  // also publishes the snap the ghost + drop read, so all three agree.
  const paletteDrag = usePaletteDragGuides({ elements, readZoom, wrapperRef });
  // The drag's snap guides, from the editor's store: a new set renders this chrome only.
  const { snapGuides, distGuides, snapTargets } = useSnapGuides(snapGuideStore);
  // A tick as a move catches an alignment guide (Android; lib/haptics).
  useSnapHaptic(snapGuides.length > 0);
  const { alignGuides, allSnapTargets } = computeDrawGuides({
    drawDrag,
    pendingDraw,
    elements,
    drawHover,
    penPoints,
    snapGuides,
    snapTargets,
  });

  // The palette strip: an editor's (not read-only), or a Participant's
  // (docs/specs/013-workspace/share-roles.md).
  const paletteShown = !readOnly || !!props.participantPalette;
  // The strip only renders with the chrome up.
  const stripShown = paletteShown && !chromeHidden;
  // The Explorer menu button: top-left on desktop; on a phone, its own card at
  // the left of the strip's row, the strip beside it (no room for a corner card
  // above a strip that needs the whole top row). A read-only visitor has no
  // strip, so it keeps the corner there.
  const menuInStrip = isMobile && paletteShown;
  const photoStrip = usePhotoStripTools({
    photo: props.pagesMode?.photo,
    isMobile,
    chromeHidden,
    onSetCanvasTool: props.onSetCanvasTool,
  });
  // A workspace frame puts its Back in the menu button's place (WB59), held sideways too: it is the frame's way out.
  const { workbenchBack } = props;
  const explorerMenuButton = workbenchBack ? (
    <WorkbenchBackButton
      onBack={workbenchBack.back}
      backTitle={workbenchBack.backTitle}
      inline={menuInStrip}
    />
  ) : props.explorerHidden ? null : (
    <ToolbarExplorerButton
      open={activeDockPanel === 'explorer'}
      onToggle={(button) => handleDockButtonClick('explorer', button)}
      inline={menuInStrip}
    />
  );

  // Panel elements + their wiring live in useCanvasChromePanels.
  const {
    panelEls,
    explorerEl,
    layersEl,
    collaborateEl,
    slidesPopoverEl,
    contentsPopoverEl,
    photoPanelOffered,
    photoPopoverEl,
    contentsSidebarEl,
    contentsDocked,
    contentsSide,
    paletteTint,
  } = useCanvasChromePanels({
    props,
    chromeHidden,
    isMobile,
    panelWiringFor,
    panelsOn,
  });

  // Measured against the real top-corner stacks (useStripCrowdsCorners). A
  // stack only renders while it holds a panel, so which top corners are
  // occupied is part of what re-measures. A phone's strip always spans the top.
  const topCornersKey = (['top-left', 'top-right'] as const)
    .map((c) => dock.cornerStacks[c].filter((id) => panelEls[id] != null).join('+'))
    .join('|');
  // UI scale (docs/specs/007-editor/ui-scale.md): the strip, the panels and the
  // bottom-right cluster are drawn at it, so the clearances around them follow.
  const toolbarScale = useUiScale('toolbar');
  const panelScale = useUiScale('panels');
  const cornerScale = useUiScale('cornerButtons');
  // Beside Pages mode's Contents sidebar when it is pinned right (useContentsChrome), never under it.
  const clusterX =
    contentsDocked && contentsSide === 'right' ? CONTENTS_SIDEBAR_WIDTH * panelScale : 0;
  // The bar across the top that the top corners give way to: the strip.
  const topBar = !isMobile && stripShown ? STRIP_SELECTOR : null;
  const topBarCrowds = useStripCrowdsCorners(
    cornerRefs,
    topBar,
    topCornersKey,
    `${toolbarScale}/${panelScale}`,
  );
  const stripSpansTop = stripShown && (isMobile || topBarCrowds);
  // Bucketing keys off the persisted placement ONLY (not which panel is
  // mid-drag): a dragged panel must stay in the same DOM parent for the
  // whole gesture — reparenting it would remount the component and drop
  // the in-flight drag. While lifted it just renders `position: absolute`
  // in place (MovablePanel), and its corner siblings reflow into the gap.
  // The persisted corner/free placement only changes on pointer-up.
  const freePanelIds = PANEL_IDS.filter(
    (id) => panelEls[id] != null && dock.placementOf(id).mode === 'free',
  );
  const snapCorner = dock.drag?.candidate ?? null;
  const snapHeight = dock.drag?.height ?? 0;
  const dockedLayer = dockingActive ? (
    <div ref={dockLayerRef} className="pointer-events-none absolute inset-0 z-[var(--z-panel)]">
      {PANEL_CORNERS.map((corner) => {
        const children = dock.cornerStacks[corner].filter((id) => panelEls[id] != null);
        // Show the live landing slot at the end of the candidate corner's
        // stack (flexbox places it where the panel will actually land).
        const showSlot = snapCorner === corner;
        if (children.length === 0 && !showSlot) return null;
        return (
          <div
            key={corner}
            ref={(el) => {
              cornerRefs.current[corner] = el;
            }}
            style={{
              ...(corner === 'bottom-right'
                ? { bottom: cornerBottomInset(corner, cornerScale) }
                : stripSpansTop && corner.startsWith('top')
                  ? { top: toolbarTopClearancePx(toolbarScale) }
                  : undefined),
              // Beside Pages mode's Contents sidebar, never under it.
              ...(contentsDocked && corner.endsWith(contentsSide)
                ? { [contentsSide]: contentsSidebarClearancePx(panelScale) }
                : undefined),
            }}
            className={`pointer-events-none absolute flex gap-4 ${DOCK_CORNER_CLASS[corner]}`}
          >
            {children.map((id) => (
              <Fragment key={id}>{panelEls[id]}</Fragment>
            ))}
            {showSlot ? <PanelSnapSlot height={snapHeight} /> : null}
          </div>
        );
      })}
      {freePanelIds.map((id) => (
        <Fragment key={id}>{panelEls[id]}</Fragment>
      ))}
    </div>
  ) : null;

  return (
    <>
      {/* The menu button's card at the top left (or a workspace frame's Back), first of the canvas's controls in the
          keyboard order (docs/specs/007-editor/toolbar-layout.md); on a phone it rides in the strip's row instead.
          Zen hides it with the rest of the chrome. */}
      {zenMode || menuInStrip ? null : explorerMenuButton}

      {/* The empty-canvas hint is now a dismissible bottom banner
          (EmptyCanvasBanner), rendered by EditorView alongside the sign-in /
          theme banners rather than a centre-of-canvas card. */}

      {showIdentityPrompt ? (
        <IdentityPrompt
          participant={selfParticipant}
          designName={designName}
          lockedName={identityLockedName}
          onJoin={onConfirmIdentity}
          onCancel={onCancelIdentity}
        />
      ) : null}

      <CanvasGuideOverlay
        alignGuides={paletteDrag.guides.length > 0 ? paletteDrag.guides : alignGuides}
        allSnapTargets={allSnapTargets}
        distGuides={paletteDrag.distGuides.length > 0 ? paletteDrag.distGuides : distGuides}
        drawHover={drawHover}
        marquee={marquee}
        tabThemeId={tabThemeId}
        wrapperRef={wrapperRef}
        mainSize={props.mainSize}
      />

      <CanvasDrawPreview
        drawDrag={drawDrag}
        penPoints={penPoints}
        polygonVertices={polygonVertices}
        polygonCursor={polygonCursor}
        pendingDraw={pendingDraw}
        mirrorPages={
          props.pagesMode ? mirroredLogoPages(props.pagesMode.pages, props.pagesMode.logo) : null
        }
        wrapperRef={wrapperRef}
        mainSize={props.mainSize}
      />

      {/* Top-of-canvas floating chrome (docs/specs/008-canvas/canvas-and-palette.md): owner / role badge, the
          active editor-mode banner and multi-selection toolbar — laid out as one non-overlapping stack. */}
      <TopCenterChrome {...props} />

      {/* The menu button (docs/specs/007-editor/toolbar-layout.md) opens the Explorer as a popover
          (zen hides it, the welcome flow doesn't), and Layers opens as a popover over its cluster
          button. */}
      {!zenMode ? (
        <>
          {explorerEl}
          {layersEl}
        </>
      ) : null}
      {/* The Collaborate popover (docs/specs/012-collaboration/assigned-actions.md §5): it positions
          against the canvas, so it renders outside the corner layer, as Layers does. */}
      {zenMode ? null : collaborateEl}
      {zenMode ? null : slidesPopoverEl}
      {contentsSidebarEl}
      {contentsPopoverEl}
      {photoPopoverEl}
      {paletteShown ? (
        <ToolbarPalette
          key={readOnly ? 'participant' : 'standard'}
          participant={readOnly}
          // Hidden, not unmounted, while the chrome is away (zen, welcome),
          // so the chosen category lasts the page load.
          hidden={chromeHidden}
          canvasTool={canvasTool}
          onSetCanvasTool={photoStrip.onSetCanvasTool}
          photoTools={photoStrip.stripTools}
          onToggleZen={onToggleZen}
          canvasEmpty={elements.length === 0}
          {...pickPaletteAddHandlers(props)}
          pendingDraw={pendingDraw}
          themeTint={paletteTint}
          leading={menuInStrip ? explorerMenuButton : undefined}
          tabElements={elements}
        />
      ) : null}

      {/* A photo page's options flyout while it is in focus, and a phone's tools row (PhotoChrome). */}
      {chromeHidden || !props.pagesMode?.photo?.hasPhotoPage ? null : (
        <PhotoChrome
          photo={props.pagesMode?.photo}
          scale={toolbarScale}
          // Beside a Contents sidebar docked on the left, never under it.
          left={
            contentsDocked && contentsSide === 'left' ? contentsSidebarClearancePx(panelScale) : 12
          }
        />
      )}

      {/* Corner panels (docs/specs/007-editor/panel-docking.md). Distributed into per-corner stack
          containers (with a free layer + snap guides) by `dockedLayer`; in zen they render inline.
          Each element carries its own visibility gate, so the welcome-flow / read-only / zen
          suppression is unchanged. */}
      {dockingActive ? (
        dockedLayer
      ) : (
        <>
          {panelEls.collaborate}
          {panelEls.minimap}
          {panelEls.laser}
          {panelEls.spotlight}
          {panelEls.eraser}
          {panelEls.format}
          {panelEls['slide-deck']}
        </>
      )}

      {/* Bottom-right cluster. Order, left to right: the Undo / Redo
          strip, the mode's own strip (Slides, Plan), the
          Collaborate button (only while the tab has a thread or an action), the Layers and
          Theme & Canvas strip, then the Zoom controls. The buttons open their panels as popovers
          above them (docs/specs/007-editor/live-app.md). */}
      <div
        // Presenting hides this cluster (docs/specs/012-collaboration/presentation-mode.md): zen keeps the zoom controls
        // as its one way back out, and a deck has its own way out plus no
        // zoom to offer.
        data-zoom-cluster=""
        data-region="controls"
        // Drawn at the UI scale, still 16px from the corner, or clear of a landscape notch.
        style={
          cornerScale === 1
            ? { right: atLeastInset(`${16 + clusterX}px`, 'right') }
            : {
                ...uiScaleStyle(cornerScale),
                right: atLeastInset(`${toSurfacePx(16 + clusterX, cornerScale)}px`, 'right'),
                bottom: toSurfacePx(16, cornerScale),
              }
        }
        // On a phone the cluster stays one row: its buttons share the width there is, PHONE_CLUSTER_BUTTON_WIDTH,
        // from 36px up to their usual 44px (always 44px tall to tap), so Undo, Layers and Theme and Fit fill the
        // row on a 360px screen and up. It may still wrap, from the right, on a narrower one, so Undo is never
        // pushed off the screen.
        className={`pointer-events-none absolute bottom-4 right-4 z-[var(--z-panel)] flex items-center gap-2 phone:left-4 phone:flex-wrap phone:justify-end phone:gap-1.5 ${PHONE_CLUSTER_BUTTON_WIDTH} ${PHONE_TOOLBAR_ITEMS}`}
      >
        {welcomeOpen ? null : (
          <>
            {offscreenContent ? <OffscreenContentHint onBringBack={onFitToScreen} /> : null}
            {/* Undo / Redo: see UndoRedoClusterStrip. A Participant undoes its own changes too
                (docs/specs/013-workspace/share-roles.md). */}
            {!zenMode && (!readOnly || !!props.participantPalette) ? (
              <UndoRedoClusterStrip
                onUndo={onUndo}
                onRedo={onRedo}
                canUndo={canUndo}
                canRedo={canRedo}
              />
            ) : null}
            {/* The page navigator (docs/specs/007-editor/pages-mode.md "Getting around the pages"): right of Undo /
                Redo, for every role, while the tab has two pages or more; not on a phone, whose row has no room
                for it (a swipe moves between pages there). */}
            {!zenMode && !isMobile && props.pagesMode && props.pagesMode.pages.length > 1 ? (
              <PageNavigatorClusterStrip
                pageIds={props.pagesMode.pages.map((p) => p.id)}
                onGo={props.pagesMode.focusPage}
              />
            ) : null}
            {/* Contents and Slides (docs/specs/007-editor/pages-mode.md "Contents", "Slides"): in Pages
                mode, one strip where Layers would be. Contents for every role and on a phone too; Slides on a
                desktop only, as the Slide Deck itself is, and an Editor's, since building and presenting a deck
                runs the session (docs/specs/013-workspace/share-roles.md), once a page is a slide: before that
                the deck has nothing to hold. */}
            {!zenMode && props.pagesMode ? (
              <PagesClusterStrip
                contents={
                  // Docked as the sidebar, Contents has no button (useContentsChrome).
                  contentsDocked ? null : (
                    <ContentsClusterSegment
                      popoverOpen={activeDockPanel === 'contents'}
                      onTogglePopover={(button) => handleDockButtonClick('contents', button, true)}
                    />
                  )
                }
                photo={
                  photoPanelOffered ? (
                    <PhotoClusterSegment
                      popoverOpen={activeDockPanel === 'photo-panel'}
                      onTogglePopover={(button) =>
                        handleDockButtonClick('photo-panel', button, true)
                      }
                    />
                  ) : null
                }
                slides={
                  !isMobile && !readOnly && props.slideDeck ? (
                    <SlidesClusterSegment
                      popoverOpen={activeDockPanel === 'slides'}
                      onTogglePopover={(button) => handleDockButtonClick('slides', button, true)}
                    />
                  ) : null
                }
              />
            ) : null}
            {/* Collaborate (docs/specs/012-collaboration/assigned-actions.md §5): before Layers, only while
                the tab has a comment thread or an action. A view-role visitor
                gets it too: they read threads and answer them. */}
            {!zenMode &&
            panelsOn.collaborate &&
            (commentRows.length > 0 || actionRows.length > 0) ? (
              <CollaborateClusterButton
                openCount={kindCounts('open', commentRows, actionRows).all}
                popoverOpen={activeDockPanel === 'collaborate'}
                onTogglePopover={(button) => handleDockButtonClick('collaborate', button, true)}
              />
            ) : null}
            {/* Layers (docs/specs/006-design/layers.md) and the Theme & Canvas brush
                (docs/specs/011-theme/canvas-and-theme-dialog.md, its one entry point; read-only sessions
                pass no handler), one strip in every mode: see LayersThemeStrip. */}
            {!zenMode ? (
              <LayersThemeStrip
                layers={
                  !readOnly && panelsOn.layers
                    ? {
                        open: activeDockPanel === 'layers',
                        onToggle: (button) => handleDockButtonClick('layers', button, true),
                      }
                    : undefined
                }
                onOpenTheme={onOpenCanvasTheme}
              />
            ) : null}
            <ViewZoomControls
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onSetZoom={handleSetZoom}
              onFitToScreen={onFitToScreen}
              onIsoOrbit={canvasTool === 'isometric' ? onIsoOrbit : undefined}
              onIsoReset={canvasTool === 'isometric' ? onIsoReset : undefined}
              onToggleZen={onToggleZen}
              zenActive={zenMode}
              // View-only visitors have no palette (so no canvas-tool
              // dropdown); the dock keeps the enter button for them.
              zenEnterHere={readOnly}
              pinchOnly={isMobile}
            />
          </>
        )}
      </div>
    </>
  );
}
