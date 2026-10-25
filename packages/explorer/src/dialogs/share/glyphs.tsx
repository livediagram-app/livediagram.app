// The Share dialog's own small glyphs: the copy menus' rows (image, Markdown, code), the ⋯ that marks a button as
// opening a menu, the clock on an expiring pass, Show Me's footprints, the status line's globe and Learn more's arrow.

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

// Show Me's footprints (lucide), beside its word in the header.
export function FootprintsGlyph() {
  return (
    <Glyph size={14} units={24}>
      <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" />
      <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" />
      <path d="M16 17h4M4 13h4" />
    </Glyph>
  );
}

// The status line's Public glyph (lucide globe).
export function GlobeGlyph() {
  return (
    <Glyph size={12} units={24}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />
    </Glyph>
  );
}

// The opens-in-a-new-tab arrow after a Learn more link.
export function ArrowOutGlyph() {
  return (
    <Glyph size={11} units={20}>
      <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3M12 4h4v4M16 4l-7 7" />
    </Glyph>
  );
}
