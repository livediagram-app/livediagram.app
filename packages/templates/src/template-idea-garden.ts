// Idea Garden (docs/specs/007-editor/templates-by-mode.md "Draw templates"): a brainstorm grown as
// a drawn tree. The question is written at the roots ("How might we get more people cycling to
// work?"); four branches are the themes the ideas fell into; each idea is a leaf with its words
// inside; the ideas the group voted best hang as fruit (a red apple with a star, its votes beside
// it). A watering can invites people to build on an idea, and a legend reads the tree. Pure:
// (cx, cy) -> Element[].

import type { Element } from '@livediagram/document';
import { fruit, leaf, wateringCan } from './template-sketch-props';
import {
  FINE,
  arrowPaths,
  boxPath,
  drawn,
  letter,
  many,
  wavyPath,
  type Pt,
} from './template-sketch-kit';

const W = 1580;
const H = 1060;
const GROUND = 850;
const TRUNK_TOP = 610;
const LEAF_W = 190;
const LEAF_H = 86;

// A leaf grows off its branch at `t` (0 at the trunk, 1 at the tip), pointing `angle` degrees
// away from it; the idea is written inside.
type Leaf = { t: number; angle: number; idea: string };
type Branch = {
  theme: string;
  tip: Pt;
  bend: number;
  // The theme is written along the branch, above it unless `themeBelow`.
  themeBelow?: true;
  leaves: Leaf[];
  // The best idea, hanging as fruit under the branch at `t`.
  best: { t: number; idea: string; votes: number; side?: -1 | 1 };
};

// From the trunk's top to each tip.
const TRUNK: Pt = { x: W / 2, y: TRUNK_TOP };
// How far a leaf's centre sits from where it grows.
const LEAF_REACH = 112;

const BRANCHES: Branch[] = [
  {
    theme: 'Safer Roads',
    tip: { x: 260, y: 390 },
    bend: 0.12,
    themeBelow: true,
    leaves: [
      { t: 1, angle: 185, idea: 'Painted bike lanes' },
      { t: 0.78, angle: -140, idea: 'Lights at junctions' },
      { t: 0.86, angle: 145, idea: 'Slower speed limits' },
    ],
    best: { t: 0.45, idea: 'A protected lane to the station', votes: 9 },
  },
  {
    theme: 'Somewhere to Change',
    tip: { x: 520, y: 270 },
    bend: 0.08,
    leaves: [
      { t: 1, angle: -150, idea: 'Lockers at work' },
      { t: 0.95, angle: 160, idea: 'A towel service' },
    ],
    best: { t: 0.84, idea: 'Showers in the basement', votes: 7, side: -1 },
  },
  {
    theme: 'Money Talks',
    tip: { x: 1060, y: 270 },
    bend: -0.08,
    leaves: [
      { t: 1, angle: -30, idea: 'Cycle-to-work scheme' },
      { t: 0.95, angle: 20, idea: 'Pay per mile ridden' },
    ],
    best: { t: 0.84, idea: 'Free servicing', votes: 6, side: 1 },
  },
  {
    theme: 'Make It Fun',
    tip: { x: 1320, y: 390 },
    bend: -0.12,
    themeBelow: true,
    leaves: [
      { t: 1, angle: -5, idea: 'A team step league' },
      { t: 0.78, angle: -40, idea: 'Breakfast for riders' },
      { t: 0.86, angle: 35, idea: 'Bike Fridays' },
    ],
    best: { t: 0.45, idea: 'Bike buddy rides', votes: 11 },
  },
];

// A point on a branch (a quadratic bend from the trunk to its tip) and its heading there.
function branchAt(b: Branch, t: number): { p: Pt; heading: number } {
  const a = TRUNK;
  const len = Math.hypot(b.tip.x - a.x, b.tip.y - a.y);
  const m = {
    x: (a.x + b.tip.x) / 2 - ((b.tip.y - a.y) / len) * len * b.bend,
    y: (a.y + b.tip.y) / 2 + ((b.tip.x - a.x) / len) * len * b.bend,
  };
  const u = 1 - t;
  return {
    p: {
      x: u * u * a.x + 2 * u * t * m.x + t * t * b.tip.x,
      y: u * u * a.y + 2 * u * t * m.y + t * t * b.tip.y,
    },
    heading: Math.atan2(
      2 * u * (m.y - a.y) + 2 * t * (b.tip.y - m.y),
      2 * u * (m.x - a.x) + 2 * t * (b.tip.x - m.x),
    ),
  };
}

// Text turned to `rad`, but never upside down.
const readable = (rad: number) => {
  let deg = (rad * 180) / Math.PI;
  while (deg > 90) deg -= 180;
  while (deg < -90) deg += 180;
  return deg;
};

export function buildIdeaGarden(cx: number, cy: number): Element[] {
  const x0 = cx - W / 2;
  const y0 = cy - H / 2;
  const P = (x: number, y: number): Pt => ({ x: x0 + x, y: y0 + y });
  const out: Element[] = [];
  const wood = { colour: 'orange' as const, width: 4 };

  out.push(
    letter(x0, y0, 900, 64, 'Idea Garden', { textSize: 'lg', textScale: 1.45, textBold: true }),
    drawn(wavyPath(x0 + 4, y0 + 70, 250, 7, 3), 1, { colour: 'green', width: FINE, amp: 0.5 }),
    letter(
      x0,
      y0 + 84,
      900,
      34,
      'Plant the question, grow ideas as leaves, pick the ripest as fruit.',
      {
        colour: 'teal',
      },
    ),
  );

  // Ground, trunk and roots.
  const mid = W / 2;
  out.push(
    drawn(wavyPath(x0 + 350, y0 + GROUND, W - 700, 9, 4), 2, { colour: 'green', width: 3 }),
    drawn([P(mid - 50, GROUND), P(mid - 26, 740), P(mid - 28, TRUNK_TOP)], 3, wood),
    drawn([P(mid + 50, GROUND), P(mid + 28, 740), P(mid + 30, TRUNK_TOP)], 4, wood),
    ...many(
      [
        [P(mid - 40, GROUND), P(mid - 110, GROUND + 40), P(mid - 190, GROUND + 50)],
        [P(mid - 12, GROUND), P(mid - 40, GROUND + 50), P(mid - 70, GROUND + 70)],
        [P(mid + 14, GROUND), P(mid + 44, GROUND + 52), P(mid + 80, GROUND + 66)],
        [P(mid + 40, GROUND), P(mid + 120, GROUND + 36), P(mid + 200, GROUND + 46)],
      ],
      5,
      { colour: 'orange', width: 2.5 },
    ),
    letter(
      x0 + mid - 400,
      y0 + GROUND + 90,
      800,
      56,
      'How might we get more people cycling to work?',
      {
        textSize: 'lg',
        textScale: 1.2,
        textBold: true,
        textAlignX: 'center',
      },
    ),
  );

  // Branches, leaves and fruit.
  BRANCHES.forEach((br, bi) => {
    const seed = 100 + bi * 50;
    const along = Array.from({ length: 13 }, (_, i) => branchAt(br, i / 12).p);
    out.push(
      drawn(
        along.map((q) => P(q.x, q.y)),
        seed,
        wood,
      ),
    );
    // The theme, written along the branch just above it.
    const half = branchAt(br, 0.62);
    const up = half.heading + (br.tip.x < TRUNK.x !== !!br.themeBelow ? Math.PI / 2 : -Math.PI / 2);
    const lc = { x: half.p.x + 26 * Math.cos(up), y: half.p.y + 26 * Math.sin(up) };
    out.push(
      letter(x0 + lc.x - 110, y0 + lc.y - 18, 220, 36, br.theme, {
        textBold: true,
        textAlignX: 'center',
        colour: 'orange',
        rotation: readable(half.heading),
      }),
    );
    br.leaves.forEach((l, li) => {
      const at = branchAt(br, l.t).p;
      const rad = (l.angle * Math.PI) / 180;
      const c = { x: at.x + LEAF_REACH * Math.cos(rad), y: at.y + LEAF_REACH * Math.sin(rad) };
      out.push(
        ...leaf(x0 + c.x, y0 + c.y, LEAF_W, LEAF_H, rad, seed + 5 + li * 4),
        letter(x0 + c.x - 70, y0 + c.y - 30, 140, 60, l.idea, {
          textAlignX: 'center',
          rotation: readable(rad),
        }),
      );
    });
    const f = br.best;
    const hang = branchAt(br, f.t).p;
    out.push(
      drawn([P(hang.x, hang.y), P(hang.x - 3, hang.y + 40)], seed + 30, {
        colour: 'orange',
        width: 2.5,
      }),
      ...fruit(x0 + hang.x, y0 + hang.y + 66, 28, seed + 31),
      f.side
        ? letter(
            x0 + hang.x + (f.side < 0 ? -40 - 170 : 40),
            y0 + hang.y + 40,
            170,
            56,
            `${f.idea} (${f.votes} dots)`,
            { colour: 'red', textAlignX: f.side < 0 ? 'right' : 'left' },
          )
        : letter(x0 + hang.x - 110, y0 + hang.y + 100, 220, 56, `${f.idea} (${f.votes} dots)`, {
            colour: 'red',
            textAlignY: 'top',
            textAlignX: 'center',
          }),
    );
  });

  // The watering can.
  out.push(
    ...wateringCan(x0 + 30, y0 + 850, 100, 400),
    letter(x0, y0 + 950, 300, 64, 'Water an idea: build on it with “yes, and…”', {
      colour: 'teal',
      textAlignY: 'top',
    }),
  );

  // The legend.
  const lx = x0 + W - 330;
  const ly = y0 + 780;
  out.push(
    drawn(boxPath(lx, ly, 330, 270, 500), 500),
    letter(lx + 16, ly + 8, 200, 40, 'Legend', { textSize: 'lg', textBold: true }),
    ...leaf(lx + 50, ly + 76, 60, 28, 0, 510, { width: FINE }),
    letter(lx + 100, ly + 60, 220, 32, 'An idea'),
    ...fruit(lx + 50, ly + 128, 14, 520),
    letter(lx + 100, ly + 112, 220, 32, 'A best idea (most dots)'),
    drawn(arrowPaths(P(W - 310, 966), P(W - 250, 950), 0.1)[0]!, 530, wood),
    letter(lx + 100, ly + 158, 220, 32, 'A theme'),
    drawn(wavyPath(lx + 22, ly + 226, 56, 3, 3), 540, { colour: 'orange', width: 2.5 }),
    letter(lx + 100, ly + 206, 220, 32, 'The question, at the roots'),
  );

  return out;
}
