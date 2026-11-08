'use client';

// A whiteboard shape's outline drawn over the canvas before it lands
// (docs/specs/023-draw-mode/draw-mode.md "Shapes"): a dock shape being dragged out.

import type { ShapeKind } from '@livehuddle/document';
import { ShapeSvgOverlay } from '@/components/canvas/shape-svg-overlay';

// A whiteboard shape while it is drawn: the outline the committed shape will
// have, in the board's ink at the default weight, unfilled. SVG-rendered outlines keep a
// screen-px stroke; CSS-bordered ones (rectangle, ellipse) scale with the zoom,
// as the committed shapes do.
export function PenShapePreview({
  kind,
  colour,
  widthPx,
  usesSvg,
  radius,
  zoom,
  aspect,
}: {
  kind: ShapeKind;
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
