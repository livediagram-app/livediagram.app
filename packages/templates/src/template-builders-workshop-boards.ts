// Two workshop boards run on one tab (docs/specs/008-canvas/canvas-and-palette.md "Templates"): a Brainstorm, ideas
// written alone and then clustered into themes, and a Workshop Board, the kickoff wall for a longer session with
// its goals, its timed agenda, its ground rules and an icebreaker. Both are built from the shared retro kit
// (template-retro-kit.ts), so they meet a team with the same heading, tinted columns, deep-hue headers, notes in
// the column's hue and session tools as every retro does.
//
// Every part carries its layer: panels, headers and prompts are the scaffold; the title, notes, tools and
// checklists are content, so they stay usable when the board is locked.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { agendaFitHeight, createShape, createText, type Element } from '@livediagram/document';
import {
  actionChecklist,
  checklistHeight,
  CONTENT,
  moodCheck,
  panelHeading,
  RETRO,
  RETRO_HUES,
  RETRO_INK,
  retroHeader,
  retroHeading,
  retroNotesTop,
  retroPanel,
  railNote,
  sessionButtons,
  stickyGrid,
  stickyGridHeight,
  stickyStack,
  type RetroHue,
} from './template-retro-kit';

// The neutral paper a board's question or icebreaker sits on, as the Action items' panel is.
const PAPER = { fill: '#f8fafc', stroke: '#94a3b8' };

// --- Brainstorm ------------------------------------------------------------

// The question on its own card at the top of the rail, the timer and the vote under it, and how the round runs.
// Then the Unsorted column, where every new idea lands, and three themes the room clusters them into: a theme
// is a column with a name, so moving a note across IS clustering it.
const BRAINSTORM_THEMES: {
  label: string;
  hint: string;
  icon: string;
  hue: RetroHue;
  notes: string[];
}[] = [
  {
    label: 'Guide them in',
    hint: 'Help people to their first win',
    icon: 'map-pin',
    hue: RETRO_HUES.sky,
    notes: [
      'A checklist of the first five steps',
      'Sample data so nothing starts empty',
      'A two-minute welcome video',
      'Templates for the common jobs',
    ],
  },
  {
    label: 'Show progress',
    hint: 'Make the value they get visible',
    icon: 'trending-up',
    hue: RETRO_HUES.violet,
    notes: [
      'A weekly summary of what they did',
      'Celebrate the first shared board',
      'Show time saved on the dashboard',
    ],
  },
  {
    label: 'Stay close',
    hint: 'Reach people before they give up',
    icon: 'help-circle',
    hue: RETRO_HUES.green,
    notes: [
      'Live chat in the first week',
      'A nudge when someone stalls',
      'Office hours every Thursday',
    ],
  },
];

const BRAINSTORM_UNSORTED = [
  'Pair new teams with a buddy team',
  'An in-app tour that can be skipped',
  'Ask why they signed up, then tailor',
  'A starter course by email',
  'Reward inviting a teammate',
  'Ask what is missing after a week',
];

export function buildBrainstorm(cx: number, cy: number): Element[] {
  const { railW, colW, gap, pad, titleH, subtitleH, headGap } = RETRO;
  const noteH = 108;
  const colH = retroNotesTop(0) + stickyGridHeight(BRAINSTORM_UNSORTED.length, 2, noteH) + pad;
  const totalW = railW + (colW + gap) * 4;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + subtitleH + headGap + colH) / 2;
  const top = y0 + titleH + subtitleH + headGap;
  const notesTop = retroNotesTop(top);

  const questionH = 196;
  const buttonY = top + questionH + 24;
  const ruleY = buttonY + RETRO.buttonH + 20;
  const elements: Element[] = [
    ...retroHeading(
      x0,
      y0,
      totalW,
      'Brainstorm · First-week success',
      'Write alone for 5 minutes, one idea per note, then cluster them into themes and dot-vote the ones to try.',
    ),
    retroPanel(x0, top, railW, questionH, PAPER, { strokeWidth: 'thick' }),
    panelHeading(x0 + pad, top + pad, railW - pad * 2, 'The question'),
    {
      ...createText(x0 + pad, top + pad + 40),
      width: railW - pad * 2,
      height: questionH - pad * 2 - 40,
      label: 'How might we help new customers succeed in their first week?',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      textAlignY: 'top',
      textColor: RETRO_INK,
      ...CONTENT,
    },
    ...sessionButtons(x0, buttonY, railW, { minutes: 5, dots: 3 }),
    railNote(
      x0,
      ruleY,
      railW,
      colH - (ruleY - top),
      'Go for quantity and build on each other’s ideas; no critique until the vote. New ideas land in Unsorted, then move to the theme they fit or start a new one.',
    ),
  ];

  const unsortedX = x0 + railW + gap;
  elements.push(
    retroPanel(unsortedX, top, colW, colH, RETRO_HUES.slate),
    ...retroHeader(
      unsortedX,
      top,
      colW,
      'Unsorted',
      'Every new idea starts here',
      'layers',
      RETRO_HUES.slate.headerColor,
    ),
    ...stickyGrid(
      unsortedX + pad,
      notesTop,
      colW - pad * 2,
      noteH,
      2,
      BRAINSTORM_UNSORTED,
      RETRO_HUES.amber.sticky,
    ),
  );

  BRAINSTORM_THEMES.forEach((theme, i) => {
    const x = unsortedX + (i + 1) * (colW + gap);
    elements.push(
      retroPanel(x, top, colW, colH, theme.hue),
      ...retroHeader(x, top, colW, theme.label, theme.hint, theme.icon, theme.hue.headerColor),
      ...stickyGrid(x + pad, notesTop, colW - pad * 2, noteH, 2, theme.notes, theme.hue.sticky),
    );
  });

  return elements;
}

// --- Workshop Board -------------------------------------------------------

// The wall a longer session opens on: the room checks in and breaks the ice down the rail, then three columns
// say what the session is for (Goals, with what is out of scope under them), how it runs (the Agenda, whose
// segments start the timer) and how people work together (Ground rules, with a parking lot for what comes up).
const WORKSHOP_GOALS = [
  'A shared picture of the problem',
  'The three riskiest assumptions',
  'Two ideas to test next sprint',
  'An owner for each test',
];

const WORKSHOP_OUT_OF_SCOPE = ['Delivery dates and estimates', 'Picking the final design'];

const WORKSHOP_AGENDA = [
  { label: 'Check in and icebreaker', minutes: 10 },
  { label: 'Goals and context', minutes: 10 },
  { label: 'What we know', minutes: 20 },
  { label: 'Map the opportunities', minutes: 25 },
  { label: 'Break', minutes: 10 },
  { label: 'Ideas and dot vote', minutes: 30 },
  { label: 'Owners and next steps', minutes: 15 },
];

const WORKSHOP_RULES = [
  'One conversation at a time',
  'Phones down, laptops for the board',
  'Yes, and: build on ideas first',
  'Off-topic goes in the parking lot',
];

export function buildWorkshopBoard(cx: number, cy: number): Element[] {
  const { railW, colW, gap, pad, titleH, subtitleH, headGap } = RETRO;
  const inner = colW - pad * 2;
  const ruleH = 76;
  const sectionGap = 24;
  // Ground rules: the rules, then the parking lot's heading and its first note.
  const rulesH = stickyGridHeight(WORKSHOP_RULES.length, 1, ruleH);
  const parkingTop = rulesH + sectionGap;
  const parkingH = 36 + 8 + ruleH;
  // Goals: the checklist, then the out-of-scope heading and its notes.
  const goalsH = checklistHeight(WORKSHOP_GOALS.length);
  const scopeH = 36 + 8 + stickyGridHeight(WORKSHOP_OUT_OF_SCOPE.length, 1, ruleH);
  const agendaH = agendaFitHeight({
    width: inner,
    height: 0,
    agendaItems: WORKSHOP_AGENDA,
  });
  const body = Math.max(parkingTop + parkingH, goalsH + sectionGap + scopeH, agendaH);
  const colH = retroNotesTop(0) + body + pad;
  const totalW = railW + (colW + gap) * 3;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + subtitleH + headGap + colH) / 2;
  const top = y0 + titleH + subtitleH + headGap;
  const notesTop = retroNotesTop(top);

  // The rail: how everyone arrives, then the icebreaker on its own card with its timer.
  const iceY = top + RETRO.tempH + sectionGap;
  const iceH = colH - RETRO.tempH - sectionGap;
  const iceButtonY = top + colH - pad - RETRO.buttonH;
  const elements: Element[] = [
    ...retroHeading(
      x0,
      y0,
      totalW,
      'Product discovery kickoff · 2 hours',
      'Check in and break the ice, agree the goals and the rules, then run the agenda segment by segment.',
    ),
    moodCheck(x0, top, railW, RETRO.tempH, 'How are you arriving today?'),
    retroPanel(x0, iceY, railW, iceH, PAPER, { strokeWidth: 'thick' }),
    panelHeading(x0 + pad, iceY + pad, railW - pad * 2, 'Icebreaker'),
    {
      ...createText(x0 + pad, iceY + pad + 40),
      width: railW - pad * 2,
      height: iceButtonY - (iceY + pad + 40) - 12,
      label: 'Two truths and a lie, about a product you love. The room guesses the lie.',
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
      textColor: RETRO_INK,
      ...CONTENT,
    },
    {
      ...createShape('session-button', x0 + pad, iceButtonY),
      width: railW - pad * 2,
      height: RETRO.buttonH,
      session: { tool: 'timer', minutes: 10 },
      ...CONTENT,
    },
  ];

  const goalsX = x0 + railW + gap;
  const goalsHue = RETRO_HUES.amber;
  const scopeY = notesTop + goalsH + sectionGap;
  elements.push(
    retroPanel(goalsX, top, colW, colH, goalsHue),
    ...retroHeader(
      goalsX,
      top,
      colW,
      'Goals',
      'By the end we will have',
      'target',
      goalsHue.headerColor,
    ),
    actionChecklist(goalsX + pad, notesTop, inner, WORKSHOP_GOALS),
    panelHeading(goalsX + pad, scopeY, inner, 'Out of scope'),
    ...stickyStack(goalsX + pad, scopeY + 44, inner, ruleH, WORKSHOP_OUT_OF_SCOPE, goalsHue.sticky),
  );

  const agendaX = goalsX + colW + gap;
  const agendaHue = RETRO_HUES.sky;
  const kitY = notesTop + agendaH + sectionGap;
  elements.push(
    retroPanel(agendaX, top, colW, colH, agendaHue),
    ...retroHeader(
      agendaX,
      top,
      colW,
      'Agenda',
      'Press a segment to start its timer',
      'clock',
      agendaHue.headerColor,
    ),
    {
      ...createShape('agenda', agendaX + pad, notesTop),
      width: inner,
      height: agendaH,
      label: 'Run of show',
      agendaItems: WORKSHOP_AGENDA.map((item) => ({ ...item })),
      ...CONTENT,
    },
    // Under the agenda, the one tool it does not run itself: the vote on the ideas (each segment, the
    // break included, starts its own timer).
    {
      ...createShape('session-button', agendaX + pad, kitY),
      width: inner,
      height: RETRO.buttonH,
      session: { tool: 'vote', dots: 3 },
      ...CONTENT,
    },
    railNote(
      agendaX + pad,
      kitY + RETRO.buttonH + 16,
      inner,
      colH - (kitY + RETRO.buttonH + 16 - top) - pad,
      'In Ideas and dot vote, everyone spends three dots on the ideas worth testing.',
    ),
  );

  const rulesX = agendaX + colW + gap;
  const rulesHue = RETRO_HUES.violet;
  const parkingY = notesTop + parkingTop;
  elements.push(
    retroPanel(rulesX, top, colW, colH, rulesHue),
    ...retroHeader(
      rulesX,
      top,
      colW,
      'Ground rules',
      'How we work together today',
      'users',
      rulesHue.headerColor,
    ),
    ...stickyStack(rulesX + pad, notesTop, inner, ruleH, WORKSHOP_RULES, rulesHue.sticky),
    panelHeading(rulesX + pad, parkingY, inner, 'Parking lot'),
    ...stickyStack(
      rulesX + pad,
      parkingY + 44,
      inner,
      ruleH,
      ['Pricing questions for the sales team'],
      rulesHue.sticky,
    ),
  );

  return elements;
}
