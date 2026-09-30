import type { RefObject } from 'react';
import { BORDER_STROKE_PX, isSelfDrawingShape, nearestBorderStroke } from '@livediagram/document';
import { isSvgRenderedShape, ShapeSvgOverlay } from '@/components/canvas/shape-svg-overlay';
import { POLYGON_CLOSE_PX } from '@/components/canvas/useCanvasPolygonGesture';
import type { PendingDraw } from '@/lib/draw-mode';
import { drawnDragBox } from '@/lib/draw-commit';
import type { StampGhost } from '@/components/canvas/useStampGhost';
import { NoteGhost } from '@/components/canvas/NoteGhost';
import { useCanvasClientOrigin } from '@/hooks/canvas/useCanvasClientOrigin';

type CanvasDrawPreviewProps = {
  drawDrag: { startX: number; startY: number; currentX: number; currentY: number } | null;
  penPoints: { x: number; y: number }[] | null;
  polygonVertices: { x: number; y: number }[];
  polygonCursor: { x: number; y: number } | null;
  // The highlighter banner's live settings (docs/specs/008-canvas/highlighter.md), so the in-flight
  // preview matches what will commit.
  highlighterColor: string;
  highlighterWidth: number;
  pendingDraw: PendingDraw | null;
  // The armed fixed-size note's ghost (docs/specs/021-event-storming/event-storming.md Phase 4), when the tile is a
  // stamp rather than a draw-to-size. It replaces the size box entirely.
  stamp: StampGhost | null;
  viewportZoom: number;
  wrapperRef: RefObject<HTMLDivElement | null>;
  // The board's ink on a whiteboard (docs/specs/023-whiteboard/whiteboard.md), what the main pen
  // previews in. Absent elsewhere.
  whiteboardInk?: string;
};

// Live previews shown while a draw gesture is in flight: the freehand pen
// polyline and the draw-to-size box (a dashed rect, or a ShapeSvgOverlay
// preview for SVG-rendered shapes). Pure SVG/markup; split out of CanvasChrome.
export function CanvasDrawPreview({
  drawDrag,
  penPoints,
  polygonVertices,
  polygonCursor,
  highlighterColor,
  highlighterWidth,
  pendingDraw,
  stamp,
  viewportZoom,
  wrapperRef,
  whiteboardInk,
}: CanvasDrawPreviewProps) {
  // A whiteboard mark previews as it will land (docs/specs/023-whiteboard/whiteboard.md "Pens"): the
  // pen's colour (the main pen: the board's) and width, solid, unfilled. Only the
  // smoothing a committed stroke gets can still differ.
  const inkOf = (colour: string | null) => colour ?? whiteboardInk ?? 'currentColor';
  const showsPen = !!penPoints && pendingDraw?.type === 'freehand' && penPoints.length >= 2;
  const showsPolygon = pendingDraw?.type === 'polygon' && polygonVertices.length > 0;
  const showsBox = !!drawDrag && !!pendingDraw && !stamp;
  // Where canvas (0, 0) sits on screen, measured only while a preview shows.
  const origin = useCanvasClientOrigin(wrapperRef, showsPen || showsPolygon || showsBox);
  return (
    <>
      {stamp && pendingDraw?.type === 'sticky' ? (
        <NoteGhost
          kind={pendingDraw.esKind ?? null}
          box={stamp.screen}
          px={1}
          position="fixed"
          testId="stamp-ghost"
        />
      ) : null}
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
      {/* Pen-gesture live preview. While the user is drawing freehand,
          paint the in-progress polyline as a brand-tinted stroke so
          they can see what they're sketching. Sits on the same z-[var(--z-chrome)]
          overlay layer as the draw-to-size box preview. Switches to
          the committed FreehandSvg after release (the next render
          tick once the new element lands in `elements`). */}
      {showsPen && penPoints && pendingDraw?.type === 'freehand'
        ? (() => {
            const rect = origin;
            if (!rect) return null;
            // Build an SVG polyline string from the sampled canvas-
            // coord points, converted to client coords via the
            // wrapper rect + zoom so the overlay aligns with the
            // canvas content.
            const d = penPoints
              .map(
                (p, i) =>
                  `${i === 0 ? 'M' : 'L'} ${rect.left + p.x * viewportZoom} ${
                    rect.top + p.y * viewportZoom
                  }`,
              )
              .join(' ');
            // The highlighter variant previews with the committed
            // marker recipe (wide translucent yellow, docs/specs/008-canvas/highlighter.md) so
            // what you see while dragging is what lands.
            const isHighlighter = pendingDraw.variant === 'highlighter';
            // A whiteboard pen: its own colour and width, in screen px like the
            // committed stroke (non-scaling).
            const wb = pendingDraw.variant === 'whiteboard' ? pendingDraw : null;
            return (
              <svg
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
              >
                <path
                  d={d}
                  fill="none"
                  stroke={
                    wb ? inkOf(wb.colour) : isHighlighter ? highlighterColor : 'rgb(14, 165, 233)'
                  }
                  strokeWidth={wb ? wb.width : isHighlighter ? highlighterWidth : 2}
                  strokeOpacity={isHighlighter ? 0.45 : undefined}
                  style={isHighlighter ? { mixBlendMode: 'multiply' } : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            );
          })()
        : null}

      {/* Polygon-tool preview (docs/specs/008-canvas/polygon-tool.md): the placed segments, a rubber-band
          segment to the live cursor, a dot per vertex, and a snap ring on
          the START vertex once the cursor is within closing range. */}
      {showsPolygon && pendingDraw?.type === 'polygon'
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
                <path
                  d={d}
                  fill="none"
                  stroke="rgb(14, 165, 233)"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
                {pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={3} fill="rgb(14, 165, 233)" />
                ))}
                {nearStart ? (
                  <circle
                    cx={pts[0]!.x}
                    cy={pts[0]!.y}
                    r={8}
                    fill="none"
                    stroke="rgb(14, 165, 233)"
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
            // Arrow intent: render the drag as a line from the start
            // point to the current point, with a small chevron-like
            // arrowhead near the end so the user sees the direction
            // they've drawn (the committed arrow defaults to no
            // arrowheads; this is just preview chrome).
            if (pendingDraw.type === 'arrow') {
              const x1 = rect.left + drawDrag.startX * viewportZoom;
              const y1 = rect.top + drawDrag.startY * viewportZoom;
              const x2 = rect.left + drawDrag.currentX * viewportZoom;
              const y2 = rect.top + drawDrag.currentY * viewportZoom;
              return (
                <svg
                  aria-hidden
                  className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
                >
                  {pendingDraw.pen ? (
                    // A whiteboard line: the pen's colour and width, which on a
                    // line scales with the zoom, as the committed line does.
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={inkOf(pendingDraw.pen.colour)}
                      strokeWidth={pendingDraw.pen.width * viewportZoom}
                      strokeLinecap="round"
                    />
                  ) : (
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="rgb(14, 165, 233)"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                  )}
                </svg>
              );
            }
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
              pendingDraw.type === 'shape' &&
              (pendingDraw.kind === 'circle' || pendingDraw.kind === 'progress-ring')
                ? '50%'
                : pendingDraw.type === 'shape' &&
                    (pendingDraw.kind === 'stadium' || pendingDraw.kind === 'progress-bar')
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
                {pendingDraw.type === 'shape' && pendingDraw.pen ? (
                  <PenShapePreview
                    kind={pendingDraw.kind}
                    colour={inkOf(pendingDraw.pen.colour)}
                    widthPx={BORDER_STROKE_PX[nearestBorderStroke(pendingDraw.pen.width)]}
                    usesSvg={usesSvg}
                    radius={radius}
                    zoom={viewportZoom}
                    aspect={heightPx > 0 ? widthPx / heightPx : 1}
                  />
                ) : usesSvg && pendingDraw.type === 'shape' ? (
                  <ShapeSvgOverlay
                    shape={pendingDraw.kind}
                    fill="rgba(14, 165, 233, 0.10)"
                    stroke="rgb(14, 165, 233)"
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
}

// A whiteboard shape while it is drawn: the outline the committed shape will
// have, in the pen's colour and weight, unfilled. SVG-rendered outlines keep a
// screen-px stroke; CSS-bordered ones (rectangle, ellipse) scale with the zoom,
// as the committed shapes do.
function PenShapePreview({
  kind,
  colour,
  widthPx,
  usesSvg,
  radius,
  zoom,
  aspect,
}: {
  kind: import('@livediagram/document').ShapeKind;
  colour: string;
  widthPx: number;
  usesSvg: boolean;
  radius: string;
  zoom: number;
  aspect: number;
}) {
  if (usesSvg) {
    return (
      <ShapeSvgOverlay
        shape={kind}
        fill="none"
        stroke={colour}
        strokeWidth={widthPx}
        aspect={aspect}
      />
    );
  }
  return (
    <div
      data-pen-preview=""
      className="h-full w-full"
      style={{
        borderStyle: 'solid',
        borderColor: colour,
        borderWidth: widthPx * zoom,
        // The committed shape's own corners: a rectangle's default 8 canvas px.
        borderRadius: radius === '4px' ? `${SHAPE_CORNER_PX * zoom}px` : radius,
      }}
    />
  );
}

// A rectangle's default corner radius on the canvas (element-variant's 8px).
const SHAPE_CORNER_PX = 8;
