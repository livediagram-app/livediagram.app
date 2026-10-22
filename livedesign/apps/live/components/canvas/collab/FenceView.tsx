'use client';

import { fenceParts, FENCE_RAIL_OPACITY, type ShapeElement } from '@livedesign/document';

// A fence (docs/specs/009-elements/fence.md): one straight run of posts and rails that an Avatar-mode
// character cannot walk through. Drawn from the shared `fenceParts` table, which the headless export
// draws too, in the element's own box (its rotation is the element's, applied by the wrapper).
export function FenceView({
  element,
  stroke,
  animClass,
}: {
  element: ShapeElement;
  // The resolved timber colour: the element's own stroke, or the wood brown for the paper.
  stroke: string;
  // Glow / pulse / trace / gradient, on the drawing's silhouette rather than the transparent box.
  animClass?: string;
}) {
  const { width, height } = element;
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label="Fence"
      >
        {fenceParts(width, height).map((p, i) => (
          <rect
            key={i}
            x={p.x}
            y={p.y}
            width={p.width}
            height={p.height}
            rx={p.rx}
            fill={stroke}
            opacity={p.role === 'rail' ? FENCE_RAIL_OPACITY : undefined}
          />
        ))}
      </svg>
    </div>
  );
}
