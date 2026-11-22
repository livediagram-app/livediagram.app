import { usePageHasAncestors } from '@/components/page-tree/PageBreadcrumb';
import { canvasIsBusy } from '@liveworkspace/workbench/lib/tab-style-ease';
import { CanvasFinishProvider } from '@liveworkspace/workbench/components/canvas/CanvasFinishContext';
import { LongPressRing } from '@liveworkspace/workbench/components/primitives/LongPressRing';
import { useCallback, useRef, ViewTransition } from 'react';
import { useFocusCanvasOnMount } from '@liveworkspace/workbench/hooks/canvas/useFocusCanvasOnMount';
import {
  articleMarginPx,
  articleTopMarginPx,
  isAnimatedPattern,
  isContinuousPage,
} from '@liveknowledge/document';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { PageSurfaceSheet } from '@/components/page-surface/PageSurfaceSheet';
import { useDrawingZoneEditing } from '@/lib/page-surface/drawing-zone-store';
import { WORLD_HEIGHT_CSS } from '@/lib/page-surface/page-lock';
import { releaseReadSelection } from '@/lib/page-surface/read-selection';
import { usePageSurface } from './usePageSurface';
import { PageCoverBand } from '@/components/page-cover/PageCoverBand';
import { usePageHasCover } from '@/components/page-cover/page-cover-state';
import { canvasMainStyle, canvasWorldStyle } from './canvas-main-style';
import { imageBackingInsetAttribute } from '@liveknowledge/document';
import { useObservedSize } from '@liveworkspace/workbench/hooks/canvas/useObservedSize';
import { useNoCanvasTextSelection } from '@liveworkspace/workbench/hooks/canvas/useNoCanvasTextSelection';
import { AnimatedCanvasBackground } from '@/components/canvas/AnimatedCanvasBackground';
import { canvasCursorClass } from '@/lib/canvas-chrome';
import { useDockPopovers } from '@/hooks/canvas/useDockPopovers';
import { useCanvasPanAndMarquee } from '@/hooks/canvas/useCanvasPanAndMarquee';
import { useQuickRing } from '@liveworkspace/workbench/hooks/canvas/useQuickRing';
import { useZoomControls } from '@liveworkspace/workbench/hooks/canvas/useZoomControls';
import { usePaletteDrop } from '@/hooks/canvas/usePaletteDrop';
import { isDarkCanvas } from '@/lib/dark-canvas';
import { CanvasSelectionToolbars } from '@/components/canvas/CanvasSelectionToolbars';
// Reused as the excludeIds argument to snapResizeBounds during draw-
// to-size: the new element doesn't exist yet, so there's nothing to
// exclude. A module-level frozen Set keeps the snap effect from
// allocating a new Set on every pointermove.

import { CanvasChrome } from '@/components/canvas/CanvasChrome';
import { useCanvasChromeProps } from '@/components/canvas/canvas-chrome-props';
import { CanvasElementsLayer } from '@/components/canvas/CanvasElementsLayer';
import { PageImageAccessProvider } from '@/components/canvas/page-image-access';
import { CanvasZoomProvider } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { canvasGestureNow } from '@liveworkspace/workbench/lib/canvas-gesture';
import { useCanvasLongTaskLog } from '@liveworkspace/workbench/hooks/canvas/useCanvasLongTaskLog';
import { useSelectionStore } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { useKeyboardElementMenu } from '@/hooks/canvas/useKeyboardElementMenu';
import { withStableEventProps } from '@liveworkspace/workbench/components/primitives/withStableEventProps';
import { ElementIndicatorStyleProvider } from '@liveworkspace/workbench/components/canvas/ElementIndicatorStyleContext';
import { readElementIndicatorStyle } from '@liveworkspace/workbench/lib/element-indicator-style';
import { CanvasArrivalProvider } from '@liveworkspace/workbench/components/canvas/CanvasArrivalContext';
import { CanvasLiveRegion } from '@liveworkspace/workbench/components/canvas/CanvasLiveRegion';
import { SpotlightOverlay } from '@liveworkspace/workbench/components/canvas/SpotlightOverlay';
import { useCanvasPointer } from './useCanvasPointer';
import { useCanvasDrawTools } from './useCanvasDrawTools';
import { useCanvasSelectionInput } from './useCanvasSelectionInput';

import { TabLoadOverlay } from '@liveworkspace/workbench/components/canvas/TabLoadOverlay';
import { PaletteDragGhost } from '@/components/canvas/PaletteDragGhost';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasSurfaceGestures } from '@/hooks/canvas/useCanvasSurfaceGestures';
import { useCanvasSelectHandlers } from '@liveworkspace/workbench/hooks/canvas/useCanvasSelectHandlers';
// Pages mode's pages and their writing draw only on a tab that has pages, so their code loads on demand
// (lib/editor-deferred-code.ts fetches it as the editor mounts, and before a warm paint).
import { ArticleFlows, CanvasPages } from '@/lib/editor-deferred-code';
import { SLIDE_VIEW_TRANSITION_UPDATE } from '@liveworkspace/workbench/components/canvas/slide-transition';
import { useStickyPeelVars } from '@liveworkspace/workbench/lib/sticky-peel-image';

// The canvas boundary (docs/specs/008-canvas/canvas-performance.md "The canvas re-renders only for what it
// shows"): memoised, its `on…` props stable, so an editor render that changes nothing it shows stops here.
export const Canvas = withStableEventProps(CanvasView);

// The canvas draws its world at the page's lock (docs/specs/030-knowledgebase/blueprints/page-surface.md "The
// lock"): a fixed view, changed by a resize and never by a scroll, so scrolling the page renders nothing here.

function CanvasView(props: CanvasProps) {
  const {
    tabLocked,
    readOnly,
    tabBackgroundPattern,
    tabBackgroundColor,
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
  // The open page, its column locked to the middle of the surface and scrolled by the window (usePageSurface).
  const leadPage = props.pagesMode?.pages[0];
  const leadStyle = leadPage?.flow
    ? props.pagesMode?.articles?.flows[leadPage.flow]?.style
    : undefined;
  const pageMargin = articleMarginPx(leadStyle);
  // A knowledgebase page's cover band (page-surface.md "The cover") stands over its top room.
  const continuousPage = !!leadPage && isContinuousPage(leadPage);
  const hasCover = usePageHasCover() && continuousPage;
  const hasCrumbs = usePageHasAncestors();
  const { view: lockedView, scrollerRef } = usePageSurface({
    mainRef,
    page: leadPage?.rect,
    margin: pageMargin,
    topMargin: articleTopMarginPx(leadStyle),
    hasCover,
    crumbs: hasCrumbs,
  });
  const phone = useIsMobileViewport();
  const { zoom: viewportZoom, offset: viewportOffset } = lockedView;

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Paint mode is the Format canvas tool: it reads as paint mode from its
  // first click (copy cursor, handles/label-drag/dblclick suppressed on boxed
  // elements AND arrows), not only once a source is armed.
  const isPaintMode = canvasTool === 'format';
  // Nudge above the Fit button when everything on the canvas has scrolled out of view.
  // Long tasks, with the gesture they fell in, while the canvas-perf debug scope is on
  // (docs/specs/008-canvas/canvas-performance.md "Observability").
  useCanvasLongTaskLog(canvasGestureNow);
  // Nothing is ever lost off screen on a page that only scrolls: there is no Fit to bring it back with.
  const offscreenContent = false;
  // The canvas's size, for the pattern's zoom centre (worldPatternOrigin).
  const mainSize = useObservedSize(mainRef) ?? { width: 0, height: 0 };
  // The chrome's own props, its pages view and the writing it leaves out (docs/specs/007-editor/blueprints/
  // typing.md "Performance and limits"): a typing commit changes only the writing, which Contents reads from its
  // store.
  const chromeProps = useCanvasChromeProps(props);
  // No text selection starts on the canvas (docs/specs/008-canvas/canvas-performance.md "A press on the canvas
  // selects no text").
  useNoCanvasTextSelection(mainRef);

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

  const drawingZone = useDrawingZoneEditing();
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
      isPinchingRef,
      spacePan: drawingZone,
    });
  // Outside a drawing zone being edited the page has none of the engine's bare-ground gestures
  // (docs/specs/030-knowledgebase/page-surface.md "No zoom and no panning"): no held-Space or middle-button drag,
  // and no marquee. A press on the ground only lets go of what was selected; selecting text is the browser's own.
  const pressGround = useCallback(
    (next: Parameters<typeof setMarquee>[0]) => {
      if (drawingZone) setMarquee(next);
      else if (next) onDeselect();
      else setMarquee(null);
    },
    [drawingZone, setMarquee, onDeselect],
  );
  const dragView = useCallback(
    (next: Parameters<typeof setPan>[0]) => {
      if (drawingZone || !next) setPan(next);
    },
    [drawingZone, setPan],
  );

  // Palette drag-drop onto the canvas (onDragOver / onDrop), lifted into
  // usePaletteDrop so the canvas body keeps to layout + pointer routing.
  const paletteDrop = usePaletteDrop({
    onDropFile: props.onDropFile,
    onDropLibraryItem: props.onDropLibraryItem,
    onDropPalette: props.onDropPalette,
    viewportZoom,
    wrapperRef,
  });

  const {
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    setZoomTo: handleSetZoom,
  } = useZoomControls(setViewportZoom);

  // Every arrow label, laid out once per element change, the page stack's staging and what the
  // selection chrome derives from (useCanvasSelectionInput).
  const { hasArrows, arrowLabels, staged, selectionInput } = useCanvasSelectionInput({
    elements,
    editingId,
    isPaintMode,
    tabLocked,
    readOnly,
    pagesMode: props.pagesMode,
    tabFont: props.tabFont,
    tabFinish: props.tabFinish,
    elementMenuOpen: props.elementMenuOpen,
  });
  const { spotlightLook, spotlight, handlePointerMoveCanvas, handlePointerLeaveCanvas } =
    useCanvasPointer({ canvasTool, mainRef, onCanvasPointerMove, wrapperRef, viewportZoom });

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
    drawHover,
    polygonVertices,
    polygonCursor,
    handlePolygonDoubleClick,
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
    onCommitPolygon,
  });

  // Menu key / Shift+F10 on the canvas opens the selected element's menu (no toolbar to Tab to).
  useKeyboardElementMenu(mainRef, selectionStore.get, handleElementContextSelect);

  // Bare-surface press routing (capture intercepts, background context
  // menu, pan-vs-marquee) lives in useCanvasSurfaceGestures; the JSX
  // below mounts its handlers verbatim.
  const stickyPeel = useStickyPeelVars();
  const surface = useCanvasSurfaceGestures({
    canvasTool,
    // The middle button is the browser's own on a page (its autoscroll); a drawing being edited drags its view.
    middleMousePan: drawingZone,
    pendingDraw,
    viewportOffset,
    viewportZoom,
    mainRef,
    wrapperRef,
    spaceHeldRef,
    setPan: dragView,
    setMarquee: pressGround,
    spotlight,
    beginPendingDrawGesture: beginPendingDrawOrPolygon,
    interceptPress: formatPagePress,
    onCanvasContextMenu,
    onDeselect,
    // A finger's double-tap zooms nothing (the browser's zoom is the page's); a mouse's double-click is the
    // engine's own.
    onCanvasDoubleClick: (x, y, byFinger) => {
      if (!byFinger) onCanvasDoubleClick(x, y);
    },
  });

  // Focus the canvas on mount, so a paste works before the first click (useFocusCanvasOnMount).
  useFocusCanvasOnMount(mainRef);
  return (
    // The image store's access (page-image-access): the pages' pictures, and the Contents
    // thumbnails' pictures in the chrome.
    <PageImageAccessProvider access={props.imageContext}>
      {/* This canvas's tab's finish (docs/specs/008-canvas/finish.md), over the editor's active tab's. */}
      <CanvasFinishProvider finish={props.tabFinish}>
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
            onPointerDownCapture={surface.onPointerDownCapture}
            // A dark backdrop deepens the sticky paper-peel (docs/specs/008-canvas/canvas-and-palette.md): the shadow
            // ink is tuned for light paper and vanishes on a dark wall. Flagged
            // here so the peel's CSS can respond without knowing about themes.
            data-dark-canvas={isDarkCanvas(tabBackgroundColor) ? '' : undefined}
            // The Tab Style colour ease scopes to the canvas (@liveworkspace/workbench/lib/tab-style-ease.ts); on a busy
            // canvas it eases this surface alone, the parts snapping (canvasIsBusy).
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
            // focus-visible ring only: pointer focus stays outline-free, but a
            // keyboard user Tabbing to the canvas sees where they landed.
            // overflow-clip, not overflow-hidden: a hidden box still scrolls (focus revealing a label
            // editor past the bottom edge, a scrollIntoView), and the corner chrome positioned in it (the
            // bottom-right cluster, the Map) rode up the screen by every scroll and stayed there. A
            // clipped box clips the same and can never scroll (docs/specs/008-canvas/canvas-and-palette.md).
            className={`relative flex-1 select-none overflow-clip outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400/70 [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] ${
              pendingDraw ? '' : cursorClass
            }`}
            style={canvasMainStyle({
              tabBackgroundPattern,
              tabBackgroundColor,
              tabPatternColor,
              tabBackgroundOpacity,
              tabBackgroundPatternScale,
              stickyPeel,
              viewportOffset,
              viewportZoom,
              mainSize,
              pendingDraw,
            })}
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
            {/* The page's scroll container (docs/specs/030-knowledgebase/page-surface.md "A reading column"): the
                world is laid in it at the lock, so the wheel, the scrollbar, Page Up and Down, Home and End and the
                browser's find move the page as they move any web page, and a pinch or Ctrl/Cmd-wheel is the
                browser's own zoom. The chrome stays over it, outside what scrolls. */}
            <div
              ref={scrollerRef}
              data-page-scroller=""
              // A press off the writing lets go of a reader's selection in it (lib/page-surface/read-selection.ts).
              onPointerDownCapture={(e) => releaseReadSelection(e.target)}
              // A page is shown at 100% and re-wraps to a narrow window (the narrow view), so nothing scrolls sideways.
              className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]"
            >
              <div
                ref={wrapperRef}
                // The pages and elements, as against the chrome over them.
                data-canvas-content=""
                onPointerDown={surface.onWrapperPointerDown}
                onDoubleClick={(e) => {
                  // Polygon finish-line double-click (docs/specs/008-canvas/polygon-tool.md) wins over the
                  // add-text double-click while the intent is armed.
                  if (handlePolygonDoubleClick()) return;
                  // Off a page nothing is made, but a finger's double-tap still zooms there.
                  if (offPage(e) && !surface.pressedByFinger()) return;
                  surface.onWrapperDoubleClick(e);
                }}
                // Its box ends PAGE_TOP_ROOM short of the scroll container's foot (worldHeight, page-lock.ts), so the
                // box itself is never something to scroll to. The ground's cursor is the plain one outside a drawing
                // being edited: the page has no marquee to promise.
                className={`absolute inset-x-0 top-0 origin-center ${
                  pendingDraw ? '' : drawingZone ? cursorClass : 'cursor-default'
                }`}
                // The inset the white under each picture needs at this zoom (docs/specs/009-elements/images.md "The
                // white under a picture"): an attribute the stylesheet reads for the pictures alone, so no picture
                // re-renders on zoom and nothing else restyles; it changes only below 50%.
                {...imageBackingInsetAttribute(viewportZoom)}
                style={{
                  ...canvasWorldStyle(viewportZoom, viewportOffset, pendingDraw),
                  height: WORLD_HEIGHT_CSS,
                }}
              >
                {/* Pages mode's A4 pages, under every element (CanvasPages). */}
                {staged && leadPage && isContinuousPage(leadPage) ? (
                  // A knowledgebase page paints no sheet (PageSurfaceSheet): its box, its breadcrumb, its foot room.
                  <PageSurfaceSheet
                    key={leadPage.id}
                    page={leadPage}
                    zoom={viewportZoom}
                    margin={pageMargin}
                    topMargin={articleTopMarginPx(leadStyle)}
                    bare={props.zenMode === true}
                    mobile={phone}
                  />
                ) : staged ? (
                  // An article kept in a paper size (an imported livedocuments tab) still draws the fork's sheets.
                  <CanvasPages
                    // Its page state (the palette's pages seen, an open panel, hidden layout cards) is the
                    // tab's own: page ids repeat across tabs.
                    key={props.activeTabId}
                    view={staged}
                    zoom={viewportZoom}
                    // Zen and presenting show the sheets alone: no labels, cogs, or add
                    // button.
                    bare={props.zenMode === true}
                    placing={!!pendingDraw}
                  />
                ) : null}
                {/* Article pages' writing (ArticleFlows), over the sheets and under the elements, so a
            zone's elements sit in the room the writing leaves them. */}
                {staged?.articles ? (
                  <ArticleFlows
                    view={staged}
                    zoom={viewportZoom}
                    interactive={!pendingDraw && canvasTool !== 'spotlight'}
                    elements={elements}
                  />
                ) : null}
                <CanvasArrivalProvider
                  tabId={props.activeTabId ?? ''}
                  loaded={props.activeTabLoaded ?? true}
                  count={elements.length}
                >
                  {/* The zoom reaches only the counter-scaled parts of each element
              (docs/specs/008-canvas/canvas-performance.md). */}
                  <CanvasZoomProvider zoom={viewportZoom}>
                    <ElementIndicatorStyleProvider
                      style={readElementIndicatorStyle(props.settings)}
                    >
                      <CanvasElementsLayer
                        {...props}
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
                  </CanvasZoomProvider>
                </CanvasArrivalProvider>
              </div>
              {/* Over the world's top room, so it scrolls with the page and takes its own presses. */}
              {hasCover ? <PageCoverBand /> : null}
            </div>

            {/* Spotlight presenter shroud (docs/specs/008-canvas/canvas-and-palette.md). Screen-space sibling of the
          transformed wrapper so the light stays fixed on screen while the
          canvas pans / zooms underneath. Rendered before CanvasChrome so the
          palette + chrome paint ON TOP and stay reachable to switch tools
          back; pointer-events-none lets clicks fall through to <main>. */}
            {canvasTool === 'spotlight' ? (
              <SpotlightOverlay
                pos={spotlight.pos}
                radius={spotlight.radius}
                config={spotlightLook.config}
              />
            ) : null}

            <CanvasSelectionToolbars props={props} selectionInput={selectionInput} />
            <CanvasChrome
              {...chromeProps}
              mainSize={mainSize}
              laserConfig={props.laserConfig}
              onChangeLaserField={props.onChangeLaserField}
              spotlightConfig={spotlightLook.config}
              onChangeSpotlightField={spotlightLook.setField}
              spotlightRadius={spotlight.radius}
              onSetSpotlightRadius={spotlight.setRadius}
              spotlightPanelPosition={props.spotlightPanelPosition}
              onMoveSpotlightPanel={props.onMoveSpotlightPanel}
              onResetSpotlightPanel={props.onResetSpotlightPanel}
              formatConfig={props.formatConfig}
              onToggleFormatGroup={props.onToggleFormatGroup}
              onSetFormatMode={props.onSetFormatMode}
              formatBrushSource={props.formatBrushSource}
              formatPanelPosition={props.formatPanelPosition}
              onMoveFormatPanel={props.onMoveFormatPanel}
              onResetFormatPanel={props.onResetFormatPanel}
              laserPanelPosition={props.laserPanelPosition}
              onMoveLaserPanel={props.onMoveLaserPanel}
              onResetLaserPanel={props.onResetLaserPanel}
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
          </main>
        </ViewTransition>
      </CanvasFinishProvider>
    </PageImageAccessProvider>
  );
}
