import type { Element, ShapeElement } from '@livediagram/document';
import { frameOf, type Chapter, type Topic, type Waypoint } from '../topic';
import {
  bar,
  carryAt,
  learnTiles,
  placed,
  tile,
  within,
  type Carry,
  type TileMemory,
} from './workshop-shared';

// Ask the Room (docs/specs/007-editor/watch-it-built.md "The curriculum", Workshop): the palette's Ask band, whose
// tiles put a question to the room (palette-tile-defs.tsx, tileGroup 'ask'). Example drags out a Dot Vote, a Poll and
// a Temperature Check; nothing is started.

// The ids are read by the telemetry dashboard (computed-emitters.ts TOUR_STEP_SOURCE) as `TourStep<Id>`.
export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'ask-vote',
    name: 'Dot Vote',
    shortName: 'Vote',
    ms: 7000,
    say: 'Open Ask in the palette and drag a Dot Vote onto the canvas.',
    sayTouch: 'Tap Ask in the palette and drag a Dot Vote onto the canvas.',
  },
  {
    id: 'ask-poll',
    name: 'Poll',
    shortName: 'Poll',
    ms: 6000,
    say: 'A Poll asks the room a question you write from its menu.',
    sayTouch: 'A Poll asks the room a question you write from its long-press menu.',
  },
  {
    id: 'ask-check',
    name: 'Check-In',
    shortName: 'Check',
    ms: 6000,
    say: 'A Temperature Check shows how the room feels, live.',
    sayTouch: 'A Temperature Check shows how the room feels, live.',
  },
];

export const DEMO_IDS = {
  vote: 'wib-ask-vote',
  poll: 'wib-ask-poll',
  check: 'wib-ask-check',
} as const;

// The Ask band's tiles, by their buttons' labels (palette-tile-defs.tsx: tools:session-vote, tools:session-poll,
// collab:temperature).
export const TILES = {
  vote: 'Add Dot Vote Button',
  poll: 'Add Poll Button',
  check: 'Add Temperature Check',
} as const;

// Each chapter's beats, in ms: open Ask, then carry its tile out (Ask closes as the carry leaves it).
export const VOTE = { open: 1000, carry: [2400, 4000] } as const;
export const POLL = { open: 900, carry: [2200, 3800] } as const;
export const CHECK = { open: 900, carry: [2200, 3800] } as const;

const CARRIES: readonly Carry[] = [
  { tile: TILES.vote, chapter: 0, at: VOTE.carry[0] },
  { tile: TILES.poll, chapter: 1, at: POLL.carry[0] },
  { tile: TILES.check, chapter: 2, at: CHECK.carry[0] },
];

export type AskLayout = TileMemory & {
  readonly vote: ShapeElement;
  readonly poll: ShapeElement;
  readonly check: ShapeElement;
};

const ASK = { id: 'bar-collab-ask', open: ['bar-collab-ask'] } as const;

export const ask: Topic<AskLayout> = {
  id: 'workshop-ask',
  chapters: CHAPTERS,

  layout({ centre, tab }) {
    // The Dot Vote (104 wide) and the Poll (240) side by side, the Temperature Check under them, drawn a little smaller
    // than a tap makes it (as a drag sizes it) so all three sit in about 370 x 365, above the player.
    const top = centre.y - 290;
    const left = centre.x - 184;
    const vote = placed<ShapeElement>(
      tab,
      DEMO_IDS.vote,
      { type: 'shape', kind: 'session-button', session: 'vote' },
      left + 52,
      top + 10,
    );
    const poll = placed<ShapeElement>(
      tab,
      DEMO_IDS.poll,
      { type: 'shape', kind: 'session-button', session: 'poll' },
      left + 248,
      top,
    );
    const check = placed<ShapeElement>(
      tab,
      DEMO_IDS.check,
      { type: 'shape', kind: 'temperature' },
      centre.x,
      top + 140,
      {
        width: 240,
        height: 225,
      },
    );
    return { vote, poll, check, tiles: {} };
  },

  measure: (layout, index, ms, screen) => learnTiles(layout, CARRIES, index, ms, screen),

  frame(index, ms, layout) {
    const i = Math.max(0, Math.min(index, CHAPTERS.length - 1));
    const { vote, poll, check, tiles } = layout;
    const beats = [VOTE, POLL, CHECK][i]!;
    const el = [vote, poll, check][i]!;
    const carry = carryAt(el, tiles[CARRIES[i]!.tile], ms, beats.carry);
    const before: Element[] = [vote, poll].slice(0, i);
    const open = within(ms, [[beats.open, beats.carry[0] + 200]]);
    return frameOf(carry.el ? [...before, carry.el] : before, {
      open: open ? [...ASK.open] : [],
      hold: carry.hold,
    });
  },

  plan(index) {
    const i = Math.max(0, Math.min(index, CHAPTERS.length - 1));
    const beats = [VOTE, POLL, CHECK][i]!;
    const id = [DEMO_IDS.vote, DEMO_IDS.poll, DEMO_IDS.check][i]!;
    const plan: Waypoint[] = [
      { at: beats.open, to: bar(ASK.id), press: true },
      { at: beats.carry[0], to: tile(CARRIES[i]!.tile), press: true },
      { at: beats.carry[1], to: { kind: 'element', id } },
    ];
    return plan;
  },
};
