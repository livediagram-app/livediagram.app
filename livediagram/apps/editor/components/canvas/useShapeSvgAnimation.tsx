import { useId, type SVGAttributes } from 'react';
import type { ShapePartRole } from '@livediagram/document';

// The SVG-geometry animation adapter (docs/specs/028-animation/element-animations.md "Shape"), lifted
// out of ShapeSvgOverlay. On an SVG-rendered shape the Shape set's Pulse, Glow, Trace and Gradient
// follow the true outline: Pulse expands a copy of the outline, Glow breathes a blurred copy of the
// silhouette behind the shape, Trace runs a light with a tail along a copy of the outline, and
// Gradient fills the body with a moving gradient. The copies are invisible at rest, so reduced
// motion and export show the plain shape. Colour, speed and size come from the wrapper's inherited
// --lvd-anim-* properties.
export type ShapeSvgAnimation = 'trace' | 'gradient' | 'pulse' | 'glow';

// The roles that draw the silhouette's edge; detail chrome (bezels, keys) is left out of copies.
const EDGE_ROLES: ReadonlySet<ShapePartRole> = new Set(['main', 'outline', 'limb', 'head']);

export type ShapeSvgEffectLayer = {
  className: string;
  // Painted before the shape (Glow) or after it.
  behind: boolean;
  paint: SVGAttributes<SVGElement>;
  // Trace draws two copies: a wide faint tail and the bright head ahead of it.
  extra?: SVGAttributes<SVGElement>;
};

const ACCENT = 'var(--lvd-anim-color, #0ea5e9)';

export function useShapeSvgAnimation(animation: ShapeSvgAnimation | undefined, fill: string) {
  // useId is not selector-safe (it emits ':' chars); strip them so the id is a
  // valid url(#…) fragment. One gradient def per overlay instance.
  const gradId = `lvd-grad-${useId().replace(/:/g, '')}`;
  const effectiveFill = animation === 'gradient' ? `url(#${gradId})` : fill;
  // Three cycling stops blend fill ↔ accent into a flowing band; the inline
  // stop-color is the frozen (reduced-motion / export) resting frame.
  const gradientDefs =
    animation === 'gradient' ? (
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" className="lvd-grad-s0" stopColor="var(--lvd-anim-bg, #fff)" />
          <stop offset="50%" className="lvd-grad-s1" stopColor="var(--lvd-anim-bg, #fff)" />
          <stop offset="100%" className="lvd-grad-s2" stopColor="var(--lvd-anim-bg, #fff)" />
        </linearGradient>
      </defs>
    ) : null;

  const effect: ShapeSvgEffectLayer | null =
    animation === 'pulse'
      ? {
          className: 'lvd-svg-ring',
          behind: false,
          paint: {
            fill: 'none',
            stroke: ACCENT,
            strokeWidth: 2,
            vectorEffect: 'non-scaling-stroke',
          },
        }
      : animation === 'glow'
        ? {
            className: 'lvd-svg-halo',
            behind: true,
            paint: {
              fill: ACCENT,
              stroke: ACCENT,
              strokeWidth: 4,
              vectorEffect: 'non-scaling-stroke',
            },
          }
        : animation === 'trace'
          ? {
              // The dashes are measured onto each copy (useTraceDashes).
              className: 'lvd-svg-trace',
              behind: false,
              paint: {
                className: 'lvd-svg-trace-tail',
                fill: 'none',
                stroke: ACCENT,
                strokeWidth: 5,
                strokeOpacity: 0.3,
                strokeLinecap: 'round',
                vectorEffect: 'non-scaling-stroke',
              },
              extra: {
                className: 'lvd-svg-trace-head',
                fill: 'none',
                stroke: ACCENT,
                strokeWidth: 3,
                strokeLinecap: 'round',
                vectorEffect: 'non-scaling-stroke',
              },
            }
          : null;

  return { effectiveFill, gradientDefs, effect };
}

export function isEdgeRole(role: ShapePartRole): boolean {
  return EDGE_ROLES.has(role);
}
