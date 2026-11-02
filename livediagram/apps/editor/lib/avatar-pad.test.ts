import { describe, expect, it } from 'vitest';
import { avatarPadCore, createShape, type Element, type ShapeElement } from '@livediagram/document';
import {
  AVATAR_PAD_ARRIVAL_MS,
  AVATAR_PAD_MAX_ARRIVALS,
  avatarPads,
  nextArrivals,
  padEntry,
  padUnderFeet,
  pickSpawnPad,
  type PadArrival,
} from '@liveworkspace/avatar/pad';

// docs/specs/009-elements/avatar-pad.md
const pad = (id: string, x: number, y: number) =>
  ({ ...createShape('avatar-pad', x, y), id }) as ShapeElement;

describe('avatarPads', () => {
  it('keeps the pads in layer order and nothing else', () => {
    const square = { ...createShape('square', 0, 0), id: 'sq' } as Element;
    expect(avatarPads([pad('a', 0, 0), square, pad('b', 9, 9)]).map((p) => p.id)).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('pickSpawnPad', () => {
  it('is null on a tab without a pad', () => {
    expect(pickSpawnPad([], { x: 0, y: 0 })).toBeNull();
  });
  it('takes the pad whose core is nearest the view centre', () => {
    const a = pad('a', 0, 0);
    const b = pad('b', 1000, 1000);
    expect(pickSpawnPad([a, b], { x: 900, y: 950 })?.id).toBe('b');
    expect(pickSpawnPad([a, b], { x: 10, y: 10 })?.id).toBe('a');
  });
  it('breaks an exact tie by layer order, the furthest back first', () => {
    const a = pad('a', 0, 0);
    const b = pad('b', 200, 0);
    const mid = { x: (avatarPadCore(a).x + avatarPadCore(b).x) / 2, y: avatarPadCore(a).y };
    expect(pickSpawnPad([a, b], mid)?.id).toBe('a');
    expect(pickSpawnPad([b, a], mid)?.id).toBe('b');
  });
  it('takes the first pad when there is no view to measure from', () => {
    expect(pickSpawnPad([pad('a', 0, 0), pad('b', 1, 1)], null)?.id).toBe('a');
  });
});

describe('padEntry', () => {
  it('puts the feet on the core and recentres only when it is off screen', () => {
    const p = pad('p', 0, 0);
    expect(padEntry([p], null, () => true)).toEqual({
      pad: p,
      feet: avatarPadCore(p),
      recentre: false,
    });
    expect(padEntry([p], null, () => false)?.recentre).toBe(true);
    expect(padEntry([], null, () => true)).toBeNull();
  });
});

describe('padUnderFeet', () => {
  const p = pad('p', 100, 100);
  it('is the pad whose top face the feet are on', () => {
    expect(padUnderFeet([p], avatarPadCore(p))?.id).toBe('p');
    expect(padUnderFeet([p], { x: 0, y: 0 })).toBeNull();
  });
  it('prefers the frontmost of overlapping pads', () => {
    const q = pad('q', 100, 100);
    expect(padUnderFeet([p, q], avatarPadCore(p))?.id).toBe('q');
  });
  it('ignores a pad sized to nothing', () => {
    expect(padUnderFeet([{ ...p, width: 0 }], avatarPadCore(p))).toBeNull();
  });
});

describe('nextArrivals', () => {
  const p = pad('p', 100, 100);
  const core = avatarPadCore(p);
  const onPad = { id: 'ann', ...core, color: '#f43f5e' };
  const offPad = { id: 'bob', x: 0, y: 0, color: '#22c55e' };

  it('starts a beam for somebody who appears on a pad, in their colour, at their feet', () => {
    const next = nextArrivals({
      arrivals: [],
      seen: new Set(),
      present: [onPad],
      pads: [p],
      now: 5,
    });
    expect(next).toEqual([
      {
        key: 'ann:5',
        personId: 'ann',
        padId: 'p',
        x: core.x,
        y: core.y,
        color: '#f43f5e',
        startedAt: 5,
      },
    ]);
  });

  it('starts nothing for somebody already on screen, off a pad, or on a tab with no pads', () => {
    const none: readonly PadArrival[] = [];
    expect(
      nextArrivals({ arrivals: none, seen: new Set(['ann']), present: [onPad], pads: [p], now: 1 }),
    ).toBe(none);
    expect(
      nextArrivals({ arrivals: none, seen: new Set(), present: [offPad], pads: [p], now: 1 }),
    ).toBe(none);
    expect(
      nextArrivals({ arrivals: none, seen: new Set(), present: [onPad], pads: [], now: 1 }),
    ).toBe(none);
  });

  it('drops finished beams and replaces a person’s own', () => {
    const first = nextArrivals({
      arrivals: [],
      seen: new Set(),
      present: [onPad],
      pads: [p],
      now: 0,
    });
    const again = nextArrivals({
      arrivals: first,
      seen: new Set(),
      present: [onPad],
      pads: [p],
      now: 10,
    });
    expect(again.map((a) => a.key)).toEqual(['ann:10']);
    expect(
      nextArrivals({
        arrivals: again,
        seen: new Set(['ann']),
        present: [onPad],
        pads: [p],
        now: 10 + AVATAR_PAD_ARRIVAL_MS,
      }),
    ).toEqual([]);
  });

  it('plays at most AVATAR_PAD_MAX_ARRIVALS at once, oldest dropped first', () => {
    const crowd = Array.from({ length: AVATAR_PAD_MAX_ARRIVALS + 5 }, (_, i) => ({
      ...onPad,
      id: `p${i}`,
    }));
    const next = nextArrivals({ arrivals: [], seen: new Set(), present: crowd, pads: [p], now: 0 });
    expect(next).toHaveLength(AVATAR_PAD_MAX_ARRIVALS);
    expect(next.at(-1)?.personId).toBe(`p${AVATAR_PAD_MAX_ARRIVALS + 4}`);
  });
});
