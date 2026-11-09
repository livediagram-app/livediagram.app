import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { reactionDuration } from '@livehuddle/avatar/reactions';
import {
  RECEPTIONIST_GREET_MS,
  RECEPTIONIST_HOME_EVERY,
  RECEPTIONIST_LEG_MS,
  receptionistRoute,
  receptionistStop,
  receptionistWorld,
  routeMs,
} from './receptionist-day';
import {
  bellDetour,
  greetDetour,
  leadDetour,
  releaseDetour,
  receptionistDayPose,
  receptionistNextChangeMs,
  receptionistPose,
  talkDetour,
} from './receptionist-timeline';

// docs/specs/008-canvas/receptionist.md "His day", "A greeting" and "Asking the Receptionist".

const shape = (id: string, kind: string, x: number, y: number, width = 60, height = 60) =>
  ({ id, type: 'shape', shape: kind, x, y, width, height }) as unknown as Element;

const pad = shape('pad-1', 'avatar-pad', 0, 0, 80, 80);
const world = receptionistWorld(
  [pad, shape('coffee', 'coffee-machine', 200, 0), shape('bed', 'pet-bed', -200, 0)],
  null,
)!;

/** The first leg at or after `from` whose stop matches. */
function legWhere(test: (n: number) => boolean, from = 0): number {
  for (let n = from; n < from + 500; n += 1) if (test(n)) return n;
  throw new Error('no such leg');
}

describe('receptionistDayPose', () => {
  it('walks from the last stop at the leg start, then stands at the stop', () => {
    const n = legWhere(
      (k) =>
        receptionistStop(world, k).activity === 'drink' &&
        receptionistStop(world, k - 1) === world.home,
    );
    const start = n * RECEPTIONIST_LEG_MS;
    const walking = receptionistDayPose(world, start + 100);
    expect(walking.walking).toBe(true);
    expect(walking.holding).toBeNull();
    expect(walking.activity).toBe('drink');
    const stop = receptionistStop(world, n);
    const there = receptionistDayPose(world, start + RECEPTIONIST_LEG_MS - 1);
    expect(there).toMatchObject({
      at: stop.at,
      walking: false,
      facing: 'up',
      activity: 'drink',
      reaction: null,
    });
    expect(there.holding).toBe(stop.drink);
    expect(there.encoreInMs).toBeUndefined();
  });

  it('pats the dog with a wave that comes round again', () => {
    const n = legWhere((k) => receptionistStop(world, k).activity === 'pat');
    const stop = receptionistStop(world, n);
    const from = receptionistStop(world, n - 1).at;
    const arrive = n * RECEPTIONIST_LEG_MS + routeMs(from, receptionistRoute(null, from, stop.at)!);
    const pose = receptionistDayPose(world, arrive + 10);
    expect(pose.reaction).toMatchObject({ kind: 'wave' });
    expect(pose.encoreInMs).toBeGreaterThan(0);
    const between = receptionistDayPose(world, arrive + reactionDuration('wave') + 10);
    expect(between.reaction).toBeNull();
  });

  it('does a flourish on the open floor', () => {
    const n = legWhere((k) => receptionistStop(world, k).activity === 'flourish');
    const pose = receptionistDayPose(world, (n + 1) * RECEPTIONIST_LEG_MS - 1);
    expect(pose.activity).toBe('flourish');
    expect(pose.encoreInMs).toBeGreaterThan(0);
  });

  it('picks up from where a detour left him within the same leg, but not from an earlier one', () => {
    const n = RECEPTIONIST_HOME_EVERY - 1;
    const start = n * RECEPTIONIST_LEG_MS;
    const away = { x: 400, y: 400 };
    const resumed = receptionistDayPose(world, start + 100, { at: away, from: start + 50 });
    expect(resumed.walking).toBe(true);
    expect(resumed.at.x).toBeGreaterThan(300);
    const earlier = receptionistDayPose(world, start + 100, { at: away, from: start - 50 });
    expect(earlier.at.x).toBeLessThan(300);
  });
});

describe('detours', () => {
  const t0 = 3 * RECEPTIONIST_LEG_MS + RECEPTIONIST_LEG_MS - 1; // standing home at the end of a home leg

  it('greets by the pad on his side, waves, holds, then goes back to his day', () => {
    const detour = greetDetour(world, t0, null);
    expect(detour.kind).toBe('greet');
    expect(detour.face).toBe('left');
    const route = detour.route;
    expect(route[route.length - 1]).toEqual({ x: 108, y: 40 });
    const arrived = t0 + routeMs(detour.from, route);
    const waving = receptionistPose(world, arrived + 10, detour);
    expect(waving).toMatchObject({
      walking: false,
      facing: 'left',
      activity: 'greet',
      reaction: { kind: 'wave' },
    });
    expect(
      receptionistPose(world, arrived + reactionDuration('wave') + 10, detour).reaction,
    ).toBeNull();
    expect(detour.until).toBe(arrived + RECEPTIONIST_GREET_MS);
    expect(receptionistPose(world, detour.until! + 1, detour).activity).not.toBe('greet');
  });

  it('greets from the left side, facing right, when he is left of the pad', () => {
    const away = {
      kind: 'talk' as const,
      startAt: 0,
      from: { x: -300, y: 40 },
      route: [],
      face: 'down' as const,
      until: null,
    };
    const detour = greetDetour(world, 1000, away);
    expect(detour.route[detour.route.length - 1]).toEqual({ x: -28, y: 40 });
    expect(detour.face).toBe('right');
    const walking = receptionistPose(world, 1100, detour);
    expect(walking).toMatchObject({ walking: true, activity: 'greet', facing: 'right' });
  });

  it('comes over to talk beside you on his side, and stays until released', () => {
    const you = { x: 600, y: 40 };
    const detour = talkDetour(world, t0, null, you);
    expect(detour.route[detour.route.length - 1]).toEqual({ x: 556, y: 40 });
    expect(detour.face).toBe('right');
    expect(detour.until).toBeNull();
    const later = t0 + 60_000;
    expect(receptionistPose(world, later, detour)).toMatchObject({
      at: { x: 556, y: 40 },
      activity: 'talk',
      walking: false,
    });
    const fromRight = talkDetour(world, t0, null, { x: -600, y: 40 });
    expect(fromRight.face).toBe('left');
    expect(fromRight.route[fromRight.route.length - 1]).toEqual({ x: -556, y: 40 });

    const released = releaseDetour(detour, later)!;
    expect(released.until).toBe(later);
    expect(receptionistPose(world, later + 10, released).activity).not.toBe('talk');
    // Releasing what has already ended, or nothing, changes nothing.
    expect(releaseDetour(released, later + 10)).toBe(released);
    expect(releaseDetour(null, later)).toBeNull();
  });

  it('leads you to a spot, facing it', () => {
    const detour = leadDetour(world, t0, null, { x: 900, y: 0 });
    expect(detour).toMatchObject({ kind: 'talk', face: 'up', until: null });
    expect(detour.route[detour.route.length - 1]).toEqual({ x: 900, y: 0 });
  });
});

describe('the reception bell', () => {
  const desk = { x: 300, y: 300, width: 120, height: 40 };

  it('walks behind the desk, faces whoever rang, waves, and holds as a greeting', () => {
    const at = 1_000;
    const detour = bellDetour(world, at, null, desk)!;
    expect(detour.kind).toBe('bell');
    expect(detour.route.at(-1)).toEqual({ x: 330, y: 260 });
    expect(detour.face).toBe('down');
    const arrive = at + routeMs(detour.from, detour.route);
    expect(detour.until).toBe(arrive + RECEPTIONIST_GREET_MS);
    const there = receptionistPose(world, arrive + 10, detour);
    expect(there).toMatchObject({ at: { x: 330, y: 260 }, walking: false, activity: 'greet' });
    expect(there.reaction?.kind).toBe('wave');
  });

  it('stands beside its front when behind is walled off, and gives up on a desk he cannot reach', () => {
    const behind = { x: 330, y: 260 };
    const front = { x: 448, y: 368 };
    const blocked = (to: { x: number; y: number }) => to.x === behind.x && to.y === behind.y;
    const walled = { ...world, grid: null };
    const route = (to: { x: number; y: number }) => (blocked(to) ? null : [to]);
    const beside = bellDetour(walled, 1_000, null, desk, route)!;
    expect(beside.route.at(-1)).toEqual(front);
    expect(beside.face).toBe('left');
    expect(bellDetour(walled, 1_000, null, desk, () => null)).toBeNull();
  });
});

describe('receptionistNextChangeMs', () => {
  const standing = {
    at: { x: 0, y: 0 },
    facing: 'down' as const,
    walking: false,
    stepFrame: 0,
    holding: null,
    reaction: null,
    activity: 'home' as const,
  };

  it('draws every frame while he walks or plays a reaction', () => {
    expect(receptionistNextChangeMs({ ...standing, walking: true }, 0, null)).toBe(0);
    expect(
      receptionistNextChangeMs({ ...standing, reaction: { kind: 'wave', elapsedMs: 0 } }, 0, null),
    ).toBe(0);
  });

  it('standing, wakes at the next leg, the detour end or the next encore, whichever is first', () => {
    expect(receptionistNextChangeMs(standing, 1000, null)).toBe(RECEPTIONIST_LEG_MS - 1000);
    const detour = {
      kind: 'greet' as const,
      startAt: 0,
      from: { x: 0, y: 0 },
      route: [],
      face: 'down' as const,
      until: 1500,
    };
    expect(receptionistNextChangeMs(standing, 1000, detour)).toBe(500);
    expect(receptionistNextChangeMs({ ...standing, encoreInMs: 200 }, 1000, detour)).toBe(200);
    expect(receptionistNextChangeMs(standing, 2000, detour)).toBe(RECEPTIONIST_LEG_MS - 2000);
    expect(receptionistNextChangeMs(standing, RECEPTIONIST_LEG_MS - 0.5, null)).toBe(1);
  });
});
