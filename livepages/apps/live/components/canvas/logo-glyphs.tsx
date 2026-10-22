'use client';

// Glyphs for a logo page's tools (docs/specs/007-editor/logo-pages.md).
import type { MirrorAxis } from '@livediagram/document';
import { Glyph } from '@livediagram/ui';

// Mirror Copy (docs/specs/007-editor/logo-pages.md "Mirror"): a shape and its reflection either
// side of a dashed axis.
export function MirrorCopyGlyph({ size = 16 }: { size?: number }) {
  return (
    <Glyph size={size} units={16}>
      <path d="M8 1.5v13" strokeDasharray="1.5 1.5" />
      <path d="M6 4 2 12h4zM10 4l4 8h-4z" strokeLinejoin="round" />
    </Glyph>
  );
}

// A mirror axis (docs/specs/007-editor/logo-pages.md "Mirror"): a square artboard with its axis
// solid and a dot either side of it (four ways for Both, round the centre for Radial).
export function MirrorAxisGlyph({ axis, size = 16 }: { axis: MirrorAxis; size?: number }) {
  return (
    <Glyph size={size} units={16}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" strokeOpacity={0.5} />
      {axis === 'vertical' || axis === 'both' ? <path d="M8 1.5v13" /> : null}
      {axis === 'horizontal' || axis === 'both' ? <path d="M1.5 8h13" /> : null}
      {axis === 'radial' ? <path d="M8 8V2.5M8 8l4.8 2.8M8 8l-4.8 2.8" /> : null}
      {axis === 'vertical' ? <path d="M4.5 8h.01M11.5 8h.01" strokeWidth={2.5} /> : null}
      {axis === 'horizontal' ? <path d="M8 4.5h.01M8 11.5h.01" strokeWidth={2.5} /> : null}
      {axis === 'both' ? (
        <path d="M4.5 4.5h.01M11.5 4.5h.01M4.5 11.5h.01M11.5 11.5h.01" strokeWidth={2.5} />
      ) : null}
    </Glyph>
  );
}
