import { describe, expect, it } from 'vitest';
import {
  furnitureFrame,
  OFFICE_ART,
  type FurniturePart,
  type GridOfficeKind,
} from '@livehuddle/document';
import { hasMoment, MOMENT_KINDS, type MomentKind } from './piece-moments';
import {
  drawsOverMoment,
  PART_MOTIONS,
  playsOnFace,
  partMotionsOf,
  partMotionStyle,
  waveDelay,
  WAVE_S,
  wholeMotionOf,
} from './piece-moment-motions';

// docs/specs/009-elements/piece-moments.md and its blueprint's "Presentation and UX": the parts each moment moves.
const front = (kind: MomentKind) => furnitureFrame(OFFICE_ART[kind as GridOfficeKind], 'n');
const partOf = (kind: MomentKind, i: number): FurniturePart | undefined =>
  front(kind).view.parts[i];
const fillOf = (p: FurniturePart | undefined) => (p && 'fill' in p ? p.fill : undefined);

// What each moving part is, so a change to a drawing that moves a part fails here, not on screen.
const IS: Partial<Record<MomentKind, (i: number, p: FurniturePart) => boolean>> = {
  // Books: coloured panels on the shelves, below the top shelf's board.
  bookshelf: (_, p) =>
    p.tag === 'rect' && p.role === 'panel' && p.y > 47 && fillOf(p) !== undefined,
  // The glasses: the pale panels standing on the bar top.
  bar: (_, p) => p.tag === 'rect' && fillOf(p) === '#e2e8f0',
  // The cue ball, and the six balls of the rack.
  'pool-table': (i, p) => p.tag === 'ellipse' && (i === 17 ? fillOf(p) === '#f8fafc' : p.cx > 130),
  'foosball-table': (i, p) =>
    i === 8
      ? p.tag === 'ellipse' && fillOf(p) === '#f8fafc'
      : p.tag === 'path' && p.role === 'mark',
  printer: (i, p) =>
    i === 12 ? p.tag === 'ellipse' : fillOf(p) === '#ffffff' || p.role === 'rail',
  copier: (_, p) => fillOf(p) === '#38bdf8',
  'kitchen-counter': (_, p) => p.tag === 'rect' && p.y >= 43,
  'bike-rack': (_, p) => p.tag === 'path' && p.role === 'rail',
  'umbrella-stand': (_, p) => p.tag === 'path' && (p.role === 'panel' || p.role === 'line'),
  'coat-rack': (i, p) => (i >= 10 ? fillOf(p) === '#57534e' : p.tag === 'path'),
  podium: (i, p) =>
    p.tag === 'ellipse' && (i === 11 ? fillOf(p) === '#1f2937' : fillOf(p) === '#ef4444'),
  // The ropes and the spreader bars (lines), the sling and its band (the striped panels).
  hammock: (i, p) =>
    p.tag === 'path' &&
    (i === 3 || i === 6 ? p.role === 'line' : fillOf(p) === '#38bdf8' || fillOf(p) === '#fb923c'),
  // The note in the slot, and the writing on it.
  'suggestion-box': (i, p) =>
    p.tag === 'path' &&
    (i === 9 ? p.role === 'panel' && p.d.startsWith('M26 22') : p.role === 'rail'),
};

describe('the part motions', () => {
  it('belong only to moment kinds, each a real part of its front drawing', () => {
    for (const kind of Object.keys(PART_MOTIONS) as MomentKind[]) {
      expect(hasMoment(kind)).toBe(true);
      const [, , w, h] = front(kind).viewBox.split(' ').map(Number) as [
        number,
        number,
        number,
        number,
      ];
      for (const m of partMotionsOf(kind)) {
        const p = partOf(kind, m.part);
        expect(p, `${kind} part ${m.part}`).toBeDefined();
        expect(p!.role, `${kind} part ${m.part}`).not.toBe('shadow');
        const is = IS[kind];
        if (is) expect(is(m.part, p!), `${kind} part ${m.part}`).toBe(true);
        if (m.pivot) {
          expect(m.pivot[0]).toBeGreaterThanOrEqual(0);
          expect(m.pivot[0]).toBeLessThanOrEqual(w);
          expect(m.pivot[1]).toBeGreaterThanOrEqual(0);
          expect(m.pivot[1]).toBeLessThanOrEqual(h);
        }
      }
    }
    expect(partMotionsOf('chair')).toEqual([]);
  });

  it('draws over every kind but the six whose own parts are the whole moment and the three faces', () => {
    const notOver = MOMENT_KINDS.filter((k) => !drawsOverMoment(k));
    const onFace = MOMENT_KINDS.filter(playsOnFace);
    expect(onFace).toEqual(['notice-board', 'world-clock', 'calendar-wall']);
    const movesOnly = notOver.filter((k) => !playsOnFace(k));
    expect(movesOnly).toEqual([
      'bookshelf',
      'pool-table',
      'coat-rack',
      'kitchen-counter',
      'stage-curtains',
      'hammock',
    ]);
    for (const k of movesOnly) expect(partMotionsOf(k).length).toBeGreaterThan(0);
    for (const k of onFace) expect(partMotionsOf(k)).toEqual([]);
  });

  it('turns a wave into delays from your end, and a pivot into a view-box origin', () => {
    expect(waveDelay(0, -1, 120)).toBe(0);
    expect(waveDelay(120, -1, 120)).toBe(WAVE_S);
    expect(waveDelay(120, 1, 120)).toBe(0);
    const style = partMotionStyle(
      {
        part: 1,
        motion: 'swing',
        pivot: [15, 36],
        delay: 0.1,
        wave: 20,
        vars: { '--swing': '6deg' },
      },
      1,
      40,
    ) as Record<string, string>;
    expect(style['--swing']).toBe('6deg');
    expect(style['--delay']).toBe(`${0.1 + WAVE_S / 2}s`);
    expect(style.transformBox).toBe('view-box');
    expect(style.transformOrigin).toBe('15px 36px');
    expect(
      (partMotionStyle({ part: 0, motion: 'wink' }, -1, 40) as Record<string, string>)
        .transformOrigin,
    ).toBeUndefined();
  });
});

describe('the whole drawing', () => {
  it('sways a tree and rustles a plant at every facing, nudges any other turned piece', () => {
    expect(wholeMotionOf('tree', false)).toBe('sway');
    expect(wholeMotionOf('plant', false)).toBe('rustle');
    expect(wholeMotionOf('outdoor-plant', true)).toBe('rustle');
    expect(wholeMotionOf('bookshelf', false)).toBe('nudge');
    expect(wholeMotionOf('fireplace', false)).toBe('nudge');
  });

  it('thunks the dartboard, rattles the lockers and hums the hand dryer on the front, else nothing', () => {
    expect(wholeMotionOf('dartboard', true)).toBe('thunk');
    expect(wholeMotionOf('lockers', true)).toBe('rattle');
    expect(wholeMotionOf('hand-dryer', true)).toBe('hum');
    expect(wholeMotionOf('kettle', true)).toBeNull();
  });

  it('keeps the art still where the live face plays the moment, at every facing', () => {
    for (const kind of ['notice-board', 'world-clock', 'calendar-wall'] as const) {
      expect(wholeMotionOf(kind, true)).toBeNull();
      expect(wholeMotionOf(kind, false)).toBeNull();
    }
    expect(wholeMotionOf('hammock', false)).toBe('nudge');
  });
});
