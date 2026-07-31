// Inline SVG icons for the rich-text toolbars (the overflow ellipsis and the
// font-family glyph). Pure presentational; split out of RichTextToolbar.
//
// The bullet / numbered / no-list / heading glyphs that lived here went with
// the buttons they labelled: both toolbars now use the block-type picker
// (spec/102), which is a word list, not a row of pictograms.
export function EllipsisIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="4" cy="8" r="1.4" fill="currentColor" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      <circle cx="12" cy="8" r="1.4" fill="currentColor" />
    </svg>
  );
}

// A serif "A" — the font/typeface glyph for the Font submenu row.
export function FontGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <text x="8" y="12" textAnchor="middle" fontSize="12" fontFamily="Georgia, serif">
        A
      </text>
    </svg>
  );
}
