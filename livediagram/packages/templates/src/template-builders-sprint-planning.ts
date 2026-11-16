// Sprint Planning (docs/specs/008-canvas/canvas-and-palette.md "Templates"): a team plans its next sprint on the retro
// kit's board (template-retro-kit.ts), so it reads like the retros it alternates with. The left rail holds the sprint
// goal, the capacity as a stat row, a fist-of-five confidence check and the session's timer and vote; three columns
// of story stickies carry their points (Ready backlog, Committed adding up to the capacity, Stretch); and the closing
// column holds risks and dependencies over the team's Definition of done.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createShape, createText, type Element } from '@livediagram/document';
import {
  CONTENT,
  RETRO,
  RETRO_HUES,
  RETRO_INK,
  actionChecklist,
  actionsPanel,
  moodCheck,
  panelHeading,
  railNote,
  retroHeader,
  retroHeading,
  retroNotesTop,
  retroPanel,
  sessionButtons,
  stickyGrid,
  stickyGridHeight,
  type RetroHue,
} from './template-retro-kit';

type Column = {
  label: string;
  hint: string;
  icon: string;
  hue: RetroHue;
  notes: readonly string[];
};

// Committed adds up to the capacity (34 points), so the board shows a plan that fits.
const COLUMNS: readonly Column[] = [
  {
    label: 'Ready backlog',
    hint: 'Refined and estimated, top first',
    icon: 'clipboard',
    hue: RETRO_HUES.slate,
    notes: [
      'Gift cards at checkout · 8 pts',
      'Dark mode for the courier app · 5 pts',
      'Split the bill with friends · 13 pts',
      'Restaurant opening hours on menus · 3 pts',
    ],
  },
  {
    label: 'Committed',
    hint: 'Adds up to our 34 points',
    icon: 'target',
    hue: RETRO_HUES.blue,
    notes: [
      'Reorder a past order in one tap · 8 pts',
      'Live courier map on the order page · 13 pts',
      'Allergen filter on search · 5 pts',
      'Faster card form (Apple Pay) · 5 pts',
      'Fix: promo code lost on refresh · 3 pts',
    ],
  },
  {
    label: 'Stretch',
    hint: 'Only if Committed lands early',
    icon: 'trending-up',
    hue: RETRO_HUES.violet,
    notes: ['Tip the courier after delivery · 5 pts', 'Order notes for the kitchen · 3 pts'],
  },
];

const RISKS = [
  'Live map needs the routing API key from Ops by Tuesday',
  'Ana is off Thursday and Friday of week 2',
  'Apple Pay review can take a week',
];

const DONE_CHECKS = [
  'Code reviewed and merged',
  'Tested on iOS and Android',
  'Product owner has seen it',
  'Release notes written',
];

export function buildSprintPlanning(cx: number, cy: number): Element[] {
  const { railW, gap, pad, titleH, subtitleH, headGap, stickyGap } = RETRO;
  const colW = 380;
  const noteH = 104;
  const closeW = 380;
  const colH = retroNotesTop(0) + stickyGridHeight(5, 1, noteH) + pad;
  const totalW = railW + gap + 3 * (colW + gap) + closeW;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + subtitleH + headGap + colH) / 2;
  const top = y0 + titleH + subtitleH + headGap;

  // The rail: goal, capacity, confidence, then the timer and vote with a line on when to use them.
  const goalH = 150;
  const statY = top + goalH + 16;
  const statH = 96;
  const tempY = statY + statH + 16;
  const tempH = 260;
  const buttonY = tempY + tempH + 16;
  const noteY = buttonY + RETRO.buttonH + 12;
  const rail: Element[] = [
    retroPanel(x0, top, railW, goalH, RETRO_HUES.amber),
    { ...panelHeading(x0 + pad, top + 12, railW - pad * 2, 'Sprint goal'), textColor: '#b45309' },
    {
      ...createText(x0 + pad, top + 52),
      width: railW - pad * 2,
      height: goalH - 64,
      label: 'Customers can reorder in one tap and watch their courier on a live map.',
      textSize: 'md',
      textBold: true,
      textColor: '#451a03',
      textAlignX: 'left',
      textAlignY: 'top',
      ...CONTENT,
    },
    {
      ...createShape('stat-row', x0, statY),
      width: railW,
      height: statH,
      stats: [
        { value: '5', caption: 'People' },
        { value: '9', caption: 'Days' },
        { value: '34', caption: 'Points' },
      ],
      ...CONTENT,
    },
    moodCheck(x0, tempY, railW, tempH, 'How sure are we we’ll hit the goal?'),
    ...sessionButtons(x0, buttonY, railW, { minutes: 10, dots: 2 }),
    railNote(
      x0,
      noteY,
      railW,
      top + colH - noteY,
      'Ten minutes a story at most. When Committed is full, everyone spends two dots on the stretch worth trying.',
    ),
  ];

  const columns = COLUMNS.flatMap((col, i): Element[] => {
    const x = x0 + railW + gap + i * (colW + gap);
    return [
      retroPanel(x, top, colW, colH, col.hue),
      ...retroHeader(x, top, colW, col.label, col.hint, col.icon, col.hue.headerColor),
      ...stickyGrid(
        x + pad,
        retroNotesTop(top),
        colW - pad * 2,
        noteH,
        1,
        col.notes,
        col.hue.sticky,
        stickyGap,
      ),
    ];
  });

  // Risks over the Definition of done, on the neutral closing paper.
  const closeX = x0 + railW + gap + 3 * (colW + gap);
  const riskH = 88;
  const riskTop = retroNotesTop(top);
  const doneHeadY = riskTop + RISKS.length * (riskH + stickyGap) + 8;
  const closing: Element[] = [
    actionsPanel(closeX, top, closeW, colH),
    ...retroHeader(
      closeX,
      top,
      closeW,
      'Risks',
      'What could stop us, and who unblocks it',
      'alert-triangle',
      RETRO_INK,
    ),
    ...stickyGrid(
      closeX + pad,
      riskTop,
      closeW - pad * 2,
      riskH,
      1,
      RISKS,
      RETRO_HUES.orange.sticky,
      stickyGap,
      'sm',
    ),
    panelHeading(closeX + pad, doneHeadY, closeW - pad * 2, 'Definition of done'),
    actionChecklist(closeX + pad, doneHeadY + 40, closeW - pad * 2, DONE_CHECKS),
  ];
  return [
    ...retroHeading(
      x0,
      y0,
      totalW,
      'Sprint 15 planning · 3 to 14 March',
      'Agree the goal, check capacity, pull stories into Committed until the points match, then check how sure we are.',
    ),
    ...rail,
    ...columns,
    ...closing,
  ];
}
