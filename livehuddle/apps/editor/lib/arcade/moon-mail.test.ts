import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { arcadeScoreCeiling, MOON_MAIL_SCORING } from '@livehuddle/document';
import {
  advance,
  angleBetween,
  FIRST_ROCK_MS,
  hop,
  hopForTap,
  HURT_MS,
  LETTERS_MAX,
  MAX_FRAME_MS,
  newRun,
  ORBITS,
  OUTER_ORBIT,
  ROCK_EVERY_MIN_MS,
  ROCK_LIFE_MS,
  rockEveryMs,
  ROCKS_MAX,
  SHIELDS,
  SHIP_SPEED_MAX,
  SHIP_SPEED_START,
  shipSpeed,
  START_ORBIT,
  STEP_MS,
  streakFor,
  wrapAngle,
  type MoonMailItem,
  type MoonMailRun,
} from './moon-mail';

// docs/specs/009-elements/social-pieces.md "Moon Mail"; blueprint "Moon Mail's model".

const steps = (run: MoonMailRun, n: number) => {
  for (let i = 0; i < n; i += 1) advance(run, STEP_MS);
};
// A run with nothing on it but what the test places.
const bare = (seed = 1): MoonMailRun => {
  const run = newRun(seed);
  run.items = [];
  run.nextRockAt = Number.POSITIVE_INFINITY;
  run.letterSteps = Number.NEGATIVE_INFINITY;
  return run;
};
const place = (run: MoonMailRun, it: Partial<MoonMailItem> & Pick<MoonMailItem, 'kind'>) => {
  run.items.push({ orbit: run.orbit, angle: run.angle, speed: 0, age: 0, ...it });
};
// A tiny autopilot: hop off a rock coming on the ship's orbit, else toward the nearest letter ahead.
function autopilot(run: MoonMailRun): void {
  let rockAhead = Number.POSITIVE_INFINITY;
  let letter: MoonMailItem | null = null;
  let letterAhead = Number.POSITIVE_INFINITY;
  for (const it of run.items) {
    const ahead = wrapAngle(it.angle - run.angle);
    if (it.kind === 'rock' && it.orbit === run.orbit) rockAhead = Math.min(rockAhead, ahead);
    if (it.kind === 'letter' && ahead < letterAhead) {
      letterAhead = ahead;
      letter = it;
    }
  }
  if (rockAhead < 0.6) {
    if (!hop(run, 'out')) hop(run, 'in');
  } else if (letter && letter.orbit !== run.orbit) {
    hop(run, letter.orbit > run.orbit ? 'out' : 'in');
  }
}

describe('a new run', () => {
  it('starts at the top of the middle orbit with three shields and three letters ahead', () => {
    const run = newRun(42);
    expect(run.orbit).toBe(START_ORBIT);
    expect(run.angle).toBeCloseTo((3 * Math.PI) / 2);
    expect(run.shields).toBe(SHIELDS);
    expect(run.score).toBe(0);
    expect(run.items).toHaveLength(MOON_MAIL_SCORING.startLetters);
    for (const it of run.items) {
      expect(it.kind).toBe('letter');
      expect(it.orbit).toBeGreaterThanOrEqual(0);
      expect(it.orbit).toBeLessThanOrEqual(OUTER_ORBIT);
    }
  });
  it('replays the same run from the same seed and hops', () => {
    const play = (seed: number) => {
      const run = newRun(seed);
      for (let i = 0; i < 3_000 && !run.over; i += 1) {
        if (i % 37 === 0) hop(run, i % 2 ? 'out' : 'in');
        advance(run, STEP_MS);
      }
      return [run.score, run.shields, run.ms, run.letters, run.hits, run.items.length];
    };
    expect(play(7)).toEqual(play(7));
    expect(play(7)).not.toEqual(play(8));
  });
});

describe('angles', () => {
  it('wraps into [0, 2π) and measures the short way round', () => {
    expect(wrapAngle(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2);
    expect(wrapAngle(5 * Math.PI)).toBeCloseTo(Math.PI);
    expect(angleBetween(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2);
    expect(angleBetween(2 * Math.PI - 0.1, 0.1)).toBeCloseTo(-0.2);
  });
});

describe('the pace', () => {
  it('speeds the ship up each second, to its cap', () => {
    expect(shipSpeed(0)).toBe(SHIP_SPEED_START);
    expect(shipSpeed(10_000)).toBeCloseTo(SHIP_SPEED_START + 0.15);
    expect(shipSpeed(1_000_000)).toBe(SHIP_SPEED_MAX);
  });
  it('sends rocks more often as the run goes on, to a floor', () => {
    expect(rockEveryMs(0)).toBe(2_600);
    expect(rockEveryMs(60_000)).toBe(1_700);
    expect(rockEveryMs(1_000_000)).toBe(ROCK_EVERY_MIN_MS);
  });
  it('moves the ship clockwise and the rocks the other way', () => {
    const run = bare();
    place(run, { kind: 'rock', orbit: 0, angle: 1, speed: 0.6 });
    const ship = run.angle;
    steps(run, 6);
    expect(angleBetween(run.angle, ship)).toBeGreaterThan(0);
    expect(run.items[0]!.angle).toBeLessThan(1);
  });
});

describe('advance', () => {
  it('plays whole steps, carrying the rest to the next frame', () => {
    const run = bare();
    expect(advance(run, STEP_MS * 2.5)).toBe(2);
    expect(advance(run, STEP_MS * 0.5)).toBe(1);
    expect(run.steps).toBe(3);
    expect(run.ms).toBe(50);
  });
  it('never plays more than a capped frame, nor a negative one', () => {
    const run = bare();
    // 250 ms is 15 steps.
    expect(advance(run, 10_000)).toBe(Math.round(MAX_FRAME_MS / STEP_MS));
    expect(advance(run, -50)).toBe(0);
  });
  it('plays nothing once over', () => {
    const run = bare();
    run.over = true;
    expect(advance(run, 100)).toBe(0);
    expect(hop(run, 'out')).toBe(false);
  });
});

describe('hops', () => {
  it('moves one orbit at a time and stops at either end', () => {
    const run = bare();
    expect(hop(run, 'out')).toBe(true);
    expect(run.orbit).toBe(OUTER_ORBIT);
    expect(hop(run, 'out')).toBe(false);
    expect(hop(run, 'in')).toBe(true);
    expect(hop(run, 'in')).toBe(true);
    expect(run.orbit).toBe(0);
    expect(hop(run, 'in')).toBe(false);
  });
  it('records when it hopped, for the glide', () => {
    const run = bare();
    steps(run, 3);
    hop(run, 'in');
    expect(run.hopAt).toBe(run.ms);
  });
  it('reads a tap outside the orbit as out and inside as in', () => {
    const run = bare();
    expect(hopForTap(run, 0.5, 0.5 - ORBITS[START_ORBIT] - 0.05)).toBe('out');
    expect(hopForTap(run, 0.5, 0.5 - ORBITS[START_ORBIT] + 0.05)).toBe('in');
    expect(hopForTap(run, 0.9, 0.9)).toBe('out');
  });
});

describe('letters', () => {
  it('collects a letter the ship flies through, at its streak', () => {
    const run = bare();
    place(run, { kind: 'letter', angle: run.angle + 0.05 });
    steps(run, 3);
    expect(run.score).toBe(MOON_MAIL_SCORING.letterPoints);
    expect(run.streak).toBe(1);
    expect(run.letters).toBe(1);
    expect(run.items).toHaveLength(0);
  });
  it('leaves a letter on another orbit', () => {
    const run = bare();
    place(run, { kind: 'letter', orbit: 0, angle: run.angle + 0.05 });
    steps(run, 3);
    expect(run.score).toBe(0);
    expect(run.items).toHaveLength(1);
  });
  it('raises the streak every five letters, to ×5', () => {
    expect([0, 4, 5, 9, 10, 19, 20, 99].map(streakFor)).toEqual([1, 1, 2, 2, 3, 4, 5, 5]);
    const run = bare();
    run.streak = 12;
    place(run, { kind: 'letter', angle: run.angle + 0.05 });
    steps(run, 3);
    expect(run.score).toBe(30);
  });
  it('brings a new letter at most every 0.9 seconds, never more than five waiting, on the far side', () => {
    const run = newRun(3);
    run.nextRockAt = Number.POSITIVE_INFINITY;
    run.orbit = -1; // collects nothing
    let lastCount = run.items.length;
    let lastSpawn = 0;
    for (let i = 0; i < 1_200; i += 1) {
      steps(run, 1);
      const n = run.items.length;
      expect(n).toBeLessThanOrEqual(LETTERS_MAX);
      if (n > lastCount) {
        expect(run.ms - lastSpawn).toBeGreaterThanOrEqual(MOON_MAIL_SCORING.letterEveryMs);
        const newest = run.items[n - 1]!;
        expect(Math.abs(angleBetween(newest.angle, run.angle))).toBeGreaterThanOrEqual(
          Math.PI / 2 - 1e-9,
        );
        lastSpawn = run.ms;
      }
      lastCount = n;
    }
    expect(lastCount).toBe(LETTERS_MAX);
  });
});

describe('rocks', () => {
  it('takes a shield, ends the streak and blinks the ship', () => {
    const run = bare();
    run.streak = 7;
    place(run, { kind: 'rock', angle: run.angle + 0.05, speed: 0.5 });
    steps(run, 2);
    expect(run.shields).toBe(SHIELDS - 1);
    expect(run.streak).toBe(0);
    expect(run.hits).toBe(1);
    expect(run.hurtUntil).toBeGreaterThan(run.ms);
    expect(run.hurtUntil).toBeLessThanOrEqual(run.ms + HURT_MS);
    expect(run.items).toHaveLength(0);
  });
  it('passes through the ship while it blinks', () => {
    const run = bare();
    run.hurtUntil = 10_000;
    place(run, { kind: 'rock', angle: run.angle + 0.02, speed: 0.5 });
    steps(run, 2);
    expect(run.shields).toBe(SHIELDS);
    expect(run.items).toHaveLength(1);
  });
  it('ends the run with the last shield', () => {
    const run = bare();
    run.shields = 1;
    place(run, { kind: 'rock', angle: run.angle + 0.02, speed: 0.5 });
    place(run, { kind: 'letter', angle: run.angle + 0.03 });
    steps(run, 2);
    expect(run.over).toBe(true);
    expect(run.shields).toBe(0);
    expect(advance(run, 100)).toBe(0);
  });
  it('fades a rock that has drifted its life', () => {
    const run = bare();
    place(run, { kind: 'rock', orbit: 0, angle: 3, speed: 0.5, age: ROCK_LIFE_MS - STEP_MS / 2 });
    steps(run, 1);
    expect(run.items).toHaveLength(0);
  });
  it('sends the first rock two seconds in, on the far side, then more, never more than seven', () => {
    const run = newRun(5);
    run.items = [];
    run.letterSteps = Number.NEGATIVE_INFINITY;
    run.orbit = -1;
    steps(run, Math.floor(FIRST_ROCK_MS / STEP_MS) - 2);
    expect(run.items).toHaveLength(0);
    steps(run, 3);
    expect(run.items).toHaveLength(1);
    const rock = run.items[0]!;
    expect(Math.abs(angleBetween(rock.angle, run.angle))).toBeGreaterThan(Math.PI - 0.6);
    expect(rock.speed).toBeGreaterThanOrEqual(0.5);
    expect(rock.speed).toBeLessThanOrEqual(0.9);
    for (let i = 0; i < 3_000; i += 1) {
      steps(run, 1);
      expect(run.items.length).toBeLessThanOrEqual(ROCKS_MAX);
    }
  });
  it('never walls off all three orbits with a new rock', () => {
    // Rocks on the inner two orbits near where the next one comes: whatever orbit it draws, it never takes the outer.
    const drawn = new Set<number>();
    for (let seed = 1; seed <= 24; seed += 1) {
      const run = bare(seed);
      run.orbit = -1;
      run.nextRockAt = 0;
      const far = run.angle + Math.PI;
      place(run, { kind: 'rock', orbit: 0, angle: far, speed: 0.0001 });
      place(run, { kind: 'rock', orbit: 1, angle: far, speed: 0.0001 });
      steps(run, 1);
      expect(run.items).toHaveLength(3);
      drawn.add(run.items[2]!.orbit);
      expect(run.items[2]!.orbit).not.toBe(2);
    }
    expect(drawn).toEqual(new Set([0, 1]));
  });
});

describe('the bound the room holds a score to', () => {
  it('is never passed, at any step of any run', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const run = newRun(seed);
      let hops = seed;
      for (let i = 0; i < 7_200 && !run.over; i += 1) {
        // A greedy player: the autopilot most of the time, a random hop now and then.
        hops = (hops * 1_103_515_245 + 12_345) | 0;
        if ((hops >>> 8) % 11 === 0) hop(run, (hops >>> 4) % 2 ? 'out' : 'in');
        else autopilot(run);
        advance(run, STEP_MS);
        expect(run.score).toBeLessThanOrEqual(arcadeScoreCeiling(run.ms));
      }
    }
  });
  it('is near enough to what a perfect run scores that it is a real bound', () => {
    const run = newRun(11);
    run.nextRockAt = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 3_600; i += 1) {
      autopilot(run);
      advance(run, STEP_MS);
    }
    expect(run.score).toBeGreaterThan(arcadeScoreCeiling(run.ms) * 0.3);
  });
});

describe('a frame loop', () => {
  it('plays ten minutes of Moon Mail in a sliver of CPU', () => {
    const ms = cpuMsOf(() => {
      let run = newRun(99);
      for (let frame = 0; frame < 36_000; frame += 1) {
        autopilot(run);
        advance(run, STEP_MS);
        if (run.over) run = newRun(frame);
      }
    });
    expect(ms).toBeLessThan(150);
  });
});
