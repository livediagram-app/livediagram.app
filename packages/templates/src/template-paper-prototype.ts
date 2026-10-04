// Paper Prototype (docs/specs/007-editor/templates-by-mode.md "Draw templates"): an app sketched
// before anyone builds it, the way a designer draws one on paper to put in front of users.
// Sprout, a made-up plant-watering app, in three hand-drawn phone screens: the plant list, one
// plant's detail and the reminder it sets. The UI is lo-fi marker work (boxes, scribbled copy,
// crossed image placeholders); red tap marks show where the user presses and arrows carry the
// tap on to the next screen. Sticky notes beside them hold what to test and the open questions.
// Pure: (cx, cy) -> Element[].

import type { Element } from '@livediagram/document';
import { drop, imageBox, phone, tapMark, tickBox } from './template-sketch-props';
import {
  FINE,
  arrowPaths,
  boxPath,
  bubblePath,
  drawn,
  ellipsePath,
  letter,
  many,
  note,
  sticker,
  tickPath,
  wavyPath,
  type Pt,
} from './template-sketch-kit';

const PHONE_W = 270;
const PHONE_H = 520;
const PHONE_GAP = 150;
const TOP = 150;
const NOTES_X = 3 * PHONE_W + 2 * PHONE_GAP + 70;
const W = NOTES_X + 250;
const H = TOP + PHONE_H + 90;

const PLANTS = [
  { name: 'Monstera', due: 'Water today' },
  { name: 'Fern', due: 'In 2 days' },
  { name: 'Cactus', due: 'In 12 days' },
];

export function buildPaperPrototype(cx: number, cy: number): Element[] {
  const x0 = cx - W / 2;
  const y0 = cy - H / 2;
  const P = (x: number, y: number): Pt => ({ x: x0 + x, y: y0 + y });
  const out: Element[] = [];
  const phoneX = (i: number) => x0 + i * (PHONE_W + PHONE_GAP);
  const py = y0 + TOP;

  out.push(
    letter(x0, y0, 1100, 64, 'Paper Prototype: Sprout, the Plant-Watering App', {
      textSize: 'lg',
      textScale: 1.4,
      textBold: true,
    }),
    drawn(wavyPath(x0 + 4, y0 + 70, 640, 16, 3), 1, { colour: 'green', width: FINE, amp: 0.5 }),
    letter(
      x0,
      y0 + 84,
      1100,
      34,
      'Three screens, drawn in ten minutes. Test them before anyone writes code.',
      {
        colour: 'teal',
      },
    ),
  );

  // Screen 1: My Plants, the list.
  {
    const x = phoneX(0);
    out.push(...phone(x, py, PHONE_W, PHONE_H, 10));
    out.push(
      letter(x + 24, py + 44, 200, 44, 'My Plants', { textSize: 'lg', textBold: true }),
      drawn(boxPath(x + 24, py + 100, PHONE_W - 48, 36, 11), 11, { width: FINE, amp: 0.6 }),
      drawn(ellipsePath(x + 44, py + 117, 8, 8, 12), 12, { width: FINE, amp: 0.3 }),
      drawn([P(50, TOP + 123), P(56, TOP + 130)], 13, { width: FINE, amp: 0.2 }),
      drawn(wavyPath(x + 64, py + 118, 90, 4, 2), 14, { width: FINE, amp: 0.3 }),
    );
    PLANTS.forEach((plant, i) => {
      const ry = py + 160 + i * 96;
      out.push(
        ...imageBox(x + 24, ry, 64, 64, 20 + i * 10),
        letter(x + 100, ry + 2, 120, 32, plant.name, { textBold: true }),
        letter(x + 100, ry + 32, 120, 28, plant.due, {
          textSize: 'sm',
          colour: i === 0 ? 'red' : undefined,
        }),
        drop(x + PHONE_W - 44, ry + 32, 14, 25 + i * 10, i === 0 ? {} : { width: FINE }),
        drawn(
          [
            { x: x + 24, y: ry + 82 },
            { x: x + PHONE_W - 24, y: ry + 82 },
          ],
          27 + i * 10,
          { width: FINE, amp: 0.6 },
        ),
      );
    });
    out.push(
      drawn(ellipsePath(x + PHONE_W - 56, py + PHONE_H - 56, 22, 22, 50), 50, { width: 3 }),
      letter(x + PHONE_W - 80, py + PHONE_H - 80, 48, 48, '+', {
        textSize: 'lg',
        textBold: true,
        textAlignX: 'center',
      }),
      ...tapMark(x + 205, py + 224, 60),
    );
  }

  // Screen 2: one plant's detail.
  {
    const x = phoneX(1);
    out.push(...phone(x, py, PHONE_W, PHONE_H, 100));
    out.push(
      drawn(
        [
          { x: x + 40, y: py + 52 },
          { x: x + 28, y: py + 64 },
          { x: x + 40, y: py + 76 },
        ],
        101,
        { amp: 0.3 },
      ),
      ...imageBox(x + 24, py + 92, PHONE_W - 48, 150, 102),
      letter(x + 24, py + 252, 220, 44, 'Monstera', { textSize: 'lg', textBold: true }),
      letter(x + 24, py + 296, 220, 30, 'Water every 7 days'),
      drawn(boxPath(x + 24, py + 336, PHONE_W - 48, 22, 103), 103, { width: FINE, amp: 0.5 }),
      ...many(
        Array.from({ length: 8 }, (_, k) => [
          { x: x + 32 + k * 17, y: py + 354 },
          { x: x + 44 + k * 17, y: py + 340 },
        ]),
        104,
        { colour: 'blue', width: FINE, amp: 0.2 },
      ),
      letter(x + 24, py + 362, 220, 28, 'Last watered 6 days ago', { textSize: 'sm' }),
      drawn(bubblePath(x + 40, py + 410, PHONE_W - 80, 52, undefined, 16), 105, { width: 3 }),
      letter(x + 40, py + 414, PHONE_W - 80, 44, 'Remind me', {
        textBold: true,
        textAlignX: 'center',
      }),
      ...tapMark(x + 212, py + 452, 110),
    );
  }

  // Screen 3: the reminder is set.
  {
    const x = phoneX(2);
    out.push(...phone(x, py, PHONE_W, PHONE_H, 200));
    out.push(
      drawn(ellipsePath(x + PHONE_W / 2, py + 150, 54, 54, 201), 201, {
        colour: 'green',
        width: 3,
      }),
      drawn(tickPath(x + PHONE_W / 2 - 26, py + 140, 52), 202, {
        colour: 'green',
        width: 4,
        amp: 0.4,
      }),
      letter(x + 24, py + 220, PHONE_W - 48, 44, 'Reminder set!', {
        textSize: 'lg',
        textBold: true,
        textAlignX: 'center',
      }),
      letter(x + 24, py + 266, PHONE_W - 48, 30, 'Saturday, 9am', { textAlignX: 'center' }),
      drawn(bubblePath(x + PHONE_W - 104, py + 326, 70, 32, undefined, 16), 203, { width: FINE }),
      drawn(ellipsePath(x + PHONE_W - 52, py + 342, 11, 11, 204, 2.4), 204, {
        colour: 'green',
        width: 3,
        amp: 0.2,
      }),
      letter(x + 24, py + 326, 140, 32, 'Repeat weekly'),
      ...tickBox(x + 26, py + 380, 22, false, 205),
      letter(x + 58, py + 376, 180, 30, 'Tell my flatmate'),
      drawn(bubblePath(x + 40, py + 430, PHONE_W - 80, 52, undefined, 16), 206, { width: 3 }),
      letter(x + 40, py + 434, PHONE_W - 80, 44, 'Done', { textBold: true, textAlignX: 'center' }),
      sticker('emoji-bell', x + PHONE_W - 70, py + 50, 52, 12),
    );
  }

  // The taps carried on to the next screen.
  out.push(
    ...many(arrowPaths(P(226, TOP + 214), P(PHONE_W + PHONE_GAP - 14, TOP + 130), -0.25, 18), 300, {
      colour: 'red',
      width: 3,
    }),
    letter(x0 + PHONE_W + 10, y0 + TOP + 40, 130, 30, 'tap a plant', {
      colour: 'red',
      textAlignX: 'center',
    }),
    ...many(
      arrowPaths(
        P(PHONE_W + PHONE_GAP + 236, TOP + 446),
        P(2 * PHONE_W + 2 * PHONE_GAP - 14, TOP + 360),
        -0.2,
        18,
      ),
      310,
      { colour: 'red', width: 3 },
    ),
    letter(x0 + 2 * PHONE_W + PHONE_GAP + 10, y0 + TOP + 470, 130, 30, 'tap Remind me', {
      colour: 'red',
      textAlignX: 'center',
    }),
  );

  // Screen names under each phone.
  ['1. My Plants', '2. Plant Detail', '3. Reminder Set'].forEach((name, i) =>
    out.push(
      letter(phoneX(i), py + PHONE_H + 14, PHONE_W, 40, name, {
        textSize: 'lg',
        textAlignX: 'center',
        colour: 'green',
      }),
    ),
  );

  // What to test, and the open questions.
  const nx = x0 + NOTES_X;
  out.push(
    note(nx, py, 240, 140, 'Test this with 5 users this week', 'yellow', {
      textSize: 'lg',
      rotation: -2,
    }),
    note(nx, py + 160, 240, 140, 'Q: do people know what the drop means?', 'pink', {
      textSize: 'lg',
      rotation: 1.5,
    }),
    note(nx, py + 320, 240, 140, 'Q: “Remind me” or “Water later”?', 'pink', {
      textSize: 'lg',
      rotation: -1,
    }),
    note(nx, py + 480, 240, 120, 'Watch where they tap first on screen 1', 'blue', {
      textSize: 'lg',
      rotation: 2,
    }),
  );

  return out;
}
