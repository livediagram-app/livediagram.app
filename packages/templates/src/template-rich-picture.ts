// Rich Picture (docs/specs/007-editor/templates-by-mode.md "Draw templates"): the systems-thinking
// sketch of a messy problem (Checkland's Soft Systems Methodology), here a hospital ward whose
// patients are medically fit by mid-morning but go home late in the afternoon. The system sits
// in a drawn cloud at the centre; the people caught up in it stand round it as stick figures,
// each saying what they see in a speech bubble; arrows carry what flows between them; crossed
// swords mark where interests clash and an eye marks who is watching. A legend in the corner
// teaches the symbols, so a group can carry on drawing in the same language. Pure:
// (cx, cy) -> Element[].

import type { Element } from '@livediagram/document';
import { crossedSwords, eye, stickFigure, type FigureOpts } from './template-sketch-figures';
import {
  FINE,
  arrowPaths,
  boxPath,
  bubblePath,
  cloudPath,
  drawn,
  letter,
  many,
  says,
  sticker,
  wavyPath,
  type Pt,
} from './template-sketch-kit';

const W = 1800;
const H = 1100;
// A stakeholder's height, head to feet.
const FIG = 110;

type Stakeholder = {
  name: string;
  // The figure's centre line and the top of its head, board-local.
  x: number;
  y: number;
  figure: FigureOpts;
  // What they say, and where the bubble sits.
  words: string;
  bubble: { x: number; y: number; w: number; h: number };
};

const STAKEHOLDERS: Stakeholder[] = [
  {
    name: 'Patient',
    x: 170,
    y: 270,
    figure: { mood: 'frown', pose: 'shrug' },
    words: 'They said I’d go home this morning…',
    bubble: { x: 230, y: 170, w: 280, h: 92 },
  },
  {
    name: 'Ward nurse',
    x: 760,
    y: 260,
    figure: { mood: 'flat', pose: 'hips', hair: 'cap' },
    words: 'The discharge letter still isn’t signed.',
    bubble: { x: 820, y: 160, w: 290, h: 92 },
  },
  {
    name: 'Consultant',
    x: 1380,
    y: 270,
    figure: { mood: 'smile', pose: 'point', facing: -1, hair: 'tie' },
    words: 'Ward round first, then I’ll sign them off.',
    bubble: { x: 1440, y: 170, w: 300, h: 92 },
  },
  {
    name: 'Family',
    x: 130,
    y: 780,
    figure: { mood: 'flat', pose: 'stand' },
    words: 'We can’t collect Mum until after work.',
    bubble: { x: 260, y: 700, w: 270, h: 92 },
  },
  {
    name: 'Pharmacist',
    x: 660,
    y: 780,
    figure: { mood: 'flat', pose: 'stand' },
    words: 'Take-home meds take three hours.',
    bubble: { x: 720, y: 700, w: 260, h: 92 },
  },
  {
    name: 'Bed manager',
    x: 1220,
    y: 780,
    figure: { mood: 'open', pose: 'wave' },
    words: 'A&E has 12 people waiting for a bed!',
    bubble: { x: 1280, y: 700, w: 220, h: 116 },
  },
];

export function buildRichPicture(cx: number, cy: number): Element[] {
  const x0 = cx - W / 2;
  const y0 = cy - H / 2;
  const P = (x: number, y: number): Pt => ({ x: x0 + x, y: y0 + y });
  const out: Element[] = [];

  out.push(
    letter(x0, y0, 1000, 64, 'Rich Picture: Why Do Discharges Run Late?', {
      textSize: 'lg',
      textScale: 1.35,
      textBold: true,
    }),
    drawn(wavyPath(x0 + 4, y0 + 70, 560, 14, 3), 1, { colour: 'red', width: FINE, amp: 0.5 }),
    letter(x0, y0 + 84, 1000, 34, 'Ward 7 on a Tuesday: medically fit by 10am, home after 4pm.', {
      colour: 'teal',
    }),
  );

  // The system, in a cloud at the centre.
  out.push(
    drawn(cloudPath(x0 + 900, y0 + 530, 270, 135, 11, 7), 2, { colour: 'blue', width: 3 }),
    letter(x0 + 790, y0 + 432, 220, 30, 'THE SYSTEM', {
      colour: 'red',
      textBold: true,
      textAlignX: 'center',
    }),
    letter(x0 + 680, y0 + 464, 440, 120, 'Getting a patient from “medically fit” to home', {
      textSize: 'lg',
      textScale: 1.1,
      textAlignX: 'center',
      colour: 'blue',
    }),
    sticker('emoji-hourglass', x0 + 1110, y0 + 420, 56, 12),
  );

  // The people caught up in it.
  STAKEHOLDERS.forEach((s, i) => {
    const seed = 100 + i * 20;
    out.push(...stickFigure(x0 + s.x, y0 + s.y, FIG, seed, s.figure));
    if (s.name === 'Family') {
      out.push(
        ...stickFigure(x0 + s.x + 70, y0 + s.y + 16, FIG - 16, seed + 9, {
          mood: 'flat',
          pose: 'hips',
          hair: 'ponytail',
        }),
      );
    }
    out.push(
      letter(x0 + s.x + (s.name === 'Family' ? 35 : 0) - 80, y0 + s.y + FIG + 6, 160, 32, s.name, {
        textAlignX: 'center',
        textBold: true,
      }),
      ...says(
        x0 + s.bubble.x,
        y0 + s.bubble.y,
        s.bubble.w,
        s.bubble.h,
        P(s.x + (s.name === 'Family' ? 100 : 26), s.y + 22),
        s.words,
        seed + 15,
      ),
    );
  });

  // What flows between them.
  const flow = (
    a: Pt,
    b: Pt,
    bend: number,
    label: string,
    lx: number,
    ly: number,
    seed: number,
  ) => [
    ...many(arrowPaths(a, b, bend, 16), seed, { colour: 'green' }),
    letter(x0 + lx, y0 + ly, 200, 30, label, { colour: 'green', textAlignX: 'center' }),
  ];
  out.push(
    ...flow(P(830, 300), P(860, 410), 0.15, 'Discharge letter', 880, 330, 300),
    ...flow(P(680, 760), P(740, 640), -0.12, 'Meds to take home', 540, 650, 302),
    ...flow(P(1240, 770), P(1110, 640), 0.12, 'Beds, please!', 1170, 600, 304),
  );

  // Where interests clash.
  out.push(
    ...crossedSwords(x0 + 1360, y0 + 520, 56, 400),
    letter(x0 + 1420, y0 + 500, 200, 60, 'Ward round vs. beds', { colour: 'red' }),
    ...crossedSwords(x0 + 320, y0 + 560, 56, 410),
    letter(x0 + 380, y0 + 540, 220, 60, 'Pick-up time vs. a free bed', { colour: 'red' }),
  );

  // Who is watching.
  out.push(
    ...eye(x0 + 1260, y0 + 60, 90, 500, { colour: 'violet' }),
    letter(x0 + 1320, y0 + 30, 460, 64, 'Hospital board: watching the 4-hour A&E target', {
      colour: 'violet',
    }),
  );

  // The legend: every symbol on the picture, once, with what it means.
  const lx = 1520;
  const ly = 760;
  out.push(
    drawn(boxPath(x0 + lx, y0 + ly, 270, 330, 600), 600),
    letter(x0 + lx + 16, y0 + ly + 8, 200, 40, 'Legend', { textSize: 'lg', textBold: true }),
  );
  const row = (i: number) => y0 + ly + 72 + i * 42;
  const ix = x0 + lx + 46;
  out.push(
    ...stickFigure(ix, row(0) - 18, 38, 610, { pose: 'stand' }).map((m) => ({
      ...m,
      penWidth: FINE,
    })),
    drawn(bubblePath(ix - 26, row(1) - 14, 52, 24, { x: ix - 14, y: row(1) + 18 }, 8), 620, {
      width: FINE,
      amp: 0.4,
    }),
    drawn(cloudPath(ix, row(2) + 2, 24, 12, 7, 630), 630, {
      colour: 'blue',
      width: FINE,
      amp: 0.3,
    }),
    ...crossedSwords(ix, row(3), 16, 640, { width: FINE }),
    ...eye(ix, row(4), 40, 650, { colour: 'violet', width: FINE }),
    ...many(arrowPaths(P(lx + 20, ly + 72 + 5 * 42), P(lx + 72, ly + 72 + 5 * 42), 0, 10), 660, {
      colour: 'green',
      width: FINE,
    }),
  );
  [
    'Stakeholder',
    'What they say',
    'The system',
    'A clash of interests',
    'Who is watching',
    'What flows',
  ].forEach((label, i) => out.push(letter(x0 + lx + 96, row(i) - 16, 170, 32, label)));

  return out;
}
