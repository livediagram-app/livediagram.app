import type { Element, ShapeElement, StickyElement } from '@livediagram/document';
import { between, frameOf, lerp, type Chapter, type Topic, type Waypoint } from '../topic';
import {
  bar,
  carryAt,
  learnTiles,
  placed,
  railRow,
  tile,
  type Carry,
  type TileMemory,
} from './workshop-shared';

// Reactions and Reveals (docs/specs/007-editor/watch-it-built.md "The curriculum", Workshop): Session's React group
// gives a Confetti pad; its Tools group a Reveal Zone, drawn over two answers so they hide under its cover.

// The ids are read by the telemetry dashboard (computed-emitters.ts TOUR_STEP_SOURCE) as `TourStep<Id>`.
export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'reveal-react',
    name: 'Reactions',
    shortName: 'React',
    ms: 6500,
    say: 'Open Session, then React, and drop a pad that throws confetti for everyone.',
    sayTouch: 'Tap Session, then React, and drag out a pad that throws confetti for everyone.',
  },
  {
    id: 'reveal-cover',
    name: 'Reveal',
    shortName: 'Hide',
    ms: 8000,
    say: 'Pick a Reveal Zone and drag it over answers to hide them until you show them.',
    sayTouch: 'Tap a Reveal Zone and drag it over answers to hide them until you show them.',
  },
];

export const DEMO_IDS = {
  pad: 'wib-reveal-pad',
  answers: ['wib-reveal-a', 'wib-reveal-b'],
  cover: 'wib-reveal-cover',
} as const;

// The tiles, by their buttons' labels (palette-tile-defs.tsx tools:reaction-confetti, tools:reveal).
export const TILES = { pad: 'Add Confetti Pad', cover: 'Add Reveal Zone' } as const;

// Session's rail (session-category.tsx SESSION_GROUP_IDS): Tools first, React third.
const SESSION = 'session tools';

export const REACT = { open: 900, group: 1700, carry: [2500, 4000] } as const;
// The Reveal Zone's tile arms a draw (useElementCreation.ts addShape); the zone is then dragged out on the canvas.
export const COVER = { open: 900, group: 1600, pick: 2400, drag: [3300, 5200] } as const;

const CARRIES: readonly Carry[] = [{ tile: TILES.pad, chapter: 0, at: REACT.carry[0] }];

export type RevealLayout = TileMemory & {
  readonly pad: ShapeElement;
  readonly answers: readonly StickyElement[];
  readonly cover: ShapeElement;
};

export const reveal: Topic<RevealLayout> = {
  id: 'workshop-reveal',
  chapters: CHAPTERS,

  layout({ centre, tab }) {
    // The pad on top, the two answers under it with the cover over them and 16 round: about 290 x 300.
    const pad = placed<ShapeElement>(
      tab,
      DEMO_IDS.pad,
      { type: 'shape', kind: 'reaction-pad', reaction: 'confetti' },
      centre.x,
      centre.y - 270,
    );
    const size = 120;
    const top = centre.y - 110;
    const answers = ['Answer: Paris', 'Answer: 1969'].map((label, i) => ({
      ...placed<StickyElement>(
        tab,
        DEMO_IDS.answers[i]!,
        { type: 'sticky' },
        centre.x + (i === 0 ? -68 : 68),
        top,
        {
          width: size,
          height: size,
        },
      ),
      label,
    }));
    const cover = placed<ShapeElement>(
      tab,
      DEMO_IDS.cover,
      { type: 'shape', kind: 'reveal' },
      centre.x,
      top - 16,
      {
        width: 2 * size + 16 + 32,
        height: size + 32,
      },
    );
    return { pad, answers, cover, tiles: {} };
  },

  measure: (layout, index, ms, screen) => learnTiles(layout, CARRIES, index, ms, screen),

  frame(index, ms, layout) {
    const i = Math.max(0, Math.min(index, CHAPTERS.length - 1));
    const { pad, answers, cover, tiles } = layout;
    if (i === 0) {
      const c = carryAt(pad, tiles[TILES.pad], ms, REACT.carry);
      const open: string[] = [];
      if (ms >= REACT.open && ms < REACT.carry[0] + 200) open.push('bar-session');
      if (ms >= REACT.group && ms < REACT.carry[0] + 200) open.push('session-react');
      return frameOf([...answers, ...(c.el ? [c.el] : [])], { open, hold: c.hold });
    }
    const els: Element[] = [pad, ...answers];
    let hold = null;
    if (ms >= COVER.drag[0]) {
      // Dragged out from its top left corner, its far corner under the cursor.
      const p = between(ms, COVER.drag[0], COVER.drag[1]);
      const width = lerp(16, cover.width, p);
      const height = lerp(16, cover.height, p);
      els.push({ ...cover, width, height });
      if (ms < COVER.drag[1]) hold = { x: cover.x + width, y: cover.y + height };
    }
    const open: string[] = [];
    if (ms >= COVER.open && ms < COVER.pick + 200) open.push('bar-session');
    if (ms >= COVER.group && ms < COVER.pick + 200) open.push('session-tools');
    return frameOf(els, { open, hold });
  },

  plan(index, layout) {
    const i = Math.max(0, Math.min(index, CHAPTERS.length - 1));
    if (i === 0)
      return [
        { at: REACT.open, to: bar('bar-session'), press: true },
        { at: REACT.group, to: railRow(SESSION, 3), press: true },
        { at: REACT.carry[0], to: tile(TILES.pad), press: true },
        { at: REACT.carry[1], to: { kind: 'element', id: DEMO_IDS.pad } },
      ];
    const { cover } = layout;
    const plan: Waypoint[] = [
      { at: COVER.open, to: bar('bar-session'), press: true },
      { at: COVER.group, to: railRow(SESSION, 1), press: true },
      { at: COVER.pick, to: tile(TILES.cover), press: true },
      { at: COVER.drag[0], to: { kind: 'canvas', x: cover.x, y: cover.y }, press: true },
      {
        at: COVER.drag[1],
        to: { kind: 'canvas', x: cover.x + cover.width, y: cover.y + cover.height },
      },
      { at: COVER.drag[1] + 1200, to: { kind: 'element', id: DEMO_IDS.cover } },
    ];
    return plan;
  },
};
