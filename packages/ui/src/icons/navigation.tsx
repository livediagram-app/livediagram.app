import { Glyph, type IconProps } from './Glyph';

// Navigation glyphs: chevrons, the hamburger menu and the search magnifier.

// Downward chevron on a 12-unit viewBox: dropdown triggers and disclosure
// toggles (rotate it with a className for the open state).
export function ChevronDownIcon({ size = 10, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} units={12} {...rest}>
      <path d="M3 4.5 6 7.5 9 4.5" />
    </Glyph>
  );
}

export function ChevronLeftIcon({ size = 14, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <path d="M10 3.5 5.5 8l4.5 4.5" />
    </Glyph>
  );
}

export function ChevronRightIcon({ size = 14, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </Glyph>
  );
}

// Three bars on a 12-unit viewBox.
export function MenuIcon({ size = 12, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} units={12} {...rest}>
      <path d="M2 3h8M2 6h8M2 9h8" />
    </Glyph>
  );
}

export function SearchIcon({ size = 16, strokeWidth = 1.6, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l3.5 3.5" />
    </Glyph>
  );
}

// Three filled dots: a "more actions" / overflow trigger.
export function EllipsisIcon({ size = 16, ...rest }: IconProps) {
  return (
    <Glyph size={size} filled {...rest}>
      <circle cx="3.5" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="12.5" cy="8" r="1.3" />
    </Glyph>
  );
}
