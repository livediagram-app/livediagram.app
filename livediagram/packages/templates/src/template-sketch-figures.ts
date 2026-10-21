// The doodles the Draw templates share (docs/specs/007-editor/templates-by-mode.md "Draw
// templates"), each a handful of marker strokes from the sketch kit: stick figures in a few
// poses, a lightbulb, crossed swords, an eye, a stopwatch, a laptop, a bug and quick portraits.
// Every doodle is placed by its own anchor and seeded, so it is the same drawing wherever it
// lands. The quick portraits live in template-sketch-portrait.ts. Pure.

import type { FreehandElement } from '@livediagram/document';
import {
  BOLD,
  FINE,
  arrowPaths,
  bowLine,
  boxPath,
  drawn,
  ellipsePath,
  many,
  type Pen,
  type Pt,
} from './template-sketch-kit';

const P = (x: number, y: number): Pt => ({ x, y });

// An arc of the circle round (cx, cy) from angle `a0` to `a1` (radians, screen axes).
export function arcPts(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  n = 12,
) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return P(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
  });
}

export type Pose = 'stand' | 'wave' | 'cheer' | 'point' | 'hips' | 'shrug';
export type Mood = 'smile' | 'frown' | 'flat' | 'open';

export type FigureOpts = {
  pose?: Pose;
  mood?: Mood;
  // Which way a pointing or waving arm reaches.
  facing?: 1 | -1;
  // A ponytail (Maya), a cap (a nurse), a tie (a consultant's suit).
  hair?: 'ponytail' | 'cap' | 'tie';
  pen?: Pen;
};

// A stick figure standing `h` tall, its head's top at (x, y).
export function stickFigure(
  x: number,
  y: number,
  h: number,
  seed: number,
  opts: FigureOpts = {},
): FreehandElement[] {
  const { pose = 'stand', mood = 'smile', facing = 1, pen = {} } = opts;
  const r = h * 0.13;
  const hy = y + r;
  const neck = y + 2 * r;
  const sh = neck + h * 0.08;
  const hip = y + h * 0.62;
  const foot = y + h;
  const arm = h * 0.3;
  const f = facing;
  const hand = (dx: number, dy: number) => P(x + dx * arm, sh + dy * arm);
  const arms: Record<Pose, Pt[]> = {
    stand: [hand(-0.6, 0.8), P(x, sh), hand(0.6, 0.8)],
    wave: [hand(-0.6 * f, 0.8), P(x, sh), hand(0.55 * f, -0.85)],
    cheer: [hand(-0.95, -0.7), hand(-0.5, -0.15), P(x, sh), hand(0.5, -0.15), hand(0.95, -0.7)],
    point: [hand(-0.5 * f, 0.85), P(x, sh), hand(1.05 * f, -0.15)],
    hips: [
      P(x - arm * 0.15, hip - h * 0.05),
      hand(-0.6, 0.35),
      P(x, sh),
      hand(0.6, 0.35),
      P(x + arm * 0.15, hip - h * 0.05),
    ],
    shrug: [hand(-0.75, -0.3), hand(-0.45, 0.25), P(x, sh), hand(0.45, 0.25), hand(0.75, -0.3)],
  };
  const mouth: Record<Mood, Pt[]> = {
    smile: arcPts(x, hy + r * 0.1, r * 0.5, r * 0.45, 0.2 * Math.PI, 0.8 * Math.PI, 6),
    frown: arcPts(x, hy + r * 0.75, r * 0.45, r * 0.35, 1.2 * Math.PI, 1.8 * Math.PI, 6),
    flat: [P(x - r * 0.35, hy + r * 0.45), P(x + r * 0.35, hy + r * 0.45)],
    open: ellipsePath(x, hy + r * 0.45, r * 0.2, r * 0.22, seed, 1.05),
  };
  const marks: FreehandElement[] = [
    drawn(ellipsePath(x, hy, r, r * 1.05, seed), seed, pen),
    drawn(bowLine(P(x, neck), P(x, hip), h * 0.01), seed + 1, pen),
    drawn(arms[pose], seed + 2, pen),
    drawn([P(x - h * 0.17, foot), P(x, hip), P(x + h * 0.17, foot)], seed + 3, pen),
    drawn(mouth[mood], seed + 4, { ...pen, width: FINE, amp: 0.3 }),
    drawn([P(x - r * 0.38, hy - r * 0.3), P(x - r * 0.36, hy - r * 0.05)], seed + 5, {
      ...pen,
      width: BOLD,
      amp: 0.2,
    }),
    drawn([P(x + r * 0.38, hy - r * 0.3), P(x + r * 0.36, hy - r * 0.05)], seed + 6, {
      ...pen,
      width: BOLD,
      amp: 0.2,
    }),
  ];
  if (opts.hair === 'ponytail') {
    marks.push(
      drawn(
        [
          P(x - r * 0.95, hy - r * 0.2),
          P(x - r * 0.6, hy - r * 0.95),
          P(x + r * 0.3, hy - r * 1.1),
          P(x + r * 0.95, hy - r * 0.6),
          P(x + r * 1.6, hy - r * 0.75),
          P(x + r * 2.3, hy - r * 0.2),
          P(x + r * 2.5, hy + r * 0.7),
          P(x + r * 2.2, hy + r * 1.5),
        ],
        seed + 7,
        { ...pen, amp: 0.6 },
      ),
    );
  } else if (opts.hair === 'cap') {
    marks.push(
      drawn(
        [
          P(x - r * 0.9, hy - r * 0.55),
          P(x - r * 0.7, hy - r * 1.35),
          P(x + r * 0.7, hy - r * 1.35),
          P(x + r * 0.9, hy - r * 0.55),
        ],
        seed + 7,
        { ...pen, amp: 0.5 },
      ),
      drawn([P(x - r * 0.15, hy - r * 1.05), P(x + r * 0.2, hy - r * 1.05)], seed + 8, {
        ...pen,
        colour: 'red',
        amp: 0.2,
      }),
    );
  } else if (opts.hair === 'tie') {
    marks.push(
      drawn(
        [
          P(x - r * 0.25, neck + 2),
          P(x + r * 0.25, neck + 2),
          P(x + r * 0.15, neck + h * 0.2),
          P(x, neck + h * 0.25),
          P(x - r * 0.15, neck + h * 0.2),
          P(x - r * 0.25, neck + 2),
        ],
        seed + 7,
        { ...pen, colour: 'blue', width: FINE, amp: 0.4 },
      ),
    );
  }
  return marks;
}

// A lightbulb with rays, its glass centred on (cx, cy).
export function lightbulb(cx: number, cy: number, r: number, seed: number, pen: Pen = {}) {
  const glass = [
    P(cx - r * 0.38, cy + r * 1.25),
    ...arcPts(cx, cy, r, r, (2 / 3) * Math.PI, (7 / 3) * Math.PI, 22),
    P(cx + r * 0.38, cy + r * 1.25),
  ];
  const rays = [200, 235, 270, 305, 340].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return [
      P(cx + 1.35 * r * Math.cos(a), cy + 1.35 * r * Math.sin(a)),
      P(cx + 1.75 * r * Math.cos(a), cy + 1.75 * r * Math.sin(a)),
    ];
  });
  return [
    drawn(glass, seed, pen),
    ...many(
      [
        [P(cx - r * 0.42, cy + r * 1.35), P(cx + r * 0.42, cy + r * 1.35)],
        [P(cx - r * 0.38, cy + r * 1.52), P(cx + r * 0.38, cy + r * 1.52)],
        [P(cx - r * 0.2, cy + r * 1.7), P(cx + r * 0.2, cy + r * 1.7)],
      ],
      seed + 1,
      { ...pen, amp: 0.4 },
    ),
    drawn(
      [
        P(cx - r * 0.25, cy + r * 1.15),
        P(cx - r * 0.25, cy + r * 0.2),
        P(cx - r * 0.1, cy - r * 0.05),
        P(cx + r * 0.05, cy + r * 0.2),
        P(cx + r * 0.2, cy - r * 0.05),
        P(cx + r * 0.25, cy + r * 0.2),
        P(cx + r * 0.25, cy + r * 1.15),
      ],
      seed + 5,
      { ...pen, width: FINE, amp: 0.4 },
    ),
    ...many(rays, seed + 9, { ...pen, amp: 0.4 }),
  ];
}

// Two swords crossed at (cx, cy), each blade `s` from the crossing: a clash of interests.
export function crossedSwords(cx: number, cy: number, s: number, seed: number, pen: Pen = {}) {
  // One sword, its hilt low on the `dir` side: the blade to its tip, the guard across the blade
  // and the grip.
  const sword = (dir: 1 | -1): Pt[][] => {
    const hilt = P(cx - dir * s * 0.8, cy + s * 0.8);
    const tip = P(cx + dir * s * 0.75, cy - s * 0.75);
    const gx = cx - dir * s * 0.42;
    const gy = cy + s * 0.42;
    const g = s * 0.3;
    return [
      [P(gx, gy), P(tip.x - dir * 5, tip.y + 2), tip],
      [P(gx - g, gy - dir * g), P(gx + g, gy + dir * g)],
      [P(gx, gy), hilt],
      ellipsePath(hilt.x - dir * s * 0.06, hilt.y + s * 0.06, s * 0.08, s * 0.08, seed + dir, 1.6),
    ];
  };
  const [blade1, guard1, grip1, pommel1] = sword(1);
  const [blade2, guard2, grip2, pommel2] = sword(-1);
  const thin = { colour: 'red' as const, ...pen, amp: 0.6 };
  const thick = { ...thin, width: (pen.width ?? BOLD) * 1.8, amp: 0.3 };
  return [
    ...many([blade1!, guard1!, blade2!, guard2!, pommel1!, pommel2!], seed, thin),
    ...many([grip1!, grip2!], seed + 50, thick),
  ];
}

// An eye looking on: lids, iris and a scribbled pupil, `w` wide.
export function eye(cx: number, cy: number, w: number, seed: number, pen: Pen = {}) {
  const h = w * 0.32;
  const l = P(cx - w / 2, cy);
  const r = P(cx + w / 2, cy);
  const lid = (k: number) =>
    Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      return P(l.x + (r.x - l.x) * t, cy + k * h * Math.sin(Math.PI * t));
    });
  return [
    drawn(lid(-1), seed, pen),
    drawn(lid(0.85), seed + 1, pen),
    drawn(ellipsePath(cx, cy, h * 0.62, h * 0.62, seed + 2), seed + 2, pen),
    drawn(ellipsePath(cx, cy, h * 0.22, h * 0.22, seed + 3, 3.2), seed + 3, {
      ...pen,
      width: 4,
      amp: 0.3,
    }),
    ...many(
      [-0.25, 0, 0.25].map((t) => {
        const x = cx + t * w;
        const y = cy - h * Math.sin(Math.PI * (0.5 + t)) - 2;
        return [P(x, y), P(x + t * 14, y - 10)];
      }),
      seed + 4,
      { ...pen, width: FINE, amp: 0.3 },
    ),
  ];
}

// A stopwatch, its face centred on (cx, cy): the button, the face, four ticks and the hand.
export function stopwatch(cx: number, cy: number, r: number, seed: number, pen: Pen = {}) {
  const ticks = [0, 1, 2, 3].map((k) => {
    const a = (k * Math.PI) / 2 - Math.PI / 2;
    return [
      P(cx + r * 0.78 * Math.cos(a), cy + r * 0.78 * Math.sin(a)),
      P(cx + r * 0.92 * Math.cos(a), cy + r * 0.92 * Math.sin(a)),
    ];
  });
  return [
    drawn(ellipsePath(cx, cy, r, r, seed, 1.08), seed, pen),
    drawn(boxPath(cx - r * 0.18, cy - r * 1.32, r * 0.36, r * 0.18, seed), seed + 1, {
      ...pen,
      amp: 0.4,
    }),
    drawn([P(cx, cy - r * 1.14), P(cx, cy - r * 1.0)], seed + 2, { ...pen, amp: 0.2 }),
    ...many(ticks, seed + 3, { ...pen, width: FINE, amp: 0.2 }),
    ...many(arrowPaths(P(cx, cy), P(cx + r * 0.42, cy - r * 0.5), 0, r * 0.18), seed + 8, {
      ...pen,
      colour: 'red',
      amp: 0.3,
    }),
  ];
}

// A laptop on a desk: the screen with its top-left at (x, y), `w` wide, and the keyboard below.
export function laptop(x: number, y: number, w: number, seed: number, pen: Pen = {}) {
  const h = w * 0.6;
  return [
    drawn(boxPath(x, y, w, h, seed), seed, pen),
    drawn(
      [
        P(x, y + h + 2),
        P(x - w * 0.12, y + h + w * 0.12),
        P(x + w * 1.12, y + h + w * 0.12),
        P(x + w, y + h + 2),
      ],
      seed + 1,
      pen,
    ),
  ];
}

// A bug: shell, head, legs and feelers, its shell centred on (cx, cy).
export function bug(cx: number, cy: number, s: number, seed: number, pen: Pen = {}) {
  const legs = [-0.45, 0, 0.45].flatMap((t) => [
    [
      P(cx - s * 0.5, cy + t * s),
      P(cx - s * 0.85, cy + t * s - s * 0.1),
      P(cx - s * 1.0, cy + t * s + s * 0.15),
    ],
    [
      P(cx + s * 0.5, cy + t * s),
      P(cx + s * 0.85, cy + t * s - s * 0.1),
      P(cx + s * 1.0, cy + t * s + s * 0.15),
    ],
  ]);
  return [
    drawn(ellipsePath(cx, cy + s * 0.1, s * 0.55, s * 0.75, seed), seed, pen),
    drawn(ellipsePath(cx, cy - s * 0.8, s * 0.3, s * 0.25, seed + 1), seed + 1, pen),
    drawn([P(cx, cy - s * 0.55), P(cx, cy + s * 0.85)], seed + 2, { ...pen, amp: 0.4 }),
    ...many(legs, seed + 3, { ...pen, width: FINE, amp: 0.5 }),
    ...many(
      [
        [
          P(cx - s * 0.12, cy - s * 1.0),
          P(cx - s * 0.3, cy - s * 1.35),
          P(cx - s * 0.5, cy - s * 1.4),
        ],
        [
          P(cx + s * 0.12, cy - s * 1.0),
          P(cx + s * 0.3, cy - s * 1.35),
          P(cx + s * 0.5, cy - s * 1.4),
        ],
      ],
      seed + 20,
      { ...pen, width: FINE, amp: 0.5 },
    ),
  ];
}
