// Icebreaker Questions, of the Games category (docs/specs/012-collaboration/game-templates.md). Like the
// other session boards it is RUN rather than filled in, so each tool sits beside the words that say when to press
// it. Find Someone Who Bingo lives next door in template-builders-party-games.ts.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[].

import { createShape, createSticky, type Element } from '@livepages/document';
import {
  BUTTON_H,
  BUTTON_W,
  GAP,
  HEAD_GAP,
  PAD_W,
  SUBTITLE_H,
  TITLE_H,
  UNDER_SECTION,
  heading,
  note,
  section,
  sessionButton,
  stepCards,
  type SessionStep,
} from './template-session-parts';
import { ICEBREAKER_QUESTIONS } from './template-games-data';
import { BLUE, PINK } from './template-workshop-stickies';

// Icebreaker Questions: the round drawn down the left as four joined step cards; in the centre the two Pickers that
// run it (a written list of questions, then the room) over a two-minute timer and a Hearts pad; on the right the
// hello wall, two example stickies under the line that says what to write.
const ICEBREAKER_STEPS: SessionStep[] = [
  {
    n: '1',
    title: 'Spin a question',
    hint: 'Press Pick on Today’s question. Everyone hears it at once.',
    icon: 'help-circle',
    fill: '#e0f2fe',
    ink: '#0369a1',
  },
  {
    n: '2',
    title: 'Spin a person',
    hint: 'Press Pick on Who answers? to choose someone in the room.',
    icon: 'users',
    fill: '#ede9fe',
    ink: '#6d28d9',
  },
  {
    n: '3',
    title: 'Two minutes',
    hint: 'Start the timer. They answer, the room asks one follow-up.',
    icon: 'timer',
    fill: '#fef3c7',
    ink: '#b45309',
  },
  {
    n: '4',
    title: 'Say hello',
    hint: 'Everyone adds a sticky to the wall, then spin again.',
    icon: 'smile',
    fill: '#dcfce7',
    ink: '#15803d',
  },
];

export function buildIcebreakerQuestions(cx: number, cy: number): Element[] {
  const stepsW = 340;
  const stepH = 124;
  const stepGap = 36;
  const spinW = 420;
  const wallW = 340;
  const bodyH = UNDER_SECTION + ICEBREAKER_STEPS.length * (stepH + stepGap) - stepGap;
  const totalW = stepsW + GAP + spinW + GAP + wallW;
  const x0 = cx - totalW / 2;
  const y0 = cy - (TITLE_H + SUBTITLE_H + HEAD_GAP + bodyH) / 2;
  const top = y0 + TITLE_H + SUBTITLE_H + HEAD_GAP;
  const spinX = x0 + stepsW + GAP;
  const wallX = spinX + spinW + GAP;

  const steps = stepCards(x0, top + UNDER_SECTION, stepsW, stepH, stepGap, ICEBREAKER_STEPS);
  const elements: Element[] = [
    ...heading(
      x0,
      y0,
      totalW,
      'Icebreakers · Team kick-off',
      520,
      'emoji-wave',
      'Spin a question, spin a person, two minutes each. Then add yourself to the wall.',
    ),
    section(x0, top, stepsW, 'How it works'),
    ...steps.elements,
  ];

  const questionH = 180;
  const personH = 150;
  const personY = top + UNDER_SECTION + questionH + 20;
  const kitY = personY + personH + 20;
  elements.push(
    section(spinX, top, spinW, 'The spin'),
    {
      ...createShape('picker', spinX, top + UNDER_SECTION),
      width: spinW,
      height: questionH,
      label: 'Today’s question',
      pickerSource: 'options',
      pickerOptions: [...ICEBREAKER_QUESTIONS],
    },
    {
      ...createShape('picker', spinX, personY),
      width: spinW,
      height: personH,
      label: 'Who answers?',
    },
    { ...sessionButton({ tool: 'timer', minutes: 2 }), x: spinX, y: kitY },
    {
      ...createShape('reaction-pad', spinX + BUTTON_W + 16, kitY),
      width: PAD_W,
      height: BUTTON_H,
      reaction: 'hearts',
      label: 'Love that',
    },
  );

  const sticky = (wallW - 16) / 2;
  const stickyY = top + UNDER_SECTION + 64;
  elements.push(
    section(wallX, top, wallW, 'Say hello'),
    note(
      wallX,
      top + UNDER_SECTION,
      wallW,
      52,
      'A sticky each: your name, where you are and one thing we would not guess.',
    ),
    {
      ...createSticky(wallX, stickyY),
      ...BLUE,
      width: sticky,
      height: sticky,
      label: 'Maya · Leeds · I keep bees',
      textSize: 'sm',
    },
    {
      ...createSticky(wallX + sticky + 16, stickyY + 24),
      ...PINK,
      width: sticky,
      height: sticky,
      label: 'Dev · Pune · I have run four marathons',
      textSize: 'sm',
    },
  );

  return elements;
}
