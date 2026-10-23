'use client';

import { memo, useMemo } from 'react';
import {
  MARKER_DETAIL_PX,
  MARKER_INK_OPACITY,
  MARKER_STREAK_OPACITY,
  SHAPE_DETAIL_STROKE_PX,
  SKETCH_HATCH_OPACITY,
  handDrawnElementPaint,
  handDrawnInk,
  type BoxedElement,
  type Finish,
  type HandDrawnPaint,
} from '@livedesign/design';

// A sketched element's body on the canvas (docs/specs/008-canvas/finish.md "Sketch"): the hand-drawn outline,
// solid fill with faint pencil shading over it, and chrome from sketch-element.ts in @livedesign/design, the same drawing the
// SVG export emits. It stands in for the wrapper's CSS border and background (element-variant.ts drops them
// under Sketch) and for the shape's SVG overlay (ShapeContentRouter skips it), and sits under the label. Marker's
// felt-tip body (docs/specs/008-canvas/finish.md "Marker", marker-element.ts) takes the same place, drawn in layers of
// see-through ink so crossings pool darker.

type SketchPaint = HandDrawnPaint;

/** The element's sketch, memoised on what shapes it: never on position, so a drag recomputes nothing
 *  (docs/specs/008-canvas/canvas-performance.md). Null when the element is not sketched. */
export function useSketchPaint(
  element: BoxedElement,
  finish: Finish,
  fill: string,
  // Something sits on this shape (sketch-backdrop-store): a solid fill, never hatching.
  backdrop = false,
): SketchPaint | null {
  const shape = element.type === 'shape' ? element.shape : undefined;
  const {
    strokeWidth,
    strokeStyle,
    borderRadius,
    packedPoints,
    closed,
    straightEdges,
    penWidth,
    nodes,
    subpaths,
  } = element as {
    strokeWidth?: string;
    strokeStyle?: string;
    borderRadius?: string;
    // A Polygon-tool outline's own points (docs/specs/008-canvas/finish.md "Polygons").
    packedPoints?: string;
    closed?: boolean;
    straightEdges?: boolean;
    penWidth?: number;
    // A Path-tool curve's nodes.
    nodes?: unknown;
    subpaths?: unknown;
  };
  return useMemo(
    () => handDrawnElementPaint(element, finish, fill, backdrop),
    // The fields the paint reads, so moving the element keeps the drawing.
    // oxlint-disable-next-line react/exhaustive-deps
    [
      element.id,
      element.type,
      shape,
      element.width,
      element.height,
      strokeWidth,
      strokeStyle,
      borderRadius,
      packedPoints,
      closed,
      straightEdges,
      penWidth,
      nodes,
      subpaths,
      finish,
      fill,
      backdrop,
    ],
  );
}

function SketchOverlayImpl({
  paint,
  width,
  height,
  fill,
  stroke: lineColour,
}: {
  paint: SketchPaint;
  width: number;
  height: number;
  fill: string;
  stroke: string;
}) {
  const { drawing, strokePx, dash } = paint;
  // A line too pale to read on its fill (a card's or a page's hairline grey) is drawn in a stronger shade.
  const stroke = handDrawnInk(lineColour, fill);
  const line = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  if (drawing.pen === 'marker') {
    // Bottom to top: the fill, the colouring's streaks, the outline's ink, the chrome (svg-render-sketch.ts's
    // svgMarkerDrawing in the export). Each layer is its own path so crossings between them pool.
    return (
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        data-finish="marker"
        aria-hidden
      >
        {drawing.solid ? (
          <path
            d={drawing.solid}
            fill={fill}
            fillRule={drawing.solidEvenOdd ? 'evenodd' : undefined}
          />
        ) : null}
        {drawing.streaks.map((d, i) =>
          d ? (
            <path
              key={`s${i}`}
              d={d}
              stroke={stroke}
              strokeOpacity={MARKER_STREAK_OPACITY}
              strokeWidth={drawing.nibPx}
              {...line}
            />
          ) : null,
        )}
        {drawing.ink.map((d, i) =>
          d ? (
            <path
              key={`i${i}`}
              d={d}
              stroke={stroke}
              strokeOpacity={MARKER_INK_OPACITY}
              strokeWidth={strokePx}
              strokeDasharray={dash ?? undefined}
              {...line}
            />
          ) : null,
        )}
        {drawing.details ? (
          <path
            d={drawing.details}
            stroke={stroke}
            strokeOpacity={MARKER_INK_OPACITY}
            strokeWidth={MARKER_DETAIL_PX}
            {...line}
          />
        ) : null}
      </svg>
    );
  }
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      data-finish="sketch"
      aria-hidden
    >
      {drawing.solid ? (
        <path
          d={drawing.solid}
          fill={fill}
          fillRule={drawing.solidEvenOdd ? 'evenodd' : undefined}
        />
      ) : null}
      {drawing.hatch ? (
        <path
          d={drawing.hatch}
          stroke={stroke}
          strokeOpacity={SKETCH_HATCH_OPACITY}
          strokeWidth={Math.max(1, strokePx / 2)}
          {...line}
        />
      ) : null}
      {drawing.strokes ? (
        <path
          d={drawing.strokes}
          stroke={stroke}
          strokeWidth={strokePx}
          strokeDasharray={dash ?? undefined}
          {...line}
        />
      ) : null}
      {drawing.details ? (
        <path d={drawing.details} stroke={stroke} strokeWidth={SHAPE_DETAIL_STROKE_PX} {...line} />
      ) : null}
    </svg>
  );
}

export const SketchOverlay = memo(SketchOverlayImpl);
