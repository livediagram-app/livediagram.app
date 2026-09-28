import { lucideSmile } from '@livediagram/icons/lucide';
import { Glyph, lucideGlyph } from '@livediagram/ui';
// Glyphs for the collapsible tile groups inside a palette category
// (PaletteTileGroup). Kept beside the tab icons rather than inline in the tab
// bodies, so the category files stay a list of what's in them.

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

/** Behaviour → Reactions: a smile, the feeling every one of them throws. */
export const ReactionGroupIcon = lucideGlyph(lucideSmile, 18);

/** Behaviour → Selection Mode: a pointer, the thing being switched. */
export function ModeGroupIcon() {
  return (
    <Glyph size={18} units={24}>
      <path d="M5.5 3.5 18 11.2l-5.2 1.4-2.1 5.6z" />
    </Glyph>
  );
}

/** Behaviour → Navigate: an arrow through a doorway. */
export function MoveGroupIcon() {
  return (
    <Glyph size={18} units={24}>
      <path d="M4 20V6.5a1 1 0 0 1 .8-1l7-1.4a1 1 0 0 1 1.2 1V20" />
      <path d="M2.6 20h12.8M17 9.5h4.4M19.2 7.3l2.2 2.2-2.2 2.2" />
    </Glyph>
  );
}

/** Behaviour → Tools: a raised hand over a card. */
export function FacilitateGroupIcon() {
  return (
    <Glyph size={18} units={24}>
      <rect x="3" y="4" width="18" height="12.5" rx="2" />
      <path d="M8 20h8M12 16.5V20M9 11.5V8.2M12 11.5V7M15 11.5v-2.6" />
    </Glyph>
  );
}

/** Collaborate → Ask: a question mark in a bubble. */
export function AskGroupIcon() {
  return (
    <Glyph size={18} units={24}>
      <path d="M20.5 11.6c0 3.8-3.8 6.9-8.5 6.9-.9 0-1.8-.1-2.6-.3l-5 3.1 1.1-4.5A6.5 6.5 0 0 1 3.5 11.6c0-3.8 3.8-6.9 8.5-6.9s8.5 3.1 8.5 6.9z" />
      <path d="M10.2 9.4a1.9 1.9 0 1 1 2.4 2.2c-.5.2-.8.6-.8 1.1M12 15h.01" />
    </Glyph>
  );
}

/** Collaborate → Record: a page with ruled lines. */
export function RecordGroupIcon() {
  return (
    <Glyph size={18} units={24}>
      <path d="M6 2.6h8l4.4 4.4V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1z" />
      <path d="M13.8 2.6V7h4.4M8.4 12h7.2M8.4 16h5" />
    </Glyph>
  );
}
