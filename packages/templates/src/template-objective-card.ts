// The objective card of the Objectives planner (template-builders-objectives.ts),
// and the sentence formula it and the planner's "How to write one" guide
// share, so a part of the formula wears the same hue in the guide and in
// every objective written with it.
//
// Pure: returns fresh elements, split into the planner's scaffold (the card
// and its section labels) and the person's content (what they wrote).

import {
  createShape,
  createText,
  runsPlainText,
  type Element,
  type TextRun,
} from '@livediagram/document';
import { MUTED, checklistHeight, chip, type Tint } from './template-planner-parts';

// The four parts of a well-formed objective, in sentence order. Each has
// its own text colour (a mid tone that reads on a light or a dark card) and
// a tint for its chip in the guide.
export type FormulaPart = 'do' | 'when' | 'measure' | 'why';

export const FORMULA: Record<FormulaPart, { lead: string; text: string; tint: Tint }> = {
  do: {
    lead: 'I will',
    text: '#6366f1',
    tint: { fill: '#e0e7ff', stroke: '#a5b4fc', ink: '#3730a3' },
  },
  when: {
    lead: 'by',
    text: '#0891b2',
    tint: { fill: '#cffafe', stroke: '#67e8f9', ink: '#155e75' },
  },
  measure: {
    lead: 'measured by',
    text: '#059669',
    tint: { fill: '#d1fae5', stroke: '#6ee7b7', ink: '#065f46' },
  },
  why: {
    lead: 'so that',
    text: '#e11d48',
    tint: { fill: '#ffe4e6', stroke: '#fda4af', ink: '#9f1239' },
  },
};

export const FORMULA_ORDER: FormulaPart[] = ['do', 'when', 'measure', 'why'];

// One objective sentence as rich text: each part in its formula ink, its
// lead words bold, joined by plain commas so it still reads as a sentence.
export function formulaRuns(parts: Record<FormulaPart, string>): TextRun[] {
  const runs: TextRun[] = [];
  FORMULA_ORDER.forEach((part, i) => {
    const { lead, text } = FORMULA[part];
    runs.push({ text: lead, bold: true, color: text }, { text: ` ${parts[part]}`, color: text });
    runs.push({ text: i < FORMULA_ORDER.length - 1 ? ', ' : '.' });
  });
  return runs;
}

export type LifeArea = 'Craft' | 'Leadership' | 'Wellbeing';

// Each life area's hue: the card's border, its chip, bars and its
// sticker, deliberately apart from the four formula inks.
export const AREAS: Record<LifeArea, { hue: string; tint: Tint; sticker: string }> = {
  Craft: {
    hue: '#f59e0b',
    tint: { fill: '#fef3c7', stroke: '#fcd34d', ink: '#92400e' },
    sticker: 'emoji-art-palette',
  },
  Leadership: {
    hue: '#c026d3',
    tint: { fill: '#fae8ff', stroke: '#f0abfc', ink: '#86198f' },
    sticker: 'emoji-handshake',
  },
  Wellbeing: {
    hue: '#65a30d',
    tint: { fill: '#ecfccb', stroke: '#bef264', ink: '#3f6212' },
    sticker: 'emoji-herb',
  },
};

export type Objective = {
  area: LifeArea;
  sentence: Record<FormulaPart, string>;
  keyResults: [
    { text: string; now: string; progress: number },
    { text: string; now: string; progress: number },
  ];
  steps: { text: string; done: boolean }[];
  support: string;
  confidence: number;
};

// The card's inner rhythm, top to bottom.
const PAD = 20;
const CHIP_H = 28;
const SENTENCE_H = 112;
const LABEL_H = 24;
const KR_TEXT_H = 22;
const KR_BAR_H = 22;
const KR_GAP = 12;
const SECTION_GAP = 16;
const SUPPORT_H = 44;
const RATING_W = 150;
const RATING_H = 30;

// The height a card needs for its steps, so the planner can size its row.
export function objectiveCardHeight(steps: number): number {
  return (
    PAD +
    CHIP_H +
    12 +
    SENTENCE_H +
    SECTION_GAP +
    LABEL_H +
    2 * (KR_TEXT_H + 4 + KR_BAR_H) +
    KR_GAP +
    SECTION_GAP +
    LABEL_H +
    checklistHeight(steps) +
    SECTION_GAP +
    LABEL_H +
    SUPPORT_H +
    SECTION_GAP +
    RATING_H +
    PAD
  );
}

export function objectiveCard(
  x: number,
  y: number,
  width: number,
  height: number,
  number: number,
  obj: Objective,
): { scaffold: Element[]; content: Element[] } {
  const area = AREAS[obj.area];
  const inner = width - PAD * 2;
  const ix = x + PAD;
  const scaffold: Element[] = [];
  const content: Element[] = [];
  const sectionLabel = (sy: number, label: string, w = inner): Element => ({
    ...createText(ix, sy),
    width: w,
    height: LABEL_H,
    label,
    textSize: 'sm',
    textBold: true,
    textColor: MUTED,
    textAlignX: 'left',
  });

  // The card: theme-owned body (it follows light and dark), bordered in the
  // area's hue.
  scaffold.push(
    {
      ...createShape('square', x, y),
      width,
      height,
      label: '',
      strokeColor: area.hue,
      strokeWidth: 'medium',
      borderRadius: 'lg',
    },
    {
      ...createText(ix + 132, y + PAD),
      width: inner - 132 - 56,
      height: CHIP_H,
      label: `Objective ${number}`,
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  );

  let cy = y + PAD;
  content.push(chip(ix, cy, 120, CHIP_H, obj.area, area.tint), {
    ...createShape('sticker', x + width - PAD - 48, y - 14),
    width: 52,
    height: 52,
    stickerId: area.sticker,
    rotation: number % 2 === 0 ? -8 : 8,
  });
  cy += CHIP_H + 12;

  const runs = formulaRuns(obj.sentence);
  content.push({
    ...createText(ix, cy),
    width: inner,
    height: SENTENCE_H,
    label: runsPlainText(runs),
    richText: runs,
    textSize: 'scale',
    textAlignX: 'left',
    textAlignY: 'top',
  });
  cy += SENTENCE_H + SECTION_GAP;

  scaffold.push(sectionLabel(cy, 'Key results'));
  cy += LABEL_H;
  obj.keyResults.forEach((kr, i) => {
    const krRuns: TextRun[] = [{ text: kr.text }, { text: `  ${kr.now}`, color: MUTED }];
    content.push(
      {
        ...createText(ix, cy),
        width: inner,
        height: KR_TEXT_H,
        label: runsPlainText(krRuns),
        richText: krRuns,
        textSize: 'sm',
        textAlignX: 'left',
      },
      {
        ...createShape('progress-bar', ix, cy + KR_TEXT_H + 4),
        width: inner,
        height: KR_BAR_H,
        progress: kr.progress,
        strokeColor: area.hue,
        // The track stays pale on every canvas, so its percentage is inked
        // dark to match.
        textColor: '#0f172a',
      },
    );
    cy += KR_TEXT_H + 4 + KR_BAR_H + (i === 0 ? KR_GAP : 0);
  });
  cy += SECTION_GAP;

  scaffold.push(sectionLabel(cy, 'First steps'));
  cy += LABEL_H;
  content.push({
    ...createShape('checklist', ix, cy),
    width: inner,
    height: checklistHeight(obj.steps.length),
    checklistItems: obj.steps.map((s) => ({ ...s })),
  });
  cy += checklistHeight(obj.steps.length) + SECTION_GAP;

  scaffold.push(sectionLabel(cy, 'Support I need'));
  cy += LABEL_H;
  content.push({
    ...createText(ix, cy),
    width: inner,
    height: SUPPORT_H,
    label: obj.support,
    textSize: 'sm',
    textAlignX: 'left',
    textAlignY: 'top',
  });
  // Confidence sits on the card's bottom edge, whatever the row's height.
  cy = y + height - PAD - RATING_H;

  scaffold.push(sectionLabel(cy + (RATING_H - LABEL_H) / 2, 'Confidence', inner - RATING_W));
  content.push({
    ...createShape('rating', ix + inner - RATING_W, cy),
    width: RATING_W,
    height: RATING_H,
    rating: obj.confidence,
  });

  return { scaffold, content };
}
