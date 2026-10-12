'use client';

import { memo, useMemo } from 'react';
import {
  SHAPE_DETAIL_STROKE_PX,
  sketchElementPaint,
  type BoxedElement,
  type Finish,
} from '@livediagram/document';

// A sketched element's body on the canvas (docs/specs/008-canvas/finish.md "Sketch"): the hand-drawn outline,
// hatching or solid fill, and chrome from sketch-element.ts in @livediagram/document, the same drawing the
// SVG export emits. It stands in for the wrapper's CSS border and background (element-variant.ts drops them
// under Sketch) and for the shape's SVG overlay (ShapeContentRouter skips it), and sits under the label.

type SketchPaint = NonNullable<ReturnType<typeof sketchElementPaint>>;

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
  const { strokeWidth, strokeStyle, borderRadius } = element as {
    strokeWidth?: string;
    strokeStyle?: string;
    borderRadius?: string;
  };
  return useMemo(
    () => sketchElementPaint(element, finish, fill, backdrop),
    // The fields sketchElementPaint reads, so moving the element keeps the drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      element.id,
      element.type,
      shape,
      element.width,
      element.height,
      strokeWidth,
      strokeStyle,
      borderRadius,
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
  stroke,
}: {
  paint: SketchPaint;
  width: number;
  height: number;
  fill: string;
  stroke: string;
}) {
  const { drawing, strokePx, dash } = paint;
  const line = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      data-finish="sketch"
      aria-hidden
    >
      {drawing.solid ? <path d={drawing.solid} fill={fill} /> : null}
      {drawing.hatch ? (
        <path d={drawing.hatch} stroke={fill} strokeWidth={Math.max(1, strokePx / 2)} {...line} />
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
