import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  BARS_FAR_OPACITY_MIN,
  BARS_FAR_OPACITY_NEAR,
  barsOpacity,
  FULL_VOLUME_RADIUS_PX,
  gainAt,
  HEARING_RADIUS_PX,
  inEarshot,
  MAX_PAN,
  nextHeard,
  panAt,
  placeFor,
  reachOf,
  RELEASE_RADIUS_PX,
  togetherWith,
  walkTowards,
  withVoiceReach,
} from './hearing';
import { LECTERN_VOICE_REACH } from '@livehuddle/document';
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

// docs/specs/009-elements/venue-pieces.md "Speaking from the Podium", proximity-audio.md "Hearing": a voice from a
// Podium's speaker spot carries three times as far, walls block it as before, and it ends on stepping away.
describe('a voice from the podium', () => {
  const LECTERNS: ReadonlySet<string> = new Set(['podium']);
  const atPodium = (x: number, y = 0) => withVoiceReach({ x, y, seatedOn: 'podium' }, LECTERNS);

  it('reads its reach from the seat everyone shares, and only at a podium', () => {
    expect(LECTERN_VOICE_REACH).toBe(3);
    expect(reachOf(atPodium(0))).toBe(3);
    // Standing up, or sitting anywhere else, carries as far as anyone; the point is left as it was.
    const walking = { x: 0, y: 0, seatedOn: null };
    expect(withVoiceReach(walking, LECTERNS)).toBe(walking);
    expect(reachOf(withVoiceReach({ x: 0, y: 0, seatedOn: 'desk' }, LECTERNS))).toBe(1);
    expect(reachOf(withVoiceReach({ x: 0, y: 0, seatedOn: 'podium' }, undefined))).toBe(1);
    expect(reachOf(at(0))).toBe(1);
  });

  it('is heard three times as far: joining at three hearing radii, let go at three release radii', () => {
    const join = 3 * HEARING_RADIUS_PX;
    expect([...nextHeard(new Set(), at(0), new Map([['speaker', atPodium(join)]]))]).toEqual([
      'speaker',
    ]);
    expect([...nextHeard(new Set(), at(0), new Map([['speaker', atPodium(join + 1)]]))]).toEqual(
      [],
    );
    // The same spot off the podium is out of earshot.
    expect([...nextHeard(new Set(), at(0), new Map([['speaker', at(join)]]))]).toEqual([]);
    const prev = new Set(['speaker']);
    expect(nextHeard(prev, at(0), new Map([['speaker', atPodium(3 * RELEASE_RADIUS_PX)]]))).toBe(
      prev,
    );
    expect([
      ...nextHeard(prev, at(0), new Map([['speaker', atPodium(3 * RELEASE_RADIUS_PX + 1)]])),
    ]).toEqual([]);
  });

  it('fades over three times the distance, and stays as loud as a voice a third as far', () => {
    for (const d of [0, 90, 200, 270, 500, 800, 899])
      expect(placeFor(at(0), atPodium(d), 'open').gain, `${d}`).toBeCloseTo(gainAt(d / 3), 9);
    expect(placeFor(at(0), atPodium(3 * FULL_VOLUME_RADIUS_PX), 'open').gain).toBe(1);
    expect(placeFor(at(0), atPodium(3 * RELEASE_RADIUS_PX), 'open').gain).toBe(0);
    // A listener's own reach never changes how loud others are.
    expect(placeFor(atPodium(0), at(200), 'open').gain).toBe(gainAt(200));
  });

  it('tells the speaker they are heard three times as far', () => {
    const speaker = atPodium(0);
    expect(inEarshot(speaker, at(3 * HEARING_RADIUS_PX), 'open')).toBe(true);
    expect(inEarshot(speaker, at(3 * HEARING_RADIUS_PX + 1), 'open')).toBe(false);
    expect(inEarshot(at(0), at(3 * HEARING_RADIUS_PX), 'open')).toBe(false);
  });

  it('is still blocked by walls, however close', () => {
    const zones = roomZones([
      { id: 'hall', type: 'shape', shape: 'room', x: 0, y: 0, width: 1200, height: 600 },
    ]);
    // The speaker at a podium inside the hall; a listener just outside its front wall, well within three radii.
    const speaker = withVoiceReach({ x: 600, y: 560, seatedOn: 'podium' }, LECTERNS);
    const outside = { x: 600, y: 700 };
    const walkers = new Map([['speaker', speaker]]);
    const z = zoning(outside, walkers, zones);
    expect(togetherWith('speaker', z)).toBe('apart');
    expect([...nextHeard(new Set(), outside, walkers, z)]).toEqual([]);
    // From the speaker's side: the listener outside never hears them.
    const back = zoning(speaker, new Map([['outside', outside]]), zones);
    expect(inEarshot(speaker, outside, togetherWith('outside', back))).toBe(false);
    // Inside the hall, at twice the hearing radius, they are heard.
    const inside = { x: 600 - 2 * HEARING_RADIUS_PX, y: 560 };
    expect([...nextHeard(new Set(), inside, walkers, zoning(inside, walkers, zones))]).toEqual([
      'speaker',
    ]);
  });

  it('ends the moment they step away from it', () => {
    const prev = new Set(['speaker']);
    const away = withVoiceReach({ x: 700, y: 0, seatedOn: null }, LECTERNS);
    expect(reachOf(away)).toBe(1);
    expect([...nextHeard(prev, at(0), new Map([['speaker', away]]))]).toEqual([]);
    expect(placeFor(at(0), away, 'open').gain).toBe(0);
  });
});
