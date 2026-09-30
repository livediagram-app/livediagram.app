// The Objectives planner template (docs/specs/008-canvas/canvas-and-palette.md
// "Templates"): a personal sheet for WRITING good objectives, not just
// listing them. The objective card and the sentence formula live in
// ./template-objective-card.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createShape,
  createSticky,
  createText,
  runsPlainText,
  type Element,
  type TextRun,
} from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { HEAD_GAP, SUBTITLE_H, TITLE_H, heading } from './template-session-parts';
import {
  BAND_H,
  HEAD_H,
  MUTED,
  columnHead,
  initialsDisc,
  phaseBand,
} from './template-planner-parts';
import { objectiveCard, objectiveCardHeight, type Objective } from './template-objective-card';
import { GUIDE_H, objectiveGuide } from './template-objective-guide';
import { RHYTHM_H, checkinRhythm } from './template-checkin-rhythm';

// Alex's plan for the second half of 2026, read left to right the way the
// thinking goes. START WITH WHY: one focus statement for the half, then
// strengths to build on (green notes) and areas to grow (peach notes).
// WRITE IT WELL: the sentence formula "I will ... by ... measured by ... so
// that ...", each part a chip in its own ink with what it asks for and why,
// a vague draft rewritten with it, and a SMART checklist to test every
// draft against. THREE OBJECTIVES, one per life area (Craft, Leadership,
// Wellbeing, each in its own hue, so the set stays balanced), each written
// with the formula in the same inks as the guide, with two key results on
// progress bars, first steps as a checklist, the support needed, and a
// confidence rating that is allowed to be low. A CHECK-IN rhythm closes the
// sheet (set, monthly check-ins, mid-point review, reflect) with today's
// place on it. The guide, labels and rhythm are the "Planner" scaffold;
// everything Alex wrote rides the "Objectives" content layer.

const OBJECTIVES: Objective[] = [
  {
    area: 'Craft',
    sentence: {
      do: 'ship a shared design system for checkout',
      when: '30 Nov',
      measure: 'every checkout screen using it',
      why: 'the team builds faster and customers see one Plateful',
    },
    keyResults: [
      { text: '30 checkout screens on the system', now: '18 so far', progress: 60 },
      { text: 'UI bug reports: 40 to 20 a month', now: 'now 29', progress: 55 },
    ],
    steps: [
      { text: 'Audit every checkout screen', done: true },
      { text: 'Agree colour and type tokens with Sam', done: true },
      { text: 'Run Friday office hours', done: false },
    ],
    support: 'Two hours a week of Sam’s time, and a standing slot at design crit.',
    confidence: 4,
  },
  {
    area: 'Leadership',
    sentence: {
      do: 'mentor Kim and Jo to lead a project each',
      when: '15 Dec',
      measure: 'both shipping without me in every review',
      why: 'the team grows, and I stop being the bottleneck',
    },
    keyResults: [
      { text: 'Projects led end to end: 2', now: 'Kim shipped', progress: 50 },
      { text: 'Reviews I must attend: 8 to 3 a week', now: 'now 6', progress: 40 },
    ],
    steps: [
      { text: 'Pick the projects with Jordan', done: true },
      { text: 'Weekly 1:1s with Kim and Jo', done: false },
      { text: 'Hand over hosting design crit', done: false },
    ],
    support: 'Jordan backing me when I step out of reviews.',
    confidence: 3,
  },
  {
    area: 'Wellbeing',
    sentence: {
      do: 'keep two meeting-free mornings a week',
      when: '31 Dec',
      measure: '30 of 36 mornings kept',
      why: 'deep work happens in daylight, not at 11pm',
    },
    keyResults: [
      { text: 'Focus mornings kept: 30 of 36', now: '15 so far', progress: 42 },
      { text: 'Offline by 7pm, four nights a week', now: 'averaging 3', progress: 60 },
    ],
    steps: [
      { text: 'Block Tuesday and Thursday mornings', done: true },
      { text: 'Tell the team why', done: true },
      { text: 'Snooze Slack until 12 on those days', done: false },
    ],
    support: 'The team holding the line when a meeting drifts into my mornings.',
    confidence: 2,
  },
];

const STRENGTHS = ['Fast, scrappy prototypes', 'Customer interviews', 'Clear design writing'];
const GROWTH = ['Presenting to execs', 'Letting go of the pixels', 'Saying no to side quests'];

const WHY_HUE = '#e11d48';
const GUIDE_HUE = '#4f46e5';
const OBJ_HUE = '#0284c7';

export function buildObjectivesPlanner(cx: number, cy: number): Element[] {
  const gap = 40;
  const whyW = 330;
  const guideW = 420;
  const cardW = 360;
  // The row is as tall as the taller of the guide and an objective card.
  const bodyH = Math.max(objectiveCardHeight(3), GUIDE_H);
  const totalW = whyW + guideW + cardW * 3 + gap * 4;
  const x0 = cx - totalW / 2;
  const blockH =
    TITLE_H + SUBTITLE_H + HEAD_GAP + BAND_H + 20 + HEAD_H + 20 + bodyH + 48 + RHYTHM_H;
  const y0 = cy - blockH / 2;
  const bandY = y0 + TITLE_H + SUBTITLE_H + HEAD_GAP;
  const headY = bandY + BAND_H + 20;
  const top = headY + HEAD_H + 20;
  const whyX = x0;
  const guideX = whyX + whyW + gap;
  const objX = guideX + guideW + gap;
  const objW = cardW * 3 + gap * 2;

  const scaffold: Element[] = [];
  const content: Element[] = [];

  const [title, sticker, subtitle] = heading(
    x0,
    y0,
    totalW,
    'Alex’s objectives · H2 2026',
    420,
    'emoji-sparkles',
    'Alex Rivera, senior product designer at Plateful. Start with why, write each one with the formula, test it, then check in monthly.',
  );
  content.push(title!, sticker!);
  scaffold.push(subtitle!);

  scaffold.push(
    ...phaseBand(whyX, bandY, whyW, '1 · Reflect: start with why', WHY_HUE),
    ...phaseBand(guideX, bandY, guideW, '2 · Draft: write it well', GUIDE_HUE),
    ...phaseBand(objX, bandY, objW, '3 · Commit: three objectives, one per area', OBJ_HUE),
    ...columnHead(
      whyX,
      headY,
      whyW,
      'heart',
      WHY_HUE,
      'Start with why',
      'What do I want to be true by December?',
    ),
    ...columnHead(
      guideX,
      headY,
      guideW,
      'edit',
      GUIDE_HUE,
      'How to write one',
      'One sentence, four parts, then test it',
    ),
    ...columnHead(
      objX,
      headY,
      objW,
      'target',
      OBJ_HUE,
      'My objectives',
      'Craft, leadership and wellbeing: one each, so the half stays balanced',
    ),
  );

  // START WITH WHY: the focus, then what to build on and what to grow.
  const focusH = 132;
  content.push({
    ...createShape('callout', whyX, top),
    width: whyW,
    height: focusH,
    pageTitle: 'My focus for the half',
    label:
      'Become the designer the team trusts with its hardest problems, without the late nights.',
    iconId: 'star',
    textSize: 'sm',
    strokeColor: WHY_HUE,
  });
  const subLabel = (x: number, y: number, w: number, label: string): Element => ({
    ...createText(x, y),
    width: w,
    height: 26,
    label,
    textSize: 'sm',
    textBold: true,
    textAlignX: 'left',
  });
  const noteGap = 10;
  const noteW = (whyW - noteGap * 2) / 3;
  // The notes grow to fill the column, so it ends level with the cards.
  const noteH = (bodyH - focusH - 2 * (24 + 32) - (24 + 34 + 88)) / 2;
  const noteRow = (y: number, notes: string[], fill: string, text: string) =>
    notes.forEach((label, i) =>
      content.push({
        ...createSticky(whyX + i * (noteW + noteGap), y),
        width: noteW,
        height: noteH,
        label,
        textSize: 'md',
        fillColor: fill,
        textColor: text,
      }),
    );
  const strengthsY = top + focusH + 24;
  scaffold.push(subLabel(whyX, strengthsY, whyW, 'Strengths to build on'));
  noteRow(strengthsY + 32, STRENGTHS, '#bbf7d0', '#052e16');
  const growY = strengthsY + 32 + noteH + 24;
  scaffold.push(subLabel(whyX, growY, whyW, 'Areas to grow'));
  noteRow(growY + 32, GROWTH, '#fed7aa', '#431407');
  const peopleY = growY + 32 + noteH + 24;
  scaffold.push(subLabel(whyX, peopleY, whyW, 'People in my corner'));
  const CORNER = [
    { initials: 'JM', name: 'Jordan', role: 'manager, monthly 1:1', colour: '#0284c7' },
    { initials: 'MO', name: 'Mei', role: 'mentor, every other Friday', colour: '#c026d3' },
  ];
  CORNER.forEach((p, i) => {
    const y = peopleY + 34 + i * 44;
    const runs: TextRun[] = [
      { text: p.name, bold: true },
      { text: `  ${p.role}`, color: MUTED },
    ];
    content.push(initialsDisc(whyX, y, 34, p.initials, p.colour), {
      ...createText(whyX + 46, y),
      width: whyW - 46,
      height: 34,
      label: runsPlainText(runs),
      richText: runs,
      textSize: 'sm',
      textAlignX: 'left',
    });
  });

  // HOW TO WRITE ONE: the formula, a rewrite, and the SMART test.
  scaffold.push(...objectiveGuide(guideX, top, guideW));

  // THREE OBJECTIVES, one per life area.
  OBJECTIVES.forEach((obj, i) => {
    const card = objectiveCard(objX + i * (cardW + gap), top, cardW, bodyH, i + 1, obj);
    scaffold.push(...card.scaffold);
    content.push(...card.content);
  });

  // CHECK-IN RHYTHM: the sheet's closing strip, across its whole width.
  const rhythm = checkinRhythm(x0, top + bodyH + 48, totalW);
  scaffold.push(...rhythm.scaffold);
  content.push(...rhythm.content);

  return [
    ...scaffold.map((el) => ({ ...el, layerId: TEMPLATE_SCAFFOLD_LAYER_ID })),
    ...content.map((el) => ({ ...el, layerId: TEMPLATE_CONTENT_LAYER_ID })),
  ];
}
