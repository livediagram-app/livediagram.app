// The 4Ls retrospective (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the reflective
// retro, run after a milestone rather than a sprint. Unlike the column
// formats the four Ls sit in a 2x2 (Liked / Learned over Lacked / Longed
// for), each quadrant a tinted container with a deep-hue header, a glyph, a
// prompt and three notes in a row. The shared opening rail sits on the left
// and closes on the milestone's facts (a stat row), and an Action items strip
// runs under the grid, its checklist split over two columns.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createShape, createText, type Element } from '@livediagram/document';
import {
  actionChecklist,
  actionsPanel,
  CONTENT,
  RETRO,
  RETRO_HUES,
  RETRO_INK,
  railNote,
  retroHeader,
  retroHeading,
  retroNotesTop,
  retroPanel,
  SCAFFOLD,
  moodCheck,
  sessionButtons,
  stickyGrid,
  stickyGridHeight,
  checklistHeight,
  type RetroHue,
} from './template-retro-kit';

const FOUR_LS: { label: string; hint: string; icon: string; hue: RetroHue; notes: string[] }[] = [
  {
    label: 'Liked',
    hint: 'What did you enjoy?',
    icon: 'heart',
    hue: RETRO_HUES.green,
    notes: [
      'Daily launch-room standups kept us in sync',
      'Design QA caught issues before customers did',
      'Support joined planning from week one',
      'The staged rollout felt calm',
      'Finance signed off pricing early',
      'Pizza at the Friday bug bash',
    ],
  },
  {
    label: 'Learned',
    hint: 'What did we find out?',
    icon: 'book',
    hue: RETRO_HUES.sky,
    notes: [
      'Apple Pay shoppers convert twice as often',
      'Feature flags let us roll back in minutes',
      'Load tests need real basket sizes',
      'Guest checkout matters more than we thought',
      'Error copy drives support tickets',
      'Mobile Safari needs its own QA pass',
    ],
  },
  {
    label: 'Lacked',
    hint: 'What was missing?',
    icon: 'battery',
    hue: RETRO_HUES.amber,
    notes: [
      'A clear owner for payment errors',
      'Time to fix the address form',
      'Analytics ready on launch day',
      'A rollback runbook anyone could follow',
      'Test cards for every region',
      'Design time for the edge cases',
    ],
  },
  {
    label: 'Longed for',
    hint: 'What do we wish we’d had?',
    icon: 'star',
    hue: RETRO_HUES.violet,
    notes: [
      'A sandbox copy of the payment provider',
      'One more week of beta',
      'A launch checklist we trust',
      'One dashboard the whole team watches',
      'Fewer meetings in launch week',
      'Customer quotes from day one',
    ],
  },
];

// Split over two checklists across the strip, three lines each.
const FOUR_LS_ACTIONS = [
  'Name an owner for payment errors · Mei · 3 Oct',
  'Write the launch checklist · Tom · 7 Oct',
  'Order regional test cards · Joe · 9 Oct',
  'Stand up a payments sandbox · Ravi · 10 Oct',
  'Write a rollback runbook · Ana · 14 Oct',
  'Analytics live before launch · Kim · 17 Oct',
];

export function buildFourLs(cx: number, cy: number): Element[] {
  const { railW, gap, pad, titleH, subtitleH, headGap, stickyGap, buttonH } = RETRO;
  // Six notes per quadrant, two rows of three.
  const perRow = 3;
  const noteW = 176;
  const noteH = 108;
  const quadW = pad * 2 + perRow * noteW + (perRow - 1) * stickyGap;
  const quadH = retroNotesTop(0) + stickyGridHeight(6, perRow, noteH) + pad;
  const gridW = quadW * 2 + gap;
  const gridH = quadH * 2 + gap;
  const half = FOUR_LS_ACTIONS.length / 2;
  const stripH = pad * 2 + checklistHeight(half);
  const bodyH = gridH + gap + stripH;
  const totalW = railW + gap + gridW;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + subtitleH + headGap + bodyH) / 2;
  const top = y0 + titleH + subtitleH + headGap;
  const gridX = x0 + railW + gap;

  // Rail: the mood, the tools, a note, then the milestone's facts at the
  // foot, level with the actions strip.
  const tempH = 380;
  const buttonsY = top + tempH + 24;
  const statH = 96;
  const statY = top + bodyH - statH;
  const noteY = buttonsY + buttonH + 20;
  // The title sized to its words, with a rocket beside it: this retro marks
  // a launch.
  const [title, howTo] = retroHeading(
    x0,
    y0,
    totalW,
    'Checkout launch · 4Ls',
    'Look back over the whole milestone: write for 7 minutes, read each L out, dot-vote, then act on the top themes.',
  );
  const titleW = 340;
  const elements: Element[] = [
    { ...title!, width: titleW },
    {
      ...createShape('sticker', x0 + titleW + 4, y0 - 2),
      width: 52,
      height: 52,
      stickerId: 'emoji-rocket',
      rotation: -8,
      ...CONTENT,
    },
    howTo!,
    moodCheck(x0, top, railW, tempH, 'How did the launch feel?'),
    ...sessionButtons(x0, buttonsY, railW, { minutes: 7, dots: 3 }),
    railNote(
      x0,
      noteY,
      railW,
      statY - 52 - noteY,
      'Think back to kickoff, not just last week. Fill all four Ls, then spend your dots across the whole grid.',
    ),
    {
      ...createText(x0, statY - 40),
      width: railW,
      height: 32,
      label: 'The launch in numbers',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
    {
      ...createShape('stat-row', x0, statY),
      width: railW,
      height: statH,
      stats: [
        { value: '+4.1%', caption: 'Conversion' },
        { value: '2', caption: 'Incidents' },
        { value: '9', caption: 'Days late' },
      ],
      ...CONTENT,
    },
  ];

  FOUR_LS.forEach((q, i) => {
    const x = gridX + (i % 2) * (quadW + gap);
    const y = top + Math.floor(i / 2) * (quadH + gap);
    elements.push(
      retroPanel(x, y, quadW, quadH, q.hue),
      ...retroHeader(x, y, quadW, q.label, q.hint, q.icon, q.hue.headerColor),
    );
    elements.push(
      ...stickyGrid(
        x + pad,
        retroNotesTop(y),
        quadW - pad * 2,
        noteH,
        perRow,
        q.notes,
        q.hue.sticky,
      ),
    );
  });

  // The strip: the header block on the left, the checklist over two columns.
  const stripY = top + gridH + gap;
  const headW = 360;
  const listX = gridX + headW;
  const listW = (gridW - headW - pad - 24) / 2;
  elements.push(
    actionsPanel(gridX, stripY, gridW, stripH),
    ...retroHeader(
      gridX,
      stripY,
      headW,
      'Action items',
      'Before Payments v2 kicks off',
      'check-circle',
      RETRO_INK,
    ),
    actionChecklist(listX, stripY + pad, listW, FOUR_LS_ACTIONS.slice(0, half)),
    actionChecklist(listX + listW + 24, stripY + pad, listW, FOUR_LS_ACTIONS.slice(half)),
  );
  return elements;
}
