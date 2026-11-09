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

// Below this the card sheds the glyph, so the name always shows.
export const RETIRED_GLYPH_MIN = { width: 96, height: 88 } as const;

// The card's type and spacing (the canvas face's classes and the export's text use the same numbers): the title and
// caption sizes and line heights, the glyph row, the side and top padding, and the advance per character the fit is
// measured with (a little wider than the face's real average, so a line judged to fit never clips).
export const RETIRED_TEXT = {
  titleSize: 13,
  titleLine: 16,
  captionSize: 11,
  captionLine: 14,
  glyphRow: 28,
  padX: 8,
  padY: 6,
  em: 0.56,
} as const;

export type RetiredPlaceholderPlan = {
  /** The big line: the element's own label when it has one, else the piece's name. */
  title: string;
  /** The title as drawn: one or two lines, the last ending in an ellipsis when it runs on. */
  titleLines: string[];
  /** The quiet line under it, or null when no form of it fits the box. */
  caption: string | null;
  /** The caption as drawn: one line, or two when the box is narrow but tall enough. */
  captionLines: string[];
  /** Whether the moved-out glyph shows above the title. */
  glyph: boolean;
  /** Where the block sits: centred, or at the top of a Room so the pieces inside it never cover it. */
  anchor: 'center' | 'top';
  /** The card's corner radius, never more than a quarter of the shorter side. */
  radius: number;
};

const perLine = (width: number, size: number) =>
  Math.max(1, Math.floor(width / (size * RETIRED_TEXT.em)));

const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}\u2026`;

// Greedy word wrap into at most `max` lines of `per` characters; a word longer than a line, or text left over after
// the last line, ends that line in an ellipsis.
function wrap(text: string, per: number, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  const words = text.split(' ').filter(Boolean);
  let i = 0;
  for (; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i]!;
    if (next.length <= per) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    if (lines.length === max) break;
    line = words[i]!;
  }
  if (lines.length < max && line) lines.push(line);
  const ranOn = i < words.length || lines.some((l) => l.length > per);
  const out = lines.map((l) => clip(l, per));
  if (ranOn && out.length > 0 && !out[out.length - 1]!.endsWith('\u2026')) {
    out[out.length - 1] = clip(`${out[out.length - 1]}\u2026`, per);
  }
  return out;
}

// Lines that fit without an ellipsis, or null.
function fitWhole(text: string, per: number, max: number): string[] | null {
  const lines = wrap(text, per, max);
  return lines.join(' ') === text ? lines : null;
}

export function retiredPlaceholderPlan(
  box: { width: number; height: number; shape?: string },
  name: string,
  label: string | undefined,
): RetiredPlaceholderPlan {
  const T = RETIRED_TEXT;
  const own = (label ?? '').replace(/\s+/g, ' ').trim();
  const title = own || name;
  const inner = Math.max(0, box.width - 2 * T.padX);
  let room = Math.max(0, box.height - 2 * T.padY);
  // The name always shows: one line, a second when the box has the height for it and the name needs it.
  const titlePer = perLine(inner, T.titleSize);
  const twoLineTitle = wrap(title, titlePer, 2);
  let titleLines = room >= 2 * T.titleLine ? twoLineTitle : wrap(title, titlePer, 1);
  room -= titleLines.length * T.titleLine;
  // Then the caption, in the first form that fits whole: the long one under an own label, the plain line, the
  // plain line over two rows. A second title row gives way to it.
  const capPer = perLine(inner, T.captionSize);
  const forms = own
    ? [`${name} \u00b7 ${RETIRED_ELEMENT_LINE}`, RETIRED_ELEMENT_LINE]
    : [RETIRED_ELEMENT_LINE];
  const tryCaption = (space: number): string[] | null => {
    for (const form of forms) {
      for (const rows of [1, 2]) {
        if (rows * T.captionLine > space) break;
        const lines = fitWhole(form, capPer, rows);
        if (lines) return lines;
      }
    }
    return null;
  };
  let captionLines = tryCaption(room);
  if (!captionLines && titleLines.length === 2) {
    const oneLine = wrap(title, titlePer, 1);
    const freed = room + T.titleLine;
    const lines = tryCaption(freed);
    if (lines) {
      titleLines = oneLine;
      room = freed;
      captionLines = lines;
    }
  }
  captionLines ??= [];
  room -= captionLines.length * T.captionLine;
  // A Room holds other pieces, so its block sits at its top, where its old name bar was, and stays two short rows
  // (no glyph) so the pieces inside never cover it.
  const anchor = box.shape === 'room' ? 'top' : 'center';
  const glyph =
    anchor === 'center' &&
    box.width >= RETIRED_GLYPH_MIN.width &&
    box.height >= RETIRED_GLYPH_MIN.height &&
    room >= T.glyphRow;
  return {
    title,
    titleLines,
    caption: captionLines.length > 0 ? captionLines.join(' ') : null,
    captionLines,
    glyph,
    anchor,
    radius: Math.max(0, Math.min(12, box.width / 4, box.height / 4)),
  };
}

// The moved-out glyph (a box with an arrow leaving its corner), in 24 units, stroked.
export const RETIRED_GLYPH_PATHS = [
  'M14 4h6v6',
  'M20 4l-9 9',
  'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
] as const;
