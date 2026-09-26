import { Glyph, type IconProps } from './Glyph';

// Status + label glyphs: the share-state badge dots (spec/24 / spec/35), the
// Tabs label, the sign-in sparkle and the error-state crossed circle. The
// marketing hero illustration draws the editor's chrome with these same
// components, so the two can't drift apart.

// Connected nodes on a 9-unit viewBox: the "Shared" badge.
export function SharedDotIcon({ size = 9, strokeWidth = 1.4, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} units={9} {...rest}>
      <circle cx="2" cy="4.5" r="1.4" />
      <circle cx="7" cy="2" r="1.2" />
      <circle cx="7" cy="7" r="1.2" />
      <path d="M3.2 3.8L5.9 2.5M3.2 5.2L5.9 6.5" />
    </Glyph>
  );
}

// Padlock on a 9-unit viewBox: the "Private" badge.
export function PrivateDotIcon({ size = 9, strokeWidth = 1.4, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} units={9} {...rest}>
      <rect x="2" y="4" width="5" height="3.5" rx="0.8" />
      <path d="M3.25 4V3a1.25 1.25 0 0 1 2.5 0v1" />
    </Glyph>
  );
}

// Folder-tab stack on a 12-unit viewBox, paired with the tab bar's TABS
// label: reads as "tabs of paper", not the canvas's shape tooling.
export function TabsLabelIcon({ size = 11, strokeWidth = 1.4, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} units={12} {...rest}>
      <path d="M1.5 4.5h3l1 1.25h5v4.25h-9z" />
      <path d="M3 4.5V3h3.25" />
    </Glyph>
  );
}

// A large and a small four-point star, filled: the sign-in prompts.
export function SparkleIcon({ size = 14, ...rest }: IconProps) {
  return (
    <Glyph size={size} filled {...rest}>
      <path d="M8 1.5 9.2 5.4 13 6.6 9.2 7.8 8 11.7 6.8 7.8 3 6.6 6.8 5.4 8 1.5Z" />
      <path d="M13 10.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z" />
    </Glyph>
  );
}

// A crossed-out circle on a 24-unit viewBox: the "not found" / "no access"
// error cards.
export function CircleXIcon({ size = 28, strokeWidth = 1.75, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} units={24} {...rest}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M9 15l6-6" />
    </Glyph>
  );
}
