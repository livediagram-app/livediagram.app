// Inline SVG icons for the rich-text toolbar (overflow ellipsis, the three
// list-style glyphs, and the font-family glyph). Pure presentational; split
// out of RichTextToolbar.
export function EllipsisIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="4" cy="8" r="1.4" fill="currentColor" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      <circle cx="12" cy="8" r="1.4" fill="currentColor" />
    </svg>
  );
}

// Bulleted-list glyph: three dots + lines.
export function BulletListIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="3" cy="4" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M6.5 4h7M6.5 8h7M6.5 12h7" />
    </svg>
  );
}

// Numbered-list glyph: 1/2/3 + lines.
export function NumberedListIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6.5 4h7M6.5 8h7M6.5 12h7" />
      <text x="1.5" y="5.5" fontSize="5" fill="currentColor" stroke="none">
        1
      </text>
      <text x="1.5" y="9.5" fontSize="5" fill="currentColor" stroke="none">
        2
      </text>
      <text x="1.5" y="13.5" fontSize="5" fill="currentColor" stroke="none">
        3
      </text>
    </svg>
  );
}

// "Remove list" glyph: lines with a slash.
export function NoListIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6.5 4h7M6.5 8h7M6.5 12h7" />
      <path d="M2.5 13.5l11-11" />
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
