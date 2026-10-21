// Journey Doodle (docs/specs/007-editor/templates-by-mode.md "Draw templates"): a customer's day
// drawn as a winding road, a customer journey map in marker. Ana gets her groceries delivered:
// six stops along the road, each a little doodle with its time and what happened, and above each
// a face for how it felt, joined by a line that rises and falls with her mood. The dip where it
// goes wrong (the missed delivery) is ringed in red with an "ouch"; green sticky notes along the
// bottom turn the low points into opportunities. Pure: (cx, cy) -> Element[].

import type { Element } from '@livediagram/document';
import { laptop, stopwatch } from './template-sketch-figures';
import { face, fridge, gift, house, van, type Feeling } from './template-sketch-props';
import {
  FINE,
  drawn,
  ellipsePath,
  letter,
  many,
  note,
  sticker,
  wavyPath,
  type Pt,
} from './template-sketch-kit';

const W = 1640;
const H = 1000;
// The road's centre line, board-local: a slow wave across the board.
const ROAD_Y = 520;
const roadY = (x: number) => ROAD_Y + 46 * Math.sin((2 * Math.PI * x) / 560 + 0.6);
const ROAD_HALF = 26;
// Where each stop's doodle starts, under the road's lowest point.
const DOODLE_Y = 610;
// How high each feeling's face sits: the line through them is the mood.
const FACE_Y: Record<Feeling, number> = { happy: 190, meh: 260, sad: 340 };

type Stop = {
  time: string;
  what: string;
  feeling: Feeling;
  // The doodle, drawn round the point (x, y) below the road.
  draw: (x: number, y: number, seed: number) => Element[];
};

const STOPS: Stop[] = [
  {
    time: '7:30am',
    what: 'Opens the fridge: empty',
    feeling: 'meh',
    draw: (x, y, s) => fridge(x - 31, y, 100, s),
  },
  {
    time: '7:40am',
    what: 'Orders on the app in 3 minutes',
    feeling: 'happy',
    draw: (x, y, s) => laptop(x - 50, y + 10, 100, s),
  },
  {
    time: '12:00pm',
    what: '“Out for delivery” text',
    feeling: 'happy',
    draw: (x, y, s) => van(x - 60, y + 20, 120, s),
  },
  {
    time: '6:00pm',
    what: 'Slot missed, nobody home',
    feeling: 'sad',
    draw: (x, y, s) => house(x, y, 90, s),
  },
  {
    time: '6:30pm',
    what: '25 minutes on hold to support',
    feeling: 'sad',
    draw: (x, y, s) => stopwatch(x, y + 56, 40, s),
  },
  {
    time: '8:00pm',
    what: 'Redelivered, with a free dessert',
    feeling: 'happy',
    draw: (x, y, s) => gift(x - 40, y + 14, 80, s),
  },
];

const OPPORTUNITIES = [
  'Let people pick a one-hour slot',
  'Text a photo at the door before leaving',
  'Call back instead of hold music',
];

export function buildJourneyDoodle(cx: number, cy: number): Element[] {
  const x0 = cx - W / 2;
  const y0 = cy - H / 2;
  const P = (x: number, y: number): Pt => ({ x: x0 + x, y: y0 + y });
  const out: Element[] = [];

  out.push(
    letter(x0, y0, 1100, 64, 'Journey Doodle: Ana Gets Her Groceries', {
      textSize: 'lg',
      textScale: 1.4,
      textBold: true,
    }),
    drawn(wavyPath(x0 + 4, y0 + 70, 540, 14, 3), 1, { colour: 'blue', width: FINE, amp: 0.5 }),
    letter(x0, y0 + 84, 1100, 34, 'One customer, one Tuesday. A face for how each moment felt.', {
      colour: 'teal',
    }),
  );

  // The road: two edges and a dashed centre line.
  const edge = (k: number) =>
    Array.from({ length: 41 }, (_, i) => {
      const x = 30 + (i / 40) * (W - 60);
      return P(x, roadY(x) + k * ROAD_HALF);
    });
  out.push(drawn(edge(-1), 2, { width: 3 }), drawn(edge(1), 3, { width: 3 }));
  const dashes: Pt[][] = [];
  for (let x = 50; x < W - 60; x += 46) dashes.push([P(x, roadY(x)), P(x + 22, roadY(x + 22))]);
  out.push(...many(dashes, 4, { colour: 'orange', width: FINE, amp: 0.2 }));
  out.push(
    letter(x0, y0 + roadY(30) - 80, 90, 30, 'Start', { textBold: true }),
    sticker('emoji-chequered-flag', x0 + W - 70, y0 + roadY(W - 40) - 90, 60, 8),
  );

  // The stops, the faces over them and the mood line through the faces.
  const stopX = (i: number) => 160 + i * ((W - 320) / (STOPS.length - 1));
  const mood: Pt[] = [];
  STOPS.forEach((stop, i) => {
    const x = stopX(i);
    const seed = 100 + i * 30;
    const fy = FACE_Y[stop.feeling];
    mood.push(P(x, fy));
    out.push(
      drawn(ellipsePath(x0 + x, y0 + roadY(x), 9, 9, seed, 2.4), seed, {
        colour: 'red',
        width: 4,
        amp: 0.2,
      }),
      drawn([P(x, fy + 46), P(x, roadY(x) - 14)], seed + 1, { width: FINE, amp: 0.4 }),
      ...face(x0 + x, y0 + fy, 34, stop.feeling, seed + 2),
      ...stop.draw(x0 + x, y0 + DOODLE_Y, seed + 10),
      letter(x0 + x - 110, y0 + DOODLE_Y + 124, 220, 30, stop.time, {
        textBold: true,
        textAlignX: 'center',
      }),
      letter(x0 + x - 110, y0 + DOODLE_Y + 152, 220, 60, stop.what, {
        textAlignX: 'center',
        textAlignY: 'top',
      }),
    );
  });
  // The mood line runs face to face, stopping short of each face's rim.
  for (let i = 1; i < mood.length; i++) {
    const a = mood[i - 1]!;
    const b = mood[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const k = 40 / len;
    out.push(
      drawn(
        [
          { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k },
          { x: b.x - (b.x - a.x) * k, y: b.y - (b.y - a.y) * k },
        ],
        50 + i,
        { colour: 'violet', width: FINE, amp: 1 },
      ),
    );
  }
  out.push(
    letter(x0 + 30, y0 + 170, 140, 60, 'How it felt', { colour: 'violet', textAlignY: 'top' }),
  );

  // The dip, ringed: where the day goes wrong.
  const dipX = stopX(3);
  out.push(
    drawn(ellipsePath(x0 + dipX + 132, y0 + FACE_Y.sad, 200, 64, 60, 1.12), 60, {
      colour: 'red',
      width: 3,
    }),
    letter(x0 + dipX + 62, y0 + FACE_Y.sad - 128, 140, 56, 'ouch!', {
      textSize: 'lg',
      textScale: 1.4,
      textBold: true,
      textAlignX: 'center',
      colour: 'red',
    }),
  );

  // Opportunities, along the bottom.
  out.push(
    letter(x0, y0 + H - 140, 220, 40, 'Opportunities', {
      textSize: 'lg',
      textBold: true,
      colour: 'green',
    }),
  );
  OPPORTUNITIES.forEach((text, i) =>
    out.push(
      note(x0 + 240 + i * 300, y0 + H - 150, 260, 130, text, 'green', {
        textSize: 'lg',
        rotation: i % 2 === 0 ? -1.5 : 1.5,
      }),
    ),
  );
  out.push(sticker('emoji-bulb', x0 + 1160, y0 + H - 130, 70, 10));

  return out;
}
