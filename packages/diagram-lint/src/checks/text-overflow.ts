// `text-overflow` (warning, an Illustrate tab only): on a page, text is the content rather than a caption, so a text
// element whose words, wrapped as every headless render wraps them, need more lines than its box holds runs into what
// is under it; and two text elements whose boxes overlap print over each other. Elsewhere text is not linted (LN2).

import {
  defaultPadding,
  defaultTextAlign,
  estimatedLabelMeasure,
  fontSizeFor,
  LABEL_LINE_HEIGHT,
  labelRoom,
  PADDING_PX,
  wrapLabel,
  type BoxedElement,
  type Element,
} from '@livediagram/document';
import { LINT_OVERLAP_TOLERANCE_PX } from '../constants';
import { refOf } from '../context';
import { fixes } from '../fixes';
import type { Check, RawFinding } from './types';

const isText = (el: Element): el is BoxedElement & { label: string } =>
  el.type === 'text' &&
  typeof (el as { label?: unknown }).label === 'string' &&
  (el as { label: string }).label.trim() !== '' &&
  [el.x, el.y, el.width, el.height].every((v) => Number.isFinite(v));

type Ink = { x: number; y: number; width: number; height: number };

// Where a text's lines are drawn: wrapped at its room in its size (a Shift-resized text scaled), set in its box as the
// renderer sets them (its alignment, its padding), less a little at the top and bottom for the glyphs' own leading,
// so lines that only touch are not counted as printed over each other. Its lines may run past its box.
function inkOf(t: BoxedElement & { label: string }): { ink: Ink; lines: number; px: number } {
  const scale = (t as { textScale?: number }).textScale ?? 1;
  const px = fontSizeFor(t.textSize) * scale;
  const measure = estimatedLabelMeasure(px);
  const wrapped = wrapLabel(t.label, labelRoom(t).width, measure, true);
  const pad = PADDING_PX[t.padding ?? defaultPadding(t)];
  const defaults = defaultTextAlign(t);
  const ax = t.textAlignX ?? defaults.x;
  const ay = t.textAlignY ?? defaults.y;
  const width = Math.max(...wrapped.map(measure));
  const block = wrapped.length * px * LABEL_LINE_HEIGHT;
  const x =
    ax === 'left'
      ? t.x + pad
      : ax === 'right'
        ? t.x + t.width - pad - width
        : t.x + t.width / 2 - width / 2;
  const top =
    ay === 'top'
      ? t.y + pad
      : ay === 'bottom'
        ? t.y + t.height - pad - block
        : t.y + t.height / 2 - block / 2;
  const slack = px * INK_SLACK_EM;
  return {
    ink: { x, y: top + slack, width, height: Math.max(0, block - 2 * slack) },
    lines: wrapped.length,
    px,
  };
}

// The share of the font size each line's top and bottom leading takes, where no glyph is drawn.
const INK_SLACK_EM = 0.2;

const inkOverlap = (a: Ink, b: Ink) =>
  Math.min(
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );

export const textOverflow: Check = (ctx) => {
  // Text on a curve (a badge's) is drawn along its arc, not in its box, so it is left out.
  const texts = ctx.visible.filter(isText).filter((t) => !(t as { textArc?: number }).textArc);
  const inks = new Map(texts.map((t) => [t.id, inkOf(t)]));
  const out: RawFinding[] = [];
  for (const t of texts) {
    // A text set to scale fills its box by its size.
    if (t.textSize === 'scale') continue;
    const { lines, px } = inks.get(t.id)!;
    const room = labelRoom(t);
    const holds = Math.max(1, Math.floor((room.height + px * 0.25) / (px * LABEL_LINE_HEIGHT)));
    if (lines <= holds) continue;
    const ref = refOf(ctx, t.id);
    out.push({
      code: 'text-overflow',
      refs: [ref],
      message: `${ref} needs ${lines} lines, holds ${holds}`,
      fix: fixes.textOverflow(
        ref,
        Math.ceil(lines * px * LABEL_LINE_HEIGHT + (t.height - room.height)),
      ),
      at: { x: t.x, y: t.y },
    });
  }
  // Texts printed over each other, where their lines are drawn: a sweep down the page (sorted by the top of their
  // ink), each against those starting above its ink's bottom, so the pairs tested are only those that share rows.
  const byTop = [...texts].sort((a, b) => inks.get(a.id)!.ink.y - inks.get(b.id)!.ink.y);
  for (let i = 0; i < byTop.length; i++) {
    const a = byTop[i]!;
    const ia = inks.get(a.id)!.ink;
    for (let k = i + 1; k < byTop.length && inks.get(byTop[k]!.id)!.ink.y < ia.y + ia.height; k++) {
      const b = byTop[k]!;
      if (inkOverlap(ia, inks.get(b.id)!.ink) <= LINT_OVERLAP_TOLERANCE_PX) continue;
      const [ra, rb] = [refOf(ctx, a.id), refOf(ctx, b.id)];
      out.push({
        code: 'text-overflow',
        refs: [ra, rb],
        message: `${ra} prints over ${rb}`,
        fix: fixes.textOverlap(ra, rb),
        at: { x: a.x, y: a.y },
      });
    }
  }
  return out;
};
