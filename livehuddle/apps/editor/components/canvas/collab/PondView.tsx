'use client';

import { FurniturePartView } from './FurnitureView';
import { pondParts, type ShapeElement } from '@livehuddle/document';

// A Pond (docs/specs/009-elements/social-pieces.md "Pond"): a stone rim, the water in the element's fill and two lily
// pads, drawn to its own size like grass, with a faint ripple drifting across it (CSS, still under reduced motion).
export function PondView({
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
        aria-label="Pond"
      >
        {pondParts(w, h).map((p, i) => (
          <FurniturePartView key={i} part={p} seat={floor} stroke={stroke} />
        ))}
        <path
          d={`M${w * 0.42} ${h * 0.3}q${w * 0.06} ${h * -0.04} ${w * 0.12} 0M${w * 0.5} ${h * 0.78}q${w * 0.05} ${h * -0.03} ${w * 0.1} 0`}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1.5}
          strokeLinecap="round"
          className="lh-social-anim lh-ripple"
          aria-hidden
        />
      </svg>
    </div>
  );
}
