'use client';

import { PoolMoment } from './OfficeMoments';
import { FurniturePartView } from './FurnitureView';
import { swimmingPoolParts, type ShapeElement } from '@livehuddle/document';

// A Swimming Pool (docs/specs/009-elements/venue-pieces.md "Swimming Pool"): a tiled deck, the water in the element's
// fill, lane stripes, a lane of floats and a ladder, drawn to its own size like the Pond, with the Pond's faint ripple
// drifting across the water (CSS lh-ripple, still under reduced motion).
export function SwimmingPoolView({
  element,
  stroke,
  floor,
  animClass,
}: {
  element: ShapeElement;
  stroke: string;
  floor: string;
  animClass?: string;
}) {
  const { width: w, height: h } = element;
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label="Swimming pool"
      >
        {swimmingPoolParts(w, h).map((p, i) => (
          <FurniturePartView key={i} part={p} seat={floor} stroke={stroke} />
        ))}
        <path
          d={`M${w * 0.3} ${h * 0.36}q${w * 0.06} ${h * -0.04} ${w * 0.12} 0M${w * 0.58} ${h * 0.7}q${w * 0.05} ${h * -0.03} ${w * 0.1} 0`}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1.5}
          strokeLinecap="round"
          className="lh-social-anim lh-ripple"
          aria-hidden
        />
        {/* A rubber duck each time you walk up (docs/specs/009-elements/piece-moments.md). */}
        <PoolMoment id={element.id} width={w} height={h} />
      </svg>
    </div>
  );
}
