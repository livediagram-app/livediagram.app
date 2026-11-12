import type { RefObject } from 'react';
import { useMemo } from 'react';
import { imageBackingInsetVar } from '@livediagram/document';
import { drawIntentCursor, isWhiteboardPenIntent } from '@/lib/draw-mode';
import { WhiteboardPenPreview } from '@/components/canvas/whiteboard/WhiteboardPenPreview';
import { CanvasZoomProvider } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { MindGrowProvider } from '@/components/canvas/MindGrowContext';
import { MindOutlineProvider, useMindOutlineBadges } from '@/components/canvas/MindOutlineContext';
import { ElementIndicatorStyleProvider } from '@liveworkspace/workbench/components/canvas/ElementIndicatorStyleContext';
import { readElementIndicatorStyle } from '@liveworkspace/workbench/lib/element-indicator-style';
import { CanvasStillProvider } from '@/components/canvas/CanvasStillContext';
import { CanvasArrivalProvider } from '@liveworkspace/workbench/components/canvas/CanvasArrivalContext';
import { IsometricDepthLayer } from '@/components/canvas/IsometricDepthLayer';
import {
  CanvasElementsLayer,
  type CanvasElementsLayerProps,
} from '@/components/canvas/CanvasElementsLayer';
import { PathDraftLayer } from '@/components/canvas/path/PathDraftLayer';
import { PathEditLayer } from '@/components/canvas/path/PathEditLayer';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { useCanvasSurfaceGestures } from '@/hooks/canvas/useCanvasSurfaceGestures';
import type { useCanvasDrawTools } from './useCanvasDrawTools';

type DrawTools = ReturnType<typeof useCanvasDrawTools>;
type SurfaceGestures = ReturnType<typeof useCanvasSurfaceGestures>;

type CanvasWorldLayerProps = Pick<
  CanvasElementsLayerProps,
  | 'hasArrows'
  | 'arrowLabels'
  | 'selectionInput'
  | 'isPaintMode'
  | 'handleArrowSelect'
  | 'handleElementClick'
  | 'handleElementContextSelect'
  | 'quickRingOpen'
  | 'setQuickRingOpen'
  | 'drawDrag'
> & {
  props: CanvasProps;
  wrapperRef: RefObject<HTMLDivElement | null>;
  surface: Pick<SurfaceGestures, 'onWrapperPointerDown' | 'onWrapperDoubleClick'>;
  handlePolygonDoubleClick: DrawTools['handlePolygonDoubleClick'];
  pathTool: DrawTools['pathTool'];
  penStroke: DrawTools['penStroke'];
  // Portal travel, resolved by Canvas (it owns the viewport).
  resolvePortal: CanvasProps['onEnterPortal'];
  cursorClass: string;
  penCursorValue: string | null;
  viewportZoom: number;
  viewportOffset: { x: number; y: number };
  isoFragment: string;
};

// The canvas's world layer, split out of Canvas.tsx: the wrapper the view transforms (pan, zoom, the
// isometric tilt) and everything drawn in canvas coordinates inside it, the elements and the drafts.
// Canvas keeps the screen-space surface around it and the gestures that drive both.
export function CanvasWorldLayer({
  props,
  wrapperRef,
  surface,
  handlePolygonDoubleClick,
  pathTool,
  penStroke,
  resolvePortal,
  cursorClass,
  penCursorValue,
  viewportZoom,
  viewportOffset,
  isoFragment,
  hasArrows,
  arrowLabels,
  selectionInput,
  isPaintMode,
  handleArrowSelect,
  handleElementClick,
  handleElementContextSelect,
  quickRingOpen,
  setQuickRingOpen,
  drawDrag,
}: CanvasWorldLayerProps) {
  const { canvasTool, pendingDraw, elements } = props;
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
    <div
      ref={wrapperRef}
      data-canvas-content=""
      onPointerDown={surface.onWrapperPointerDown}
      onDoubleClick={(e) => {
        // Polygon finish-line double-click (docs/specs/008-canvas/polygon-tool.md) wins over the
        // add-text double-click while the intent is armed.
        if (handlePolygonDoubleClick() || pathTool.handlePathDoubleClick()) return;
        surface.onWrapperDoubleClick(e);
      }}
      // Spotlight (docs/specs/008-canvas/canvas-and-palette.md) is a non-editing presenter mode: make the whole
      // canvas layer ignore pointer events so NO element kind can be
      // selected, dragged, or edited (a per-element capture guard can't
      // catch every select path, boxed elements, arrow hit-bands, labels,
      // click vs pointerdown). Clicks then fall through to <main>, where the
      // capture handler turns them into grow / shrink, and middle-mouse or
      // held-Space still pans.
      // Isometric view (docs/specs/008-canvas/isometric-view.md): like Spotlight, the layer goes
      // pointer-events-none so NO element kind can be selected / dragged,
      // it's a read-only view tool. Clicks fall through to <main>, where a
      // drag pans (canvasTool === 'isometric' is added to `wantsPan`).
      className={`absolute inset-0 origin-center touch-none ${
        canvasTool === 'spotlight' || canvasTool === 'isometric' ? 'pointer-events-none' : ''
      } ${pendingDraw ? '' : cursorClass}`}
      // Scopes the [data-iso] CSS (globals.css): frames settle just under
      // the base plane while the camera orbits so they can't z-fight
      // (flicker) with the coplanar contents above them.
      data-iso={canvasTool === 'isometric' ? '' : undefined}
      // The same modes, said to the element plane's children, which take presses of their own (globals.css).
      data-elements-inert={
        canvasTool === 'spotlight' || canvasTool === 'isometric' ? '' : undefined
      }
      // A whiteboard pen draws wherever it presses, so nothing under it swaps
      // the pen cursor for its own (globals.css, docs/specs/023-draw-mode/draw-mode.md "Pens").
      data-pen-in-hand={
        (pendingDraw?.type === 'freehand' && pendingDraw.variant === 'whiteboard') ||
        pendingDraw?.type === 'path' ||
        pendingDraw?.type === 'fill'
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
        // The inset the white under each picture needs at this zoom (docs/specs/009-elements/images.md "The white
        // under a picture"): a CSS variable, so no picture re-renders on zoom; it changes only below 50%.
        ...imageBackingInsetVar(viewportZoom),
        ...(canvasTool === 'isometric' ? { transformStyle: 'preserve-3d' as const } : null),
        // Draw-mode cursor: every intent gets a custom inline-SVG
        // cursor (crosshair at the pointer tip plus a small glyph
        // hinting at what's about to land). Without this, tool
        // intents inherited the default arrow cursor because the
        // wrapper drops its Tailwind cursor- class above when
        // pendingDraw is set, leaving no cursor specified at all.
        ...(pendingDraw ? { cursor: penCursorValue ?? drawIntentCursor(pendingDraw) } : null),
        // A path in its edit mode says what a press would do (usePathTool).
        ...(pathTool.cursor ? { cursor: pathTool.cursor } : null),
      }}
    >
      {/* Isometric extrusion (docs/specs/008-canvas/isometric-view.md): per-element raised blocks painted
      behind the real element layer, which caps each column at z=0.
      Only mounted while the tool is active. */}
      {canvasTool === 'isometric' ? <IsometricDepthLayer elements={elements} /> : null}
      <CanvasStillProvider still={props.editorMode === 'draw'}>
        <CanvasArrivalProvider
          tabId={props.activeTabId ?? ''}
          loaded={props.activeTabLoaded ?? true}
          count={elements.length}
        >
          {/* The zoom reaches only the counter-scaled parts of each element
        (docs/specs/008-canvas/canvas-performance.md). */}
          <CanvasZoomProvider zoom={viewportZoom}>
            <MindGrowProvider value={mindGrow}>
              <MindOutlineProvider value={mindOutlineBadges}>
                <ElementIndicatorStyleProvider style={readElementIndicatorStyle(props.settings)}>
                  <CanvasElementsLayer
                    {...props}
                    elements={pathTool.elements}
                    // Portal travel is resolved HERE (Canvas owns the viewport), so the prop
                    // from the host is overridden with the local resolver.
                    onEnterPortal={resolvePortal}
                    onFireReaction={props.onFireReaction}
                    reactionBursts={props.reactionBursts}
                    onReactionBurstDone={props.onReactionBurstDone}
                    onPressModeButton={props.onPressModeButton}
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
      {/* Drafts: editor-only. */}
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
      {pathTool.editView ? <PathEditLayer {...pathTool.editView} /> : null}
    </div>
  );
}
