import type { RefObject } from 'react';
import { isSelfDrawingShape } from '@livediagram/diagram';
import { isSvgRenderedShape, ShapeSvgOverlay } from '@/components/canvas/shape-svg-overlay';
import type { PendingDraw } from '@/lib/draw-mode';

type CanvasDrawPreviewProps = {
  drawDrag: { startX: number; startY: number; currentX: number; currentY: number } | null;
  penPoints: { x: number; y: number }[] | null;
  pendingDraw: PendingDraw | null;
  viewportZoom: number;
  wrapperRef: RefObject<HTMLDivElement | null>;
};

// Live previews shown while a draw gesture is in flight: the freehand pen
// polyline and the draw-to-size box (a dashed rect, or a ShapeSvgOverlay
// preview for SVG-rendered shapes). Pure SVG/markup; split out of CanvasChrome.
export function CanvasDrawPreview({
  drawDrag,
  penPoints,
  pendingDraw,
  viewportZoom,
  wrapperRef,
}: CanvasDrawPreviewProps) {
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
      {/* Pen-gesture live preview. While the user is drawing freehand,
          paint the in-progress polyline as a brand-tinted stroke so
          they can see what they're sketching. Sits on the same z-[var(--z-chrome)]
          overlay layer as the draw-to-size box preview. Switches to
          the committed FreehandSvg after release (the next render
          tick once the new element lands in `elements`). */}
      {penPoints && pendingDraw?.type === 'freehand' && penPoints.length >= 2
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
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
            return (
              <svg
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
              >
                <path
                  d={d}
                  fill="none"
                  stroke="rgb(14, 165, 233)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            );
          })()
        : null}

      {drawDrag && pendingDraw
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
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
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgb(14, 165, 233)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                </svg>
              );
            }
            const canvasMinX = Math.min(drawDrag.startX, drawDrag.currentX);
            const canvasMinY = Math.min(drawDrag.startY, drawDrag.currentY);
            const canvasW = Math.abs(drawDrag.currentX - drawDrag.startX);
            const canvasH = Math.abs(drawDrag.currentY - drawDrag.startY);
            const widthPx = Math.max(canvasW * viewportZoom, 1);
            const heightPx = Math.max(canvasH * viewportZoom, 1);
            // The self-drawing shapes (progress / rail / rating / charts) render
            // via their own views, not ShapeSvgOverlay (which would draw nothing
            // for them), so they fall back to the dashed-rect preview.
            const usesSvg =
              pendingDraw.type === 'shape' &&
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
                  left: rect.left + canvasMinX * viewportZoom,
                  top: rect.top + canvasMinY * viewportZoom,
                  width: widthPx,
                  height: heightPx,
                }}
              >
                {usesSvg && pendingDraw.type === 'shape' ? (
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
