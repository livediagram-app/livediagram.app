// `text-overflow` (warning, an Illustrate tab only): on a page, text is the content rather than a caption, so a text
// element whose words, wrapped as every headless render wraps them, need more lines than its box holds runs into what
// is under it; and two text elements whose boxes overlap print over each other. Elsewhere text is not linted (LN2).

import {
  estimatedLabelMeasure,
  fontSizeFor,
  LABEL_LINE_HEIGHT,
  labelRoom,
  wrapLabel,
  type BoxedElement,
  type Element,
} from '@livediagram/document';
import { overlapDepth } from '../boxes';
import { LINT_OVERLAP_TOLERANCE_PX } from '../constants';
import { refOf } from '../context';
import { fixes } from '../fixes';
import type { Check, RawFinding } from './types';

const isText = (el: Element): el is BoxedElement & { label: string } =>
  el.type === 'text' &&
  typeof (el as { label?: unknown }).label === 'string' &&
  (el as { label: string }).label.trim() !== '' &&
  [el.x, el.y, el.width, el.height].every((v) => Number.isFinite(v));

export const textOverflow: Check = (ctx) => {
  const texts = ctx.visible.filter(isText);
  const out: RawFinding[] = [];
  for (const t of texts) {
    // A text set to scale fills its box by its size.
    if (t.textSize === 'scale') continue;
    const px = fontSizeFor(t.textSize);
    const room = labelRoom(t);
    const lines = wrapLabel(t.label, room.width, estimatedLabelMeasure(px), true).length;
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
  // Texts printed over each other: a sweep down the page (sorted by top edge), each against those starting above
  // its bottom, so the pairs tested are only those that share rows.
  const byTop = [...texts].sort((a, b) => a.y - b.y);
  for (let i = 0; i < byTop.length; i++) {
    const a = byTop[i]!;
    for (let k = i + 1; k < byTop.length && byTop[k]!.y < a.y + a.height; k++) {
      const b = byTop[k]!;
      if (overlapDepth(a, b) <= LINT_OVERLAP_TOLERANCE_PX) continue;
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
