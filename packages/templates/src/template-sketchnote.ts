// Sketchnote (docs/specs/007-editor/templates-by-mode.md "Draw templates"): visual notes taken
// during a talk, "How We Ship on Fridays", the way a sketchnoter fills a page live. A ribbon
// banner carries the title over the speaker and date; the big idea sits in a blue cloud at the
// centre; three framed areas (Key Points, Quotes, Questions) hang off it on drawn arrows; a
// lightbulb marks the aha moment, a tiny chart sketches the talk's one number, and a takeaway
// banner closes the page. Every line is a marker stroke from the sketch kit, every word hand
// lettering, so the person draws straight over it. Pure: (cx, cy) -> Element[].

import type { Element } from '@livediagram/document';
import { lightbulb } from './template-sketch-figures';
import {
  BOLD,
  FINE,
  arrowPaths,
  bannerPaths,
  boxPath,
  cloudPath,
  drawn,
  ellipsePath,
  letter,
  many,
  sticker,
  tickPath,
  wavyPath,
  type Pt,
} from './template-sketch-kit';

const W = 1400;
const H = 960;

const KEY_POINTS = [
  'Deploy every day, so Friday is nothing special',
  'Feature flags: deploying is not releasing',
  'One-click rollback, rehearsed every month',
  'Small PRs, under 200 lines each',
];

const QUOTES = ['“If it scares you, ship it smaller.”', '“Rollback is a feature, not a failure.”'];

const QUESTIONS = [
  'How do we flag a database migration?',
  'Who is on call when it breaks at 5pm?',
  'Does this work for app store releases?',
];

export function buildSketchnote(cx: number, cy: number): Element[] {
  const x0 = cx - W / 2;
  const y0 = cy - H / 2;
  const P = (x: number, y: number): Pt => ({ x: x0 + x, y: y0 + y });
  const out: Element[] = [];

  // The banner title, the speaker and the date.
  const [body, left, right] = bannerPaths(x0 + 400, y0 + 6, 600, 86);
  out.push(drawn(left!, 11), drawn(right!, 12), drawn(body!, 10, { width: 3 }));
  out.push(
    letter(x0 + 410, y0 + 14, 580, 70, 'How We Ship on Fridays', {
      textSize: 'lg',
      textScale: 1.45,
      textBold: true,
      textAlignX: 'center',
    }),
    letter(x0 + 380, y0 + 112, 640, 34, 'Priya Nair  ·  DevOps Days London  ·  3 Oct 2026', {
      textAlignX: 'center',
      colour: 'teal',
    }),
    sticker('emoji-microphone', x0 + 1040, y0 + 18, 64, 12),
  );

  // The big idea in a cloud at the centre.
  out.push(drawn(cloudPath(x0 + 700, y0 + 420, 215, 120, 10, 4), 20, { colour: 'blue', width: 3 }));
  out.push(
    letter(x0 + 610, y0 + 318, 180, 30, 'THE BIG IDEA', {
      colour: 'red',
      textBold: true,
      textAlignX: 'center',
    }),
    letter(x0 + 520, y0 + 350, 360, 130, 'Small, boring releases make Friday just another day', {
      textSize: 'lg',
      textScale: 1.1,
      textAlignX: 'center',
      colour: 'blue',
    }),
    sticker('emoji-rocket', x0 + 860, y0 + 268, 66, -10),
  );

  // Key Points, left.
  out.push(drawn(boxPath(x0 + 30, y0 + 190, 380, 400, 31), 31));
  out.push(
    letter(x0 + 52, y0 + 202, 300, 44, 'Key Points', {
      textSize: 'lg',
      colour: 'green',
      textBold: true,
    }),
    drawn(wavyPath(x0 + 54, y0 + 250, 150, 6, 3), 32, { colour: 'green', width: FINE, amp: 0.4 }),
  );
  KEY_POINTS.forEach((text, i) => {
    const y = y0 + 280 + i * 76;
    out.push(
      drawn(tickPath(x0 + 52, y + 8, 20), 33 + i, { colour: 'green', amp: 0.4 }),
      letter(x0 + 86, y, 310, 64, text, { textAlignY: 'top' }),
    );
  });

  // Quotes, top right.
  out.push(drawn(boxPath(x0 + 990, y0 + 190, 380, 290, 41), 41));
  out.push(
    letter(x0 + 1012, y0 + 202, 300, 44, 'Quotes', {
      textSize: 'lg',
      colour: 'violet',
      textBold: true,
    }),
    drawn(wavyPath(x0 + 1014, y0 + 250, 110, 5, 3), 42, {
      colour: 'violet',
      width: FINE,
      amp: 0.4,
    }),
  );
  QUOTES.forEach((text, i) => {
    out.push(
      letter(x0 + 1016, y0 + 276 + i * 96, 340, 80, text, {
        textSize: 'lg',
        textItalic: true,
        textAlignY: 'top',
        colour: 'violet',
      }),
    );
  });

  // Questions, bottom right.
  out.push(drawn(boxPath(x0 + 990, y0 + 520, 380, 270, 51), 51));
  out.push(
    letter(x0 + 1012, y0 + 532, 300, 44, 'Questions', {
      textSize: 'lg',
      colour: 'orange',
      textBold: true,
    }),
    drawn(wavyPath(x0 + 1014, y0 + 580, 140, 6, 3), 52, {
      colour: 'orange',
      width: FINE,
      amp: 0.4,
    }),
  );
  QUESTIONS.forEach((text, i) => {
    const y = y0 + 604 + i * 60;
    out.push(
      letter(x0 + 1012, y - 6, 30, 50, '?', { textSize: 'lg', textBold: true, colour: 'orange' }),
      letter(x0 + 1046, y, 310, 56, text, { textAlignY: 'top' }),
    );
  });

  // Arrows from the cloud out to each area.
  out.push(
    ...many(arrowPaths(P(482, 430), P(420, 405), 0.1, 16), 61, { colour: 'blue' }),
    ...many(arrowPaths(P(905, 360), P(978, 320), -0.15, 18), 63, { colour: 'blue' }),
    ...many(arrowPaths(P(890, 500), P(976, 600), 0.18, 18), 65, { colour: 'blue' }),
  );

  // The aha: a lightbulb under the key points.
  out.push(...lightbulb(x0 + 110, y0 + 680, 40, 70, { colour: 'orange' }));
  out.push(
    letter(x0 + 180, y0 + 640, 230, 30, 'Aha!', {
      textSize: 'lg',
      textBold: true,
      colour: 'orange',
    }),
    letter(x0 + 180, y0 + 676, 240, 90, 'Deploy is a non-event. Release is a business call.', {
      textAlignY: 'top',
    }),
  );

  // The talk's one number, sketched as a chart: deploys up, incidents flat.
  const ox = 560;
  const oy = 780;
  out.push(
    drawn([P(ox, oy - 170), P(ox, oy), P(ox + 290, oy)], 80, { width: BOLD }),
    drawn(
      [
        P(ox + 10, oy - 30),
        P(ox + 70, oy - 50),
        P(ox + 130, oy - 70),
        P(ox + 190, oy - 115),
        P(ox + 270, oy - 150),
      ],
      81,
      { colour: 'green', width: 3 },
    ),
    drawn(
      [P(ox + 10, oy - 22), P(ox + 90, oy - 24), P(ox + 170, oy - 18), P(ox + 270, oy - 20)],
      82,
      { colour: 'red', width: 3 },
    ),
    drawn(ellipsePath(x0 + ox + 270, y0 + oy - 150, 6, 6, 83, 2), 83, {
      colour: 'green',
      amp: 0.2,
    }),
    letter(x0 + ox + 10, y0 + oy - 200, 200, 30, 'Deploys per week', { colour: 'green' }),
    letter(x0 + ox + 150, y0 + oy - 70, 140, 30, 'Incidents', {
      colour: 'red',
      textAlignX: 'right',
    }),
    letter(x0 + ox, y0 + oy + 4, 290, 30, 'Jan  →  Sep', { textAlignX: 'center', textSize: 'sm' }),
  );

  // The takeaway, along the bottom.
  const [tb, tl, tr] = bannerPaths(x0 + 230, y0 + 840, 940, 76);
  out.push(drawn(tl!, 91, { colour: 'red' }), drawn(tr!, 92, { colour: 'red' }));
  out.push(drawn(tb!, 90, { colour: 'red', width: 3 }));
  out.push(
    letter(
      x0 + 250,
      y0 + 850,
      900,
      56,
      'Takeaway: make the deploy so dull nobody notices it is Friday',
      {
        textSize: 'lg',
        textAlignX: 'center',
        textBold: true,
      },
    ),
    sticker('emoji-party-popper', x0 + 1196, y0 + 832, 70, 10),
  );

  return out;
}
