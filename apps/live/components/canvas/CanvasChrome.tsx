import { ES_LANES } from '@livediagram/diagram';
import { computeDrawGuides } from '@/components/canvas/canvas-draw-guides';
import { CanvasGuideOverlay } from '@/components/canvas/CanvasGuideOverlay';
import { TimelineLanesOverlay } from '@/components/canvas/TimelineLanesOverlay';
import { CanvasDrawPreview } from '@/components/canvas/CanvasDrawPreview';
import { TopCenterChrome } from '@/components/chrome/TopCenterChrome';
// Lazy-load TemplatePicker (1163 lines + its theme / share helpers)
// the same way ExportTabDialog + ShareDialog already are. The picker
// is gated on `showTemplatePicker`, which is false for the common
// path (a returning user opening an existing diagram with tabs that
// already have content). For first-time guests on a fresh diagram
// the gate is true on first paint, but the empty canvas underneath
// has already rendered by then, so the user sees the welcome modal
// fade in a frame later rather than blocking the route on the
// picker's JS. The /live/new entry keeps the static import because
// the picker is the whole UI there.
import dynamic from 'next/dynamic';
const TemplatePicker = dynamic(() =>
  import('@/components/palette/TemplatePicker').then((m) => m.TemplatePicker),
);

import { ThemeBrushIcon } from '@/components/palette/palette-icons';
import { Tooltip } from '@/components/primitives/Tooltip';
import { ZoomControls } from '@/components/chrome/ZoomControls';
import { OffscreenContentHint } from '@/components/canvas/OffscreenContentHint';
import { CanvasMobileDock } from '@/components/canvas/CanvasMobileDock';
import { ToolbarPalette } from '@/components/palette/ToolbarPalette';
import { pickPaletteAddHandlers } from '@/components/palette/palette-add-handlers';
import { ToolbarExplorerButton } from '@/components/chrome/ToolbarExplorerButton';
import { LayersClusterButton } from '@/components/canvas/LayersClusterButton';
import { ActivityClusterStrip } from '@/components/canvas/ActivityClusterStrip';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { Fragment, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { DockAnchor, MobilePanel } from '@/hooks/canvas/useCanvasMobileDock';
import { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import { PanelSnapSlot } from '@/components/canvas/PanelSnapSlot';
import { useCanvasChromePanels } from './useCanvasChromePanels';
import { usePaletteDragGuides } from '@/hooks/canvas/usePaletteDragGuides';
import { PhoneDockProvider } from '@/components/primitives/phone-dock-context';
import { PANEL_CORNERS, PANEL_IDS, cornerBottomInset, type PanelCorner } from '@/lib/panel-layout';
import type { StampGhost } from '@/components/canvas/useStampGhost';

// Values the Canvas computes (selection projection + layout/dock/zoom
// state) and threads into the chrome alongside its own props.
type ChromeExtras = {
  isPaintMode: boolean;
  // True when every element has scrolled out of view: show the nudge above
  // the Fit button (useOffscreenContent in Canvas).
  offscreenContent: boolean;
  marquee: { startX: number; startY: number; currentX: number; currentY: number } | null;
  drawDrag: { startX: number; startY: number; currentX: number; currentY: number } | null;
  // Snapped pointer position while a draw is armed but not yet started
  // (pre-press start-snap preview); null when not armed / not snapped.
  drawHover: { x: number; y: number } | null;
  // The armed fixed-size note's ghost (docs/specs/021-event-storming/event-storming.md Phase 4).
  stamp: StampGhost | null;
  penPoints: { x: number; y: number }[] | null;
  // Polygon tool in-flight state (docs/specs/008-canvas/polygon-tool.md): the placed vertices and
  // the live rubber-band cursor position, both canvas coords.
  polygonVertices: { x: number; y: number }[];
  polygonCursor: { x: number; y: number } | null;
  wrapperRef: RefObject<HTMLDivElement | null>;
  paletteBottomY: number;
  setPaletteBottomY: Dispatch<SetStateAction<number>>;
  explorerBottomY: number;
  setExplorerBottomY: Dispatch<SetStateAction<number>>;
  activeMobilePanel: MobilePanel | null;
  setActiveMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  dockButtonRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  activeDockAnchor: DockAnchor | null;
  setActiveDockAnchor: Dispatch<SetStateAction<DockAnchor | null>>;
  handleDockButtonClick: (id: MobilePanel, ownButton?: HTMLElement, above?: boolean) => void;
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
  // Avatar mode (docs/specs/008-canvas/avatar-mode.md): the character's customisation, owned by
  // useAvatarConfig in Canvas (it persists per browser, so it lives with the
  // sprite rather than in the editor's diagram state) and edited by the
  // Avatar Panel down in the chrome.
  avatarConfig: import('@/lib/avatar-config').AvatarConfig;
  onChangeAvatarField: <K extends keyof import('@/lib/avatar-config').AvatarConfig>(
    field: K,
    value: import('@/lib/avatar-config').AvatarConfig[K],
  ) => void;
  // Roll a whole new character, and play one of the panel's reactions.
  onRandomiseAvatar: () => void;
  onAvatarReaction: (kind: import('@/lib/avatar-reactions').AvatarReactionKind) => void;
  // Throw one of the Reaction Pad's bursts (docs/specs/009-elements/reaction-pad.md) around the character.
  onAvatarBurst?: (reaction: import('@livediagram/diagram').Reaction) => void;
  // Laser Panel (docs/specs/008-canvas/laser-panel.md): the pen, owned by useLaserConfig in Canvas (it
  // persists per browser, like the avatar's costume) and edited down here.
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
  // Highlighter Panel (docs/specs/008-canvas/highlighter.md): the marker's colour + strength, owned by
  // useShapeDrawing (highlighterColor / highlighterWidth below) — the settings
  // that used to hang off the top mode banner.
  highlighterPanelPosition?: { x: number; y: number } | null;
  onMoveHighlighterPanel?: (x: number, y: number) => void;
  onResetHighlighterPanel?: () => void;
  // Slide Deck panel (docs/specs/012-collaboration/presentation-mode.md): the seventh tool panel.
  slideDeckPanelPosition?: { x: number; y: number } | null;
  onMoveSlideDeckPanel?: (x: number, y: number) => void;
  onResetSlideDeckPanel?: () => void;
  slideDeck?: import('@/app/diagram/[id]/useSlideDeck').SlideDeckState;
  // Format Panel (docs/specs/008-canvas/format-panel.md): what the painter copies, owned in editor state
  // (the paint lives there), plus a description of the loaded element.
  formatConfig?: import('@/lib/format-config').FormatConfig;
  onToggleFormatGroup?: (group: import('@/lib/format-config').FormatGroup) => void;
  onSetFormatMode?: (mode: import('@/lib/format-config').FormatMode) => void;
  formatBrushSource?: {
    name: string;
    fill?: string;
    stroke?: string;
    textColor?: string;
  } | null;
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
const DOCK_CORNER_CLASS: Record<PanelCorner, string> = {
  'top-left': 'left-4 top-4 flex-col items-start',
  'top-right': 'right-4 top-4 flex-col items-end',
  'bottom-left': 'left-4 bottom-4 flex-col-reverse items-start',
  // bottom-right omits `bottom-4`; its bottom is set inline to clear the
  // fixed zoom controls (cornerBottomInset), so panels docked there sit
  // above the zoom bar instead of overlapping it.
  'bottom-right': 'right-4 flex-col-reverse items-end',
};

// The floating chrome layer of the canvas: empty-state prompt, template
// picker, multi-select toolbar, mode banners, mobile dock, Explorer, the
// Activity / Comments / Editor / Context panels, the palette, and
// the zoom / undo cluster. Extracted from Canvas.tsx verbatim; consumes
// Canvas's props plus the computed ChromeExtras.

export function CanvasChrome(props: CanvasChromeProps) {
  const {
    activeMobilePanel,
    activityMinimized,
    aiPanel,
    canRedo,
    canUndo,
    canvasTool,
    diagramName,
    dockButtonRefs,
    drawDrag,
    drawHover,
    stamp,
    elements,
    handleDockButtonClick,
    handleSetZoom,
    handleZoomIn,
    handleZoomOut,
    marquee,
    minimalPanels,
    toolbarLayout,
    layersMinimized,
    onToggleLayersMinimized,
    onOpenCanvasTheme,
    onChooseTemplate,
    offscreenContent,
    onFitToScreen,
    onRedo,
    onIsoOrbit,
    onIsoReset,
    onSkipTemplatePicker,
    onToggleActivityMinimized,
    onUndo,
    pendingDraw,
    penPoints,
    polygonVertices,
    polygonCursor,
    highlighterColor,
    highlighterWidth,
    readOnly,
    selfParticipant,
    snapGuides,
    distGuides,
    snapTargets,
    showTemplatePicker,
    tabThemeId,
    templatePickerLockedName,
    templatePickerMode,
    viewportZoom,
    welcomeOpen,
    wrapperRef,
    zenMode,
    onToggleZen,
  } = props;
  // Zen / focus mode (docs/specs/007-editor/zen-mode.md): hide all floating chrome. `chromeHidden`
  // folds it in next to the welcome-flow gate that already suppresses
  // the same panels, so each panel stays hidden in either state.
  const chromeHidden = welcomeOpen || zenMode === true;

  // --- Corner docking (docs/specs/007-editor/panel-docking.md) — see useCornerDocking. ---
  const { isMobile, dock, dockLayerRef, cornerRefs, dockingActive, panelWiringFor } =
    useCornerDocking({
      minimalPanels: minimalPanels === true,
      zenMode: zenMode === true,
      toolbarLayout: toolbarLayout === true,
    });
  // Alignment guides while a palette tile is being dragged in (docs/specs/021-event-storming/event-storming.md):
  // the same faint lines a move shows, BEFORE the element exists. The hook
  // also publishes the snap the ghost + drop read, so all three agree.
  //
  // On an event-storming board, while Alt is held, it additionally offers to
  // INSERT the note between two others (docs/specs/021-event-storming/event-storming.md): the board is a
  // left-to-right timeline, so making room in the middle is the board's most
  // common edit. Never offered where the drop would be refused anyway
  // (read-only, locked tab, blocked active layer), so the preview can't
  // promise something it can't keep.
  const paletteDrag = usePaletteDragGuides({
    elements,
    viewportZoom,
    wrapperRef,
    insertGate: {
      esBoard: props.esBoard === true,
      readOnly,
      tabLocked: props.tabLocked,
      createBlocked: props.createBlocked === true,
    },
    inertIds: props.layerInertIds,
    // Every event-storming board is on lanes; the stack is derived from the
    // board itself, so there is nothing to gate beyond "is this that board".
    timeline: props.esBoard === true ? ES_LANES : null,
  });
  const { alignGuides, allSnapTargets } = computeDrawGuides({
    // A stamp is placed by the lanes, not sized against edges: no box guides.
    drawDrag: stamp ? null : drawDrag,
    pendingDraw,
    elements,
    drawHover,
    penPoints,
    snapGuides,
    snapTargets,
  });

  // Toolbar layout (docs/specs/007-editor/toolbar-layout.md) in force: honoured on a phone too, where it
  // replaces the dock's Palette + Explorer buttons.
  const toolbarActive = toolbarLayout === true;
  // The Explorer menu button: top-left on desktop, the far left of the strip
  // on a phone (no room for both across the top). A read-only visitor has no
  // strip, so it keeps the corner there.
  const menuInStrip = isMobile && !readOnly;
  const explorerMenuButton = (
    <ToolbarExplorerButton
      open={activeMobilePanel === 'explorer'}
      onToggle={(button) => handleDockButtonClick('explorer', button)}
      inline={menuInStrip}
    />
  );

  // Floating panel elements + their wiring live in useCanvasChromePanels.
  const { panelEls, toolbarExplorerEl, toolbarClusterEls, clusterPopovers, paletteTint } =
    useCanvasChromePanels({
      props,
      chromeHidden,
      isMobile,
      dockingActive,
      toolbarActive,
      panelWiringFor,
    });
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
            style={corner === 'bottom-right' ? { bottom: cornerBottomInset(corner) } : undefined}
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
    <PhoneDockProvider value={!toolbarActive}>
      {/* The empty-canvas hint is now a dismissible bottom banner
          (EmptyCanvasBanner), rendered by EditorView alongside the sign-in /
          theme banners rather than a centre-of-canvas card. */}

      {showTemplatePicker ? (
        <TemplatePicker
          mode={templatePickerMode}
          participant={selfParticipant}
          currentThemeId={tabThemeId}
          diagramName={diagramName}
          lockedName={templatePickerLockedName}
          onPick={onChooseTemplate}
          onSkip={onSkipTemplatePicker}
        />
      ) : null}

      {/* Timeline lanes (docs/specs/021-event-storming/event-storming.md Phase 6): the lane a dragged note is
          landing on, lit for the duration of the drag. Beside the guide
          overlay because it is the same kind of thing — help BEFORE the
          drop — and it publishes through its own store, so it costs nothing
          on every other board. */}
      <TimelineLanesOverlay
        timeline={props.esBoard === true ? ES_LANES : null}
        tabThemeId={tabThemeId}
        viewportZoom={viewportZoom}
        wrapperRef={wrapperRef}
      />

      <CanvasGuideOverlay
        alignGuides={paletteDrag.guides.length > 0 ? paletteDrag.guides : alignGuides}
        allSnapTargets={allSnapTargets}
        distGuides={paletteDrag.distGuides.length > 0 ? paletteDrag.distGuides : distGuides}
        drawHover={drawHover}
        viewportZoom={viewportZoom}
        marquee={marquee}
        tabThemeId={tabThemeId}
        wrapperRef={wrapperRef}
      />

      <CanvasDrawPreview
        drawDrag={drawDrag}
        penPoints={penPoints}
        polygonVertices={polygonVertices}
        polygonCursor={polygonCursor}
        highlighterColor={highlighterColor}
        highlighterWidth={highlighterWidth}
        pendingDraw={pendingDraw}
        stamp={stamp}
        viewportZoom={viewportZoom}
        wrapperRef={wrapperRef}
      />

      {/* Top-of-canvas floating chrome (docs/specs/008-canvas/canvas-and-palette.md): owner / role badge, the
          active editor-mode banner, multi-selection toolbar, session timer
          and vote banner — laid out as one non-overlapping stack. */}
      <TopCenterChrome {...props} toolbarLayout={toolbarActive} />

      {/* Toolbar layout (docs/specs/007-editor/toolbar-layout.md): the menu button stands where the
          Explorer would float and opens it as a popover (zen hides it, the
          welcome flow doesn't, same as the Explorer), and the strip replaces
          the Palette for edit sessions. */}
      {toolbarActive && !zenMode ? (
        <>
          {menuInStrip ? null : explorerMenuButton}
          {toolbarExplorerEl}
          {toolbarClusterEls}
        </>
      ) : null}
      {toolbarActive && !readOnly ? (
        <ToolbarPalette
          key={props.esBoard ? 'es-board' : 'standard'}
          // Hidden, not unmounted, while the chrome is away (zen, welcome),
          // so the chosen category lasts the page load.
          hidden={chromeHidden}
          canvasTool={canvasTool}
          onSetCanvasTool={props.onSetCanvasTool}
          onExitAvatarMode={props.onExitAvatarMode}
          onToggleZen={onToggleZen}
          canvasEmpty={elements.length === 0}
          {...pickPaletteAddHandlers(props)}
          pendingDraw={pendingDraw}
          esBoard={props.esBoard}
          esBoardControls={props.esBoardControls}
          themeTint={paletteTint}
          leading={menuInStrip ? explorerMenuButton : undefined}
        />
      ) : null}

      <CanvasMobileDock
        welcomeOpen={chromeHidden}
        minimalPanels={minimalPanels}
        toolbarLayout={toolbarActive}
        readOnly={readOnly}
        hasCollaborate={props.commentRows.length > 0 || props.actionRows.length > 0}
        hasAi={!!aiPanel}
        hasPoll={!!props.pollPanel}
        hasVote={!!props.tabVote}
        hasAvatar={props.canvasTool === 'avatar'}
        hasLaser={props.canvasTool === 'laser'}
        hasSpotlight={props.canvasTool === 'spotlight'}
        hasEraser={props.canvasTool === 'eraser'}
        hasFormat={props.canvasTool === 'format'}
        hasHighlighter={props.canvasTool === 'highlighter'}
        hasSlideDeck={props.canvasTool === 'slide-deck'}
        activeMobilePanel={activeMobilePanel}
        dockButtonRefs={dockButtonRefs}
        onDockButtonClick={handleDockButtonClick}
      />

      {/* Floating panels (docs/specs/007-editor/panel-docking.md). In the desktop docking layout they
          are distributed into per-corner stack containers (with a free
          layer + snap guides) by `dockedLayer`; otherwise — mobile,
          minimal dock, or zen — they render inline where they always
          did. Each element carries its own visibility gate, so the
          welcome-flow / read-only / zen suppression is unchanged.
          Explorer stays visible during the welcome flow; only zen hides
          it. */}
      {dockingActive ? (
        dockedLayer
      ) : (
        <>
          {panelEls.explorer}
          {panelEls.collaborate}
          {panelEls.ai}
          {panelEls.activity}
          {panelEls.palette}
          {panelEls.minimap}
          {panelEls.layers}
          {/* The session panels were missing from this list, so on mobile (and
              any other non-docking layout) they were never rendered at all —
              a live poll or vote simply had no panel. The docked branch above
              iterates PANEL_IDS and so picked them up for free, which is why
              it only ever showed on the layouts that take this path. */}
          {panelEls.poll}
          {panelEls.vote}
          {panelEls.avatar}
          {panelEls.laser}
          {panelEls.spotlight}
          {panelEls.eraser}
          {panelEls.format}
          {panelEls.highlighter}
          {panelEls['slide-deck']}
        </>
      )}

      {/* Bottom-right cluster. Order, left to right: the Activity strip
          (with inline Undo / Redo), the Layers button, the Theme & Canvas
          paintbrush, then the Zoom controls. Activity + Layers minimise into
          their buttons in desktop Floating and open as popovers above them
          everywhere else (clusterPopovers, docs/specs/007-editor/live-app.md). */}
      <div
        // Presenting hides this cluster (docs/specs/012-collaboration/presentation-mode.md): zen keeps the zoom controls
        // as its one way back out, and a deck has its own way out plus no
        // zoom to offer.
        data-zoom-cluster=""
        className="pointer-events-none absolute bottom-4 right-4 z-[var(--z-panel)] flex items-center gap-2"
      >
        {welcomeOpen ? null : (
          <>
            {offscreenContent ? <OffscreenContentHint onBringBack={onFitToScreen} /> : null}
            {/* Activity + Undo / Redo (docs/specs/012-collaboration/activity-and-audit.md): see ActivityClusterStrip. */}
            {!zenMode && !readOnly && (clusterPopovers ? true : activityMinimized) ? (
              <ActivityClusterStrip
                popoverOpen={clusterPopovers && activeMobilePanel === 'activity'}
                onExpand={onToggleActivityMinimized}
                onTogglePopover={
                  !clusterPopovers
                    ? undefined
                    : (button) => handleDockButtonClick('activity', button, true)
                }
                onUndo={onUndo}
                onRedo={onRedo}
                canUndo={canUndo}
                canRedo={canRedo}
              />
            ) : null}
            {/* Layers (docs/specs/006-diagram/layers.md): see LayersClusterButton. */}
            {!zenMode && !readOnly && (clusterPopovers ? true : layersMinimized) ? (
              <LayersClusterButton
                popoverOpen={clusterPopovers && activeMobilePanel === 'layers'}
                onExpand={onToggleLayersMinimized}
                onTogglePopover={
                  !clusterPopovers
                    ? undefined
                    : (button) => handleDockButtonClick('layers', button, true)
                }
              />
            ) : null}
            {/* Theme & Canvas dock button (docs/specs/011-theme/canvas-and-theme-dialog.md): the paintbrush right of
                the Layers dock opens the CanvasThemeDialog — the same modal
                the canvas right-click menu reaches, one click from the
                chrome. All viewports, mobile included — the canvas menu's
                long-press entry isn't discoverable there (read-only
                sessions pass no handler). */}
            {!zenMode && onOpenCanvasTheme ? (
              <div
                data-tour-id="canvas-theme"
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="pointer-events-auto flex animate-pop-in items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
              >
                <Tooltip
                  title="Theme & canvas"
                  description="Change this tab's theme and canvas background."
                >
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={onOpenCanvasTheme}
                    aria-label="Theme and canvas"
                    className="flex h-11 w-11 items-center justify-center text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <ThemeBrushIcon />
                  </button>
                </Tooltip>
              </div>
            ) : null}
            <ZoomControls
              zoom={viewportZoom}
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
    </PhoneDockProvider>
  );
}
