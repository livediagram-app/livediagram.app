'use client';

// Whiteboard shape outlines drawn over the canvas before they land
// (docs/specs/023-whiteboard/whiteboard.md "Shapes", "Shape recognition"): a dock shape being dragged
// out, and the shape a held-still pen stroke is recognised as.

import {
  BORDER_STROKE_PX,
  nearestBorderStroke,
  type RecognisedShape,
  type ShapeKind,
} from '@livediagram/document';
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

// The shape a pen stroke is recognised as, while the pen holds still: drawn
// where and as it will land (commit-freehand's whiteboardStroke), in the pen's
// colour and nearest border weight, unfilled; a line in the pen's own width.
// In canvas px, inside the canvas's transformed layer beside the live ink
// (WhiteboardPenPreview), so the canvas zoom scales it as it scales the shape
// that lands.
export function RecognisedShapePreview({
  shape,
  colour,
  penWidth,
}: {
  shape: RecognisedShape;
  colour: string;
  penWidth: number;
}) {
  if (shape.kind === 'line') {
    const from = shape.from ?? { x: shape.bbox.x, y: shape.bbox.y };
    const to = shape.to ?? {
      x: shape.bbox.x + shape.bbox.width,
      y: shape.bbox.y + shape.bbox.height,
    };
    return (
      <svg
        aria-hidden
        data-recognition-preview="line"
        className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-visible"
      >
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={colour}
          strokeWidth={penWidth}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  const width = Math.max(16, shape.bbox.width);
  const height = Math.max(16, shape.bbox.height);
  const css = shape.kind === 'square' || shape.kind === 'circle';
  return (
    <div
      aria-hidden
      data-recognition-preview={shape.kind}
      className="pointer-events-none absolute"
      style={{ left: shape.bbox.x, top: shape.bbox.y, width, height }}
    >
      <PenShapePreview
        kind={shape.kind}
        colour={colour}
        widthPx={BORDER_STROKE_PX[nearestBorderStroke(penWidth)]}
        usesSvg={!css}
        radius={shape.kind === 'circle' ? '50%' : '4px'}
        zoom={1}
        aspect={height > 0 ? width / height : 1}
      />
    </div>
  );
}
