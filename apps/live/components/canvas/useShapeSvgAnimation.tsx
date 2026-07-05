import { useId } from 'react';

// The SVG-geometry animation adapter (spec/09), lifted out of
// ShapeSvgOverlay: 'trace' marches the shape's own outline, 'gradient'
// fills it with a moving gradient between the element's fill + accent,
// and 'pulse' / 'glow' radiate a drop-shadow off the true silhouette.
// Returns the fill / outline / root-class / defs pieces the overlay
// mounts on its per-shape SVG.
export type ShapeSvgAnimation = 'trace' | 'gradient' | 'pulse' | 'glow';

export function useShapeSvgAnimation(animation: ShapeSvgAnimation | undefined, fill: string) {
  // useId is not selector-safe (it emits ':' chars); strip them so the id is a
  // valid url(#…) fragment. One gradient def per overlay instance.
  const gradId = `lvd-grad-${useId().replace(/:/g, '')}`;
  // The moving gradient fills the shape body via an SVG paint server; the
  // marching-outline trace keeps the body's fill and only restyles the stroke.
  const effectiveFill = animation === 'gradient' ? `url(#${gradId})` : fill;
  // When tracing, the outline becomes a marching dash (overriding the user's
  // border style for the duration, the way a flowing arrow's dashes do).
  const traceOutline =
    animation === 'trace'
      ? { strokeDasharray: '10 8', strokeLinecap: 'round' as const, className: 'lvd-trace-run' }
      : null;
  // pulse / glow ride a CSS drop-shadow on the <svg> root. drop-shadow follows
  // the rendered alpha (the shape's silhouette / stroke), so the ring hugs the
  // true outline instead of the bounding box. Colour + speed come from the
  // inherited --lvd-anim-* props. The svg already sets overflow-visible so the
  // shadow isn't clipped to the box.
  const svgRoot = 'pointer-events-none absolute inset-0 h-full w-full overflow-visible';
  const svgClassName =
    animation === 'glow'
      ? `${svgRoot} lvd-svg-glow`
      : animation === 'pulse'
        ? `${svgRoot} lvd-svg-pulse`
        : svgRoot;
  // Three cycling stops blend fill ↔ accent into a flowing band; the inline
  // stop-color is the frozen (reduced-motion / export) resting frame.
  const gradientDefs =
    animation === 'gradient' ? (
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" className="lvd-grad-s0" stopColor="var(--lvd-anim-bg, #fff)" />
          <stop offset="50%" className="lvd-grad-s1" stopColor="var(--lvd-anim-color, #0ea5e9)" />
          <stop offset="100%" className="lvd-grad-s2" stopColor="var(--lvd-anim-bg, #fff)" />
        </linearGradient>
      </defs>
    ) : null;

  return { effectiveFill, traceOutline, svgClassName, gradientDefs };
}
