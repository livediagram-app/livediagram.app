// The party games of the Quizzes & Games category (docs/specs/012-collaboration/quiz-and-game-templates.md): Two
// Truths and a Lie, Would You Rather and Find Someone Who Bingo. Built from the session boards' parts
// (template-session-parts.ts), the quiz boards' siblings in template-builders-quiz-games.ts.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[].

import { createShape, createSticky, createText, type Element } from '@livediagram/document';
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
  kitRow,
  note,
  section,
  sessionButton,
} from './template-session-parts';
import { BINGO_PROMPTS, TWO_TRUTHS_PLAYERS, WOULD_YOU_RATHER } from './template-quiz-games-data';
import { YELLOW } from './template-workshop-stickies';

const PAD_W = 150;
const UNDER_SECTION = SECTION_H + 12;

// A reaction pad as tall as a session button, with the line that says when to press it beside it.
function padRow(
  x: number,
  y: number,
  width: number,
  reaction: 'confetti' | 'applause' | 'fireworks',
  label: string,
  text: string,
): Element[] {
  return [
    {
      ...createShape('reaction-pad', x, y),
      width: PAD_W,
      height: BUTTON_H,
      reaction,
      label,
    },
    note(x + PAD_W + 16, y, width - PAD_W - 16, BUTTON_H, text),
  ];
}

// Two Truths and a Lie: a row per player (who they are, their three numbered statements on stickies of their own
// colour, and the poll that asks the room which is the lie), the first row a worked example and the rest left for
// the next players to write. The host's kit sits on the right: a Picker for who goes next and a Confetti pad.
export function buildTwoTruthsAndALie(cx: number, cy: number): Element[] {
  const playerW = 180;
  const stickyW = 170;
  const rowH = 170;
  const rowGap = 32;
  const inner = 24;
  const rowW = playerW + inner + 3 * stickyW + 2 * 16 + inner + BUTTON_W;
  const sideW = 330;
  const totalW = rowW + GAP + sideW;
  const bodyH = UNDER_SECTION + TWO_TRUTHS_PLAYERS.length * (rowH + rowGap) - rowGap;
  const x0 = cx - totalW / 2;
  const y0 = cy - (TITLE_H + SUBTITLE_H + HEAD_GAP + bodyH) / 2;
  const top = y0 + TITLE_H + SUBTITLE_H + HEAD_GAP;
  const sideX = x0 + rowW + GAP;

  const elements: Element[] = [
    ...heading(
      x0,
      y0,
      totalW,
      'Two Truths and a Lie',
      440,
      'emoji-thinking-face',
      'Each player writes three things about themselves, one of them false. The room votes on the lie, then the player owns up.',
    ),
    section(x0, top, rowW, 'Players'),
  ];

  TWO_TRUTHS_PLAYERS.forEach((p, i) => {
    const y = top + UNDER_SECTION + i * (rowH + rowGap);
    const disc = 56;
    elements.push(
      {
        ...createShape('square', x0, y),
        width: playerW,
        height: rowH,
        fillColor: '#ffffff',
        strokeColor: '#cbd5e1',
      },
      {
        ...createShape('circle', x0 + (playerW - disc) / 2, y + 30),
        width: disc,
        height: disc,
        label: p.initials,
        textSize: 'md',
        textBold: true,
        padding: 'none',
        fillColor: p.colour,
        strokeColor: '#ffffff',
        textColor: '#ffffff',
        themeLockFill: true,
      },
      {
        ...createText(x0 + 12, y + 30 + disc + 12),
        width: playerW - 24,
        height: 28,
        label: p.name,
        textSize: 'md',
        textBold: true,
        textColor: '#0f172a',
      },
    );
    for (let s = 0; s < 3; s++) {
      const statement = p.statements?.[s] ?? 'A truth, or the lie';
      elements.push({
        ...createSticky(x0 + playerW + inner + s * (stickyW + 16), y),
        ...p.sticky,
        width: stickyW,
        height: rowH,
        label: `${s + 1}. ${statement}`,
        textSize: 'sm',
      });
    }
    elements.push({
      ...sessionButton({
        tool: 'poll',
        style: 'choice',
        question: `Which is ${p.name}’s lie?`,
        options: ['1', '2', '3'],
      }),
      x: x0 + rowW - BUTTON_W,
      y: y + (rowH - BUTTON_H) / 2,
    });
  });

  const kitTop = top + UNDER_SECTION;
  const pickerH = 132;
  const padY = kitTop + pickerH + 20;
  elements.push(
    section(sideX, top, sideW, 'Host kit'),
    {
      ...createShape('picker', sideX, kitTop),
      width: sideW,
      height: pickerH,
      label: 'Who goes next?',
    },
    ...padRow(sideX, padY, sideW, 'confetti', 'Got me!', 'For every lie that fooled the room.'),
    note(
      sideX,
      padY + BUTTON_H + 20,
      sideW,
      96,
      'The player reads their three out loud. Start their poll, give the room a minute, end it, then they say which one was the lie.',
    ),
  );

  return elements;
}

// Would You Rather: six dilemmas in two columns, each an A card and a B card with an "or" disc between them and
// the poll that puts it to the room beside them: "Would you rather?" with the two sides as its answers, short
// enough to read on the button. A one-minute timer and an Applause pad close the board.
const SIDE_A = { fillColor: '#e0f2fe', strokeColor: '#0369a1', textColor: '#082f49' };
const SIDE_B = { fillColor: '#fce7f3', strokeColor: '#be185d', textColor: '#500724' };

export function buildWouldYouRather(cx: number, cy: number): Element[] {
  const cardW = 220;
  const cardH = 100;
  const orD = 44;
  const rowGap = 28;
  const colGap = 60;
  const rowW = cardW + 12 + orD + 12 + cardW + 20 + BUTTON_W;
  const perCol = Math.ceil(WOULD_YOU_RATHER.length / 2);
  const gridH = perCol * (cardH + rowGap) - rowGap;
  const totalW = rowW * 2 + colGap;
  const bodyH = UNDER_SECTION + gridH + GAP + BUTTON_H;
  const x0 = cx - totalW / 2;
  const y0 = cy - (TITLE_H + SUBTITLE_H + HEAD_GAP + bodyH) / 2;
  const top = y0 + TITLE_H + SUBTITLE_H + HEAD_GAP;

  const elements: Element[] = [
    ...heading(
      x0,
      y0,
      totalW,
      'Would You Rather?',
      400,
      'emoji-dice',
      'Press a question, everyone picks a side, then the room makes its case.',
    ),
    section(x0, top, totalW, 'The dilemmas'),
  ];

  WOULD_YOU_RATHER.forEach((d, i) => {
    const col = Math.floor(i / perCol);
    const x = x0 + col * (rowW + colGap);
    const y = top + UNDER_SECTION + (i % perCol) * (cardH + rowGap);
    const card = (cx0: number, label: string, side: typeof SIDE_A): Element => ({
      ...createShape('square', cx0, y),
      ...side,
      width: cardW,
      height: cardH,
      label,
      textSize: 'md',
      textBold: true,
      borderRadius: 'lg',
      themeLockFill: true,
    });
    elements.push(
      card(x, d.a, SIDE_A),
      {
        ...createShape('circle', x + cardW + 12, y + (cardH - orD) / 2),
        width: orD,
        height: orD,
        label: 'or',
        textSize: 'sm',
        textBold: true,
        padding: 'none',
        fillColor: '#334155',
        strokeColor: '#ffffff',
        textColor: '#ffffff',
        themeLockFill: true,
      },
      card(x + cardW + 12 + orD + 12, d.b, SIDE_B),
      {
        ...sessionButton({
          tool: 'poll',
          style: 'choice',
          question: 'Would you rather?',
          options: [d.a, d.b],
        }),
        x: x + rowW - BUTTON_W,
        y: y + (cardH - BUTTON_H) / 2,
      },
    );
  });

  const kitY = top + UNDER_SECTION + gridH + GAP;
  const kitW = rowW;
  elements.push(
    ...kitRow(
      x0,
      kitY,
      kitW,
      sessionButton({ tool: 'timer', minutes: 1 }),
      'One minute for each side to make its case.',
    ),
    ...padRow(
      x0 + rowW + colGap,
      kitY,
      kitW,
      'applause',
      'Applause',
      'For the best argument of the round.',
    ),
  );

  return elements;
}

// Find Someone Who Bingo: a 4 x 4 card of prompts in two alternating tints; people put a sticky with a teammate's
// name on each square they fill. The kit on the right: a ten-minute timer, a Fireworks pad for "Bingo!", an
// example name sticky and the winners to tick off.
const BINGO_TINTS = [
  { fillColor: '#fef3c7', strokeColor: '#d97706', textColor: '#451a03' },
  { fillColor: '#e0f2fe', strokeColor: '#0284c7', textColor: '#082f49' },
];
const BINGO_SIZE = 4;

export function buildPeopleBingo(cx: number, cy: number): Element[] {
  const cell = 170;
  const cellGap = 10;
  const gridW = BINGO_SIZE * cell + (BINGO_SIZE - 1) * cellGap;
  const sideW = 330;
  const totalW = gridW + GAP + sideW;
  const bodyH = UNDER_SECTION + gridW;
  const x0 = cx - totalW / 2;
  const y0 = cy - (TITLE_H + SUBTITLE_H + HEAD_GAP + bodyH) / 2;
  const top = y0 + TITLE_H + SUBTITLE_H + HEAD_GAP;
  const sideX = x0 + gridW + GAP;

  const elements: Element[] = [
    ...heading(
      x0,
      y0,
      totalW,
      'Find Someone Who · Bingo',
      500,
      'emoji-handshake',
      'Find a teammate for each square and put a sticky with their name on it. A full row, column or diagonal wins.',
    ),
    section(x0, top, gridW, 'Find someone who…'),
  ];

  BINGO_PROMPTS.slice(0, BINGO_SIZE * BINGO_SIZE).forEach((prompt, i) => {
    const r = Math.floor(i / BINGO_SIZE);
    const c = i % BINGO_SIZE;
    elements.push({
      ...createShape(
        'square',
        x0 + c * (cell + cellGap),
        top + UNDER_SECTION + r * (cell + cellGap),
      ),
      ...BINGO_TINTS[(r + c) % 2]!,
      width: cell,
      height: cell,
      label: prompt,
      textSize: 'sm',
      textBold: true,
      borderRadius: 'lg',
      textAlignY: 'top',
      themeLockFill: true,
    });
  });

  const kitTop = top + UNDER_SECTION;
  const exampleY = kitTop + (BUTTON_H + 20) * 2;
  const exampleW = 130;
  const winnersY = exampleY + 90 + GAP;
  elements.push(
    section(sideX, top, sideW, 'Host kit'),
    ...kitRow(
      sideX,
      kitTop,
      sideW,
      sessionButton({ tool: 'timer', minutes: 10 }),
      'Ten minutes to fill the card. Go and talk to people.',
    ),
    ...padRow(
      sideX,
      kitTop + BUTTON_H + 20,
      sideW,
      'fireworks',
      'Bingo!',
      'Shout it, then press this. The room checks your line.',
    ),
    {
      ...createSticky(sideX, exampleY),
      ...YELLOW,
      width: exampleW,
      height: 90,
      label: 'Priya',
      textSize: 'md',
      textBold: true,
    },
    note(
      sideX + exampleW + 16,
      exampleY,
      sideW - exampleW - 16,
      90,
      'One name per square. Nobody fills two squares on your card.',
    ),
    section(sideX, winnersY, sideW, 'Winners'),
    checklist(sideX, winnersY + SECTION_H + 8, sideW, ['First full line', 'First full card']),
  );

  return elements;
}
