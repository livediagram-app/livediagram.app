import {
  ARROWHEAD_SHAPES,
  ARROWHEAD_SIZE_PX,
  type ArrowheadShape,
  type ArrowheadSize,
} from '@livediagram/diagram';

// The arrowhead marker system (spec/09 arrow styles), lifted out of
// ArrowView: the shared <defs> block Canvas mounts once, the per-shape
// marker geometry, and the id scheme each arrow's markerStart / markerEnd
// references.

export function arrowheadMarkerId(shape: ArrowheadShape, size: ArrowheadSize): string {
  return `arrowhead-${shape}-${size}`;
}

// Inner geometry for one arrowhead shape, drawn in the marker's
// 0..10 viewBox with the attachment point at x≈9. `context-stroke`
// is the canonical SVG2 way to inherit the referencing line's colour
// through the marker boundary (currentColor didn't inherit reliably).
// The `-hollow` variants fill white and outline with the line colour;
// `line` is an open V with no fill.
function arrowheadMarkerShape(shape: ArrowheadShape) {
  switch (shape) {
    case 'triangle':
      return <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />;
    case 'triangle-hollow':
      return (
        <path d="M 0.6 1 L 9.4 5 L 0.6 9 z" fill="white" stroke="context-stroke" strokeWidth={1} />
      );
    case 'line':
      return (
        <path
          d="M 0 0 L 10 5 L 0 10"
          fill="none"
          stroke="context-stroke"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'circle':
      return <circle cx="5" cy="5" r="4.5" fill="context-stroke" />;
    case 'circle-hollow':
      return <circle cx="5" cy="5" r="4" fill="white" stroke="context-stroke" strokeWidth={1} />;
    case 'diamond':
      return <path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill="context-stroke" />;
    case 'diamond-hollow':
      return (
        <path
          d="M 0.7 5 L 5 0.7 L 9.3 5 L 5 9.3 z"
          fill="white"
          stroke="context-stroke"
          strokeWidth={1}
        />
      );
  }
}

export function ArrowDefs() {
  // One marker per (head shape x size preset) so an arrow can choose
  // its head shape and weight independently of the line's stroke
  // width. Symmetric shapes (circle / diamond) read the same at either
  // end; triangle / line flip via orient="auto-start-reverse".
  return (
    <defs>
      {ARROWHEAD_SHAPES.flatMap((shape) =>
        (Object.entries(ARROWHEAD_SIZE_PX) as [ArrowheadSize, number][]).map(([size, px]) => (
          <marker
            key={`${shape}-${size}`}
            id={arrowheadMarkerId(shape, size)}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth={px}
            markerHeight={px}
            orient="auto-start-reverse"
          >
            {arrowheadMarkerShape(shape)}
          </marker>
        )),
      )}
    </defs>
  );
}
