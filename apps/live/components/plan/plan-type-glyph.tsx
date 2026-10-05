// A type's glyph (docs/specs/025-plan/item-types.md "An item type"), from the Plan glyph set in
// @livediagram/items, drawn inline on a 16-unit grid so a card never waits for an icon catalogue.
// Stroked in the type's colour by the caller.
import { planGlyphPath } from '@livediagram/items';

export function PlanTypeGlyph({
  glyph,
  color,
  size = 12,
}: {
  glyph: string | undefined;
  color: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={planGlyphPath(glyph)} />
    </svg>
  );
}
