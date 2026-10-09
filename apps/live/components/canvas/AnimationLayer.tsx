import { useRef } from 'react';
import { useTraceDashes } from './useTraceDashes';

// The Shape set's effect layer on an element (docs/specs/028-animation/element-animations.md
// "Shape"): Pulse's ring, Glow's halo, Trace's light and Gradient's band, drawn by motion-shape.css.
// It sits ABOVE the element's own face (painted after it), so a face that covers the whole box (a
// plan board, a code block, a legend) cannot hide it.
//
// Trace is a light with a fading tail running a rounded rectangle the size of the element, its
// dashes measured onto it in px (useTraceDashes) so it travels the outline at one steady speed:
// an angular sweep slows on a wide box's long sides and rushes its corners.
export function AnimationLayer({
  animation,
  width,
  height,
  radius,
}: {
  animation: string;
  width: number;
  height: number;
  radius: number;
}) {
  const group = useRef<SVGGElement>(null);
  const trace = animation === 'trace';
  useTraceDashes(group, trace, `${width}:${height}:${radius}`);
  if (!trace) return <span className="lvd-anim-layer" aria-hidden />;
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const r = Math.min(radius, w / 2, h / 2);
  const outline = {
    x: 1,
    y: 1,
    width: Math.max(w - 2, 0),
    height: Math.max(h - 2, 0),
    rx: r,
    ry: r,
  };
  return (
    <span className="lvd-anim-layer" aria-hidden>
      <svg
        className="absolute inset-0 overflow-visible"
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
      >
        <g ref={group} className="lvd-svg-trace">
          <rect
            {...outline}
            className="lvd-svg-trace-tail"
            fill="none"
            stroke="var(--lvd-anim-color, #0ea5e9)"
            strokeWidth={5}
            strokeOpacity={0.3}
            strokeLinecap="round"
          />
          <rect
            {...outline}
            className="lvd-svg-trace-head"
            fill="none"
            stroke="var(--lvd-anim-color, #0ea5e9)"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      </svg>
    </span>
  );
}
