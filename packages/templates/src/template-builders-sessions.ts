// Live-session boards built around the Q&A board (docs/specs/012-collaboration/qa-board.md): Lean Coffee
// and a Town Hall Q&A. Unlike the workshop boards next door these are RUN
// rather than filled in, so their centre is a live element the room writes
// into, flanked by the session tools the format calls for and a checklist for
// what comes out of it. Every tool sits next to the words that say when to
// press it, so a first-time facilitator can run the session from the board.
//
// The Q&A boards start EMPTY on purpose. A session template is used live, and
// a board seeded with example questions is the first thing a facilitator has
// to delete in front of the room; the board's own empty state already says
// what to do. The scaffolding around it (steps, panel, agenda) is what carries
// the worked example instead.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. See docs/specs/008-canvas/canvas-and-palette.md "Templates" for the catalogue.

import { createPinnedArrow, createShape, createText, type Element } from '@livediagram/document';
import {
  BUTTON_H,
  BUTTON_W,
  GAP,
  HEAD_GAP,
  SECTION_H,
  SUBTITLE_H,
  TITLE_H,
  checklist,
  heading,
  note,
  section,
} from './template-session-parts';

// The Town Hall lives in its own module; re-exported so build-template keeps
// importing both session boards from here.
export { buildTownHall } from './template-builders-town-hall';

// Lean Coffee: an agenda-less meeting. Everyone proposes topics, the room
// upvotes them, the top topic gets a short timebox, and when it rings the room
// votes to keep going or move on. The loop is drawn as four tinted step cards
// down the left, joined by arrows, with a loop-back arrow from the last step
// to the discuss step ("next topic"), so the ritual's shape is visible before
// anyone reads a word. The Topics board (the Q&A board IS that loop: add,
// upvote, spotlight, Done, next) sits in the middle. On the right, the
// facilitator's kit is laid out in the order it is pressed: the 8-minute
// timebox, the keep-going poll, the 4-minute extension. Takeaways close it.
type Step = { n: string; title: string; hint: string; icon: string; fill: string; ink: string };

const LEAN_COFFEE_STEPS: Step[] = [
  {
    n: '1',
    title: 'Propose',
    hint: 'Everyone adds topics to the board, one per note.',
    icon: 'edit',
    fill: '#e0f2fe',
    ink: '#0369a1',
  },
  {
    n: '2',
    title: 'Vote',
    hint: 'Upvote what you want to talk about. The board sorts itself.',
    icon: 'thumbs-up',
    fill: '#ede9fe',
    ink: '#6d28d9',
  },
  {
    n: '3',
    title: 'Discuss',
    hint: 'Spotlight the top topic and start the 8-minute timer.',
    icon: 'message',
    fill: '#fef3c7',
    ink: '#b45309',
  },
  {
    n: '4',
    title: 'Keep going?',
    hint: 'When it rings, poll the room: 4 more minutes, or Done, next.',
    icon: 'refresh-cw',
    fill: '#dcfce7',
    ink: '#15803d',
  },
];

export function buildLeanCoffee(cx: number, cy: number): Element[] {
  const stepsW = 320;
  const stepH = 124;
  const stepGap = 36;
  const loopRoom = 64; // right of the step cards, where the loop-back bows out
  const boardW = 420;
  const sideW = 330;
  const bodyH = SECTION_H + 12 + LEAN_COFFEE_STEPS.length * (stepH + stepGap) - stepGap;
  const totalW = stepsW + loopRoom + GAP + boardW + GAP + sideW;
  const x0 = cx - totalW / 2;
  const y0 = cy - (TITLE_H + SUBTITLE_H + HEAD_GAP + bodyH) / 2;
  const top = y0 + TITLE_H + SUBTITLE_H + HEAD_GAP;
  const boardX = x0 + stepsW + loopRoom + GAP;
  const sideX = boardX + boardW + GAP;

  const elements: Element[] = [
    ...heading(
      x0,
      y0,
      totalW,
      'Lean Coffee · Product crew, Thursday 9:30',
      650,
      'emoji-coffee',
      'No agenda: the room brings the topics, votes on them, and talks the favourites through in short timeboxes.',
    ),
    section(x0, top, stepsW, 'How it flows'),
  ];

  // The loop: four step cards, each a tinted card with a number disc, glyph,
  // name and one line of how.
  const stepIds: string[] = [];
  LEAN_COFFEE_STEPS.forEach((s, i) => {
    const y = top + SECTION_H + 12 + i * (stepH + stepGap);
    const card = {
      ...createShape('square', x0, y),
      width: stepsW,
      height: stepH,
      fillColor: s.fill,
      strokeColor: s.ink,
    };
    stepIds.push(card.id);
    const disc = 36;
    elements.push(
      card,
      {
        ...createShape('circle', x0 + 16, y + 16),
        width: disc,
        height: disc,
        label: s.n,
        textSize: 'md',
        textBold: true,
        padding: 'none',
        fillColor: s.ink,
        strokeColor: '#ffffff',
        textColor: '#ffffff',
        themeLockFill: true,
      },
      {
        ...createText(x0 + 16 + disc + 12, y + 16),
        width: stepsW - 32 - disc - 12 - 40,
        height: disc,
        label: s.title,
        textSize: 'md',
        textBold: true,
        textAlignX: 'left',
        textColor: s.ink,
      },
      {
        ...createShape('icon', x0 + stepsW - 16 - 32, y + 18),
        width: 32,
        height: 32,
        iconId: s.icon,
        strokeColor: s.ink,
      },
      {
        ...createText(x0 + 16, y + 16 + disc + 8),
        width: stepsW - 32,
        height: stepH - 16 - disc - 8 - 12,
        label: s.hint,
        textSize: 'sm',
        textAlignX: 'left',
        textAlignY: 'top',
      },
    );
  });
  for (let i = 0; i < stepIds.length - 1; i++) {
    elements.push(createPinnedArrow(stepIds[i]!, 's', stepIds[i + 1]!, 'n'));
  }
  // Back round the loop: Keep going? returns to Discuss with the next topic.
  elements.push({
    ...createPinnedArrow(stepIds[3]!, 'e', stepIds[2]!, 'e'),
    arrowStyle: 'curved',
    curveOffset: { dx: 90, dy: 0 },
    label: 'Next topic',
  });

  elements.push({
    ...createShape('qa-board', boardX, top),
    width: boardW,
    height: bodyH,
    label: 'Topics',
  });

  // The kit, top to bottom in the order it is pressed.
  const kit = (y: number, button: ReturnType<typeof createShape>, text: string): Element[] => [
    { ...button, x: sideX, y },
    note(sideX + BUTTON_W + 16, y, sideW - BUTTON_W - 16, BUTTON_H, text),
  ];
  const kitTop = top + SECTION_H + 12;
  const kitPitch = BUTTON_H + 20;
  elements.push(
    section(sideX, top, sideW, 'Facilitator kit'),
    ...kit(
      kitTop,
      {
        ...createShape('session-button', 0, 0),
        width: BUTTON_W,
        height: BUTTON_H,
        session: { tool: 'timer', minutes: 8 },
      },
      'Step 3: start the timebox as the top topic is spotlit.',
    ),
    ...kit(
      kitTop + kitPitch,
      {
        ...createShape('session-button', 0, 0),
        width: BUTTON_W,
        height: BUTTON_H,
        session: { tool: 'poll', question: 'Keep going on this topic?', style: 'yesNo' },
      },
      'Step 4: when it rings, ask the room.',
    ),
    ...kit(
      kitTop + kitPitch * 2,
      {
        ...createShape('session-button', 0, 0),
        width: BUTTON_W,
        height: BUTTON_H,
        session: { tool: 'timer', minutes: 4 },
      },
      'A yes buys 4 more minutes. A no: Done, next.',
    ),
  );
  const takeawaysY = kitTop + kitPitch * 3 + 12;
  elements.push(
    section(sideX, takeawaysY, sideW, 'Takeaways'),
    checklist(sideX, takeawaysY + SECTION_H + 8, sideW, [
      'One line per topic discussed',
      'Action · owner · by when',
    ]),
  );

  return elements;
}
