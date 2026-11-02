// `text-overflow` (warning): two text elements whose lines, wrapped as every headless render wraps them, are drawn
// over each other print over each other (a board's column heading wrapped onto its subtitle).

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
  type Rect,
} from '@livehuddle/document';
import { LINT_OVERLAP_TOLERANCE_PX } from '../constants';
import { refOf } from '../context';
import { fixes } from '../fixes';
import type { Check, RawFinding } from './types';

const isText = (el: Element): el is Text =>
  el.type === 'text' &&
  typeof (el as { label?: unknown }).label === 'string' &&
  (el as { label: string }).label.trim() !== '' &&
  [el.x, el.y, el.width, el.height].every((v) => Number.isFinite(v));

type Ink = Rect;

// Where a text's lines are drawn: wrapped at its room in its size (a Shift-resized text scaled), set in its box as the
// renderer sets them (its alignment, its padding), less a little at the top and bottom for the glyphs' own leading,
// so lines that only touch are not counted as printed over each other. Its lines may run past its box.
function inkOf(t: BoxedElement & { label: string }): {
  ink: Ink;
  lines: number;
  px: number;
  measure: (s: string) => number;
} {
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
  const [above, below] = [px * INK_SLACK_EM, px * INK_SLACK_BELOW_EM];
  return {
    ink: { x, y: top + above, width, height: Math.max(0, block - above - below) },
    lines: wrapped.length,
    px,
    measure,
  };
}

// The share of the font size a block's top and bottom take where no glyph is drawn: above a capital there is leading
// and the ascender's room, but a descender ("g", "p") reaches almost to a line's foot, so a heading wrapped onto the
// subtitle under it was let off by the room a descender fills.
const INK_SLACK_EM = 0.2;
const INK_SLACK_BELOW_EM = 0.05;

const inkOverlap = (a: Ink, b: Ink) =>
  Math.min(
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );

// Text on a curve (a badge's) is drawn along its arc, not in its box, and turned text (an axis title stood on end)
// is drawn across its box, so both are left out.
const textsOf = (ctx: Parameters<Check>[0]) =>
  ctx.visible
    .filter(isText)
    .filter((t) => !(t as { textArc?: number }).textArc)
    .filter((t) => ((t as { rotation?: number }).rotation ?? 0) % 360 === 0);

export const textOverprint: Check = (ctx) => {
  const texts = textsOf(ctx);
  return overprints(ctx, texts, new Map(texts.map((t) => [t.id, inkOf(t)])));
};

type Text = BoxedElement & { label: string };
type Inks = ReadonlyMap<string, ReturnType<typeof inkOf>>;

// Texts printed over each other, where their lines are drawn: a sweep down the page (sorted by the top of their
// ink), each against those starting above its ink's bottom, so the pairs tested are only those that share rows.
function overprints(ctx: Parameters<Check>[0], texts: readonly Text[], inks: Inks): RawFinding[] {
  const out: RawFinding[] = [];
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
}
