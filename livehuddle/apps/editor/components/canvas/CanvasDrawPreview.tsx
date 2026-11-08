import { useCanvasViewKey } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import type { RefObject } from 'react';
import {
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STROKE,
  dropsAtOwnSize,
  isSelfDrawingShape,
  ROOM_WALL,
} from '@livehuddle/document';
import { isSvgRenderedShape, ShapeSvgOverlay } from '@/components/canvas/shape-svg-overlay';
import { POLYGON_CLOSE_PX } from '@/components/canvas/useCanvasPolygonGesture';
import type { PendingDraw } from '@/lib/draw-mode';
import { drawnDragBox } from '@/lib/draw-commit';
import { PenShapePreview } from '@/components/canvas/whiteboard/BoardShapePreview';
import { useCanvasClientOrigin } from '@liveworkspace/workbench/hooks/canvas/useCanvasClientOrigin';

type CanvasDrawPreviewProps = {
  drawDrag: { startX: number; startY: number; currentX: number; currentY: number } | null;
  polygonVertices: { x: number; y: number }[];
  polygonCursor: { x: number; y: number } | null;
  pendingDraw: PendingDraw | null;
  wrapperRef: RefObject<HTMLDivElement | null>;
  // The canvas size. With the view, read from the viewport store here, it is what the wrapper's
  // origin follows (useCanvasViewKey), so the chrome around this takes no view.
  mainSize: { width: number; height: number };
  // The board's ink on a whiteboard (docs/specs/023-draw-mode/draw-mode.md), what a board shape
  // previews in. Absent elsewhere.
  whiteboardInk?: string;
};

// Live previews shown while a draw gesture is in flight: the Room Builder's
// walls and the draw-to-size box (a dashed rect, or a ShapeSvgOverlay
// preview for SVG-rendered shapes). Pure SVG/markup; split out of CanvasChrome.
export function CanvasDrawPreview({
  drawDrag,
  polygonVertices,
  polygonCursor,
  pendingDraw,
  wrapperRef,
  mainSize,
  whiteboardInk,
}: CanvasDrawPreviewProps) {
  const { viewportZoom, viewKey } = useCanvasViewKey(mainSize);
  // A whiteboard shape previews as it will land (docs/specs/023-draw-mode/draw-mode.md
  // "Shapes"): in the board's ink, solid, unfilled.
  const ink = whiteboardInk ?? 'currentColor';
  // The Room Builder (docs/specs/009-elements/room-builder.md) previews its walls, at wall thickness.
  const roomWalls = pendingDraw?.type === 'room-walls';
  const showsPolygon = roomWalls && polygonVertices.length > 0;
  // A placed piece has no box to draw: it previews itself (PlacementPreview, docs/specs/010-palette/palette-drag-ghost.md
  // "Placed pieces preview themselves").
  const showsBox =
    !!drawDrag &&
    !!pendingDraw &&
    !(pendingDraw.type === 'shape' && dropsAtOwnSize(pendingDraw.kind));
  // Where canvas (0, 0) sits on screen, measured only while a preview shows.
  const origin = useCanvasClientOrigin(wrapperRef, showsPolygon || showsBox, viewKey);
  // The drawings in progress (the Room Builder's walls, the draw-to-size box).
  const drafts = (
    <>
      {/* The Room Builder's preview (docs/specs/009-elements/room-builder.md): the placed walls, a rubber-band
            segment to the live cursor, a dot per corner, and a snap ring on
            the START corner once the cursor is within closing range. */}
      {showsPolygon
        ? (() => {
            const rect = origin;
            if (!rect) return null;
            const toClient = (p: { x: number; y: number }) => ({
              x: rect.left + p.x * viewportZoom,
              y: rect.top + p.y * viewportZoom,
            });
            const pts = polygonVertices.map(toClient);
            const cursor = polygonCursor ? toClient(polygonCursor) : null;
            const first = polygonVertices[0]!;
            const nearStart =
              polygonCursor &&
              polygonVertices.length >= 3 &&
              Math.hypot(polygonCursor.x - first.x, polygonCursor.y - first.y) <=
                POLYGON_CLOSE_PX / viewportZoom;
            const d =
              pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') +
              (cursor
                ? ` L ${nearStart ? pts[0]!.x : cursor.x} ${nearStart ? pts[0]!.y : cursor.y}`
                : '');
            return (
              <svg
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
              >
                {/* The walls as they will stand, and the closing wall back to the first corner, dashed. */}
                <path
                  d={d}
                  fill="none"
                  stroke="var(--color-brand-500)"
                  strokeOpacity={0.3}
                  strokeWidth={ROOM_WALL * viewportZoom}
                  strokeLinejoin="miter"
                />
                {pts.length >= 2 && !nearStart ? (
                  <path
                    d={`M ${cursor?.x ?? pts[pts.length - 1]!.x} ${cursor?.y ?? pts[pts.length - 1]!.y} L ${pts[0]!.x} ${pts[0]!.y}`}
                    fill="none"
                    stroke="var(--color-brand-500)"
                    strokeOpacity={0.6}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                ) : null}
                <path
                  d={d}
                  fill="none"
                  stroke="var(--color-brand-500)"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
                {pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--color-brand-500)" />
                ))}
                {nearStart ? (
                  <circle
                    cx={pts[0]!.x}
                    cy={pts[0]!.y}
                    r={8}
                    fill="none"
                    stroke="var(--color-brand-500)"
                    strokeWidth={2}
                  />
                ) : null}
              </svg>
            );
          })()
        : null}

      {showsBox && drawDrag && pendingDraw
        ? (() => {
            const rect = origin;
            if (!rect) return null;
            // The box the commit will actually mint, not the raw drag: an
            // embed is fitted to 16:9 inside it (docs/specs/009-elements/youtube-video.md), so the outline
            // has to be the fitted one or the user sizes against a rectangle
            // they never get. Shared with buildDrawnBoxed so they can't drift.
            const box = drawnDragBox(
              pendingDraw,
              drawDrag.startX,
              drawDrag.startY,
              drawDrag.currentX,
              drawDrag.currentY,
            );
            const widthPx = Math.max(box.width * viewportZoom, 1);
            const heightPx = Math.max(box.height * viewportZoom, 1);
            // The self-drawing shapes (progress / rail / rating / charts) render
            // via their own views, not ShapeSvgOverlay (which would draw nothing
            // for them), so they fall back to the dashed-rect preview. Icons
            // (line-art AND Technology marks) are the same story: they pass
            // isSvgRenderedShape but ShapeSvgOverlay has no glyph case, which
            // used to leave icon draw-outs with NO preview box at all.
            const usesSvg =
              pendingDraw.type === 'shape' &&
              pendingDraw.kind !== 'icon' &&
              isSvgRenderedShape(pendingDraw.kind) &&
              !isSelfDrawingShape(pendingDraw.kind);
            // Box intents: square / circle / stadium use border-
            // radius on the wrapping div (matching the BoxedElementView
            // at-rest treatment), every SVG-rendered shape kind
            // delegates to ShapeSvgOverlay, and text / sticky / image
            // fall back to a simple dashed-rect. The text + sticky
            // + image branches use 4px corners; stickies don't get
            // their corner-fold preview here because the preview is
            // very small and a peeled corner just reads as noise.
            const radius =
              pendingDraw.type === 'shape' && pendingDraw.kind === 'circle'
                ? '50%'
                : pendingDraw.type === 'shape' && pendingDraw.kind === 'stadium'
                  ? '9999px'
                  : '4px';
            return (
              <div
                aria-hidden
                className="pointer-events-none fixed z-[var(--z-chrome)]"
                style={{
                  left: rect.left + box.x * viewportZoom,
                  top: rect.top + box.y * viewportZoom,
                  width: widthPx,
                  height: heightPx,
                }}
              >
                {pendingDraw.type === 'shape' && pendingDraw.board ? (
                  <PenShapePreview
                    kind={pendingDraw.kind}
                    colour={ink}
                    widthPx={BORDER_STROKE_PX[DEFAULT_BORDER_STROKE]}
                    usesSvg={usesSvg}
                    radius={radius}
                    zoom={viewportZoom}
                    aspect={heightPx > 0 ? widthPx / heightPx : 1}
                  />
                ) : usesSvg && pendingDraw.type === 'shape' ? (
                  <ShapeSvgOverlay
                    shape={pendingDraw.kind}
                    fill="color-mix(in srgb, var(--color-brand-500) 10%, transparent)"
                    stroke="var(--color-brand-500)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    aspect={heightPx > 0 ? widthPx / heightPx : 1}
                  />
                ) : (
                  <div
                    className="h-full w-full border border-dashed border-brand-500 bg-brand-500/10"
                    style={{ borderRadius: radius }}
                  />
                )}
              </div>
            );
          })()
        : null}
    </>
  );
  return (
    <>
      {/* Draw-to-size preview. drawDrag holds canvas coords; convert
          to client coords via the wrapper rect + viewportZoom so the
          overlay aligns with the canvas content under it. The shape
          itself renders via ShapeSvgOverlay (the same primitive
          BoxedElementView uses for committed shapes) with a dashed-
          brand stroke + translucent brand fill, so "draw circle"
          looks like an oval, "draw diamond" like a diamond, etc.
          The three simple kinds (square / circle / stadium) bypass
          SVG and use border-radius on the wrapping div, matching
          how BoxedElementView renders them at rest. */}
      {drafts}
    </>
  );
}
