import { describe, expect, it } from 'vitest';
import {
  AVATAR_PAD_ARRIVAL_MS,
  AVATAR_PAD_MAX_ARRIVALS,
  avatarPads,
  nextArrivals,
  padEntry,
  padUnderFeet,
  pickSpawnPad,
  type PadArrival,
} from './pad';
import { avatarPadCore } from './pad-art';

// livediagram's docs/specs/009-elements/avatar-pad.md, on plain elements (each product tests its own pads too).
const pad = (id: string, x: number, y: number) =>
  ({ id, type: 'shape', shape: 'avatar-pad', x, y, width: 128, height: 80 }) as const;
const square = {
  id: 'sq',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 50,
  height: 50,
} as const;
const arrow = { id: 'ar', type: 'arrow' } as const;

describe('the pads on a board', () => {
  it('picks out the Avatar Pads in layer order', () => {
    const a = pad('a', 0, 0);
    const b = pad('b', 500, 0);
    expect(avatarPads([a, square, arrow, b]).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('starts on the pad nearest the view’s centre, the first on a tie, and the first with no view', () => {
    const a = pad('a', 0, 0);
    const b = pad('b', 500, 0);
    expect(pickSpawnPad([a, b], { x: 600, y: 40 })?.id).toBe('b');
    expect(pickSpawnPad([a, b], null)?.id).toBe('a');
    expect(pickSpawnPad([a, pad('a2', 0, 0)], avatarPadCore(a))?.id).toBe('a');
    expect(pickSpawnPad([], { x: 0, y: 0 })).toBeNull();
  });

  it('enters on a pad, recentring when it is off screen, and not at all on a board with none', () => {
    const a = pad('a', 0, 0);
    const entry = padEntry([square, a], { x: 0, y: 0 }, () => false);
    expect(entry).toMatchObject({ pad: { id: 'a' }, feet: avatarPadCore(a), recentre: true });
    expect(padEntry([a], null, () => true)?.recentre).toBe(false);
    expect(padEntry([square], null, () => true)).toBeNull();
  });

  it('finds the pad under the feet, the frontmost winning, and skips a pad of no size', () => {
    const a = pad('a', 0, 0);
    const b = pad('b', 0, 0);
    expect(padUnderFeet([a, b], avatarPadCore(a))?.id).toBe('b');
    expect(padUnderFeet([a], { x: 1000, y: 1000 })).toBeNull();
    expect(padUnderFeet([{ ...a, width: 0, height: 0 }], { x: 0, y: 0 })).toBeNull();
  });
});

describe('nextArrivals', () => {
  const a = pad('a', 0, 0);
  const core = avatarPadCore(a);
  const person = (id: string, at = core) => ({ id, x: at.x, y: at.y, color: '#0ea5e9' });

  it('starts a beam for a character that appears on a pad, and none for one already seen', () => {
    const next = nextArrivals({
      arrivals: [],
      seen: new Set(['old']),
      present: [person('new'), person('old'), person('off', { x: 900, y: 900 })],
      pads: [a],
      now: 10,
    });
    expect(next.map((x) => x.personId)).toEqual(['new']);
  });

  it('replaces a person’s beam, drops finished ones and keeps at most the cap', () => {
    const old: PadArrival = {
      key: 'p:0',
      personId: 'p',
      padId: 'a',
      ...core,
      color: '#000',
      startedAt: 0,
    };
    const next = nextArrivals({
      arrivals: [old],
      seen: new Set(),
      present: [person('p')],
      pads: [a],
      now: 5,
    });
    expect(next).toHaveLength(1);
    expect(next[0]!.startedAt).toBe(5);
    const expired = nextArrivals({
      arrivals: [old],
      seen: new Set(),
      present: [],
      pads: [],
      now: AVATAR_PAD_ARRIVAL_MS,
    });
    expect(expired).toEqual([]);
    const crowd = Array.from({ length: AVATAR_PAD_MAX_ARRIVALS + 3 }, (_, i) => person(`c${i}`));
    const capped = nextArrivals({
      arrivals: [],
      seen: new Set(),
      present: crowd,
      pads: [a],
      now: 1,
    });
    expect(capped).toHaveLength(AVATAR_PAD_MAX_ARRIVALS);
    expect(capped[0]!.personId).toBe('c3');
  });

  it('hands back the same array when nothing changed', () => {
    const arrivals: PadArrival[] = [];
    expect(nextArrivals({ arrivals, seen: new Set(), present: [], pads: [a], now: 1 })).toBe(
      arrivals,
    );
  });
});
