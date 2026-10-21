// A type's glyph (docs/specs/026-plan/item-types.md "An item type"), from the Plan glyph set in
// @liveplanner/items, drawn inline on a 16-unit grid so a card never waits for an icon catalogue.
// Stroked in the type's colour by the caller.
import { planGlyphPath } from '@liveplanner/items';

export function PlanTypeGlyph({
  glyph,
  color,
  size = 12,
}: {
  glyph: string | undefined;
  // The stroke; absent, the glyph draws in currentColor (an accent painted by ACCENT_TEXT).
  color?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={planGlyphPath(glyph)} />
    </svg>
  );
}
