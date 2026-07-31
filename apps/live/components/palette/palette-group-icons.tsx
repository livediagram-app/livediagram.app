// Glyphs for the collapsible tile groups inside a palette category
// (PaletteTileGroup). Kept beside the tab icons rather than inline in the tab
// bodies, so the category files stay a list of what's in them.

/** Media → Embed: a framed play triangle. */
export function EmbedGroupIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
      <path d="M2.5 8h19" />
      <path d="M10.5 12.2v3.6l3.2-1.8z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Components → Web Elements: a page with a header band and stacked sections. */
export function WebGroupIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="M3 8h18" />
      <rect x="6" y="11" width="12" height="3.5" rx="1" fill="currentColor" stroke="none" />
      <path d="M6 17.5h7" />
    </svg>
  );
}
