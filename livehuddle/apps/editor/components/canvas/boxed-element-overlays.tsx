import {
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  catmullRomToBezierPath,
  freehandCanvasPoints,
  isPenStroke,
  penStrokeSvg,
  isFilledPenLoop,
  penLoopFillPath,
  DEFAULT_BORDER_STROKE,
  DEFAULT_BORDER_STYLE,
  type FreehandElement,
  isHandDrawn,
  isPolygonOutline,
  polygonStrokePx,
} from '@livehuddle/document';
import { useElementFinish } from '@/components/canvas/CanvasFinishContext';
import type { SVGProps } from 'react';
import { strokeHitWidth } from '@/lib/whiteboard-tool';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { useDrawingAnimation } from '@/components/canvas/drawing-animation';

// Renders a FreehandElement's stored polyline as a smooth SVG path.
// Points are stored normalised into [0..1] within the element's
// bounding box (see createFreehand), so the renderer maps them into
// viewBox [0..100] and lets `preserveAspectRatio="none"` stretch the
// curve when the user resizes. The stroke colour comes from theme
// (with the per-element override), matching how other boxed elements
// pick their accent.
// The svg a freehand stroke draws in, shared with the whiteboard pen's live ink
// (whiteboard/LiveInk.tsx), which lays itself out exactly like the stroke it lands as.
export const FREEHAND_SVG_CLASS =
  'pointer-events-none absolute inset-0 h-full w-full overflow-visible';

// The invisible line that catches pointers on a stroke (docs/specs/023-draw-mode/draw-mode.md
// "Selecting"): STROKE_HIT_SCREEN_PX either side of a line `penWidth` canvas px wide, at any zoom. It is
// the one zoom-reading part of a stroke, so a zoom re-renders it and not the ink
// (docs/specs/008-canvas/canvas-performance.md). `trim` takes a width the line already covers.
export function StrokeHitPath({
  penWidth,
  trim = 0,
  ...path
}: { penWidth: number; trim?: number } & Omit<SVGProps<SVGPathElement>, 'strokeWidth' | 'stroke'>) {
  const zoom = useCanvasZoom();
  return (
    <path
      data-stroke-hit=""
      stroke="transparent"
      strokeWidth={Math.max(0, strokeHitWidth(penWidth, zoom) - trim)}
      {...path}
    />
  );
}

export function FreehandSvg({
  element,
  fill,
  stroke,
  hitPenWidth,
}: {
  element: FreehandElement;
  fill: string;
  stroke: string;
  // Set when only the drawn line picks the stroke (a whiteboard pen stroke not yet selected): the
  // line's width in canvas px, which StrokeHitPath grows into the band that catches pointers.
  hitPenWidth?: number;
}) {
  // Map normalised points to the 100x100 viewBox before threading
  // them through the smoothing helper. `points.length < 2` collapses
  // to an empty path; the renderer then draws nothing, which is the
  // right behaviour for a degenerate single-click "stroke".
  // A whiteboard pen stroke (docs/specs/023-draw-mode/draw-mode.md "Pens") is ink on the board:
  // the filled perfect-freehand outline of its raw points and pressures (pen-stroke.ts), in canvas
  // coordinates in a viewBox on the element's own box (penStrokeSvg), so the canvas zoom scales it
  // like everything else, identically in every browser, and the outline's numbers never depend on
  // where the box is. The stroke being drawn (whiteboard/LiveInk.tsx) is this same svg in the same
  // layer, so its settled ink stays still as it grows and release changes no pixel.
  const pen = isPenStroke(element);
  // Every other stroke keeps a 100-unit viewBox and its non-scaling preset.
  const vbW = 100;
  const vbH = 100;
  const vbPoints = pen
    ? []
    : freehandCanvasPoints({ ...element, x: 0, y: 0, width: vbW, height: vbH });
  // Polygon-tool paths (docs/specs/008-canvas/polygon-tool.md) keep their deliberate corners:
  // straight M/L segments instead of the Catmull-Rom smoothing the
  // sampled pencil strokes want.
  const d =
    vbPoints.length < 2
      ? ''
      : element.straightEdges
        ? vbPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') +
          (element.closed ? ' Z' : '')
        : catmullRomToBezierPath(vbPoints, element.closed);
  // A Polygon-tool outline follows its tab's finish (docs/specs/008-canvas/finish.md "Polygons"): drawn by hand
  // under Sketch and Marker (the element's SketchOverlay draws it; this keeps only its hit line), its unset width
  // Thin under Professional.
  const finish = useElementFinish(undefined);
  const polygon = isPolygonOutline(element);
  const handDrawn = polygon && isHandDrawn(finish);
  // A recorded pen width (a whiteboard pen, docs/specs/023-draw-mode/draw-mode.md) wins over the preset.
  const widthPx = polygon
    ? polygonStrokePx(element, finish)
    : (element.penWidth ?? BORDER_STROKE_PX[element.strokeWidth ?? DEFAULT_BORDER_STROKE]);
  // Highlighter recipe (docs/specs/008-canvas/highlighter.md): the marker owns width + translucency
  // (fixed wide round stroke, multiply blend, never filled) so the
  // border-preset widths and dash styles don't apply. Kept in sync
  // with svgFreehandShape (the headless twin) by the spec.
  const isHighlighter = element.pen === 'highlighter';
  const dasharray = BORDER_DASH_ARRAY[element.strokeStyle ?? DEFAULT_BORDER_STYLE];
  // A Drawing animation (docs/specs/028-animation/element-animations.md) works from the stroke's
  // centre line: the drawn path itself for a stroked line, the raw points for pen ink.
  const anim = useDrawingAnimation(
    element,
    pen ? () => penCentreLine(element) : d,
    isHighlighter ? (element.penWidth ?? 14) : widthPx,
    stroke,
  );
  if (pen) {
    const { viewBox, d: outline } = penStrokeSvg(element);
    // A marker loop the Fill tool closed (docs/specs/023-draw-mode/fill-tool.md): its fill under its
    // ink, along the centre line, so the ink stays the outline; picked by its fill too.
    const loopFill = isFilledPenLoop(element) ? penLoopFillPath(element) : '';
    return (
      <>
        <svg
          className={FREEHAND_SVG_CLASS}
          viewBox={viewBox}
          preserveAspectRatio="none"
          aria-hidden
        >
          {anim.defs}
          {loopFill ? (
            <path
              d={loopFill}
              fill={fill}
              stroke="none"
              data-loop-fill=""
              style={hitPenWidth !== undefined ? { pointerEvents: 'all' } : undefined}
            />
          ) : null}
          <path d={outline} fill={stroke} stroke="none" {...anim.mainProps} />
          {hitPenWidth !== undefined ? (
            // Only the drawn line picks the stroke (docs/specs/023-draw-mode/draw-mode.md "Selecting"):
            // the outline, grown by the margin either side, catches pointers.
            <StrokeHitPath
              penWidth={hitPenWidth}
              trim={element.penWidth ?? 0}
              d={outline}
              fill="transparent"
              strokeLinejoin="round"
              style={{ pointerEvents: 'all' }}
            />
          ) : null}
        </svg>
        {anim.overlay}
      </>
    );
  }
  return (
    <>
      <svg
        className={FREEHAND_SVG_CLASS}
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {anim.defs}
        {d && !handDrawn ? (
          <path
            {...anim.mainProps}
            d={d}
            // Closed paths get the fill; open strokes leave fill at
            // none so the bounding box doesn't read as a closed shape.
            fill={element.closed && !isHighlighter ? fill : 'none'}
            stroke={stroke}
            strokeWidth={isHighlighter ? (element.penWidth ?? 14) : widthPx}
            strokeOpacity={isHighlighter ? 0.45 : undefined}
            style={
              isHighlighter
                ? { ...anim.mainProps.style, mixBlendMode: 'multiply' }
                : anim.mainProps.style
            }
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={isHighlighter ? undefined : (dasharray ?? undefined)}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {d && hitPenWidth !== undefined ? (
          <StrokeHitPath
            penWidth={hitPenWidth}
            d={d}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: 'stroke' }}
          />
        ) : null}
      </svg>
      {anim.overlay}
    </>
  );
}

// A pen stroke's centre line in the canvas coordinates its svg draws in (penStrokeSvg).
function penCentreLine(element: FreehandElement): string {
  const pts = freehandCanvasPoints(element);
  return pts.length < 2 ? '' : catmullRomToBezierPath(pts, element.closed);
}
