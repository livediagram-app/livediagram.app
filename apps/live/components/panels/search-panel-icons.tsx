import type { SearchResultItem } from '@/lib/search';
import { Glyph } from '@livediagram/ui';

// The search panel's result-kind glyphs (docs/specs/008-canvas/canvas-and-palette.md Search panel), lifted
// out of SearchPanel: a compact icon per result kind so users can scan
// the list by shape without reading labels. The input's magnifier is the
// shared SearchIcon from @livediagram/ui.

export function SearchResultIcon({ item }: { item: SearchResultItem }) {
  // Compact glyph per result kind so users can scan the list by
  // shape without reading labels.
  if (item.kind === 'shared') {
    // Diagram rect + an inbound arrow: someone else's diagram that
    // was shared into this account.
    return (
      <Glyph size={13} units={16} strokeLinecap="butt" strokeLinejoin="miter">
        <rect x="5" y="5" width="8" height="8" rx="1.5" />
        <path d="M2 2l4 4M6 3v3h-3" />
      </Glyph>
    );
  }
  if (item.kind === 'team') {
    // Two heads: a team.
    return (
      <Glyph size={13} units={16} strokeLinejoin="miter">
        <circle cx="6" cy="6" r="2.2" />
        <path d="M2.5 13c.5-2.3 1.7-3.5 3.5-3.5s3 1.2 3.5 3.5" />
        <circle cx="11.5" cy="6.5" r="1.8" />
        <path d="M11 9.6c1.6.1 2.6 1.2 3 3" />
      </Glyph>
    );
  }
  if (item.kind === 'diagram') {
    return (
      <Glyph size={13} units={16} strokeLinecap="butt" strokeLinejoin="miter">
        <rect x="3" y="3" width="10" height="10" rx="1.5" />
      </Glyph>
    );
  }
  if (item.kind === 'folder') {
    return (
      <Glyph size={13} units={16} strokeLinecap="butt" strokeLinejoin="miter">
        <path d="M2.5 4.5h4l1.5 1.5h5.5v6.5a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1z" />
      </Glyph>
    );
  }
  if (item.kind === 'tab') {
    return (
      <Glyph size={13} units={16} strokeLinecap="butt" strokeLinejoin="miter">
        <path d="M2.5 6.5h4l1-2h6v9h-11z" />
      </Glyph>
    );
  }
  if (item.kind === 'palette') {
    // Plus-in-a-box: this result ADDS an element rather than navigating.
    return (
      <Glyph size={13} units={16} strokeLinejoin="miter">
        <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
        <path d="M8 5.5v5M5.5 8h5" />
      </Glyph>
    );
  }
  if (item.kind === 'command') {
    // Lightning bolt: a do-something command (delete / lock / rotate / share
    // / rename / ...) rather than navigation, distinct from the palette's
    // plus-in-a-box add glyph.
    return (
      <Glyph size={13} units={16}>
        <path d="M8.5 1.5 3 9h4l-.5 5.5L13 7H9z" />
      </Glyph>
    );
  }
  if (item.kind === 'setting') {
    // Sliders: a Settings row (opens the Settings dialog on it). The same
    // mark the editor's own settings affordances use, so the result looks
    // like where it is about to take you.
    return (
      <Glyph size={13} units={16}>
        <path d="M2 4.5h7M12.5 4.5H14M2 11.5h3.5M9 11.5H14" />
        <circle cx="10.5" cy="4.5" r="1.6" />
        <circle cx="7" cy="11.5" r="1.6" />
      </Glyph>
    );
  }
  if (item.kind === 'help') {
    // A "?" in a circle: a help-centre article (opens in a new tab).
    return (
      <Glyph size={13} units={16}>
        <circle cx="8" cy="8" r="6" />
        <path d="M6.3 6.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.5-.7 1v.3" />
        <path d="M8 11.4h.01" />
      </Glyph>
    );
  }
  return (
    <Glyph size={13} units={16} strokeLinecap="butt" strokeLinejoin="miter">
      <circle cx="8" cy="8" r="4" />
    </Glyph>
  );
}
