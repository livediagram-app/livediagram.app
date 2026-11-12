import { useViewportStore } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { ES_LANES } from '@livediagram/document';
import { useVoteReviewOpener } from '@/hooks/canvas/useVoteReviewOpener';
import { computeDrawGuides } from '@/components/canvas/canvas-draw-guides';
import { CanvasGuideOverlay } from '@/components/canvas/CanvasGuideOverlay';
import { TimelineLanesOverlay } from '@/components/canvas/TimelineLanesOverlay';
import { CanvasDrawPreview } from '@/components/canvas/CanvasDrawPreview';
import { TopCenterChrome } from '@/components/chrome/TopCenterChrome';
// Lazy-load the visitor name prompt the same way ExportTabDialog + ShareDialog already are. It is gated on
// `showIdentityPrompt`, false on the common path (the owner opening their own document); for a visitor the empty
// canvas underneath has already rendered, so the prompt fades in a frame later rather than blocking the route on its JS.
import dynamic from 'next/dynamic';
const IdentityPrompt = dynamic(
  () => import('@/components/palette/IdentityPrompt').then((m) => m.IdentityPrompt),
  { ssr: false },
);

import { ToolbarPalette } from '@/components/palette/ToolbarPalette';
import { pickPaletteAddHandlers } from '@/components/palette/palette-add-handlers';
import { ToolbarExplorerButton } from '@/components/chrome/ToolbarExplorerButton';
import { WorkbenchBackButton } from '@/components/chrome/WorkbenchChrome';
import { sessionStripTools } from '@/components/canvas/SessionClusterStrip';
import type { CanvasChromeProps } from './CanvasChrome.types';
import { CanvasCornerCluster } from './CanvasCornerCluster';
import { CanvasDockedLayer } from './CanvasDockedLayer';
import { useCallback, useState } from 'react';
import { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import { useCanvasChromePanels } from './useCanvasChromePanels';
import { usePaletteDragGuides } from '@/hooks/canvas/usePaletteDragGuides';
import { STRIP_SELECTOR, useStripCrowdsCorners } from '@/hooks/ui/useStripCrowdsCorners';
import { useSnapHaptic } from '@liveworkspace/workbench/hooks/canvas/useSnapHaptic';
import { WHITEBOARD_DOCK_SELECTOR } from '@/lib/whiteboard-dock-prefs';
import { panelEnabled } from '@/lib/user-preferences';
import { loadWhiteboardDock } from '@/lib/editor-deferred-code';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { useSnapGuides } from '@/hooks/canvas/useSnapGuideState';

// Draw mode's dock shows only on a Draw tab, so its code loads on demand (lib/editor-deferred-code.ts
// fetches it as the editor mounts).
const WhiteboardDock = dynamic(loadWhiteboardDock, { ssr: false });

export type { CanvasChromeProps } from './CanvasChrome.types';

// The chrome layer of the canvas: empty-state prompt, template picker,
// multi-select toolbar, mode banners, the menu button and Explorer, the
// corner panels (CanvasDockedLayer), the palette strip, and the zoom / undo
// cluster (CanvasCornerCluster). Extracted from Canvas.tsx verbatim; consumes
// Canvas's props plus the computed ChromeExtras (CanvasChrome.types.ts).

export function CanvasChrome(props: CanvasChromeProps) {
  const {
    activeDockPanel,
    canvasTool,
    documentName,
    drawDrag,
    drawHover,
    stamp,
    elements,
    handleDockButtonClick,
    marquee,
    onConfirmIdentity,
    onCancelIdentity,
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
    layers: panelEnabled(settings, 'layersPanelEnabled'),
    collaborate: panelEnabled(settings, 'collaboratePanelEnabled'),
  };

  // --- Corner docking (docs/specs/007-editor/panel-docking.md) — see useCornerDocking. ---
  const { isMobile, dock, dockLayerRef, cornerRefs, dockingActive, panelWiringFor } =
    useCornerDocking({ zenMode: zenMode === true });
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
    readZoom,
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
  // The drag's snap guides, from the editor's store: a new set renders this chrome only.
  const { snapGuides, distGuides, snapTargets } = useSnapGuides(snapGuideStore);
  // A tick as a move catches an alignment guide (Android; @liveworkspace/workbench/lib/haptics).
  useSnapHaptic(snapGuides.length > 0);
  const { alignGuides, allSnapTargets } = computeDrawGuides({
    // A stamp is placed by the lanes, not sized against edges: no box guides.
    drawDrag: stamp ? null : drawDrag,
    pendingDraw,
    elements,
    drawHover,
    penPoints,
    snapGuides,
    snapTargets,
    whiteboard: props.editorMode === 'draw',
  });

  // Draw mode trades the palette, the strip and the theme controls for its
  // dock (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows").
  const whiteboard = props.editorMode === 'draw';
  // The Vote button, which a starting results walkthrough opens for whoever drives it.
  const voteButtonRef = useVoteReviewOpener(!!props.voteReview?.canControl, {
    activeDockPanel,
    handleDockButtonClick,
  });
  // The palette strip: an editor's (not read-only), never on a whiteboard, which has its dock; or a Participant's
  // (docs/specs/013-workspace/share-roles.md), on every mode, since it has no dock.
  const paletteShown = (!readOnly && !whiteboard) || !!props.participantPalette;
  // The strip only renders with the chrome up.
  const stripShown = paletteShown && !chromeHidden;
  // The whiteboard's dock, absent for a view-role visitor (nothing to draw with) and while the
  // chrome is away; at the top unless the user chose the bottom (docs/specs/023-draw-mode/draw-mode.md
  // "Where the dock sits").
  const dockShown = whiteboard && !!props.whiteboardDock && !readOnly && !chromeHidden;
  const dockOnTop = dockShown && props.whiteboardDock?.position === 'top';
  // The Explorer menu button: top-left on desktop; on a phone, its own card at
  // the left of the strip's row, the strip beside it (no room for a corner card
  // above a strip that needs the whole top row). A read-only visitor has no
  // strip, and nor does a whiteboard, so it keeps the corner there.
  const menuInStrip = isMobile && paletteShown;
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

  const stripTools = sessionStripTools(props.editorMode, props.esBoard === true);
  // Panel elements + their wiring live in useCanvasChromePanels.
  const {
    panelEls,
    explorerEl,
    layersEl,
    collaborateEl,
    sessionPopoverEl,
    tidyUpPopoverEl,
    paletteTint,
  } = useCanvasChromePanels({
    props,
    stripTools,
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
  // The dock's code loads on demand, so it is drawn a moment after the chrome: the top corners
  // measure against it from the commit it is first drawn in (its onDrawn), never before, when there
  // is nothing on the page to measure. Once drawn its code is in, so a later mount is immediate.
  const [dockDrawn, setDockDrawn] = useState(false);
  const markDockDrawn = useCallback(() => setDockDrawn(true), []);
  // The bar across the top that the top corners give way to: the strip, or a dock at the top.
  const topBar = isMobile
    ? null
    : stripShown
      ? STRIP_SELECTOR
      : dockOnTop && dockDrawn
        ? WHITEBOARD_DOCK_SELECTOR
        : null;
  const topBarCrowds = useStripCrowdsCorners(
    cornerRefs,
    topBar,
    topCornersKey,
    `${toolbarScale}/${panelScale}`,
  );
  const stripSpansTop = stripShown && (isMobile || topBarCrowds);
  const dockSpansTop = dockOnTop && topBarCrowds;

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
          documentName={documentName}
          lockedName={identityLockedName}
          onJoin={onConfirmIdentity}
          onCancel={onCancelIdentity}
          looksOnly={readOnly && !props.takePart}
        />
      ) : null}

      {/* Timeline lanes (docs/specs/021-event-storming/event-storming.md Phase 6): the lane a dragged note is
          landing on, lit for the duration of the drag. Beside the guide
          overlay because it is the same kind of thing — help BEFORE the
          drop — and it publishes through its own store, so it costs nothing
          on every other tab. */}
      <TimelineLanesOverlay
        timeline={props.esBoard === true ? ES_LANES : null}
        tabThemeId={tabThemeId}
        wrapperRef={wrapperRef}
        mainSize={props.mainSize}
      />

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
        stamp={stamp}
        whiteboardInk={whiteboard ? props.whiteboardInk : undefined}
        wrapperRef={wrapperRef}
        mainSize={props.mainSize}
      />

      {/* Top-of-canvas floating chrome (docs/specs/008-canvas/canvas-and-palette.md): owner / role badge, the
          active editor-mode banner, multi-selection toolbar, session timer
          and vote banner — laid out as one non-overlapping stack. */}
      <TopCenterChrome {...props} dockOnTop={dockOnTop} />

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
      {tidyUpPopoverEl}
      {/* The Session strip's popover, in Zen too, as its strip is (docs/specs/012-collaboration/session-tools.md). */}
      {sessionPopoverEl}
      {paletteShown ? (
        <ToolbarPalette
          key={`${props.esBoard ? 'es-board' : 'standard'}${readOnly ? '-participant' : ''}`}
          participant={readOnly}
          // Hidden, not unmounted, while the chrome is away (zen, welcome),
          // so the chosen category lasts the page load.
          hidden={chromeHidden}
          canvasTool={canvasTool}
          onSetCanvasTool={props.onSetCanvasTool}
          onToggleZen={onToggleZen}
          canvasEmpty={elements.length === 0}
          {...pickPaletteAddHandlers(props)}
          pendingDraw={pendingDraw}
          esBoard={props.esBoard}
          esBoardControls={props.esBoardControls}
          themeTint={paletteTint}
          leading={menuInStrip ? explorerMenuButton : undefined}
          tabElements={elements}
        />
      ) : null}

      {/* The whiteboard's dock (docs/specs/023-draw-mode/draw-mode.md): top or bottom centre, in place
          of the palette. */}
      {dockShown && props.whiteboardDock ? (
        <WhiteboardDock
          model={props.whiteboardDock}
          ink={props.whiteboardInk ?? '#1c1917'}
          onDrawn={markDockDrawn}
        />
      ) : null}

      {/* Corner panels (docs/specs/007-editor/panel-docking.md). Distributed into per-corner stack
          containers (with a free layer + snap guides) by `CanvasDockedLayer`; in zen they render inline.
          Each element carries its own visibility gate, so the welcome-flow / read-only / zen
          suppression is unchanged. */}
      {dockingActive ? (
        <CanvasDockedLayer
          dock={dock}
          dockLayerRef={dockLayerRef}
          cornerRefs={cornerRefs}
          panelEls={panelEls}
          topCleared={stripSpansTop || dockSpansTop}
          toolbarScale={toolbarScale}
          cornerScale={cornerScale}
        />
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

      <CanvasCornerCluster
        props={props}
        stripTools={stripTools}
        voteButtonRef={voteButtonRef}
        panelsOn={panelsOn}
        whiteboard={whiteboard}
        isMobile={isMobile}
        cornerScale={cornerScale}
      />
    </>
  );
}
