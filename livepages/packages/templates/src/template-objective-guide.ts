// The "How to write one" guide of the Objectives planner
// (template-builders-objectives.ts): the heart of the sheet. The sentence
// formula as four chips, each in the ink its part wears in every objective,
// with what the part asks for and why it is there; then a vague draft
// rewritten with it, so the difference is visible rather than explained; then
// a SMART checklist to test each draft against, and a closing tip.
//
// Pure: returns fresh scaffold elements (the guide is the planner's, not the
// person's).

import {
  createShape,
  createText,
  runsPlainText,
  type Element,
  type TextRun,
} from '@livediagram/document';
import { MUTED, checklistHeight, chip } from './template-planner-parts';
import { FORMULA, FORMULA_ORDER, formulaRuns, type FormulaPart } from './template-objective-card';

const FORMULA_GUIDE: Record<FormulaPart, { asks: string; why: string }> = {
  do: { asks: 'an action you control', why: 'Start, ship, lead, learn. Not “be better at”.' },
  when: { asks: 'a real date', why: 'A day in the diary, not “soon” or “this half”.' },
  measure: {
    asks: 'a number, or a thing you can show',
    why: 'If you can’t see it, you can’t celebrate it.',
  },
  why: { asks: 'the reason it matters to you', why: 'This is what gets you through a hard week.' },
};

export const SMART = [
  'Specific: a stranger could picture done',
  'Measurable: a number or a thing to show',
  'Achievable: a stretch, not a fantasy',
  'Relevant: it serves my focus for the half',
  'Time-bound: it has a date',
];

const PART_H = 56;
const CHIP_W = 118;
const REWRITE_H = 136;
const LABEL_H = 26;
const TIP_H = 40;

// The guide's full height, so the planner can size its row to the taller of
// the guide and an objective card.
export const GUIDE_H =
  PART_H * 4 + 8 + REWRITE_H + 24 + LABEL_H + 6 + checklistHeight(SMART.length) + 12 + TIP_H;

export function objectiveGuide(x: number, y: number, width: number): Element[] {
  const out: Element[] = [];
  FORMULA_ORDER.forEach((part, i) => {
    const py = y + i * PART_H;
    const { lead, text, tint } = FORMULA[part];
    const guide = FORMULA_GUIDE[part];
    const runs: TextRun[] = [
      { text: guide.asks, bold: true, color: text },
      { text: `\n${guide.why}`, color: MUTED },
    ];
    out.push(chip(x, py + 4, CHIP_W, 28, `${lead} …`, tint), {
      ...createText(x + CHIP_W + 14, py),
      width: width - CHIP_W - 14,
      height: PART_H - 8,
      label: runsPlainText(runs),
      richText: runs,
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
    });
  });

  // A vague draft, struck through, over the same wish written with the
  // formula, in the formula's inks.
  const rewriteY = y + PART_H * 4 + 8;
  const vague: TextRun[] = [
    { text: 'Before  ', bold: true, color: MUTED },
    { text: 'Get better at presenting.', color: MUTED, strikethrough: true },
  ];
  const after: TextRun[] = [
    { text: 'After  ', bold: true },
    ...formulaRuns({
      do: 'present my checkout research at two all-hands',
      when: '30 Nov',
      measure: 'one team asking for a follow-up',
      why: 'research shapes what we build',
    }),
  ];
  out.push(
    {
      ...createShape('square', x, rewriteY),
      width,
      height: REWRITE_H,
      label: '',
      strokeColor: '#a5b4fc',
      strokeStyle: 'dashed',
      borderRadius: 'lg',
    },
    {
      ...createText(x + 18, rewriteY + 14),
      width: width - 36,
      height: 26,
      label: runsPlainText(vague),
      richText: vague,
      textSize: 'sm',
      textAlignX: 'left',
    },
    {
      ...createText(x + 18, rewriteY + 44),
      width: width - 36,
      height: REWRITE_H - 58,
      label: runsPlainText(after),
      richText: after,
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
    },
  );

  // The test every draft has to pass, then the one rule about how many.
  const smartY = rewriteY + REWRITE_H + 24;
  const listY = smartY + LABEL_H + 6;
  out.push(
    {
      ...createText(x, smartY),
      width,
      height: LABEL_H,
      label: 'Test every draft: is it SMART?',
      textSize: 'sm',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createShape('checklist', x, listY),
      width,
      height: checklistHeight(SMART.length),
      checklistItems: SMART.map((text) => ({ text, done: false })),
    },
    {
      ...createText(x, listY + checklistHeight(SMART.length) + 12),
      width,
      height: TIP_H,
      label: 'Three is plenty. With four or more, none of them gets your best.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      textAlignY: 'top',
    },
  );
  return out;
}
