import { Glyph } from '../icons/Glyph';
// Glyphs for the collapsible tile groups inside a palette category
// (PaletteTileGroup), and for the six Collaborate categories, which were groups
// once (palette-categories.tsx). Kept beside the tab icons rather than inline in
// the tab bodies, so the category files stay a list of what's in them.

/** Media → Embed: a framed play triangle. */
export function EmbedGroupIcon() {
  return (
    <Glyph size={18} units={24}>
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
      <path d="M2.5 8h19" />
      <path d="M10.5 12.2v3.6l3.2-1.8z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Components → Web Elements: a page with a header band and stacked sections. */
export function WebGroupIcon() {
  return (
    <Glyph size={18} units={24}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="M3 8h18" />
      <rect x="6" y="11" width="12" height="3.5" rx="1" fill="currentColor" stroke="none" />
      <path d="M6 17.5h7" />
    </Glyph>
  );
}
