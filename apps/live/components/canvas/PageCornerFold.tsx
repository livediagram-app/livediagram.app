// The bottom-right curl on a Page (spec/100).
//
// Two triangles in one SVG: the sheet's corner is cut away, and a smaller
// leaf is laid back over the cut, slightly darker. That reads as a lifted
// corner far more cheaply than a real curl (which would need a gradient and
// a bezier, and would fight the element's own border on every resize).
//
// Drawn in element-space px rather than a percentage, so the fold stays the
// same physical size whether the page is A4 or has been dragged out wide —
// a fold that scaled with the box would look like a giant dog-ear on a big
// page and vanish on a small one.
const FOLD_PX = 22;

export function PageCornerFold({
  width,
  height,
  fill,
  stroke,
}: {
  width: number;
  height: number;
  // The page's own body + border colours, so a recoloured page keeps a fold
  // that belongs to it rather than a hardcoded grey one.
  fill: string;
  stroke: string;
}) {
  // Degenerate on a page dragged smaller than the fold itself.
  const size = Math.min(FOLD_PX, width / 2, height / 2);
  if (size <= 2) return null;
  return (
    <svg
      // Pinned to the corner with right/bottom rather than a computed
      // left/top: the wrapper is inside the canvas's scaled transform, so
      // arithmetic against the element's own width lands in the wrong
      // coordinate space. The corner is the corner.
      className="pointer-events-none absolute bottom-0 right-0"
      style={{ width: size, height: size }}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      {/* The cut corner: paint it as canvas so the sheet reads as missing
          there, then lay the leaf over it. */}
      <path d={`M ${size} 0 L ${size} ${size} L 0 ${size} Z`} fill="var(--lvd-canvas-bg, #fff)" />
      {/* The turned-back leaf. Slightly darker than the body via a flat
          overlay rather than a gradient: one shade reads as folded paper at
          canvas zoom, and stays honest in dark mode where a light-to-dark
          gradient would glow. */}
      <path
        d={`M ${size} 0 L 0 ${size} L ${size} ${size} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth="1"
      />
      <path d={`M ${size} 0 L 0 ${size} L ${size} ${size} Z`} fill="rgba(15, 23, 42, 0.10)" />
      {/* The diagonal itself, so the fold has a defined edge against a body
          of the same colour. */}
      <path d={`M ${size} 0 L 0 ${size}`} stroke={stroke} strokeWidth="1" fill="none" />
    </svg>
  );
}
