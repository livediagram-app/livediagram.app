import { describe, expect, it } from 'vitest';
import {
  BARS_FAR_OPACITY_MIN,
  BARS_FAR_OPACITY_NEAR,
  barsOpacity,
  gainAt,
  HEARING_RADIUS_PX,
  MAX_PAN,
  nextHeard,
  panAt,
  RELEASE_RADIUS_PX,
  walkTowards,
} from './hearing';

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
