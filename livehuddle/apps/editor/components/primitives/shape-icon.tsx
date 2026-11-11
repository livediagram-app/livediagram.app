// A mini box glyph on a 16x16 viewBox: the palette drag ghost, a placement preview's fallback and the style-preset
// swatches (docs/specs/010-palette/style-presets.md). It drew each diagram shape's own outline until those kinds were
// retired (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5); every kind the
// editor still previews here (a sticky, a Space piece) reads as a rounded box.

// The stroke width hand-tuned for the box at icon scale.
const BOX_STROKE = 1.5;

// Parameterised box glyph: an outline by default, or filled / dashed /
// weighted for the preset swatches.
export function ShapeGlyph({
  fill = 'none',
  stroke = 'currentColor',
  strokeWidth,
  dash,
  size = 14,
}: {
  fill?: string;
  stroke?: string;
  // Overrides the box's default weight (in 16-unit viewBox units).
  strokeWidth?: number;
  // SVG stroke-dasharray (16-unit units) for dotted / dashed previews.
  dash?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth ?? BOX_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dash}
      aria-hidden
    >
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
    </svg>
  );
}
