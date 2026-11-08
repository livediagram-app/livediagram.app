import type { Element, ShapeElement, StickyElement } from '@livediagram/document';
import { frameOf, typedAt, type Chapter, type Topic, type Waypoint } from '../topic';
import {
  bar,
  carryAt,
  learnTiles,
  placed,
  railRow,
  tile,
  viewWidth,
  within,
  type Carry,
  type TileMemory,
} from './workshop-shared';

// Stickies and Stickers (docs/specs/007-editor/watch-it-built.md "The curriculum", Workshop): three stickies from
// Write, an idea typed on each, then two stickers from Stickers' Reactions dropped on them.

// The ids are read by the telemetry dashboard (computed-emitters.ts TOUR_STEP_SOURCE) as `TourStep<Id>`.
export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'stickies-add',
    name: 'Stickies',
    shortName: 'Notes',
    ms: 8500,
    say: 'Open Write in the palette and drag out a sticky for each idea.',
    sayTouch: 'Tap Write in the palette and drag out a sticky for each idea.',
  },
  {
    id: 'stickies-write',
    name: 'Write',
    shortName: 'Write',
    ms: 7500,
    say: 'Double-click a sticky to write on it.',
    sayTouch: 'Double-tap a sticky to write on it.',
  },
  {
    id: 'stickies-stickers',
    name: 'Stickers',
    shortName: 'React',
    ms: 7500,
    say: 'Open Stickers and drop one on a sticky to react to it.',
    sayTouch: 'Tap Stickers and drag one onto a sticky to react to it.',
  },
];

export const DEMO_IDS = {
  notes: ['wib-sticky-1', 'wib-sticky-2', 'wib-sticky-3'],
  thumbs: 'wib-sticker-thumbs',
  heart: 'wib-sticker-heart',
} as const;

export const NOTES = ['Ship sooner', 'More demos', 'Pair up'] as const;

// The tiles, by their buttons' labels: Write's Sticky Note (palette-tile-defs.tsx tools:sticky) and two of Stickers'
// Reactions (sticker-catalog.ts emoji-thumbs-up, emoji-heart).
export const TILES = { note: 'Add Sticky Note', thumbs: 'Thumbs up', heart: 'Red heart' } as const;

// Stickies: each one opens Write and carries its tile out (Write closes as the carry leaves it).
export const ADD = [0, 1, 2].map((i) => {
  const open = 900 + i * 2300;
  return { open, carry: [open + 900, open + 2000] as const };
});
// Write: each sticky is double-clicked, then typed on.
export const WRITE = [0, 1, 2].map((i) => ({
  select: 700 + i * 2300,
  type: [1000 + i * 2300, 2300 + i * 2300] as const,
}));
// Stickers: open it, pick Reactions on its rail, carry a sticker out; again for the second. Closing puts the rail
// back on its first group (replay-dom.ts byRailGroup), so each visit picks Reactions again.
export const STICK = [
  { open: 900, group: 1700, carry: [2500, 3700] as const },
  { open: 4100, group: 4800, carry: [5500, 6700] as const },
] as const;

const CARRIES: readonly Carry[] = [
  ...ADD.map((b) => ({ tile: TILES.note, chapter: 0, at: b.carry[0] })),
  { tile: TILES.thumbs, chapter: 2, at: STICK[0].carry[0] },
  { tile: TILES.heart, chapter: 2, at: STICK[1].carry[0] },
];

export type StickiesLayout = TileMemory & {
  readonly notes: readonly StickyElement[];
  readonly thumbs: ShapeElement;
  readonly heart: ShapeElement;
};

const blank = (s: StickyElement): StickyElement => ({ ...s, label: '' });

export const stickies: Topic<StickiesLayout> = {
  id: 'workshop-stickies',
  chapters: CHAPTERS,

  layout(env) {
    const { centre, tab } = env;
    // Three in a row, as large as a tap makes them would not fit a phone: as a drag sizes them, up to 150 square.
    const room = Math.min(560, viewWidth(env) - 40);
    const size = Math.max(96, Math.min(150, Math.floor((room - 48) / 3)));
    const left = centre.x - (size * 3 + 48) / 2;
    const top = centre.y - 200;
    const notes = NOTES.map((label, i) => ({
      ...placed<StickyElement>(
        tab,
        DEMO_IDS.notes[i]!,
        { type: 'sticky' },
        left + i * (size + 24) + size / 2,
        top,
        {
          width: size,
          height: size,
        },
      ),
      label,
    }));
    // A sticker on a sticky's top right corner, a little under half its size (a tap lands one at 104).
    const k = Math.round(size * 0.48);
    const corner = (n: StickyElement) => ({ cx: n.x + n.width - k * 0.3, top: n.y - k * 0.35 });
    const sticker = (id: string, stickerId: string, n: StickyElement) => {
      const { cx, top: y } = corner(n);
      return placed<ShapeElement>(tab, id, { type: 'shape', kind: 'sticker', stickerId }, cx, y, {
        width: k,
        height: k,
      });
    };
    return {
      notes,
      thumbs: sticker(DEMO_IDS.thumbs, 'emoji-thumbs-up', notes[0]!),
      heart: sticker(DEMO_IDS.heart, 'emoji-heart', notes[2]!),
      tiles: {},
    };
  },

  measure: (layout, index, ms, screen) => learnTiles(layout, CARRIES, index, ms, screen),

  frame(index, ms, layout) {
    const i = Math.max(0, Math.min(index, CHAPTERS.length - 1));
    const { notes, thumbs, heart, tiles } = layout;
    if (i === 0) {
      const els: Element[] = [];
      let hold = null;
      ADD.forEach((b, n) => {
        const c = carryAt(blank(notes[n]!), tiles[TILES.note], ms, b.carry);
        if (c.el) els.push(c.el);
        hold ??= c.hold;
      });
      const open = within(
        ms,
        ADD.map((b) => [b.open, b.carry[0] + 200] as const),
      );
      return frameOf(els, { open: open ? ['bar-write'] : [], hold });
    }
    if (i === 1) {
      const current = WRITE.findLastIndex((w) => ms >= w.select);
      const els = notes.map((n, k) =>
        k < current
          ? n
          : k > current
            ? blank(n)
            : { ...n, label: typedAt(n.label ?? '', ms, WRITE[k]!.type[0], WRITE[k]!.type[1]) },
      );
      const typing = current >= 0 && ms < WRITE[current]!.type[1] + 300;
      return frameOf(els, { selectedId: typing ? notes[current]!.id : null, typing });
    }
    const els: Element[] = [...notes];
    let hold = null;
    for (const [n, el] of [thumbs, heart].entries()) {
      const c = carryAt(el, tiles[n === 0 ? TILES.thumbs : TILES.heart], ms, STICK[n]!.carry);
      if (c.el) els.push(c.el);
      hold ??= c.hold;
    }
    const open: string[] = [];
    if (
      within(
        ms,
        STICK.map((s) => [s.open, s.carry[0] + 200] as const),
      )
    )
      open.push('bar-stickers');
    if (
      within(
        ms,
        STICK.map((s) => [s.group, s.carry[0] + 200] as const),
      )
    )
      open.push('stickers-reactions');
    return frameOf(els, { open, hold });
  },

  plan(index) {
    const i = Math.max(0, Math.min(index, CHAPTERS.length - 1));
    if (i === 0)
      return ADD.flatMap((b, n): Waypoint[] => [
        { at: b.open, to: bar('bar-write'), press: true },
        { at: b.carry[0], to: tile(TILES.note), press: true },
        { at: b.carry[1], to: { kind: 'element', id: DEMO_IDS.notes[n]! } },
      ]);
    if (i === 1)
      return WRITE.map((w, n): Waypoint => ({
        at: w.select,
        to: { kind: 'element', id: DEMO_IDS.notes[n]! },
        press: true,
      }));
    return STICK.flatMap((s, n): Waypoint[] => [
      { at: s.open, to: bar('bar-stickers'), press: true },
      { at: s.group, to: railRow('stickers', 2), press: true },
      { at: s.carry[0], to: tile(n === 0 ? TILES.thumbs : TILES.heart), press: true },
      { at: s.carry[1], to: { kind: 'element', id: n === 0 ? DEMO_IDS.thumbs : DEMO_IDS.heart } },
    ]);
  },
};
