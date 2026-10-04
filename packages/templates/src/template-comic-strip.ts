// Comic Strip (docs/specs/007-editor/templates-by-mode.md "Draw templates"): a six-panel product
// story, "Maya Finds the Bug", drawn the way a team sketches a user story on a whiteboard. Each
// panel is a hand-drawn frame with a caption on a yellow note in its corner (when and what), stick
// figures that act it out, speech or thought bubbles for what they say, and a sticker for the
// moment it shows. The story has a shape: a strange Monday, the customer's complaint, the hunt,
// the bug, the fix and a calm Friday. Pure: (cx, cy) -> Element[].

import type { Element } from '@livediagram/document';
import { bug, laptop, stickFigure } from './template-sketch-figures';
import {
  FINE,
  bannerPaths,
  bowLine,
  boxPath,
  cloudPath,
  drawn,
  ellipsePath,
  letter,
  many,
  note,
  says,
  sticker,
  type Pt,
} from './template-sketch-kit';

const PANEL_W = 440;
const PANEL_H = 320;
const GAP = 34;
const TOP = 160;
const W = 3 * PANEL_W + 2 * GAP;
const H = TOP + 2 * PANEL_H + GAP;
// The cast's height in a panel, head to feet.
const FIG = 140;

// One panel's caption and art, drawn from its top-left (px, py).
type Panel = { caption: string; draw: (px: number, py: number, seed: number) => Element[] };

const at =
  (px: number, py: number) =>
  (x: number, y: number): Pt => ({ x: px + x, y: py + y });

const PANELS: Panel[] = [
  {
    caption: 'Monday, 9:02am',
    draw: (px, py, seed) => {
      const P = at(px, py);
      return [
        ...stickFigure(px + 140, py + 150, FIG, seed, {
          hair: 'ponytail',
          mood: 'flat',
          pose: 'stand',
        }),
        ...laptop(px + 230, py + 180, 130, seed + 10),
        ...many(
          [
            [P(244, 198), P(330, 198)],
            [P(244, 216), P(300, 216)],
            [P(244, 234), P(340, 234)],
          ],
          seed + 15,
          { width: FINE, amp: 0.4 },
        ),
        ...says(px + 210, py + 64, 210, 76, P(165, 160), 'Checkout looks… weird?', seed + 20),
        sticker('emoji-coffee', px + 372, py + 250, 52, 8),
      ];
    },
  },
  {
    caption: 'A customer writes in',
    draw: (px, py, seed) => {
      const P = at(px, py);
      return [
        ...laptop(px + 50, py + 100, 210, seed),
        letter(px + 64, py + 120, 182, 40, 'Order #4412', { textBold: true, textAlignX: 'center' }),
        letter(px + 64, py + 160, 182, 40, 'Charged: 2 ×', { colour: 'red', textAlignX: 'center' }),
        ...says(px + 270, py + 70, 160, 104, P(250, 200), 'You charged me twice!!', seed + 10, {
          colour: 'red',
        }),
        sticker('emoji-angry', px + 330, py + 220, 64, -8),
      ];
    },
  },
  {
    caption: 'She digs into the logs',
    draw: (px, py, seed) => {
      const P = at(px, py);
      return [
        ...stickFigure(px + 100, py + 150, FIG, seed, {
          hair: 'ponytail',
          mood: 'flat',
          pose: 'point',
          facing: 1,
        }),
        ...laptop(px + 210, py + 170, 160, seed + 10),
        ...many(
          [
            [P(224, 192), P(330, 192)],
            [P(224, 212), P(300, 212)],
            [P(224, 232), P(350, 232)],
            [P(224, 252), P(290, 252)],
          ],
          seed + 20,
          { width: FINE, amp: 0.4 },
        ),
        drawn(cloudPath(px + 210, py + 98, 110, 38, 9, seed), seed + 30, { width: 2, amp: 0.6 }),
        ...many(
          [
            ellipsePath(px + 130, py + 142, 7, 6, seed, 1.1),
            ellipsePath(px + 118, py + 156, 4, 4, seed + 1, 1.1),
          ],
          seed + 31,
          { width: FINE, amp: 0.2 },
        ),
        letter(px + 120, py + 76, 180, 44, 'Two clicks… two orders?', { textAlignX: 'center' }),
        sticker('emoji-magnifier', px + 362, py + 76, 54, 10),
      ];
    },
  },
  {
    caption: 'Found it!',
    draw: (px, py, seed) => {
      const P = at(px, py);
      const rays = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
        const a = (k * Math.PI) / 4 + 0.2;
        return [
          P(320 + 62 * Math.cos(a), 205 + 62 * Math.sin(a)),
          P(320 + 84 * Math.cos(a), 205 + 84 * Math.sin(a)),
        ];
      });
      return [
        ...stickFigure(px + 120, py + 150, FIG, seed, {
          hair: 'ponytail',
          mood: 'open',
          pose: 'cheer',
        }),
        ...bug(px + 320, py + 205, 34, seed + 10, { colour: 'red' }),
        ...many(rays, seed + 30, { colour: 'orange', amp: 0.4 }),
        ...says(
          px + 190,
          py + 60,
          236,
          70,
          P(150, 150),
          'The Pay button never disables!',
          seed + 40,
        ),
        sticker('emoji-bug', px + 22, py + 248, 54, -10),
      ];
    },
  },
  {
    caption: 'Sam reviews the fix',
    draw: (px, py, seed) => {
      const P = at(px, py);
      return [
        ...stickFigure(px + 120, py + 150, FIG, seed, {
          hair: 'ponytail',
          mood: 'smile',
          pose: 'point',
          facing: 1,
        }),
        ...stickFigure(px + 330, py + 150, FIG, seed + 10, { mood: 'smile', pose: 'hips' }),
        ...says(px + 20, py + 62, 190, 72, P(118, 150), 'One line, plus a test.', seed + 20),
        ...says(px + 236, py + 62, 190, 72, P(320, 150), 'Ship it behind a flag?', seed + 30),
        sticker('emoji-wrench', px + 196, py + 238, 52, 12),
      ];
    },
  },
  {
    caption: 'Friday, 4pm',
    draw: (px, py, seed) => {
      const P = at(px, py);
      return [
        ...stickFigure(px + 150, py + 150, FIG, seed, {
          hair: 'ponytail',
          mood: 'smile',
          pose: 'cheer',
        }),
        ...stickFigure(px + 300, py + 150, FIG, seed + 10, { mood: 'smile', pose: 'cheer' }),
        ...says(
          px + 210,
          py + 58,
          220,
          72,
          P(250, 150),
          'Zero double orders this week!',
          seed + 20,
          {
            colour: 'green',
          },
        ),
        sticker('emoji-party-popper', px + 24, py + 236, 60, -10),
        sticker('emoji-trophy', px + 368, py + 244, 54, 8),
      ];
    },
  },
];

export function buildComicStrip(cx: number, cy: number): Element[] {
  const x0 = cx - W / 2;
  const y0 = cy - H / 2;
  const out: Element[] = [];

  // The title on a banner, and the subtitle.
  const [body, left, right] = bannerPaths(x0 + W / 2 - 260, y0, 520, 80);
  out.push(drawn(left!, 1), drawn(right!, 2), drawn(body!, 3, { width: 3 }));
  out.push(
    letter(x0 + W / 2 - 250, y0 + 6, 500, 68, 'Maya Finds the Bug', {
      textSize: 'lg',
      textScale: 1.45,
      textBold: true,
      textAlignX: 'center',
    }),
    letter(
      x0 + W / 2 - 300,
      y0 + 104,
      600,
      34,
      'A product story in six panels: draw the next one',
      {
        textAlignX: 'center',
        colour: 'teal',
      },
    ),
  );

  PANELS.forEach((panel, i) => {
    const px = x0 + (i % 3) * (PANEL_W + GAP);
    const py = y0 + TOP + Math.floor(i / 3) * (PANEL_H + GAP);
    const seed = 100 + i * 50;
    out.push(drawn(boxPath(px, py, PANEL_W, PANEL_H, seed), seed, { width: 3 }));
    out.push(...panel.draw(px, py, seed + 1));
    // A floor line under the cast, where the panel has one.
    if (i !== 1) {
      out.push(
        drawn(
          bowLine({ x: px + 18, y: py + 292 }, { x: px + PANEL_W - 18, y: py + 292 }, 1.5),
          seed + 45,
          {
            width: FINE,
            amp: 0.8,
          },
        ),
      );
    }
    out.push(
      note(px + 10, py + 10, 210, 44, panel.caption, 'yellow', { textSize: 'lg', rotation: -1.5 }),
      letter(px + PANEL_W - 40, py + 8, 30, 30, `${i + 1}`, {
        textBold: true,
        textAlignX: 'center',
      }),
    );
  });

  return out;
}
