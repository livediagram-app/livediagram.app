import { canvasIsBusy } from '@/lib/canvas-busy';
import type { View } from '@liveworkspace/workbench/lib/viewport-store';
import { CanvasFinishProvider } from './CanvasFinishContext';
import { LongPressRing } from '@liveworkspace/workbench/components/primitives/LongPressRing';
import {
  useViewportOf,
  useViewportStore,
} from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { useDoubleTapZoom } from '@/hooks/canvas/useDoubleTapZoom';
import { useSmallElementDoubleTap } from '@liveworkspace/workbench/hooks/canvas/useSmallElementDoubleTap';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { tabBackgroundStyle, worldPatternOrigin } from '@/lib/canvas-backgrounds';
import { useObservedSize } from '@liveworkspace/workbench/hooks/canvas/useObservedSize';
import { useNoCanvasTextSelection } from '@liveworkspace/workbench/hooks/canvas/useNoCanvasTextSelection';
import {
  useViewportTransform,
  viewportTransform,
} from '@liveworkspace/workbench/hooks/canvas/useViewportTransform';
import { canvasCursorClass } from '@/lib/canvas-chrome';
import { useDockPopovers } from '@/hooks/canvas/useDockPopovers';
import { drawIntentCursor } from '@/lib/draw-mode';
import { useCanvasPanAndMarquee } from '@/hooks/canvas/useCanvasPanAndMarquee';
import { useZoomControls } from '@liveworkspace/workbench/hooks/canvas/useZoomControls';
import { usePaletteDrop } from '@/hooks/canvas/usePaletteDrop';
import { isDarkCanvas } from '@/lib/dark-canvas';
import { CanvasSelectionToolbars } from '@/components/canvas/CanvasSelectionToolbars';
// Reused as the excludeIds argument to snapResizeBounds during draw-
// to-size: the new element doesn't exist yet, so there's nothing to
// exclude. A module-level frozen Set keeps the snap effect from
// allocating a new Set on every pointermove.

import { CanvasChrome } from '@/components/canvas/CanvasChrome';
import { CanvasElementsLayer } from '@/components/canvas/CanvasElementsLayer';
import { CanvasZoomProvider } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { canvasGestureNow } from '@/lib/canvas-gesture';
import { useCanvasLongTaskLog } from '@liveworkspace/workbench/hooks/canvas/useCanvasLongTaskLog';
import { useSelectionStore } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import type { CanvasSelectionInput } from '@/hooks/canvas/useCanvasSelectionView';
import { withStableEventProps } from '@liveworkspace/workbench/components/primitives/withStableEventProps';
import { ElementIndicatorStyleProvider } from '@/components/canvas/ElementIndicatorStyleContext';
import { readElementIndicatorStyle } from '@liveworkspace/workbench/lib/element-indicator-style';
import { CanvasStillProvider } from '@/components/canvas/CanvasStillContext';
import { CanvasArrivalProvider } from '@liveworkspace/workbench/components/canvas/CanvasArrivalContext';
import { CanvasLiveRegion } from '@liveworkspace/workbench/components/canvas/CanvasLiveRegion';
import { routeBoardDoubleClick } from '@/lib/whiteboard-edit-target';

import { useCanvasAvatar } from './useCanvasAvatar';
import { CanvasCharactersLayer } from './CanvasCharactersLayer';
import { PeopleArrows } from './people-arrows/PeopleArrows';
import { useCanvasPointer } from './useCanvasPointer';
import { useCanvasDrawTools } from './useCanvasDrawTools';
import { useOffscreenContent } from '@/hooks/canvas/useOffscreenContent';
import { TabLoadOverlay } from '@liveworkspace/workbench/components/canvas/TabLoadOverlay';
import { PaletteDragGhost } from '@/components/canvas/PaletteDragGhost';
import { PlacementPreview } from '@/components/canvas/collab/PlacementPreview';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasSurfaceGestures } from '@/hooks/canvas/useCanvasSurfaceGestures';
import { readPeerAvatarRows } from '@/hooks/collab/usePeerRows';
import { useCanvasSelectHandlers } from '@liveworkspace/workbench/hooks/canvas/useCanvasSelectHandlers';
import { SpeakingStageContext } from '@/components/canvas/collab/speaking-stage';
import { useStickyPeelVars } from '@liveworkspace/workbench/lib/sticky-peel-image';
import { isPieceControlPress } from '@/lib/piece-control';
import { useElementReader } from '@/components/canvas/collab/ElementReader';

// The canvas boundary (docs/specs/008-canvas/canvas-performance.md "The canvas re-renders only for what it
// shows"): memoised, its `on…` props stable, so an editor render that changes nothing it shows stops here.
export const Canvas = withStableEventProps(CanvasView);

// The canvas is what shows the view (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the
// canvas"): CanvasView subscribes to it; what it renders takes the view only where it shows it.
const zoomOf = (v: View) => v.zoom;
// livehuddle has no layers (docs/specs/006-document/layers.md): nothing is inert to the shared select handlers.
const NO_INERT_IDS = new Set<string>();

function CanvasView(props: CanvasProps) {
  const {
    readOnly,
    tabBackgroundPattern,
    tabBackgroundColor,
    tabBackgroundOpacity,
    tabBackgroundPatternScale,
    tabPatternColor,
    mainRef,
    isPinchingRef,
    setViewportOffset,
    setViewportZoom,
    elements,
    onSelectMarquee,
    canvasTool,
    onCanvasPointerMove,
    editingId,
    pendingDraw,
    onCommitDraw,
    onDeselect,
    onSelect,
    onCanvasContextMenu,
    onElementContextMenu,
    onMultiContextMenu,
    onShiftSelect,
    onCanvasDoubleClick,
    tabLoadState,
    onRetryTabLoad,
  } = props;
  // The zoom only: a pan, a walk's camera follow among them, moves the wrapper and the floor pattern
  // outside React (useViewportTransform below) and renders no canvas view
  // (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas").
  const viewportZoom = useViewportOf(zoomOf);
  // The view when a handler runs, for what is handed down and must keep its identity across pans and zooms.
  const viewportStore = useViewportStore();
  const readViewportOffset = useCallback(() => viewportStore.get().offset, [viewportStore]);

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Paint mode is the Format canvas tool: it reads as paint mode from its
  // first click (copy cursor, handles/label-drag/dblclick suppressed on
  // elements), not only once a source is armed.
  const isPaintMode = canvasTool === 'format';
  // Nudge above the Fit button when everything on the canvas has scrolled out of view.
  // Long tasks, with the gesture they fell in, while the canvas-perf debug scope is on
  // (docs/specs/008-canvas/canvas-performance.md "Observability").
  useCanvasLongTaskLog(canvasGestureNow);
  const offscreenContent = useOffscreenContent(elements, mainRef);
  // The canvas's size, for the pattern's zoom centre (worldPatternOrigin).
  const mainSize = useObservedSize(mainRef) ?? { width: 0, height: 0 };
  // No text selection starts on the canvas (docs/specs/008-canvas/canvas-performance.md "A press on the canvas
  // selects no text").
  useNoCanvasTextSelection(mainRef);
  // The backdrop for a view. In world space: the pattern pans and zooms with the elements, so they
  // stay on the same dots at any zoom (worldPatternOrigin).
  const backdropFor = (v: View) =>
    tabBackgroundStyle(
      tabBackgroundPattern,
      worldPatternOrigin(v.offset, v.zoom, { w: mainSize.width, h: mainSize.height }),
      tabBackgroundColor,
      tabPatternColor,
      tabBackgroundOpacity,
      tabBackgroundPatternScale * v.zoom,
    );
  // The view now, for this render's wrapper and backdrop; every pan after it is written straight to
  // them (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas").
  const view = useViewportTransform(wrapperRef, mainRef, (v) => {
    const position = backdropFor(v).backgroundPosition;
    return position === undefined ? undefined : String(position);
  });

  // Pan tracking. viewportOffset is owned by the page (so element placement
  // can reason about the visible viewport); we just read/write through props.
  // The selection lives in the store (docs/specs/008-canvas/blueprints/selection-store.md): the canvas
  // reads it when a handler runs and subscribes only to the narrow slices it draws.
  const selectionStore = useSelectionStore();
  // Which panel is open as a popover off its button (the Toolbar Explorer,
  // the cluster popovers). See useDockPopovers; the popover anchor math is
  // the tested computeDockAnchor.
  const {
    activeDockPanel,
    setActiveDockPanel,
    activeDockAnchor,
    setActiveDockAnchor,
    handleDockButtonClick,
  } = useDockPopovers(mainRef);

  // Pan + marquee + held-Space machinery lives in
  // useCanvasPanAndMarquee. The hook owns the pointerdown / move
  // / up listeners and the rect-vs-element marquee intersection,
  // exposes pan / marquee state + setters back so the canvas's
  // own pointerdown handlers can drive it, and exposes the
  // spaceHeldRef the pointerdown reads to decide pan vs marquee (and
  // spaceHeld, its state twin, for the cursor).
  const { pan, setPan, marquee, marqueeStore, setMarquee, spaceHeldRef, spaceHeld } =
    useCanvasPanAndMarquee({
      viewportZoom,
      setViewportOffset,
      elements,
      wrapperRef,
      onDeselect,
      onSelectMarquee,
      onShiftSelect,
      currentSelection: () => {
        const { selectedId, multiSelectedIds } = selectionStore.get();
        return new Set([...multiSelectedIds, ...(selectedId ? [selectedId] : [])]);
      },
      isPinchingRef,
    });

  // Palette drag-drop onto the canvas (onDragOver / onDrop), lifted into
  // usePaletteDrop so the canvas body keeps to layout + pointer routing.
  const paletteDrop = usePaletteDrop({
    onDropFile: props.onDropFile,
    // A tile DRAGGED onto the canvas is an edit too (docs/specs/008-canvas/avatar-mode.md), so it leaves
    // Avatar mode the same way a tile click does — otherwise the element
    // landed while the canvas still read as read-only.
    onDropPalette: props.onDropPalette
      ? (kind, x, y, art) => {
          if (canvasTool === 'avatar') props.onExitAvatarMode?.();
          props.onDropPalette?.(kind, x, y, art);
        }
      : undefined,
    viewportZoom,
    wrapperRef,
  });

  const {
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    setZoomTo: handleSetZoom,
  } = useZoomControls(setViewportZoom);

  // Selection-display derivation (primary element, bounds, and every
  // "show this chrome?" predicate) lives in lib/canvas-selection.ts so
  // it's unit-tested. Memoised because it walks the elements. The chrome that derives it lays a drag in
  // progress over these elements itself (useCanvasSelectionView), so a preview frame renders the
  // chrome and not this canvas (docs/specs/008-canvas/canvas-performance.md "A move re-renders what moved").
  const selectionInput = useMemo<CanvasSelectionInput>(
    () => ({
      elements,
      editingId,
      isPaintMode,
      readOnly,
      elementMenuOpen: props.elementMenuOpen === true,
    }),
    [elements, editingId, isPaintMode, readOnly, props.elementMenuOpen],
  );

  const { handlePointerMoveCanvas, handlePointerLeaveCanvas } = useCanvasPointer({
    onCanvasPointerMove,
    wrapperRef,
    viewportZoom,
  });

  // Peers' characters are read where they are drawn (CanvasCharactersLayer) and here only as by-value facts, so
  // nobody's step renders this canvas (docs/specs/008-canvas/canvas-performance.md "Walking renders the characters,
  // not the canvas").
  const canvasAvatar = useCanvasAvatar({
    props,
    peers: props.peers,
    canvasTool,
    elements,
    mainRef,
    wrapperRef,
    readViewportOffset,
    viewportZoom,
    setViewportOffset,
  });
  const {
    avatar,
    avatarLook,
    avatarStatus,
    playAvatarBurst,
    pressModeButton,
    pressAvatarPad,
    resolvePortal,
    setAvatarStatus,
    sittersOf,
    speakingStage,
    speech,
  } = canvasAvatar;

  const cursorClass = canvasCursorClass({
    pendingDraw: !!pendingDraw,
    pan: !!pan,
    marquee: !!marquee,
    canvasTool,
    spaceHeld,
    isPaintMode,
  });

  // Stable selection-routing wrappers for the memo'd element views, see useCanvasSelectHandlers.
  const { handleElementContextSelect, handleArrowSelect, handleElementClick } =
    useCanvasSelectHandlers({
      inertIds: NO_INERT_IDS,
      isPaintMode,
      readSelection: selectionStore.get,
      onSelect,
      onDeselect,
      onShiftSelect,
      onElementContextMenu,
      onMultiContextMenu,
    });

  const {
    drawDrag,
    drawHover,
    polygonVertices,
    polygonCursor,
    handlePolygonDoubleClick,
    beginPendingDrawOrPolygon,
  } = useCanvasDrawTools({
    props,
    pendingDraw,
    elements,
    viewportZoom,
    wrapperRef,
    isPinchingRef,
    onCommitDraw,
  });

  // Bare-surface press routing (capture intercepts, background context
  // menu, pan-vs-marquee) lives in useCanvasSurfaceGestures; the JSX
  // below mounts its handlers verbatim.
  const doubleTap = useDoubleTapZoom(mainRef, viewportStore, { id: props.activeTabId, elements });
  const smallElementTap = useSmallElementDoubleTap(doubleTap.onElement);
  const stickyPeel = useStickyPeelVars();
  // A walking click on a reading piece opens it large (docs/specs/008-canvas/avatar-mode.md "The reader").
  const elementReader = useElementReader(elements, canvasTool === 'avatar');
  const surface = useCanvasSurfaceGestures({
    canvasTool,
    middleMousePan: props.settings?.middleMousePan !== false,
    pendingDraw,
    whiteboard: false,
    readViewportOffset,
    viewportZoom,
    mainRef,
    wrapperRef,
    spaceHeldRef,
    setPan,
    setMarquee,
    avatar,
    readPeerAvatars: () => readPeerAvatarRows(props.peers),
    onPushPeer: props.onAvatarPush,
    elements,
    onToggleDoor: props.onToggleDoor,
    onReadElement: elementReader.open,
    beginPendingDrawGesture: beginPendingDrawOrPolygon,
    onCanvasContextMenu,
    onDeselect,
    // On a whiteboard a double-click inside a shape edits it (lib/whiteboard-edit-target). On the bare board a
    // finger's double-tap zooms in on the spot, a mouse's double-click drops text
    // (docs/specs/008-canvas/canvas-and-palette.md "Double-tap to zoom").
    onCanvasDoubleClick: (x, y, byFinger) =>
      routeBoardDoubleClick(
        {
          whiteboard: false,
          elements,
        },
        { x, y },
        {
          edit: props.onBeginEdit,
          board: byFinger ? (bx, by) => doubleTap.onCanvas({ x: bx, y: by }) : onCanvasDoubleClick,
        },
      ),
  });

  // Auto-focus the canvas surface on mount so clipboard paste works
  // before the user has clicked anywhere. The browser only dispatches
  // `paste` events on a focusable element; <main> has tabIndex=-1 to
  // be a valid focus target, but it doesn't grab focus by itself.
  // Without this, a freshly-loaded editor swallows Cmd/Ctrl+V silently
  // until the first canvas click. preventScroll keeps the viewport
  // from jumping if the page was scrolled at load time.
  useEffect(() => {
    const node = mainRef && 'current' in mainRef ? mainRef.current : null;
    node?.focus({ preventScroll: true });
  }, [mainRef]);
  return (
    // This canvas's tab's finish (docs/specs/008-canvas/finish.md), over the editor's active tab's.
    <CanvasFinishProvider finish={props.tabFinish}>
      <main
        ref={mainRef}
        // In the tab order (docs/specs/004-interface-design/canvas-accessibility.md): keyboard users Tab to the canvas as
        // one stop, then Tab / Shift+Tab walk the elements (useCanvasA11y,
        // engaged only while this surface itself is focused — the marker
        // attribute below is how the hook recognises it). The role stays
        // the main landmark (not "application") because the floating
        // panels render inside it and must keep normal SR navigation.
        tabIndex={0}
        aria-label="Canvas"
        data-region="canvas"
        data-canvas-a11y-root=""
        onPointerMove={handlePointerMoveCanvas}
        onPointerLeave={handlePointerLeaveCanvas}
        onDragOver={paletteDrop.onDragOver}
        onDrop={paletteDrop.onDrop}
        onPointerDownCapture={(e) => {
          surface.onPointerDownCapture(e);
          // A piece's own control is never a double-tap on its piece either (lib/piece-control).
          if (!e.isPropagationStopped() && !isPieceControlPress(e.target))
            smallElementTap.onPointerDownCapture(e);
        }}
        // A dark backdrop deepens the sticky paper-peel (docs/specs/008-canvas/canvas-and-palette.md): the shadow
        // ink is tuned for light paper and vanishes on a dark wall. Flagged
        // here so the peel's CSS can respond without knowing about themes.
        data-dark-canvas={isDarkCanvas(tabBackgroundColor) ? '' : undefined}
        // The Tab Style colour ease scopes to the canvas (@liveworkspace/workbench/lib/tab-style-ease.ts); on a busy
        // Space it eases this surface alone, the parts snapping (lib/canvas-busy.ts).
        data-canvas-root=""
        data-canvas-busy={canvasIsBusy(elements.length) ? '' : undefined}
        onContextMenuCapture={surface.onContextMenuCapture}
        onContextMenu={surface.onContextMenu}
        onPointerUp={surface.onContextMenuPointerUp}
        onPointerDown={surface.onPointerDown}
        onDoubleClick={(e) => {
          if (e.target !== e.currentTarget) return;
          if (handlePolygonDoubleClick()) return;
          surface.onSurfaceDoubleClick(e);
        }}
        // A finger's double-tap on an element too small to work on frames it before it edits (useSmallElementDoubleTap).
        onDoubleClickCapture={smallElementTap.onDoubleClickCapture}
        // focus-visible ring only: pointer focus stays outline-free, but a
        // keyboard user Tabbing to the canvas sees where they landed.
        // overflow-clip, not overflow-hidden: a hidden box still scrolls (focus revealing a label
        // editor past the bottom edge, a scrollIntoView), and the corner chrome positioned in it (the
        // bottom-right cluster, the Map) rode up the screen by every scroll and stayed there. A
        // clipped box clips the same and can never scroll (docs/specs/008-canvas/canvas-and-palette.md).
        className={`relative flex-1 touch-none select-none overflow-clip outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400/70 [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] ${
          pendingDraw ? '' : cursorClass
        }`}
        style={{
          // The sticky notes' paper peel, as a picture (sticky-peel-image.ts).
          ...stickyPeel,
          ...backdropFor(view),
          // Mirror the inner-wrapper cursor on <main>. The inner div is
          // `absolute inset-0` but its CSS transform scales it (zoom),
          // so when zoom is below 1 the hit area shrinks and the
          // surrounding "letterbox" gap falls through to <main>. Without
          // setting cursor here too, the user would see the OS default
          // arrow in that gap while a draw-to-size intent is pending.
          ...(pendingDraw ? { cursor: drawIntentCursor(pendingDraw) } : null),
        }}
      >
        {/* SR-only polite live region (docs/specs/004-interface-design/canvas-accessibility.md): selection / delete / undo
          announcements land here. */}
        <CanvasLiveRegion />
        <div
          ref={wrapperRef}
          data-canvas-content=""
          onPointerDown={surface.onWrapperPointerDown}
          onDoubleClick={(e) => {
            // The Room Builder's closing double-click (docs/specs/009-elements/room-builder.md) wins over
            // the add-text double-click while the intent is armed.
            if (handlePolygonDoubleClick()) return;
            surface.onWrapperDoubleClick(e);
          }}
          // Avatar mode (docs/specs/008-canvas/avatar-mode.md): the mode is read-only, so the canvas layer
          // ignores pointer events (a per-element capture guard can't catch every select path) and every click falls
          // through to <main>, where the capture handler turns it into a walk.
          className={`absolute inset-0 origin-center touch-none ${
            canvasTool === 'avatar' ? 'pointer-events-none' : ''
          } ${pendingDraw ? '' : cursorClass}`}
          // The same, said to the element plane's children, which take presses of their own (globals.css).
          data-elements-inert={canvasTool === 'avatar' ? '' : undefined}
          style={{
            // Translate is in canvas-coords (applied first); scale is centred
            // on the wrapper so zooming keeps the viewport centre stable.
            transform: viewportTransform(view),
            // Draw-mode cursor: every intent gets a custom inline-SVG
            // cursor (crosshair at the pointer tip plus a small glyph
            // hinting at what's about to land). Without this, tool
            // intents inherited the default arrow cursor because the
            // wrapper drops its Tailwind cursor- class above when
            // pendingDraw is set, leaving no cursor specified at all.
            ...(pendingDraw ? { cursor: drawIntentCursor(pendingDraw) } : null),
          }}
        >
          <CanvasStillProvider still={false}>
            <CanvasArrivalProvider
              tabId={props.activeTabId ?? ''}
              loaded={props.activeTabLoaded ?? true}
              count={elements.length}
            >
              {/* The zoom reaches only the counter-scaled parts of each element
              (docs/specs/008-canvas/canvas-performance.md). */}
              <CanvasZoomProvider zoom={viewportZoom}>
                <SpeakingStageContext value={speakingStage}>
                  <ElementIndicatorStyleProvider style={readElementIndicatorStyle(props.settings)}>
                    <CanvasElementsLayer
                      {...props}
                      // Portal travel is resolved HERE (Canvas owns the viewport + the avatar),
                      // so the prop from the host is overridden with the local resolver.
                      onEnterPortal={resolvePortal}
                      // Chair (docs/specs/009-elements/chair.md): occupancy resolved here, where peer presence
                      // lives, rather than threaded from the page.
                      chairSitters={sittersOf}
                      // Pressing a Selection Mode button that hands out Avatar mode drops
                      // the character at THAT button (see avatarSpawn), not the viewport
                      // centre: you pressed a thing on the canvas, so the character should
                      // appear where you pressed it.
                      // None for a Participant, who is always walking: its buttons draw inert.
                      onPressModeButton={props.onPressModeButton ? pressModeButton : undefined}
                      onPressAvatarPad={pressAvatarPad}
                      onPressFocusButton={props.onPressFocusButton}
                      selectionInput={selectionInput}
                      isPaintMode={isPaintMode}
                      handleArrowSelect={handleArrowSelect}
                      handleElementClick={handleElementClick}
                      handleElementContextSelect={handleElementContextSelect}
                    />
                  </ElementIndicatorStyleProvider>
                </SpeakingStageContext>
              </CanvasZoomProvider>
            </CanvasArrivalProvider>
          </CanvasStillProvider>
          {/* Drafts and the avatars: editor-only. */}
          {/* Where the placed piece being added would land (docs/specs/010-palette/palette-drag-ghost.md
            "Placed pieces preview themselves"). */}
          <PlacementPreview
            pendingDraw={pendingDraw}
            elements={elements}
            wrapperRef={wrapperRef}
            zoom={viewportZoom}
            drawing={!!drawDrag}
          />
          {/* Avatar mode (docs/specs/008-canvas/avatar-mode.md): the walking characters and what rides on them,
            INSIDE the transformed wrapper so they pan / zoom with the canvas, and after the element layer so
            they stand in front of the content they walk over. */}
          <CanvasCharactersLayer props={props} canvasAvatar={canvasAvatar} mainSize={mainSize} />
        </div>

        <CanvasSelectionToolbars props={props} selectionInput={selectionInput} />

        {/* People arrows (docs/specs/008-canvas/people-arrows.md): the way to the people on the tab you cannot see,
          over the canvas and under its controls. */}
        <PeopleArrows peers={props.peers} />

        <CanvasChrome
          {...props}
          mainSize={mainSize}
          avatarConfig={avatarLook.config}
          onChangeAvatarField={avatarLook.setField}
          formatConfig={props.formatConfig}
          onToggleFormatGroup={props.onToggleFormatGroup}
          onSetFormatMode={props.onSetFormatMode}
          formatBrushSource={props.formatBrushSource}
          formatPanelPosition={props.formatPanelPosition}
          onMoveFormatPanel={props.onMoveFormatPanel}
          onResetFormatPanel={props.onResetFormatPanel}
          onRandomiseAvatar={avatarLook.randomise}
          avatarStatus={avatarStatus}
          onSetAvatarStatus={setAvatarStatus}
          onSendAvatarMessage={
            speech.speaking ? (text: string) => speech.send(text, 'panel') : undefined
          }
          avatarSpeechCooling={speech.coolingDown}
          onAvatarReaction={avatar.playReaction}
          onAvatarBurst={playAvatarBurst}
          offscreenContent={offscreenContent}
          marquee={marqueeStore}
          drawDrag={drawDrag}
          drawHover={drawHover}
          polygonVertices={polygonVertices}
          polygonCursor={polygonCursor}
          wrapperRef={wrapperRef}
          activeDockPanel={activeDockPanel}
          setActiveDockPanel={setActiveDockPanel}
          activeDockAnchor={activeDockAnchor}
          setActiveDockAnchor={setActiveDockAnchor}
          handleDockButtonClick={handleDockButtonClick}
          handleZoomIn={handleZoomIn}
          handleZoomOut={handleZoomOut}
          handleSetZoom={handleSetZoom}
        />
        {/* Lazy per-tab load (docs/specs/006-document/per-tab-storage.md). Last child + z-[var(--z-overlay)] so it covers the
          canvas AND the floating palette, blocking any edit that would
          otherwise overwrite an unfetched tab's real content. */}
        {tabLoadState && tabLoadState !== 'ready' ? (
          <TabLoadOverlay state={tabLoadState} onRetry={() => onRetryTabLoad?.()} />
        ) : null}
        {/* Drag-to-add ghost (docs/specs/010-palette/palette-drag-ghost.md): previews where a dragged palette shape
          will land, following the cursor over the canvas. */}
        <PaletteDragGhost zoom={viewportZoom} />
        {/* Map (docs/specs/008-canvas/minimap.md) now renders inside CanvasChrome's docking layer
          (docs/specs/007-editor/panel-docking.md) so it snaps + stacks like the other floating panels. */}
        {/* Touch long-press "hold" ring at the finger: the docs/specs/008-canvas/canvas-and-palette.md
            press-and-hold affordance that opens the context menu on touch. */}
        <LongPressRing point={surface.canvasLongPress.pressPoint} />
        {elementReader.reader}
      </main>
    </CanvasFinishProvider>
  );
}
