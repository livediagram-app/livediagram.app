// The Share dialog's own small glyphs: the copy menus' rows (image, Markdown, code), the ⋯ that marks a button as
// opening a menu, and the clock on an expiring pass.

import { Glyph } from '../../ui/icons';

export function ImageGlyph() {
  return (
    <Glyph size={14} units={16}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="6" cy="6.5" r="1.2" />
      <path d="M3 12l3.5-3.5 2.5 2.5 2-2L14 11.5" />
    </Glyph>
  );
}

export function MarkdownGlyph() {
  return (
    <Glyph size={14} units={16}>
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M4 10V6l2 2 2-2v4M11 6v4M9.5 8.5 11 10l1.5-1.5" />
    </Glyph>
  );
}

export function CodeGlyph() {
  return (
    <Glyph size={14} units={16}>
      <path d="M6 5l-3 3 3 3M10 5l3 3-3 3" />
    </Glyph>
  );
}

export function EllipsisGlyph() {
  return (
    <Glyph size={12} units={16} filled className="-mr-0.5 opacity-70">
      <circle cx="3.5" cy="8" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="12.5" cy="8" r="1.2" />
    </Glyph>
  );
}

export function SmallClockGlyph() {
  return (
    <Glyph size={12} units={24}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Glyph>
  );
}

export function ShuffleGlyph() {
  return (
    <Glyph size={13} units={24}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
    </Glyph>
  );
}
