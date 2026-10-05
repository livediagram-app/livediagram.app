// More doodles for the Draw templates (docs/specs/007-editor/templates-by-mode.md "Draw
// templates"), split from template-sketch-figures.ts to keep each file cohesive: the lo-fi phone
// and its UI marks (an image placeholder, a tap), feeling faces, the journey's stops (a fridge, a
// van, a house, a gift), the pre-mortem's sinking ship, and the idea garden's leaf, fruit and
// watering can. Each is a few marker strokes from the sketch kit, anchored and seeded so it is
// the same drawing wherever it lands. Pure.

import type { FreehandElement } from '@livediagram/document';
import { arcPts } from './template-sketch-figures';
import {
  BOLD,
  FINE,
  bowLine,
  boxPath,
  bubblePath,
  drawn,
  ellipsePath,
  many,
  starPath,
  tickPath,
  wavyPath,
  type Pen,
  type Pt,
} from './template-sketch-kit';

const P = (x: number, y: number): Pt => ({ x, y });

// --- The paper prototype's marks ---------------------------------------------------------------

// A phone drawn on paper: a rounded body, the speaker slot and the home bar, top-left at (x, y).
export function phone(x: number, y: number, w: number, h: number, seed: number, pen: Pen = {}) {
  return [
    drawn(bubblePath(x, y, w, h, undefined, 32), seed, { width: 3, ...pen }),
    drawn(bowLine(P(x + w / 2 - 24, y + 22), P(x + w / 2 + 24, y + 22)), seed + 1, {
      ...pen,
      amp: 0.3,
    }),
    drawn(bowLine(P(x + w / 2 - 34, y + h - 18), P(x + w / 2 + 34, y + h - 18)), seed + 2, {
      ...pen,
      amp: 0.3,
    }),
  ];
}

// The paper prototyper's image placeholder: a box with a cross through it.
export function imageBox(x: number, y: number, w: number, h: number, seed: number, pen: Pen = {}) {
  return [
    drawn(boxPath(x, y, w, h, seed), seed, { width: FINE, ...pen }),
    ...many(
      [
        [P(x + 3, y + 3), P(x + w - 3, y + h - 3)],
        [P(x + w - 3, y + 3), P(x + 3, y + h - 3)],
      ],
      seed + 1,
      { width: FINE, ...pen, amp: 0.5 },
    ),
  ];
}

// A tap: a dot where the finger lands and two ripples round it, centred on (cx, cy).
export function tapMark(cx: number, cy: number, seed: number, pen: Pen = {}) {
  const p = { colour: 'red' as const, ...pen };
  return [
    drawn(ellipsePath(cx, cy, 5, 5, seed, 2.2), seed, { ...p, width: 4, amp: 0.2 }),
    drawn(arcPts(cx, cy, 15, 15, -2.4, -0.7, 8), seed + 1, { ...p, width: FINE, amp: 0.3 }),
    drawn(arcPts(cx, cy, 24, 24, -2.5, -0.6, 10), seed + 2, { ...p, width: FINE, amp: 0.3 }),
  ];
}

// A water drop, its tip at (cx, cy - s).
export function drop(cx: number, cy: number, s: number, seed: number, pen: Pen = {}) {
  return drawn(
    [
      P(cx, cy - s),
      ...arcPts(cx, cy + s * 0.25, s * 0.6, s * 0.6, -0.25 * Math.PI, 1.25 * Math.PI, 10),
      P(cx, cy - s),
    ],
    seed,
    { colour: 'blue', ...pen, amp: 0.3 },
  );
}

// A tick box, ticked or not, its top-left at (x, y).
export function tickBox(
  x: number,
  y: number,
  s: number,
  ticked: boolean,
  seed: number,
  pen: Pen = {},
) {
  const box = drawn(boxPath(x, y, s, s, seed), seed, { width: FINE, ...pen, amp: 0.4 });
  if (!ticked) return [box];
  return [
    box,
    drawn(tickPath(x + 3, y + s * 0.3, s * 0.95), seed + 1, { colour: 'green', ...pen, amp: 0.3 }),
  ];
}

// --- Feelings --------------------------------------------------------------------------------------

export type Feeling = 'happy' | 'meh' | 'sad';

// A face for how a moment felt, centred on (cx, cy): green and smiling, orange and level, or red
// and frowning.
export function face(cx: number, cy: number, r: number, feeling: Feeling, seed: number) {
  const colour = feeling === 'happy' ? 'green' : feeling === 'meh' ? 'orange' : 'red';
  const pen: Pen = { colour };
  const mouth: Record<Feeling, Pt[]> = {
    happy: arcPts(cx, cy + r * 0.05, r * 0.5, r * 0.45, 0.15 * Math.PI, 0.85 * Math.PI, 8),
    meh: [P(cx - r * 0.4, cy + r * 0.4), P(cx + r * 0.4, cy + r * 0.35)],
    sad: arcPts(cx, cy + r * 0.75, r * 0.45, r * 0.35, 1.15 * Math.PI, 1.85 * Math.PI, 8),
  };
  const eye = (dx: number) => [P(cx + dx, cy - r * 0.35), P(cx + dx, cy - r * 0.12)];
  return [
    drawn(ellipsePath(cx, cy, r, r, seed), seed, pen),
    drawn(mouth[feeling], seed + 1, { ...pen, amp: 0.4 }),
    ...many([eye(-r * 0.32), eye(r * 0.32)], seed + 2, { ...pen, width: 3.5, amp: 0.2 }),
  ];
}

// --- The journey's stops ---------------------------------------------------------------------------

// An empty fridge, top-left at (x, y): the body, the freezer line and two handles.
export function fridge(x: number, y: number, s: number, seed: number, pen: Pen = {}) {
  return [
    drawn(boxPath(x, y, s * 0.62, s, seed), seed, pen),
    ...many(
      [
        [P(x, y + s * 0.35), P(x + s * 0.62, y + s * 0.35)],
        [P(x + s * 0.5, y + s * 0.12), P(x + s * 0.5, y + s * 0.25)],
        [P(x + s * 0.5, y + s * 0.45), P(x + s * 0.5, y + s * 0.65)],
      ],
      seed + 1,
      { ...pen, amp: 0.3 },
    ),
  ];
}

// A delivery van facing right, top-left at (x, y), `w` long.
export function van(x: number, y: number, w: number, seed: number, pen: Pen = {}) {
  const h = w * 0.5;
  return [
    drawn(
      [
        P(x, y + h),
        P(x, y),
        P(x + w * 0.62, y),
        P(x + w * 0.62, y + h * 0.25),
        P(x + w * 0.85, y + h * 0.25),
        P(x + w, y + h * 0.6),
        P(x + w, y + h),
        P(x + w * 0.88, y + h),
      ],
      seed,
      pen,
    ),
    drawn([P(x + w * 0.66, y + h), P(x + w * 0.34, y + h)], seed + 1, { ...pen, amp: 0.3 }),
    drawn(ellipsePath(x + w * 0.22, y + h + 4, w * 0.1, w * 0.1, seed + 2), seed + 2, pen),
    drawn(ellipsePath(x + w * 0.77, y + h + 4, w * 0.1, w * 0.1, seed + 3), seed + 3, pen),
    drawn(boxPath(x + w * 0.68, y + h * 0.33, w * 0.13, h * 0.22, seed + 4), seed + 4, {
      ...pen,
      width: FINE,
      amp: 0.3,
    }),
  ];
}

// A house with a shut door, its roof's peak at (cx, y).
export function house(cx: number, y: number, s: number, seed: number, pen: Pen = {}) {
  const w = s;
  const roof = s * 0.42;
  return [
    drawn([P(cx - w * 0.62, y + roof), P(cx, y), P(cx + w * 0.62, y + roof)], seed, pen),
    drawn(
      [
        P(cx - w * 0.5, y + roof - 6),
        P(cx - w * 0.5, y + s),
        P(cx + w * 0.5, y + s),
        P(cx + w * 0.5, y + roof - 6),
      ],
      seed + 1,
      pen,
    ),
    drawn(boxPath(cx - w * 0.12, y + s * 0.62, w * 0.24, s * 0.38, seed + 2), seed + 2, {
      ...pen,
      width: FINE,
      amp: 0.3,
    }),
    drawn(boxPath(cx + w * 0.2, y + s * 0.52, w * 0.18, w * 0.16, seed + 3), seed + 3, {
      ...pen,
      width: FINE,
      amp: 0.3,
    }),
  ];
}

// A gift box with a bow, top-left at (x, y).
export function gift(x: number, y: number, s: number, seed: number, pen: Pen = {}) {
  const lid = s * 0.25;
  return [
    drawn(boxPath(x, y + lid, s, s * 0.75, seed), seed, pen),
    drawn(boxPath(x - 6, y + lid * 0.3, s + 12, lid * 0.7, seed + 1), seed + 1, {
      ...pen,
      amp: 0.5,
    }),
    drawn([P(x + s / 2, y + lid * 0.3), P(x + s / 2, y + s)], seed + 2, {
      colour: 'red',
      amp: 0.3,
    }),
    drawn(
      [
        P(x + s / 2, y + lid * 0.3),
        P(x + s * 0.25, y - lid * 0.5),
        P(x + s * 0.2, y + lid * 0.2),
        P(x + s / 2, y + lid * 0.3),
        P(x + s * 0.8, y + lid * 0.2),
        P(x + s * 0.75, y - lid * 0.5),
        P(x + s / 2, y + lid * 0.3),
      ],
      seed + 3,
      { colour: 'red', amp: 0.3 },
    ),
  ];
}

// --- The pre-mortem's wreck --------------------------------------------------------------------------

// A ship going down by the bow, its hull centred on (cx, cy), `w` long: tilted hull, a snapped
// mast and torn sail, the sea over it and bubbles rising.
export function sinkingShip(cx: number, cy: number, w: number, seed: number) {
  const tilt = (20 * Math.PI) / 180;
  const rot = (x: number, y: number): Pt => ({
    x: cx + x * Math.cos(tilt) - y * Math.sin(tilt),
    y: cy + x * Math.sin(tilt) + y * Math.cos(tilt),
  });
  const h = w * 0.22;
  const hull = [
    rot(-w / 2, -h / 2),
    rot(w / 2, -h / 2),
    rot(w * 0.38, h / 2),
    rot(-w * 0.4, h / 2),
    rot(-w / 2, -h / 2),
    rot(-w / 2 + 18, -h / 2 + 2),
  ];
  const mastFoot = rot(-w * 0.05, -h / 2);
  const mastTop = rot(-w * 0.05, -h / 2 - w * 0.55);
  const sail = [
    rot(-w * 0.05, -h / 2 - w * 0.5),
    rot(-w * 0.32, -h / 2 - w * 0.12),
    rot(-w * 0.22, -h / 2 - w * 0.16),
    rot(-w * 0.27, -h / 2 - w * 0.06),
    rot(-w * 0.15, -h / 2 - w * 0.1),
    rot(-w * 0.05, -h / 2 - w * 0.08),
  ];
  const portholes = [-0.25, -0.05, 0.15].map((t) => {
    const c = rot(w * t, 0);
    return ellipsePath(c.x, c.y, 9, 9, seed + t * 10, 1.1);
  });
  const sea = cy + h * 0.35;
  const waves = [0, 1, 2].map((k) =>
    wavyPath(cx - w * 0.75 + k * 30, sea + k * 22, w * 1.5 - k * 60, 9 - k, 5),
  );
  const bubbles = [
    [w * 0.42, 40, 7],
    [w * 0.5, 0, 10],
    [w * 0.36, -30, 6],
  ].map(([dx, dy, r]) => ellipsePath(cx + dx!, sea - 20 + dy!, r!, r!, seed + r!, 1.1));
  return [
    drawn(hull, seed, { width: 3 }),
    drawn([mastFoot, mastTop], seed + 1, { width: 3 }),
    drawn(sail, seed + 2, { colour: 'red' }),
    ...many(portholes, seed + 3, { width: FINE, amp: 0.3 }),
    ...many(waves, seed + 10, { colour: 'blue', width: 3 }),
    ...many(bubbles, seed + 20, { colour: 'blue', width: FINE, amp: 0.3 }),
  ];
}

// --- The idea garden ---------------------------------------------------------------------------------

// A leaf round its idea: an almond pointed at both ends with a midrib, centred on (cx, cy),
// leaning by `lean` radians.
export function leaf(
  cx: number,
  cy: number,
  w: number,
  h: number,
  lean: number,
  seed: number,
  pen: Pen = {},
) {
  const rot = (x: number, y: number): Pt => ({
    x: cx + x * Math.cos(lean) - y * Math.sin(lean),
    y: cy + x * Math.sin(lean) + y * Math.cos(lean),
  });
  const side = (k: number) =>
    Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      return rot(-w / 2 + w * t, k * (h / 2) * Math.sin(Math.PI * t) ** 0.8);
    });
  const top = side(-1);
  const bottom = side(1).reverse();
  return [
    drawn([...top, ...bottom.slice(1), top[1]!], seed, { colour: 'green', ...pen }),
    drawn([rot(-w / 2 - 14, 4), rot(-w / 2, 0), rot(-w * 0.32, 0)], seed + 1, {
      colour: 'green',
      ...pen,
      width: FINE,
      amp: 0.3,
    }),
  ];
}

// A fruit for a best idea: a red apple with a stalk and a star on it, centred on (cx, cy).
export function fruit(cx: number, cy: number, r: number, seed: number) {
  return [
    drawn(ellipsePath(cx, cy, r, r * 0.95, seed, 1.1), seed, { colour: 'red', width: 3 }),
    drawn([P(cx, cy - r * 0.9), P(cx + 3, cy - r * 1.35)], seed + 1, {
      colour: 'orange',
      amp: 0.3,
    }),
    drawn(starPath(cx, cy + 2, r * 0.55), seed + 2, { colour: 'red', width: FINE, amp: 0.3 }),
  ];
}

// A watering can tipped to pour, its body's top-left at (x, y), with drops falling from the spout.
export function wateringCan(x: number, y: number, s: number, seed: number): FreehandElement[] {
  const h = s * 0.7;
  return [
    drawn(
      [P(x, y + 6), P(x + s, y), P(x + s * 0.95, y + h), P(x + s * 0.05, y + h + 4), P(x, y + 6)],
      seed,
      { colour: 'teal', width: 3 },
    ),
    drawn(
      [P(x + s, y + h * 0.45), P(x + s * 1.55, y - h * 0.3), P(x + s * 1.65, y - h * 0.35)],
      seed + 1,
      { colour: 'teal', width: 3 },
    ),
    drawn(arcPts(x + s * 0.45, y + 2, s * 0.32, s * 0.38, Math.PI, 2 * Math.PI, 10), seed + 2, {
      colour: 'teal',
      width: BOLD,
    }),
    ...[0, 1, 2].map((k) => drop(x + s * 1.6 + k * 14, y - h * 0.05 + k * 26, 8, seed + 3 + k)),
  ];
}
