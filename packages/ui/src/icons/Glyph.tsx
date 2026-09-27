import { glyphStrokePx } from '@livediagram/icons';
import type { SVGProps } from 'react';

// The chrome-icon base: a square, stroke-currentColor, decorative SVG. Every
// named icon in this folder is a Glyph with its own path data and a default
// size. Weight is on-screen px (docs/specs/004-interface-design/iconography.md),
// converted to viewBox units here, so every glyph reads the same weight
// whatever its grid. Colour always comes from the parent's text colour.
//
// Distinct from @livediagram/icons, which is the CANVAS icon catalogue as SVG
// markup strings; these are React components for app chrome.

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'strokeWidth'> & {
  // Rendered width and height in px.
  size?: number;
  // On-screen stroke in px; defaults to the house weight for the size.
  weight?: number;
};

type GlyphProps = IconProps & {
  // Glyphs are drawn on a square viewBox of this many units.
  units?: number;
  // A filled glyph paints its shapes with currentColor and no stroke.
  filled?: boolean;
};

export function Glyph({
  size = 16,
  weight,
  units = 16,
  filled = false,
  className,
  children,
  ...rest
}: GlyphProps) {
  const paint = filled
    ? { fill: 'currentColor' }
    : {
        fill: 'none',
        stroke: 'currentColor',
        // On-screen px: every child is non-scaling (.lvd-glyph in the shared theme), so CSS sizing and
        // canvas zoom leave the weight alone.
        strokeWidth: weight ?? glyphStrokePx(size),
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
      };
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${units} ${units}`}
      aria-hidden
      className={className ? `lvd-glyph ${className}` : 'lvd-glyph'}
      {...paint}
      {...rest}
    >
      {children}
    </svg>
  );
}
