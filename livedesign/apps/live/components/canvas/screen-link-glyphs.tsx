// The screen link glyphs (docs/specs/007-editor/wireframe-pages.md "Setting a link"): a phone screen with an arrow
// leaving it for a screen link, the same arrow turned back for a back link, and the arrow broken for a link whose
// screen was deleted. Drawn on the 16-unit grid of the app's other small glyphs, in currentColor, so the link marker,
// Link Element's Screen mode and the link handle share them.
import { Glyph } from '@livedesign/ui';

type GlyphProps = { size?: number; className?: string };

export function ScreenLinkGlyph({ size = 14, className }: GlyphProps = {}) {
  return (
    <Glyph size={size} units={16} className={className}>
      <rect x="1.75" y="2.5" width="7" height="11" rx="1.5" />
      <path d="M8.75 8h5.5M11.75 5.5 14.25 8l-2.5 2.5" />
    </Glyph>
  );
}

export function BackLinkGlyph({ size = 14, className }: GlyphProps = {}) {
  return (
    <Glyph size={size} units={16} className={className}>
      <rect x="1.75" y="2.5" width="7" height="11" rx="1.5" />
      <path d="M14.25 8h-5.5M11.25 5.5 8.75 8l2.5 2.5" />
    </Glyph>
  );
}

export function BrokenScreenLinkGlyph({ size = 14, className }: GlyphProps = {}) {
  return (
    <Glyph size={size} units={16} className={className}>
      <rect x="1.75" y="2.5" width="7" height="11" rx="1.5" />
      <path d="M8.75 8h1.25M12.75 8h1.5M10.75 10.75l1.5-5.5" />
    </Glyph>
  );
}
