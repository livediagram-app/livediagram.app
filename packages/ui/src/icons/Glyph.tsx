import type { SVGProps } from 'react';

// The chrome-icon base: a square, stroke-currentColor, decorative SVG. Every
// named icon in this folder is a Glyph with its own path data and a default
// size + stroke weight (the rendering most of its call sites used before the
// copies were collapsed here). Colour always comes from the parent's text
// colour via `currentColor`.
//
// Distinct from @livediagram/icons, which is the CANVAS icon catalogue as SVG
// markup strings; these are React components for app chrome.

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'strokeWidth'> & {
  // Rendered width and height in px.
  size?: number;
  // Stroke weight in viewBox units.
  strokeWidth?: number;
};

type GlyphProps = IconProps & {
  // Glyphs are drawn on a square viewBox of this many units.
  units?: number;
  // A filled glyph paints its shapes with currentColor and no stroke.
  filled?: boolean;
};

export function Glyph({
  size = 16,
  strokeWidth = 1.5,
  units = 16,
  filled = false,
  children,
  ...rest
}: GlyphProps) {
  const paint = filled
    ? { fill: 'currentColor' }
    : {
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
      };
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${units} ${units}`}
      aria-hidden
      {...paint}
      {...rest}
    >
      {children}
    </svg>
  );
}
