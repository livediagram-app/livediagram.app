// The party game of the Games category (docs/specs/012-collaboration/game-templates.md): Find
// Someone Who Bingo. Built from the session boards' parts
// (template-session-parts.ts), Icebreaker Questions' siblings in template-builders-icebreakers.ts.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[].

import { createShape, createSticky, type Element } from '@livepages/document';
import {
  BUTTON_H,
  GAP,
  HEAD_GAP,
  PAD_W,
  SECTION_H,
  SUBTITLE_H,
  TITLE_H,
  UNDER_SECTION,
  checklist,
  heading,
  kitRow,
  note,
  section,
  sessionButton,
} from './template-session-parts';
import { BINGO_PROMPTS } from './template-games-data';
import { YELLOW } from './template-workshop-stickies';

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
