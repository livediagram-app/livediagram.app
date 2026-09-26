import { Glyph, type IconProps } from './Glyph';

// Element-affordance glyphs: link, note, assigned action and comment. The
// same four drawings label the on-element badge pill, the context-menu tiles
// and the share dialog, so an affordance looks the same wherever it appears.

export function LinkIcon({ size = 14, strokeWidth = 1.75, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <path d="M7 4.5l1.5-1.5a3.25 3.25 0 0 1 4.6 4.6L11 9.5" />
      <path d="M9 11.5l-1.5 1.5a3.25 3.25 0 0 1-4.6-4.6L5 7" />
      <line x1="6" y1="10" x2="10" y2="6" />
    </Glyph>
  );
}

// A page with a folded corner and two lines of text.
export function NoteIcon({ size = 12, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <path d="M3 2.5h7l3 3v8a0.5 0.5 0 0 1 -0.5 0.5h-9.5a0.5 0.5 0 0 1 -0.5 -0.5v-10.5a0.5 0.5 0 0 1 0.5 -0.5z" />
      <path d="M10 2.5v3h3" />
      <path d="M5.5 9h5M5.5 11.5h5" />
    </Glyph>
  );
}

// Clipboard with a tick: an assigned action (docs/specs/012-collaboration/assigned-actions.md).
export function ActionIcon({ size = 12, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <path d="M6 3h-1.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H10" />
      <rect x="6" y="1.75" width="4" height="2.5" rx="0.75" />
      <path d="M5.75 9.25 7.5 11l3-3.5" />
    </Glyph>
  );
}

// Speech bubble.
export function CommentIcon({ size = 16, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5A1.5 1.5 0 0 1 12 10.5H7l-3 2.5V10.5A1.5 1.5 0 0 1 2.5 9z" />
    </Glyph>
  );
}
