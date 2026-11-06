import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  BARS_FAR_OPACITY_MIN,
  BARS_FAR_OPACITY_NEAR,
  barsOpacity,
  gainAt,
  HEARING_RADIUS_PX,
  inEarshot,
  MAX_PAN,
  nextHeard,
  panAt,
  placeFor,
  RELEASE_RADIUS_PX,
  togetherWith,
  walkTowards,
} from './hearing';
import { roomZones, zoning } from './zones';

const at = (x: number) => ({ x, y: 0 });
const peers = (entries: [string, number][]) => new Map(entries.map(([id, x]) => [id, at(x)]));

// docs/specs/012-collaboration/proximity-audio.md "Hearing".
describe('nextHeard', () => {
  it('hears a speaker inside the hearing radius and not one outside it', () => {
    const heard = nextHeard(
      new Set(),
      at(0),
      peers([
        ['near', 200],
        ['far', 280],
      ]),
    );
    expect([...heard]).toEqual(['near']);
  });

  it('keeps a heard speaker until the release radius, so the edge never flickers', () => {
    const prev = new Set(['sam']);
    expect(nextHeard(prev, at(0), peers([['sam', 290]]))).toBe(prev);
    expect([...nextHeard(prev, at(0), peers([['sam', RELEASE_RADIUS_PX + 1]]))]).toEqual([]);
  });

  it('returns the same set when nothing changed, and hears nobody without a character', () => {
    const prev = new Set(['a']);
    expect(nextHeard(prev, at(0), peers([['a', 10]]))).toBe(prev);
    expect([...nextHeard(prev, null, peers([['a', 10]]))]).toEqual([]);
  });
});

describe('gainAt and panAt', () => {
  it('is full close by, fades with equal power, and is silent at the release radius', () => {
    expect(gainAt(0)).toBe(1);
    expect(gainAt(90)).toBe(1);
    expect(gainAt(195)).toBeCloseTo(Math.SQRT1_2, 5);
    expect(gainAt(RELEASE_RADIUS_PX)).toBe(0);
    expect(gainAt(1000)).toBe(0);
  });

  it('pans by side, up to the most at the hearing radius, and centres straight ahead', () => {
    expect(panAt(0)).toBe(0);
    expect(Object.is(panAt(-0), 0)).toBe(true);
    expect(panAt(HEARING_RADIUS_PX)).toBe(MAX_PAN);
    expect(panAt(-2 * HEARING_RADIUS_PX)).toBe(-MAX_PAN);
    expect(panAt(HEARING_RADIUS_PX / 2)).toBeCloseTo(MAX_PAN / 2);
  });
});

describe('barsOpacity', () => {
  it('is full while heard, then fades with distance to a floor', () => {
    expect(barsOpacity(5000, true)).toBe(1);
    expect(barsOpacity(100, false)).toBe(BARS_FAR_OPACITY_NEAR);
    expect(barsOpacity(900, false)).toBeCloseTo(0.6);
    expect(barsOpacity(1500, false)).toBe(BARS_FAR_OPACITY_MIN);
  });
});

describe('walkTowards', () => {
  it('stops a short way short of the talker, and stays put when already there', () => {
    expect(walkTowards(at(0), at(500))).toEqual({ x: 440, y: 0 });
    expect(walkTowards(at(0), at(40))).toEqual(at(0));
  });
});

// docs/specs/012-collaboration/meeting-rooms-and-stage.md "Rooms are calls" (Work Tracker #319, #436): two rooms side
// by side along a corridor. Each room is 600 wide; their shared wall is at x = 600.
describe('rooms keep their walls', () => {
  const room = (id: string, x: number) => ({
    id,
    type: 'shape',
    shape: 'room',
    x,
    y: 0,
    width: 600,
    height: 400,
  });
  const zones = roomZones([room('west', 0), room('east', 600)]);
  const corridor = (x: number) => ({ x, y: 500 });
  const hear = (self: { x: number; y: number }, others: [string, { x: number; y: number }][]) => {
    const walkers = new Map(others);
    return [...nextHeard(new Set(), self, walkers, zoning(self, walkers, zones))];
  };

  it('hears by distance inside a room: a neighbour, not the opposite corner', () => {
    const self = { x: 20, y: 50 };
    const corner = { x: 580, y: 390 };
    const beside = { x: 220, y: 50 };
    expect(
      hear(self, [
        ['far', corner],
        ['near', beside],
      ]),
    ).toEqual(['near']);
    const z = zoning(self, new Map([['near', beside]]), zones);
    expect(togetherWith('near', z)).toBe('open');
    expect(placeFor(self, { x: 215, y: 50 }, 'open').gain).toBeCloseTo(Math.SQRT1_2, 5);
    expect(placeFor(self, beside, 'open').pan).toBeGreaterThan(0);
    expect(inEarshot(self, beside, 'open')).toBe(true);
    expect(inEarshot(self, corner, 'open')).toBe(false);
  });

  it('places a fellow stage speaker at full volume, by side', () => {
    expect(placeFor(at(0), at(580), 'room').gain).toBe(1);
    expect(placeFor(at(0), at(580), 'room').pan).toBe(MAX_PAN);
    expect(inEarshot(at(0), at(580), 'room')).toBe(true);
  });

  it('hears nothing through the wall from the room next door, however close', () => {
    expect(hear({ x: 590, y: 200 }, [['next door', { x: 610, y: 200 }]])).toEqual([]);
    expect(inEarshot({ x: 590, y: 200 }, { x: 610, y: 200 }, 'apart')).toBe(false);
  });

  it('hears nothing between the corridor and a room, either way', () => {
    // Just outside the front wall, and inside it.
    expect(hear(corridor(300), [['inside', { x: 300, y: 380 }]])).toEqual([]);
    expect(hear({ x: 300, y: 380 }, [['outside', corridor(300)]])).toEqual([]);
  });

  it('hears by distance in the corridor, exactly as in the open', () => {
    const heard = hear(corridor(0), [
      ['near', corridor(200)],
      ['far', corridor(280)],
    ]);
    expect(heard).toEqual(['near']);
    expect(
      togetherWith('near', zoning(corridor(0), new Map([['near', corridor(200)]]), zones)),
    ).toBe('open');
    expect(placeFor(corridor(0), corridor(195), 'open').gain).toBeCloseTo(Math.SQRT1_2, 5);
    expect(inEarshot(corridor(0), corridor(200), 'open')).toBe(true);
    expect(inEarshot(corridor(0), corridor(280), 'open')).toBe(false);
  });

  it('lets go of a room’s voices the moment you step out, with no release radius', () => {
    const inside = { x: 300, y: 380 };
    const walkers = new Map([['sam', { x: 310, y: 380 }]]);
    const prev = nextHeard(new Set(), inside, walkers, zoning(inside, walkers, zones));
    expect([...prev]).toEqual(['sam']);
    const out = corridor(300);
    expect([...nextHeard(prev, out, walkers, zoning(out, walkers, zones))]).toEqual([]);
  });

  it('without zoning, everyone is in the open', () => {
    expect(togetherWith('sam', undefined)).toBe('open');
  });

  it('zones and hears 100 walkers among 50 rooms within a frame’s budget', () => {
    const many = roomZones(Array.from({ length: 50 }, (_, i) => room(`r${i}`, i * 600)));
    const walkers = new Map(
      Array.from({ length: 100 }, (_, i) => [`p${i}`, { x: i * 300 + 50, y: 200 }] as const),
    );
    const self = { x: 60, y: 200 };
    let heard: ReadonlySet<string> = new Set();
    const best = Math.min(
      ...Array.from({ length: 5 }, () =>
        cpuMsOf(() => {
          for (let i = 0; i < 60; i++)
            heard = nextHeard(heard, self, walkers, zoning(self, walkers, many));
        }),
      ),
    );
    expect([...heard]).toEqual(['p0']);
    // 60 scenes, a second of walking: well under a frame each.
    expect(best).toBeLessThan(cpuBudgetMs(30));
  });
});
