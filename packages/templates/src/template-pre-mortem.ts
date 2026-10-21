// Pre-Mortem (docs/specs/007-editor/templates-by-mode.md "Draw templates"): Gary Klein's
// prospective hindsight, drawn. "It's a year from now and the project failed. What happened?"
// The project (the launch of a new mobile app) is a ship going down in the middle of the board;
// round it the team's reasons sit on pink sticky notes in four groups (People, Plan, Tech,
// Market), and a column on the right turns them into "What we'll do now", with tick boxes and an
// owner each. Pure: (cx, cy) -> Element[].

import type { Element, PenColourName } from '@livediagram/document';
import { sinkingShip, tickBox } from './template-sketch-props';
import { FINE, boxPath, drawn, letter, note, sticker, wavyPath } from './template-sketch-kit';

const W = 1660;
const H = 960;
const NOTE_W = 190;
const NOTE_H = 120;
// The column the actions sit in, board-local.
const ACT_X = 1300;

type Group = { name: string; colour: PenColourName; x: number; y: number; reasons: string[] };

const GROUPS: Group[] = [
  {
    name: 'People',
    colour: 'violet',
    x: 0,
    y: 160,
    reasons: [
      'Our only iOS dev left in March',
      'Nobody owned the launch',
      'Support wasn’t trained',
    ],
  },
  {
    name: 'Plan',
    colour: 'orange',
    x: 860,
    y: 160,
    reasons: [
      'We said yes to every feature',
      'Beta was 2 weeks, not 2 months',
      'No date to cut scope',
    ],
  },
  {
    name: 'Tech',
    colour: 'blue',
    x: 0,
    y: 560,
    reasons: [
      'Sign-in broke on older Android phones',
      'The API fell over on launch day',
      'No crash reports until week 3',
    ],
  },
  {
    name: 'Market',
    colour: 'green',
    x: 860,
    y: 560,
    reasons: ['A rival shipped it first', 'Reviews sank us to 2 stars', 'Nobody knew it launched'],
  },
];

const ACTIONS = [
  { what: 'Pair a second dev on iOS', who: 'Dana · Nov', done: true },
  { what: 'Name one launch owner', who: 'Lee · this week', done: false },
  { what: 'Agree the cut-scope list', who: 'Team · Friday', done: false },
  { what: 'Load test at 10× traffic', who: 'Raj · Dec', done: false },
  { what: 'Plan launch comms now', who: 'Mia · Jan', done: false },
];

export function buildPreMortem(cx: number, cy: number): Element[] {
  const x0 = cx - W / 2;
  const y0 = cy - H / 2;
  const out: Element[] = [];

  out.push(
    letter(x0, y0, 1250, 64, 'Pre-Mortem: It’s a year from now and the project failed.', {
      textSize: 'lg',
      textScale: 1.35,
      textBold: true,
    }),
    drawn(wavyPath(x0 + 4, y0 + 70, 700, 18, 3), 1, { colour: 'red', width: FINE, amp: 0.5 }),
    letter(
      x0,
      y0 + 84,
      1250,
      34,
      'What happened? Write every reason on a note, then decide what we’ll do now.',
      {
        colour: 'teal',
      },
    ),
  );

  // The wreck in the middle.
  out.push(
    ...sinkingShip(x0 + 630, y0 + 440, 340, 10),
    letter(x0 + 470, y0 + 590, 320, 40, 'The Sprout App launch, Oct 2027', {
      textAlignX: 'center',
      textBold: true,
    }),
    sticker('emoji-siren', x0 + 760, y0 + 250, 60, 10),
  );

  // The reasons, in four groups round it.
  GROUPS.forEach((g, gi) => {
    const gx = x0 + g.x;
    const gy = y0 + g.y;
    out.push(
      letter(gx, gy, 200, 44, g.name, { textSize: 'lg', textBold: true, colour: g.colour }),
      drawn(wavyPath(gx + 2, gy + 46, 90, 4, 2.5), 20 + gi, {
        colour: g.colour,
        width: FINE,
        amp: 0.4,
      }),
    );
    g.reasons.forEach((reason, i) => {
      out.push(
        note(
          gx + (i % 2) * (NOTE_W + 20),
          gy + 64 + Math.floor(i / 2) * (NOTE_H + 16),
          NOTE_W,
          NOTE_H,
          reason,
          'pink',
          { textSize: 'lg', rotation: ((gi * 3 + i) % 3) - 1 },
        ),
      );
    });
  });

  // What we'll do now.
  const ax = x0 + ACT_X;
  const ay = y0 + 160;
  out.push(
    drawn(boxPath(ax, ay, W - ACT_X, 580, 300), 300, { width: 3 }),
    letter(ax + 20, ay + 14, W - ACT_X - 40, 44, 'What we’ll do now', {
      textSize: 'lg',
      textBold: true,
      colour: 'green',
    }),
  );
  ACTIONS.forEach((a, i) => {
    const ry = ay + 84 + i * 100;
    out.push(
      ...tickBox(ax + 22, ry + 6, 26, a.done, 310 + i * 5),
      letter(ax + 62, ry, W - ACT_X - 80, 34, a.what),
      letter(ax + 62, ry + 34, W - ACT_X - 80, 28, a.who, { textSize: 'sm', colour: 'teal' }),
    );
  });

  return out;
}
