import { Glyph } from '@livediagram/ui';

// The Collaborate glyph: a speech bubble with a line of text, the panel's
// mark on its cluster button (docs/specs/012-collaboration/assigned-actions.md §5).
export function CollaborateGlyph({ size = 16 }: { size?: number }) {
  return (
    <Glyph size={size} units={14}>
      <path d="M2 4.2C2 3.26 2.76 2.5 3.7 2.5h6.6c.94 0 1.7.76 1.7 1.7v3.1c0 .94-.76 1.7-1.7 1.7H7.2L4.7 11V9H3.7C2.76 9 2 8.24 2 7.3V4.2z" />
      <path d="M4.8 5.75h4.4" />
    </Glyph>
  );
}
