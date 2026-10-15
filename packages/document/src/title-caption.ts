// Title and Caption (docs/specs/009-elements/block-type-picker.md "Title and Caption"): a whole-label preset for the
// common two-tier node, "Payments" over "Stripe, EU region". The first line becomes the title (bold, the label's own
// size), every later line the caption (a size smaller and muted). Pure runs algebra, so the label editor and an agent
// produce the same runs.

import {
  applyFormatToRange,
  applyHeadingToLines,
  applyListStyle,
  normalizeRuns,
  runsPlainText,
  type TextRun,
} from './rich-text';

/** What a one-line label gains as its caption, to type over. */
export const CAPTION_PLACEHOLDER = 'Caption';

/** The opacity a muted run draws at. */
export const MUTED_RUN_OPACITY = 0.65;

export function applyTitleCaption(runs: readonly TextRun[]): TextRun[] {
  // The same two tiers whatever the label was: no heading levels, no list markers.
  let next = applyListStyle(applyHeadingToLines([...runs], null), 'none');
  let text = runsPlainText(next);
  if (!text.includes('\n')) {
    next = [...next, { text: `\n${CAPTION_PLACEHOLDER}` }];
    text = runsPlainText(next);
  }
  const split = text.indexOf('\n');
  next = applyFormatToRange(next, 0, split, { bold: true, size: undefined, muted: undefined });
  next = applyFormatToRange(next, split + 1, text.length, { bold: false, size: 'sm', muted: true });
  return normalizeRuns(next);
}
