// The quiz boards of the Quizzes & Games category (docs/specs/012-collaboration/quiz-and-game-templates.md): the Pub
// Quiz and Icebreaker Questions. Like the other session boards they are RUN rather than filled in, so each tool sits
// beside the words that say when to press it. The party games (Two Truths and a Lie, Would You Rather, Find
// Someone Who Bingo) live next door in template-builders-party-games.ts.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[].

import {
  createShape,
  createSticky,
  createTable,
  type Element,
  type TableCellStyle,
} from '@livedesign/document';
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
import {
  ICEBREAKER_QUESTIONS,
  PUB_QUIZ_ROUNDS,
  PUB_QUIZ_SECONDS,
  PUB_QUIZ_TEAMS,
  PUB_QUIZ_TIE_BREAK,
} from './template-quiz-games-data';
import { BLUE, PINK, YELLOW } from './template-workshop-stickies';

// The reaction pad's size beside a session button: as tall as the button, so a kit row reads as one band.
// The gap between a section label and what it heads.

// Pub Quiz: three rounds of three Quiz cards on the right, each round a row under its own label, so the quizmaster
// works across and down. The left column keeps score (a table the quizmaster fills in after each round), holds the
// kit (a Picker for who reads the next question, a Fireworks pad for the winners) and the tie-breaker, its answer
// under a reveal zone so it stays hidden until the quizmaster reveals it for everyone.
export function buildPubQuiz(cx: number, cy: number): Element[] {
  const leftW = 380;
  const quiz = 320;
  const quizGap = 40;
  const perRound = Math.max(...PUB_QUIZ_ROUNDS.map((r) => r.questions.length));
  const roundsW = perRound * quiz + (perRound - 1) * quizGap;
  const roundH = UNDER_SECTION + quiz;
  const bodyH = PUB_QUIZ_ROUNDS.length * (roundH + GAP) - GAP;
  const totalW = leftW + GAP + roundsW;
  const x0 = cx - totalW / 2;
  const y0 = cy - (TITLE_H + SUBTITLE_H + HEAD_GAP + bodyH) / 2;
  const top = y0 + TITLE_H + SUBTITLE_H + HEAD_GAP;
  const roundsX = x0 + leftW + GAP;

  const elements: Element[] = [
    ...heading(
      x0,
      y0,
      totalW,
      'The Friday Pub Quiz',
      440,
      'emoji-trophy',
      'Three rounds of three. The quizmaster starts each question, everyone picks before the clock runs out, then Reveal shows who got it.',
    ),
  ];

  PUB_QUIZ_ROUNDS.forEach((round, r) => {
    const y = top + r * (roundH + GAP);
    elements.push(section(roundsX, y, roundsW, round.title));
    round.questions.forEach((q, i) => {
      elements.push({
        ...createShape('quiz', roundsX + i * (quiz + quizGap), y + UNDER_SECTION),
        width: quiz,
        height: quiz,
        label: q.question,
        quizOptions: [...q.options],
        quizCorrect: q.correct,
        quizSeconds: PUB_QUIZ_SECONDS,
      });
    });
  });

  // The scoreboard: a header row of rounds, a header column of teams, the scores left for the quizmaster. The
  // headers pin their own paper and ink so they read on a dark canvas too; the score cells follow the theme.
  const head: TableCellStyle = { bg: '#fde68a', textColor: '#451a03', bold: true };
  const team: TableCellStyle = { bg: '#fef3c7', textColor: '#451a03', bold: true };
  const cells = [
    ['Team', 'R1', 'R2', 'R3', 'Total'],
    ...PUB_QUIZ_TEAMS.map((t) => [t, '', '', '', '']),
  ];
  const rowH = 44;
  elements.push(section(x0, top, leftW, 'Scoreboard'), {
    ...createTable(x0, top + UNDER_SECTION),
    width: leftW,
    height: cells.length * rowH,
    cells,
    cellStyles: cells.map((row, r) => row.map((_, c) => (r === 0 ? head : c === 0 ? team : null))),
    headerRow: true,
    headerColumn: true,
    colWidths: [170, null, null, null, null],
    textSize: 'sm',
  });

  const kitY = top + UNDER_SECTION + cells.length * rowH + GAP;
  const pickerH = 132;
  const padY = kitY + UNDER_SECTION + pickerH + 16;
  elements.push(
    section(x0, kitY, leftW, 'Quizmaster kit'),
    {
      ...createShape('picker', x0, kitY + UNDER_SECTION),
      width: leftW,
      height: pickerH,
      label: 'Who reads the next question?',
    },
    {
      ...createShape('reaction-pad', x0, padY),
      width: PAD_W,
      height: BUTTON_H,
      reaction: 'fireworks',
      label: 'Winners!',
    },
    note(
      x0 + PAD_W + 16,
      padY,
      leftW - PAD_W - 16,
      BUTTON_H,
      'Add up the scores after Round 3, then set off the fireworks.',
    ),
  );

  // The tie-breaker: the question in the open, its answer on a sticky under a cover the quizmaster lifts.
  const tieY = padY + BUTTON_H + GAP;
  const answerY = tieY + UNDER_SECTION + 56;
  const answerH = 110;
  elements.push(
    section(x0, tieY, leftW, 'Tie-breaker'),
    note(x0, tieY + UNDER_SECTION, leftW, 48, PUB_QUIZ_TIE_BREAK.question),
    {
      ...createSticky(x0, answerY),
      ...YELLOW,
      width: leftW,
      height: answerH,
      label: PUB_QUIZ_TIE_BREAK.answer,
      textSize: 'lg',
      textBold: true,
    },
    {
      ...createShape('reveal', x0, answerY),
      width: leftW,
      height: answerH,
      label: 'Answer',
    },
  );

  return elements;
}

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
