// Doodle Warm-Up (docs/specs/007-editor/templates-by-mode.md "Draw templates"): a meeting
// icebreaker, "Draw Your Teammate in 60 Seconds". The rules sit on a sticky note beside a drawn
// stopwatch; six hand-drawn frames each carry a teammate's name, two already holding a quick
// portrait (signed with who drew it and how fast) so the game reads at a glance; a "Best
// Likeness" box holds a stash of sticker stars to vote with, and the first votes are already in.
// Pure: (cx, cy) -> Element[].

import type { Element, PenColourName } from '@livediagram/document';
import { stopwatch } from './template-sketch-figures';
import { portrait, type PortraitOpts } from './template-sketch-portrait';
import { FINE, boxPath, drawn, letter, note, sticker, wavyPath } from './template-sketch-kit';

const FRAME_W = 280;
const FRAME_H = 290;
const GAP = 30;
const NAME_H = 54;
const TOP = 150;
const FRAMES_X = 340;
const VOTE_X = FRAMES_X + 3 * FRAME_W + 2 * GAP + 40;
const W = VOTE_X + 250;
const H = TOP + 2 * (FRAME_H + NAME_H) + GAP;

type Frame = {
  name: string;
  colour: PenColourName;
  // A portrait already drawn in it, who drew it and how long it took.
  drawn?: { opts: PortraitOpts; by: string };
};

const FRAMES: Frame[] = [
  {
    name: 'Alex',
    colour: 'blue',
    drawn: { opts: { hair: 'curls', glasses: true }, by: 'by Jordan, 58s' },
  },
  { name: 'Priya', colour: 'pink' },
  { name: 'Sam', colour: 'green' },
  { name: 'Mei', colour: 'violet', drawn: { opts: { hair: 'bun' }, by: 'by Tom, 60s on the dot' } },
  { name: 'Jordan', colour: 'orange' },
  { name: 'Tom', colour: 'teal' },
];

const RULES = [
  'Rules',
  '1. Draw the teammate named on your frame',
  '2. 60 seconds, then pens down',
  '3. No erasing, no peeking',
  '4. Star the best likeness',
].join('\n');

export function buildDoodleWarmup(cx: number, cy: number): Element[] {
  const x0 = cx - W / 2;
  const y0 = cy - H / 2;
  const out: Element[] = [];

  out.push(
    letter(x0, y0, 1000, 64, 'Draw Your Teammate in 60 Seconds', {
      textSize: 'lg',
      textScale: 1.45,
      textBold: true,
    }),
    drawn(wavyPath(x0 + 4, y0 + 72, 600, 16, 3), 1, { colour: 'orange', width: FINE, amp: 0.5 }),
    letter(x0, y0 + 86, 1000, 34, 'A warm-up for the first five minutes. No artists required.', {
      colour: 'teal',
    }),
  );

  // The rules and the timer.
  out.push(
    note(x0, y0 + TOP, 290, 270, RULES, 'yellow', {
      textSize: 'lg',
      textAlignX: 'left',
      textAlignY: 'top',
      rotation: -2,
    }),
    ...stopwatch(x0 + 90, y0 + TOP + 420, 62, 20),
    letter(x0 + 170, y0 + TOP + 372, 140, 60, '60s', {
      textSize: 'lg',
      textScale: 1.5,
      textBold: true,
      colour: 'red',
    }),
    letter(x0 + 170, y0 + TOP + 432, 150, 70, 'Start together, stop together', {
      textAlignY: 'top',
    }),
    sticker('emoji-pencil', x0 + 30, y0 + TOP + 520, 64, -12),
    sticker('emoji-art-palette', x0 + 120, y0 + TOP + 540, 56, 8),
  );

  // Six frames, each named for a teammate.
  FRAMES.forEach((frame, i) => {
    const fx = x0 + FRAMES_X + (i % 3) * (FRAME_W + GAP);
    const fy = y0 + TOP + Math.floor(i / 3) * (FRAME_H + NAME_H + GAP);
    const seed = 100 + i * 40;
    out.push(drawn(boxPath(fx, fy, FRAME_W, FRAME_H, seed), seed, { width: 3 }));
    if (frame.drawn) {
      out.push(
        ...portrait(fx + FRAME_W / 2, fy + 130, 82, seed + 5, frame.drawn.opts, {
          colour: frame.colour,
        }),
        letter(fx + 10, fy + FRAME_H - 42, FRAME_W - 20, 30, frame.drawn.by, {
          textSize: 'sm',
          textAlignX: 'right',
          colour: frame.colour,
        }),
      );
    }
    out.push(
      letter(fx, fy + FRAME_H + 6, FRAME_W, 40, frame.name, {
        textSize: 'lg',
        textBold: true,
        textAlignX: 'center',
        colour: frame.colour,
      }),
      drawn(wavyPath(fx + FRAME_W / 2 - 50, fy + FRAME_H + 46, 100, 4, 2.5), seed + 30, {
        colour: frame.colour,
        width: FINE,
        amp: 0.4,
      }),
    );
  });

  // The first votes are in: two stars for Alex's portrait.
  const ax = x0 + FRAMES_X;
  const ay = y0 + TOP + FRAME_H;
  out.push(
    sticker('emoji-star', ax + 10, ay + 4, 40, -10),
    sticker('emoji-star', ax + 50, ay + 8, 40, 12),
  );

  // The vote: a box of stars to drag under a favourite.
  const vx = x0 + VOTE_X;
  const vy = y0 + TOP;
  out.push(
    drawn(boxPath(vx, vy, 240, 2 * (FRAME_H + NAME_H) + GAP, 400), 400, {
      colour: 'orange',
      width: 3,
    }),
    letter(vx + 16, vy + 14, 210, 44, 'Best Likeness', {
      textSize: 'lg',
      textBold: true,
      colour: 'orange',
    }),
    letter(vx + 16, vy + 62, 210, 64, 'Drag a star under your favourite', { textAlignY: 'top' }),
  );
  for (let k = 0; k < 9; k++) {
    out.push(
      sticker(
        'emoji-star',
        vx + 24 + (k % 3) * 66,
        vy + 150 + Math.floor(k / 3) * 70,
        54,
        ((k * 37) % 30) - 15,
      ),
    );
  }
  out.push(
    sticker('emoji-trophy', vx + 80, vy + 380, 80, 0),
    letter(vx + 16, vy + 470, 210, 90, 'Winner picks next week’s warm-up', {
      textAlignX: 'center',
      textAlignY: 'top',
    }),
  );

  return out;
}
