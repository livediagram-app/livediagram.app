import dynamic from 'next/dynamic';
import type { RefObject } from 'react';
import { imageBackingInsetAttribute } from '@livedesign/design';
import { drawIntentCursor, isWhiteboardPenIntent } from '@/lib/draw-mode';
import { WhiteboardPenPreview } from '@/components/canvas/whiteboard/WhiteboardPenPreview';
import {
  CanvasElementsLayer,
  type CanvasElementsLayerProps,
} from '@/components/canvas/CanvasElementsLayer';
import { CanvasZoomProvider } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { ElementIndicatorStyleProvider } from '@liveworkspace/workbench/components/canvas/ElementIndicatorStyleContext';
import { readElementIndicatorStyle } from '@liveworkspace/workbench/lib/element-indicator-style';
import { CanvasArrivalProvider } from '@liveworkspace/workbench/components/canvas/CanvasArrivalContext';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { PathDraftLayer } from '@/components/canvas/path/PathDraftLayer';
import { LogoCanvasOverlays } from '@/components/canvas/LogoCanvasOverlays';
import { PathEditLayer } from '@/components/canvas/path/PathEditLayer';
import type { useCanvasSurfaceGestures } from '@/hooks/canvas/useCanvasSurfaceGestures';
import {
  loadCanvasPages,
  loadPhotoCanvasOverlays,
  loadPhotoPagesLayer,
} from '@/lib/editor-deferred-code';
import type { useCanvasDrawTools } from './useCanvasDrawTools';

// Pages mode's pages draw only on a tab that has pages, so their code loads on demand
// (lib/editor-deferred-code.ts fetches it as the editor mounts).
const PhotoPagesLayer = dynamic(loadPhotoPagesLayer, { ssr: false });
const PhotoCanvasOverlays = dynamic(loadPhotoCanvasOverlays, { ssr: false });
const CanvasPages = dynamic(loadCanvasPages, { ssr: false });

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
  surface: Pick<
    SurfaceGestures,
    'onWrapperPointerDown' | 'onWrapperDoubleClick' | 'pressedByFinger'
  >;
  handlePolygonDoubleClick: DrawTools['handlePolygonDoubleClick'];
  offPage: DrawTools['offPage'];
  pathTool: DrawTools['pathTool'];
  penStroke: DrawTools['penStroke'];
  // Inspect's press selects to read, so the elements take no in-place edits.
  inspecting: boolean;
  spaceHeld: boolean;
  cursorClass: string;
  viewportZoom: number;
  viewportOffset: { x: number; y: number };
};

// The canvas's world layer, split out of Canvas.tsx: the wrapper the view transforms (pan and zoom) and
// everything drawn in canvas coordinates inside it, the pages, the elements and the drafts. Canvas keeps
// the screen-space surface around it and the gestures that drive both.
export function CanvasWorldLayer({
  props,
  wrapperRef,
  surface,
  handlePolygonDoubleClick,
  offPage,
  pathTool,
  penStroke,
  inspecting,
  spaceHeld,
  cursorClass,
  viewportZoom,
  viewportOffset,
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
  const { canvasTool, pendingDraw, elements, readOnly } = props;
  return (
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
      // catch every select path, boxed elements, arrow hit-bands, labels,
      // click vs pointerdown). Clicks then fall through to <main>, where the
      // capture handler turns them into grow / shrink, and middle-mouse or
      // held-Space still pans.
      className={`absolute inset-0 origin-center touch-none ${
        canvasTool === 'spotlight' ? 'pointer-events-none' : ''
      } ${pendingDraw ? '' : cursorClass}`}
      // The same mode, said to the element plane's children, which take presses of their own (globals.css).
      data-elements-inert={canvasTool === 'spotlight' ? '' : undefined}
      // A whiteboard pen draws wherever it presses, so nothing under it swaps
      // the pen cursor for its own (globals.css, docs/specs/023-draw-mode/drawing-tools.md "Markers").
      data-pen-in-hand={
        (pendingDraw?.type === 'freehand' && pendingDraw.variant === 'whiteboard') ||
        pendingDraw?.type === 'path' ||
        pendingDraw?.type === 'fill'
          ? ''
          : undefined
      }
      data-path-cursor={pathTool.cursor ? '' : undefined}
      // The inset the white under each picture needs at this zoom (docs/specs/009-elements/images.md "The white under
      // a picture"): an attribute the stylesheet reads for the pictures alone, so no picture re-renders on zoom and
      // nothing else restyles; it changes only below 50%.
      {...imageBackingInsetAttribute(viewportZoom)}
      style={{
        // Translate is in canvas-coords (applied first); scale is centred
        // on the wrapper so zooming keeps the viewport centre stable.
        transform: `scale(${viewportZoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)`,
        // Draw-mode cursor: every intent gets a custom inline-SVG
        // cursor (crosshair at the pointer tip plus a small glyph
        // hinting at what's about to land). Without this, tool
        // intents inherited the default arrow cursor because the
        // wrapper drops its Tailwind cursor- class above when
        // pendingDraw is set, leaving no cursor specified at all.
        ...(pendingDraw ? { cursor: drawIntentCursor(pendingDraw) } : null),
        // A path in its edit mode says what a press would do (usePathTool).
        ...(pathTool.cursor ? { cursor: pathTool.cursor } : null),
      }}
    >
      {/* Pages mode's A4 pages, under every element (CanvasPages). */}
      {props.pagesMode ? (
        <CanvasPages
          // Its page state (the palette's pages seen, an open panel, hidden layout cards) is the
          // tab's own: page ids repeat across tabs.
          key={props.activeTabId}
          view={props.pagesMode}
          zoom={viewportZoom}
          // Zen shows the sheets alone: no labels, cogs, layout invites or add
          // button.
          bare={props.zenMode === true}
          placing={!!pendingDraw}
        />
      ) : null}
      {/* Photo pages' pictures on their sheets: the page in focus live, the rest their
    previews (PhotoPagesLayer). */}
      {props.pagesMode?.photo?.hasPhotoPage ? (
        <PhotoPagesLayer
          pages={props.pagesMode.pages}
          photo={props.pagesMode.photo}
          zoom={viewportZoom}
          viewKey={viewportOffset}
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
          <ElementIndicatorStyleProvider style={readElementIndicatorStyle(props.settings)}>
            <CanvasElementsLayer
              {...props}
              readOnly={readOnly || inspecting}
              elements={pathTool.elements}
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
      {/* Drafts and the logo page's guides. */}
      <>
        {/* The whiteboard pen's stroke being drawn (docs/specs/023-draw-mode/drawing-tools.md "Markers"):
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
            bare={props.zenMode === true}
            pendingDraw={pendingDraw}
            penStroke={penStroke}
            pathDraft={pathTool.draftView}
            ink={props.whiteboardInk ?? 'currentColor'}
            wrapperRef={wrapperRef}
            zoom={viewportZoom}
          />
        ) : null}
        {/* A photo page's tools: the press, the ants, the crop box, floating pixels and
    the text being typed (PhotoCanvasOverlays). */}
        {props.pagesMode?.photo?.hasPhotoPage ? (
          <PhotoCanvasOverlays
            pages={props.pagesMode.pages}
            photo={props.pagesMode.photo}
            zoom={viewportZoom}
            spaceHeld={spaceHeld}
          />
        ) : null}
        {pathTool.editView ? <PathEditLayer {...pathTool.editView} /> : null}
      </>
    </div>
  );
}
