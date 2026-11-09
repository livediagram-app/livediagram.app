// The retired placeholder's look (docs/specs/009-elements/retired-elements.md "What it looks like"), one pure plan
// read by the canvas face and the headless export, so the two always draw the same card.
import { RETIRED_ELEMENT_LINE } from './retired-elements';
import type { CanvasSurface } from './colors';

// The card's colours per paper: a muted surface, a dashed hairline, a title ink and a quieter caption ink. The
// editor's face reads the same tones from the theme tokens; the export, which has no stylesheet, reads these.
export const RETIRED_PLACEHOLDER_TONES: Record<
  CanvasSurface,
  { fill: string; border: string; title: string; caption: string }
> = {
  light: { fill: '#f8fafc', border: '#cbd5e1', title: '#334155', caption: '#64748b' },
  dark: { fill: '#1e293b', border: '#475569', title: '#e2e8f0', caption: '#94a3b8' },
};

// Below these the card sheds a row: the caption first, then the glyph, so the name always shows.
export const RETIRED_GLYPH_MIN = { width: 96, height: 88 } as const;
export const RETIRED_CAPTION_MIN = { width: 72, height: 44 } as const;

export type RetiredPlaceholderPlan = {
  /** The big line: the element's own label when it has one, else the piece's name. */
  title: string;
  /** The quiet line under it, or null when the box is too small. */
  caption: string | null;
  /** Whether the moved-out glyph shows above the title. */
  glyph: boolean;
  /** The card's corner radius, never more than a quarter of the shorter side. */
  radius: number;
};

export function retiredPlaceholderPlan(
  box: { width: number; height: number },
  name: string,
  label: string | undefined,
): RetiredPlaceholderPlan {
  const own = (label ?? '').replace(/\s+/g, ' ').trim();
  const roomy = box.width >= RETIRED_CAPTION_MIN.width && box.height >= RETIRED_CAPTION_MIN.height;
  const tall = box.width >= RETIRED_GLYPH_MIN.width && box.height >= RETIRED_GLYPH_MIN.height;
  return {
    title: own || name,
    caption: roomy ? (own ? `${name} · ${RETIRED_ELEMENT_LINE}` : RETIRED_ELEMENT_LINE) : null,
    glyph: tall,
    radius: Math.max(0, Math.min(12, box.width / 4, box.height / 4)),
  };
}

// The moved-out glyph (a box with an arrow leaving its corner), in 24 units, stroked.
export const RETIRED_GLYPH_PATHS = [
  'M14 4h6v6',
  'M20 4l-9 9',
  'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
] as const;
