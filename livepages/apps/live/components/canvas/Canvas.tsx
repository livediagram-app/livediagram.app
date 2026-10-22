import dynamic from 'next/dynamic';
import type { View } from '@/lib/viewport-store';
import { CanvasMenu } from './canvas-menu-context';
import { CanvasFinishProvider } from './CanvasFinishContext';
import { LongPressRing } from '@/components/primitives/LongPressRing';
import { useViewportOf, useViewportStore } from '@/hooks/canvas/useViewportStore';
import { useDoubleTapZoom } from '@/hooks/canvas/useDoubleTapZoom';
import { useSmallElementDoubleTap } from '@/hooks/canvas/useSmallElementDoubleTap';
import { useCallback, useEffect, useMemo, useRef, ViewTransition } from 'react';
import { isAnimatedPattern } from '@livepages/document';
import { tabBackgroundStyle, worldPatternOrigin } from '@/lib/canvas-backgrounds';
import { useObservedSize } from '@/hooks/canvas/useObservedSize';
import { AnimatedCanvasBackground } from '@/components/canvas/AnimatedCanvasBackground';
import { canvasCursorClass } from '@/lib/canvas-chrome';
import { useDockPopovers } from '@/hooks/canvas/useDockPopovers';
import { drawIntentCursor, isWhiteboardPenIntent } from '@/lib/draw-mode';
import { WhiteboardPenPreview } from '@/components/canvas/whiteboard/WhiteboardPenPreview';
import { useCanvasPanAndMarquee } from '@/hooks/canvas/useCanvasPanAndMarquee';
import { useQuickRing } from '@/hooks/canvas/useQuickRing';
import { useZoomControls } from '@/hooks/canvas/useZoomControls';
import { usePaletteDrop } from '@/hooks/canvas/usePaletteDrop';
import { isDarkCanvas } from '@/lib/dark-canvas';
import { CanvasSelectionToolbars } from '@/components/canvas/CanvasSelectionToolbars';
// Reused as the excludeIds argument to snapResizeBounds during draw-
// to-size: the new element doesn't exist yet, so there's nothing to
// exclude. A module-level frozen Set keeps the snap effect from
// allocating a new Set on every pointermove.

import { CanvasChrome } from '@/components/canvas/CanvasChrome';
import { CanvasElementsLayer } from '@/components/canvas/CanvasElementsLayer';
import { PageImageAccessProvider } from '@/components/canvas/page-image-access';
import { CanvasZoomProvider } from '@/components/canvas/CanvasZoomContext';
import { useCanvasLongTaskLog } from '@/hooks/canvas/useCanvasLongTaskLog';
import { useSelectionOf, useSelectionStore } from '@/hooks/canvas/useSelectionStore';
import type { CanvasSelectionInput } from '@/hooks/canvas/useCanvasSelectionView';
import type { Selection } from '@/lib/selection-store';
import { withStableEventProps } from '@/components/primitives/withStableEventProps';
import { MindGrowProvider } from '@/components/canvas/MindGrowContext';
import { MindOutlineProvider, useMindOutlineBadges } from '@/components/canvas/MindOutlineContext';
import { ElementIndicatorStyleProvider } from '@/components/canvas/ElementIndicatorStyleContext';
import { readElementIndicatorStyle } from '@/lib/element-indicator-style';
import { CanvasStillProvider } from '@/components/canvas/CanvasStillContext';
import { CanvasArrivalProvider } from '@/components/canvas/CanvasArrivalContext';
import { CanvasLiveRegion } from '@/components/canvas/CanvasLiveRegion';
import { IsometricDepthLayer } from '@/components/canvas/IsometricDepthLayer';
import { useIsometricView } from '@/hooks/canvas/useIsometricView';
import { SpotlightOverlay } from '@/components/canvas/SpotlightOverlay';
import { EraserBrushRing } from '@/components/canvas/EraserBrushRing';
import { DEFAULT_ERASER_CONFIG, eraserRadius } from '@/lib/eraser-config';
import { WHITEBOARD_ERASER_RADIUS_PX } from '@/lib/whiteboard-tool';
import { routeBoardDoubleClick } from '@/lib/whiteboard-edit-target';
import { useWhiteboardPenCursor } from '@/hooks/canvas/useWhiteboardPenCursor';
import { AvatarWalker } from '@/components/canvas/AvatarWalker';
import { AvatarPadArrivals } from '@/components/canvas/AvatarPadArrivals';
import { parseAvatarStatus } from '@/lib/avatar-status';
import { headPoint } from '@/lib/avatar-speech';
import { avatarScale } from '@/lib/avatar-config';
import { ReactionBurst } from '@/components/canvas/ReactionBurst';

// The footprint a burst is scaled against when it comes from the avatar panel
// rather than a pad: roughly a character, so the particles read as thrown by a
// person rather than by whatever size of pad last set one off.
import { useCanvasAvatar } from './useCanvasAvatar';
import { useCanvasPointer } from './useCanvasPointer';
import { articlePlusBlocked } from '@/lib/article-plus-blocked';
import { useCanvasDrawTools } from './useCanvasDrawTools';

const AVATAR_BURST_PX = 120;
import { parseAvatarConfig } from '@/lib/avatar-config';
import { reactionPose } from '@/lib/avatar-reactions';
import { useOffscreenContent } from '@/hooks/canvas/useOffscreenContent';
import { TabLoadOverlay } from '@/components/canvas/TabLoadOverlay';
import { PaletteDragGhost } from '@/components/canvas/PaletteDragGhost';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { PathDraftLayer } from '@/components/canvas/path/PathDraftLayer';
import { LogoCanvasOverlays } from '@/components/canvas/LogoCanvasOverlays';
import { PathEditLayer } from '@/components/canvas/path/PathEditLayer';
import { PathEditToolbar } from '@/components/canvas/path/PathEditToolbar';
import { useCanvasSurfaceGestures } from '@/hooks/canvas/useCanvasSurfaceGestures';
import { useCanvasSelectHandlers } from '@/hooks/canvas/useCanvasSelectHandlers';
import { useArrowLabelLayouts } from '@/hooks/canvas/useArrowLabelLayouts';
import { useFontEpoch } from '@/components/canvas/useFontEpoch';
import {
  loadArticleFlows,
  loadAvatarSpeechLayer,
  loadCanvasPages,
} from '@/lib/editor-deferred-code';
import { GifOmit } from './GifOmit';
import { SLIDE_VIEW_TRANSITION_UPDATE } from './slide-transition';
import { useStickyPeelVars } from '@/lib/sticky-peel-image';

// Pages mode's pages and their writing draw only on a tab that has pages, so their code loads on demand
// (lib/editor-deferred-code.ts fetches it as the editor mounts).
const CanvasPages = dynamic(loadCanvasPages, { ssr: false });
const ArticleFlows = dynamic(loadArticleFlows, { ssr: false });
// Speech bubbles (docs/specs/008-canvas/avatar-mode.md "Speech bubbles") load the first time somebody speaks:
// nothing on the canvas needs them before then.
const AvatarSpeechLayer = dynamic(loadAvatarSpeechLayer, { ssr: false });

// The canvas boundary (docs/specs/008-canvas/canvas-performance.md "The canvas re-renders only for what it
// shows"): memoised, its `on…` props stable, so an editor render that changes nothing it shows stops here.
export const Canvas = withStableEventProps(CanvasView);

// The canvas is what shows the view (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the
// canvas"): CanvasView subscribes to it; what it renders takes the view only where it shows it.
const wholeView = (v: View) => v;

function CanvasView(props: CanvasProps) {
  const {
    tabLocked,
    readOnly,
    tabBackgroundPattern,
    tabBackgroundColor,
    tabLayers,
    tabBackgroundOpacity,
    tabBackgroundPatternScale,
    tabBackgroundAnimationSpeed,
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
    onCommitFreehand,
    onCommitPolygon,
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
  const { zoom: viewportZoom, offset: viewportOffset } = useViewportOf(wholeView);
  // The zoom when a handler runs, for what is handed down and must keep its identity across zooms.
  const viewportStore = useViewportStore();
  const readZoom = useCallback(() => viewportStore.get().zoom, [viewportStore]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  // A whiteboard pen's own cursor, as chosen in the dock's More flyout.
  const penCursorValue = useWhiteboardPenCursor(
    pendingDraw,
    props.whiteboardDock?.prefs.cursor,
    viewportZoom,
  );

  // Paint mode is the Format canvas tool: it reads as paint mode from its
  // first click (copy cursor, handles/label-drag/dblclick suppressed on boxed
  // elements AND arrows), not only once a source is armed.
  const isPaintMode = canvasTool === 'format';
  // Nudge above the Fit button when everything on the canvas has scrolled out of view.
  // Long tasks, with the gesture they fell in, while the canvas-perf debug scope is on
  // (docs/specs/008-canvas/canvas-performance.md "Observability").
  useCanvasLongTaskLog();
  const offscreenContent = useOffscreenContent(
    elements,
    viewportOffset,
    viewportZoom,
    mainRef,
    props.pagesMode?.pages,
  );
  // The canvas's size, for the pattern's zoom centre (worldPatternOrigin).
  const mainSize = useObservedSize(mainRef) ?? { width: 0, height: 0 };

  // Pan tracking. viewportOffset is owned by the page (so element placement
  // can reason about the visible viewport); we just read/write through props.
  // Which quick-connect ring (if any) is open. Self-contained state + reset /
  // outside-close effects live in useQuickRing.
  // The selection lives in the store (docs/specs/008-canvas/blueprints/selection-store.md): the canvas
  // reads it when a handler runs and subscribes only to the narrow slices it draws.
  const selectionStore = useSelectionStore();
  const [quickRingOpen, setQuickRingOpen] = useQuickRing(selectionStore);
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
  const { pan, setPan, marquee, setMarquee, spaceHeldRef, spaceHeld } = useCanvasPanAndMarquee({
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
    onDropLibraryShape: props.onDropLibraryShape,
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

  // "Are there any arrows" decides whether to mount the ArrowDefs and lay out
  // labels. `some` short-circuits on the first arrow, so the typical render
  // pays O(1).
  const hasArrows = elements.some((el) => el.type === 'arrow');
  // Every arrow label laid out once per element change, avoiding each other
  // (docs/specs/008-canvas/arrow-labels.md). Laid out here, not in the element
  // layer, because the selection toolbars clear a label as part of its arrow.
  const fontEpoch = useFontEpoch();
  const arrowLabels = useArrowLabelLayouts(
    elements,
    hasArrows,
    props.tabFont,
    fontEpoch,
    undefined,
    props.tabFinish,
  );

  // Selection-display derivation (primary element, bounds, and every
  // "show this chrome?" predicate) lives in lib/canvas-selection.ts so
  // it's unit-tested. Memoised because it walks the elements. The chrome that derives it lays a drag in
  // progress over these elements itself (useCanvasSelectionView), so a preview frame renders the
  // chrome and not this canvas (docs/specs/008-canvas/canvas-performance.md "A move re-renders what moved").
  // An object in an article's writing (a chart, an image, a table) connects to nothing: no
  // quick-connect pluses on it (docs/specs/007-editor/article-pages.md "Zones"). A predicate the
  // selection derivation applies, so the canvas itself still doesn't read the selection.
  const articlePages = props.pagesMode?.pages;
  const plusBlocked = useMemo(
    () => articlePlusBlocked(articlePages, elements),
    [articlePages, elements],
  );
  const selectionInput = useMemo<CanvasSelectionInput>(
    () => ({
      elements,
      editingId,
      isPaintMode,
      tabLocked,
      readOnly,
      elementMenuOpen: props.elementMenuOpen === true,
      labelRectOf: arrowLabels.labelRectOf,
      plusBlocked,
    }),
    [
      elements,
      editingId,
      isPaintMode,
      tabLocked,
      readOnly,
      props.elementMenuOpen,
      arrowLabels,
      plusBlocked,
    ],
  );
  // The one selected element when it is a path: the path tool's edit gesture arms on it.
  const soleSelectedPathId = useSelectionOf(
    useCallback(
      (s: Selection) =>
        s.multiSelectedIds.size === 0 &&
        s.selectedId !== null &&
        elements.some((el) => el.id === s.selectedId && el.type === 'path')
          ? s.selectedId
          : null,
      [elements],
    ),
  );

  const { spotlightLook, spotlight, eraserPos, handlePointerMoveCanvas, handlePointerLeaveCanvas } =
    useCanvasPointer({ canvasTool, mainRef, onCanvasPointerMove, wrapperRef, viewportZoom });

  const {
    avatar,
    avatarBurst,
    avatarLook,
    avatarStandingOn,
    avatarStatus,
    padArrivals,
    playAvatarBurst,
    pressModeButton,
    resolvePortal,
    setAvatarBurst,
    setAvatarStatus,
    sittersOf,
    speech,
    speechBubbles,
  } = useCanvasAvatar({
    props,
    canvasTool,
    elements,
    tabLayers,
    mainRef,
    wrapperRef,
    viewportOffset,
    viewportZoom,
    setViewportOffset,
    readZoom,
  });

  // Isometric view (docs/specs/008-canvas/isometric-view.md): the orbit-able camera + the innermost
  // transform fragment, pivoted on the content centre — see
  // useIsometricView. Shift-drag on the canvas spins / tilts it (see
  // the <main> pointerdown handler).
  const { isoCamera, isoFragment } = useIsometricView({ canvasTool, elements, mainRef });

  const cursorClass = canvasCursorClass({
    pendingDraw: !!pendingDraw,
    pan: !!pan,
    marquee: !!marquee,
    canvasTool,
    spaceHeld,
    isPaintMode,
  });

  // Stable selection-routing wrappers for the memo'd element / arrow
  // views — see useCanvasSelectHandlers.
  const { handleElementContextSelect, handleArrowSelect, handleElementClick } =
    useCanvasSelectHandlers({
      inertIds: props.layerInertIds,
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
    penPoints,
    penStroke,
    drawHover,
    polygonVertices,
    polygonCursor,
    handlePolygonDoubleClick,
    pathTool,
    formatPagePress,
    offPage,
    beginPendingDrawOrPolygon,
  } = useCanvasDrawTools({
    props,
    pendingDraw,
    elements,
    canvasTool,
    viewportZoom,
    wrapperRef,
    isPinchingRef,
    onCommitDraw,
    onCommitFreehand,
    onCommitPolygon,
    editingId,
    soleSelectedPathId,
    onDeselect,
  });

  // Bare-surface press routing (capture intercepts, background context
  // menu, pan-vs-marquee) lives in useCanvasSurfaceGestures; the JSX
  // below mounts its handlers verbatim.
  const doubleTap = useDoubleTapZoom(mainRef, viewportStore, { id: props.activeTabId, elements });
  const smallElementTap = useSmallElementDoubleTap(doubleTap.onElement);
  const stickyPeel = useStickyPeelVars();
  const surface = useCanvasSurfaceGestures({
    canvasTool,
    middleMousePan: props.settings?.middleMousePan !== false,
    pendingDraw,
    whiteboard: props.whiteboardDock !== undefined,
    viewportOffset,
    viewportZoom,
    mainRef,
    wrapperRef,
    spaceHeldRef,
    setPan,
    setMarquee,
    spotlight,
    avatar,
    peerAvatars: props.remoteAvatars,
    onPushPeer: props.onAvatarPush,
    isoCamera,
    beginPendingDrawGesture: beginPendingDrawOrPolygon,
    interceptPress: (e) => formatPagePress(e) || pathTool.beginEditPress(e),
    onEraseStart: props.onEraseStart,
    onCanvasContextMenu,
    onDeselect,
    // On a whiteboard a double-click inside a shape edits it (lib/whiteboard-edit-target). On the bare board a
    // finger's double-tap zooms in on the spot, a mouse's double-click drops text
    // (docs/specs/008-canvas/canvas-and-palette.md "Double-tap to zoom").
    onCanvasDoubleClick: (x, y, byFinger) =>
      routeBoardDoubleClick(
        {
          whiteboard: props.editorMode === 'draw',
          elements,
          layers: tabLayers,
          inertIds: props.layerInertIds,
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
  // Mind map (docs/specs/009-elements/mind-node.md): the growers the label editor and the "+" reach.
  const { onGrowMindNode, onAbandonMindNode } = props;
  const mindGrow = useMemo(
    () => ({ grow: onGrowMindNode, abandon: onAbandonMindNode }),
    [onGrowMindNode, onAbandonMindNode],
  );
  // The Edit Outline badge on each map root (MindOutlineContext).
  const mindOutlineBadges = useMindOutlineBadges(
    elements,
    props.canEditMindOutline,
    props.onEditMindOutline,
    props.onTidyMindMap,
  );
  return (
    // This canvas's tab's finish (docs/specs/008-canvas/finish.md), over the editor's active tab's.
    <CanvasFinishProvider finish={props.tabFinish}>
      <CanvasMenu.Provider value={onCanvasContextMenu ?? null}>
        {/* A slide move animates the surface as a View Transition typed by its direction (slide-transition.ts);
            nothing else animates it. */}
        <ViewTransition default="none" update={SLIDE_VIEW_TRANSITION_UPDATE}>
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
              if (!e.isPropagationStopped()) smallElementTap.onPointerDownCapture(e);
            }}
            // A dark backdrop deepens the sticky paper-peel (docs/specs/008-canvas/canvas-and-palette.md): the shadow
            // ink is tuned for light paper and vanishes on a dark wall. Flagged
            // here so the peel's CSS can respond without knowing about themes.
            data-dark-canvas={isDarkCanvas(tabBackgroundColor) ? '' : undefined}
            // The Tab Style colour ease scopes to the canvas (lib/tab-style-ease.ts).
            data-canvas-root=""
            onContextMenuCapture={surface.onContextMenuCapture}
            onContextMenu={surface.onContextMenu}
            onPointerUp={surface.onContextMenuPointerUp}
            onPointerDown={surface.onPointerDown}
            onDoubleClick={(e) => {
              if (e.target !== e.currentTarget) return;
              if (handlePolygonDoubleClick() || pathTool.handlePathDoubleClick()) return;
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
              // The paper hollow arrowheads fill with (arrow-defs.tsx).
              ['--lvd-canvas-paper' as string]: tabBackgroundColor,
              // The sticky notes' paper peel, as a picture (sticky-peel-image.ts).
              ...stickyPeel,
              // In world space: the pattern pans and zooms with the elements, so
              // they stay on the same dots at any zoom (worldPatternOrigin).
              ...tabBackgroundStyle(
                tabBackgroundPattern,
                worldPatternOrigin(viewportOffset, viewportZoom, {
                  w: mainSize.width,
                  h: mainSize.height,
                }),
                tabBackgroundColor,
                tabPatternColor,
                tabBackgroundOpacity,
                tabBackgroundPatternScale * viewportZoom,
              ),
              // Mirror the inner-wrapper cursor on <main>. The inner div is
              // `absolute inset-0` but its CSS transform scales it (zoom),
              // so when zoom is below 1 the hit area shrinks and the
              // surrounding "letterbox" gap falls through to <main>. Without
              // setting cursor here too, the user would see the OS default
              // arrow in that gap while a draw-to-size intent is pending.
              ...(pendingDraw ? { cursor: penCursorValue ?? drawIntentCursor(pendingDraw) } : null),
              ...(pathTool.cursor ? { cursor: pathTool.cursor } : null),
            }}
          >
            {/* SR-only polite live region (docs/specs/004-interface-design/canvas-accessibility.md): selection / delete / undo
          announcements land here. */}
            <CanvasLiveRegion />
            {/* Animated backdrops (docs/specs/008-canvas/canvas-and-palette.md) paint as an ambient overlay behind the
          canvas content; the static patterns ride the <main> background
          above. tabBackgroundStyle returns just the backdrop colour for
          these, so this layer is the only thing that draws their motion. */}
            {isAnimatedPattern(tabBackgroundPattern) ? (
              <AnimatedCanvasBackground
                variant={tabBackgroundPattern}
                color={tabPatternColor}
                scale={tabBackgroundPatternScale}
                speed={tabBackgroundAnimationSpeed}
                opacity={tabBackgroundOpacity}
              />
            ) : null}
            <div
              ref={wrapperRef}
              // The pages and elements, as against the chrome over them (useLogoPaletteSwitch).
              data-canvas-content=""
              onPointerDown={surface.onWrapperPointerDown}
              onDoubleClick={(e) => {
                // Polygon finish-line double-click (docs/specs/008-canvas/polygon-tool.md) wins over the
                // add-text double-click while the intent is armed.
                if (handlePolygonDoubleClick() || pathTool.handlePathDoubleClick()) return;
                // Off a page nothing is made, but a finger's double-tap still zooms there.
                if (offPage(e) && !surface.pressedByFinger()) return;
                surface.onWrapperDoubleClick(e);
              }}
              // Spotlight (docs/specs/008-canvas/canvas-and-palette.md) is a non-editing presenter mode: make the whole
              // canvas layer ignore pointer events so NO element kind can be
              // selected, dragged, or edited (a per-element capture guard can't
              // catch every select path — boxed elements, arrow hit-bands, labels,
              // click vs pointerdown). Clicks then fall through to <main>, where the
              // capture handler turns them into grow / shrink, and middle-mouse or
              // held-Space still pans.
              // Isometric view (docs/specs/008-canvas/isometric-view.md): like Spotlight, the layer goes
              // pointer-events-none so NO element kind can be selected / dragged —
              // it's a read-only view tool. Clicks fall through to <main>, where a
              // drag pans (canvasTool === 'isometric' is added to `wantsPan`).
              // Avatar mode (docs/specs/008-canvas/avatar-mode.md): same treatment for the same reason — the mode
              // is read-only, so the canvas layer goes inert and every click falls
              // through to <main>, where the capture handler turns it into a walk.
              className={`absolute inset-0 origin-center touch-none ${
                canvasTool === 'spotlight' || canvasTool === 'isometric' || canvasTool === 'avatar'
                  ? 'pointer-events-none'
                  : ''
              } ${pendingDraw ? '' : cursorClass}`}
              // Scopes the [data-iso] CSS (globals.css): frames settle just under
              // the base plane while the camera orbits so they can't z-fight
              // (flicker) with the coplanar contents above them.
              data-iso={canvasTool === 'isometric' ? '' : undefined}
              // A whiteboard pen draws wherever it presses, so nothing under it swaps
              // the pen cursor for its own (globals.css, docs/specs/023-draw-mode/draw-mode.md "Pens").
              data-pen-in-hand={
                (pendingDraw?.type === 'freehand' && pendingDraw.variant === 'whiteboard') ||
                pendingDraw?.type === 'path'
                  ? ''
                  : undefined
              }
              data-path-cursor={pathTool.cursor ? '' : undefined}
              style={{
                // Translate is in canvas-coords (applied first); scale is centred
                // on the wrapper so zooming keeps the viewport centre stable.
                // Isometric tilt (docs/specs/008-canvas/isometric-view.md) is appended INNERMOST (last in the list,
                // so it transforms the content first): that keeps the pan translate
                // in screen space, so a drag moves the scene the way the cursor
                // moves at any camera angle. The fragment (built above as
                // isoFragment) pivots the tilt around the content centre so the
                // canvas tilts in place / stays centred while orbiting rather than
                // swinging off-screen. preserve-3d lets the depth layer's
                // translateZ stack read as real extruded height.
                transform: `scale(${viewportZoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)${isoFragment}`,
                ...(canvasTool === 'isometric' ? { transformStyle: 'preserve-3d' as const } : null),
                // Draw-mode cursor: every intent gets a custom inline-SVG
                // cursor (crosshair at the pointer tip plus a small glyph
                // hinting at what's about to land). Without this, tool
                // intents inherited the default arrow cursor because the
                // wrapper drops its Tailwind cursor- class above when
                // pendingDraw is set, leaving no cursor specified at all.
                ...(pendingDraw
                  ? { cursor: penCursorValue ?? drawIntentCursor(pendingDraw) }
                  : null),
                // A path in its edit mode says what a press would do (usePathTool).
                ...(pathTool.cursor ? { cursor: pathTool.cursor } : null),
              }}
            >
              {/* Isometric extrusion (docs/specs/008-canvas/isometric-view.md): per-element raised blocks painted
            behind the real element layer, which caps each column at z=0.
            Only mounted while the tool is active. */}
              {canvasTool === 'isometric' ? <IsometricDepthLayer elements={elements} /> : null}
              {/* Pages mode's A4 pages, under every element (CanvasPages). */}
              {props.pagesMode ? (
                // The image store's access, for the pages' pictures (page-image-access).
                <PageImageAccessProvider access={props.imageContext}>
                  <CanvasPages
                    // Its page state (the palette's pages seen, an open panel, hidden layout cards) is the
                    // tab's own: page ids repeat across tabs.
                    key={props.activeTabId}
                    view={props.pagesMode}
                    zoom={viewportZoom}
                    // Zen, presenting and the isometric view show the sheets alone: no labels, cogs,
                    // layout invites or add button.
                    bare={props.zenMode === true || canvasTool === 'isometric'}
                    placing={!!pendingDraw}
                    onOpenTheme={props.onOpenCanvasTheme}
                  />
                </PageImageAccessProvider>
              ) : null}
              {/* Article pages' writing (ArticleFlows), over the sheets and under the elements, so a
            zone's elements sit in the room the writing leaves them. */}
              {props.pagesMode?.articles && canvasTool !== 'isometric' ? (
                <ArticleFlows
                  view={props.pagesMode}
                  zoom={viewportZoom}
                  interactive={
                    !pendingDraw && canvasTool !== 'spotlight' && canvasTool !== 'avatar'
                  }
                  elements={elements}
                />
              ) : null}
              <CanvasStillProvider still={props.editorMode === 'draw'}>
                <CanvasArrivalProvider
                  tabId={props.activeTabId ?? ''}
                  loaded={props.activeTabLoaded ?? true}
                >
                  {/* The zoom reaches only the counter-scaled parts of each element
              (docs/specs/008-canvas/canvas-performance.md). */}
                  <CanvasZoomProvider zoom={viewportZoom}>
                    <MindGrowProvider value={mindGrow}>
                      <MindOutlineProvider value={mindOutlineBadges}>
                        <ElementIndicatorStyleProvider
                          style={readElementIndicatorStyle(props.settings)}
                        >
                          <CanvasElementsLayer
                            {...props}
                            elements={pathTool.elements}
                            // Portal travel is resolved HERE (Canvas owns the viewport + the avatar),
                            // so the prop from the host is overridden with the local resolver.
                            onEnterPortal={resolvePortal}
                            onFireReaction={props.onFireReaction}
                            reactionBursts={props.reactionBursts}
                            onReactionBurstDone={props.onReactionBurstDone}
                            // Chair (docs/specs/009-elements/chair.md): occupancy resolved here, where peer presence
                            // lives, rather than threaded from the page.
                            chairSitters={sittersOf}
                            // Pressing a Selection Mode button that hands out Avatar mode drops
                            // the character at THAT button (see avatarSpawn), not the viewport
                            // centre: you pressed a thing on the canvas, so the character should
                            // appear where you pressed it.
                            onPressModeButton={pressModeButton}
                            onPressFocusButton={props.onPressFocusButton}
                            hasArrows={hasArrows}
                            arrowLabels={arrowLabels}
                            selectionInput={selectionInput}
                            isPaintMode={isPaintMode}
                            handleArrowSelect={handleArrowSelect}
                            handleElementClick={handleElementClick}
                            handleElementContextSelect={handleElementContextSelect}
                            quickRingOpen={quickRingOpen}
                            setQuickRingOpen={setQuickRingOpen}
                            drawDrag={drawDrag}
                          />
                        </ElementIndicatorStyleProvider>
                      </MindOutlineProvider>
                    </MindGrowProvider>
                  </CanvasZoomProvider>
                </CanvasArrivalProvider>
              </CanvasStillProvider>
              {/* Drafts, the logo page's guides and the avatars: editor-only, left out of an animated GIF
            (GifOmit). */}
              <GifOmit>
                {/* The whiteboard pen's stroke being drawn (docs/specs/023-draw-mode/draw-mode.md "Pens"):
            in this transformed layer, after the elements, laid out as the stroke it lands as, so
            the same layer rasterises both and release changes no pixel. */}
                {penStroke && isWhiteboardPenIntent(pendingDraw) ? (
                  <WhiteboardPenPreview
                    stroke={penStroke}
                    pen={pendingDraw}
                    ink={props.whiteboardInk ?? 'currentColor'}
                    zoom={viewportZoom}
                  />
                ) : null}
                {/* The path being drawn (docs/specs/023-draw-mode/path-tool.md), in the same layer. */}
                {pathTool.draftView ? <PathDraftLayer {...pathTool.draftView} /> : null}
                {/* A logo page's guides, its snap points and Mirror's live twins (LogoCanvasOverlays). */}
                {props.pagesMode ? (
                  <LogoCanvasOverlays
                    view={props.pagesMode}
                    bare={props.zenMode === true || canvasTool === 'isometric'}
                    pendingDraw={pendingDraw}
                    penStroke={penStroke}
                    pathDraft={pathTool.draftView}
                    ink={props.whiteboardInk ?? 'currentColor'}
                    wrapperRef={wrapperRef}
                    zoom={viewportZoom}
                  />
                ) : null}
                {pathTool.editView ? <PathEditLayer {...pathTool.editView} /> : null}
                {/* Avatar mode (docs/specs/008-canvas/avatar-mode.md): the walking characters, INSIDE the
            transformed wrapper so they pan / zoom with the canvas, and after
            the element layer so they stand in front of the content they walk
            over. Peers' characters render whether or not WE are in the mode —
            someone else walking the canvas is worth seeing regardless. */}
                {props.remoteAvatars.map((peer) => (
                  <AvatarWalker
                    key={peer.id}
                    pos={{ x: peer.avatar.x, y: peer.avatar.y }}
                    facing={peer.avatar.facing}
                    // Parsed, not trusted: an older peer omits the costume entirely and
                    // a future one may send an option this build doesn't know.
                    config={parseAvatarConfig(peer.avatar.config)}
                    walking={peer.avatar.walking}
                    stepFrame={peer.avatar.stepFrame}
                    lift={peer.avatar.lift}
                    wave={peer.avatar.wave}
                    seated={!!peer.avatar.seatedOn}
                    // Parsed, not trusted: anything but the two drinks draws an empty hand.
                    holding={
                      peer.avatar.holding === 'water' || peer.avatar.holding === 'coffee'
                        ? peer.avatar.holding
                        : null
                    }
                    status={parseAvatarStatus(peer.avatar.status)}
                    // Replayed locally from the kind + elapsed time in their packet, by
                    // the same pure function the sender used (docs/specs/008-canvas/avatar-mode.md).
                    pose={
                      peer.avatar.reaction
                        ? reactionPose(peer.avatar.reaction.kind, peer.avatar.reaction.elapsedMs)
                        : null
                    }
                    shirt={peer.color}
                    name={peer.name}
                    standingOn={null}
                  />
                ))}
                {/* A Reaction Pad burst (docs/specs/009-elements/reaction-pad.md) thrown around the CHARACTER rather
            than around a pad. Same engine, same particles: the pad and the
            avatar panel are two ways to set off one effect, not two effects.
            Positioned at the character's canvas point, inside the transformed
            wrapper, so it pans and zooms with the canvas it is celebrating. */}
                {avatar.pos && avatarBurst ? (
                  <div
                    className="pointer-events-none absolute"
                    style={{ left: avatar.pos.x, top: avatar.pos.y, width: 0, height: 0 }}
                  >
                    <ReactionBurst
                      reaction={avatarBurst.reaction}
                      seed={avatarBurst.seed}
                      // The character's own footprint, so the burst is scaled to a
                      // person rather than to whatever pad happened to throw it.
                      width={AVATAR_BURST_PX}
                      height={AVATAR_BURST_PX}
                      onDone={() => setAvatarBurst(null)}
                    />
                  </div>
                ) : null}
                {avatar.pos ? (
                  <AvatarWalker
                    pos={avatar.pos}
                    facing={avatar.facing}
                    config={avatarLook.config}
                    walking={avatar.walking}
                    stepFrame={avatar.stepFrame}
                    lift={avatar.lift}
                    wave={avatar.wave}
                    pose={avatar.pose}
                    seated={avatar.seatedOn !== null}
                    holding={avatar.holding}
                    status={avatarStatus}
                    shirt={props.selfParticipant.color}
                    standingOn={avatarStandingOn}
                    onStand={avatar.standUp}
                  />
                ) : null}
                {/* Arrival beams on an Avatar Pad (docs/specs/009-elements/avatar-pad.md), over the characters. */}
                <AvatarPadArrivals arrivals={padArrivals} />
                {/* Speech bubbles, in front of every character: yours and everyone's, and the composer above your
              own head while you type. */}
                {speechBubbles.length > 0 || speech.composerOpen ? (
                  <AvatarSpeechLayer
                    bubbles={speechBubbles}
                    activeTabId={props.activeTabId ?? ''}
                    zoom={viewportZoom}
                    peers={props.remoteAvatars}
                    self={{ name: props.selfParticipant.name, colour: props.selfParticipant.color }}
                    composer={
                      speech.composerOpen && avatar.pos
                        ? {
                            head: headPoint(avatar.pos, avatarScale(avatarLook.config.size)),
                            coolingDown: speech.coolingDown,
                            onSend: (text) => speech.send(text, 'composer'),
                            onCancel: speech.closeComposer,
                          }
                        : null
                    }
                  />
                ) : null}
              </GifOmit>
            </div>

            {/* Spotlight presenter shroud (docs/specs/008-canvas/canvas-and-palette.md). Screen-space sibling of the
          transformed wrapper so the light stays fixed on screen while the
          canvas pans / zooms underneath. Rendered before CanvasChrome so the
          palette + chrome paint ON TOP and stay reachable to switch tools
          back; pointer-events-none lets clicks fall through to <main>. */}
            {/* The eraser's brush ring (docs/specs/008-canvas/eraser-panel.md): the same screen-space layer as
          the shroud, for the same reason — it must not pan or zoom with the
          canvas, and it must never take a pointer event. */}
            {canvasTool === 'eraser' ? (
              <EraserBrushRing
                pos={eraserPos}
                // A whiteboard's brush is fixed per mode (docs/specs/023-draw-mode/draw-mode.md "Eraser").
                radius={
                  props.whiteboardDock
                    ? WHITEBOARD_ERASER_RADIUS_PX[props.whiteboardDock.prefs.eraserMode]
                    : eraserRadius(props.eraserConfig ?? DEFAULT_ERASER_CONFIG)
                }
                filtered={
                  !props.whiteboardDock &&
                  (props.eraserConfig ?? DEFAULT_ERASER_CONFIG).target !== 'anything'
                }
              />
            ) : null}
            {canvasTool === 'spotlight' ? (
              <SpotlightOverlay
                pos={spotlight.pos}
                radius={spotlight.radius}
                config={spotlightLook.config}
              />
            ) : null}

            <CanvasSelectionToolbars
              props={props}
              selectionInput={selectionInput}
              quickRingOpen={quickRingOpen !== null}
            />
            {pathTool.toolbar ? (
              <PathEditToolbar
                {...pathTool.toolbar}
                viewportOffset={viewportOffset}
                zoom={viewportZoom}
              />
            ) : null}

            <CanvasChrome
              {...props}
              // While a path is being drawn, Undo and Redo (the dock's and the corner's) step through its
              // nodes, not the board (docs/specs/023-draw-mode/path-tool.md "Drawing").
              {...(pathTool.history
                ? {
                    canUndo: pathTool.history.canUndo,
                    canRedo: pathTool.history.canRedo,
                    onUndo: pathTool.history.undo,
                    onRedo: pathTool.history.redo,
                  }
                : null)}
              mainSize={mainSize}
              avatarConfig={avatarLook.config}
              onChangeAvatarField={avatarLook.setField}
              laserConfig={props.laserConfig}
              onChangeLaserField={props.onChangeLaserField}
              spotlightConfig={spotlightLook.config}
              onChangeSpotlightField={spotlightLook.setField}
              spotlightRadius={spotlight.radius}
              onSetSpotlightRadius={spotlight.setRadius}
              spotlightPanelPosition={props.spotlightPanelPosition}
              onMoveSpotlightPanel={props.onMoveSpotlightPanel}
              onResetSpotlightPanel={props.onResetSpotlightPanel}
              eraserConfig={props.eraserConfig}
              onChangeEraserField={props.onChangeEraserField}
              formatConfig={props.formatConfig}
              onToggleFormatGroup={props.onToggleFormatGroup}
              onSetFormatMode={props.onSetFormatMode}
              formatBrushSource={props.formatBrushSource}
              formatPanelPosition={props.formatPanelPosition}
              onMoveFormatPanel={props.onMoveFormatPanel}
              onResetFormatPanel={props.onResetFormatPanel}
              eraserPanelPosition={props.eraserPanelPosition}
              onMoveEraserPanel={props.onMoveEraserPanel}
              onResetEraserPanel={props.onResetEraserPanel}
              laserPanelPosition={props.laserPanelPosition}
              onMoveLaserPanel={props.onMoveLaserPanel}
              onResetLaserPanel={props.onResetLaserPanel}
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
              marquee={marquee}
              drawDrag={drawDrag}
              drawHover={drawHover}
              // Off a whiteboard, a marker's live stroke guides off its box as the pencil's does.
              penPoints={
                penPoints ??
                (penStroke && props.editorMode !== 'draw' ? penStroke.points.slice() : null)
              }
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
              onIsoOrbit={isoCamera.startOrbit}
              onIsoReset={isoCamera.reset}
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
          </main>
        </ViewTransition>
      </CanvasMenu.Provider>
    </CanvasFinishProvider>
  );
}
