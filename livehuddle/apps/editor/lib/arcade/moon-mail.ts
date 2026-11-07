// Moon Mail, the Arcade Machine's game (docs/specs/009-elements/social-pieces.md "Moon Mail"; blueprint "Moon Mail's
// model"): a mail run round a small moon. Your ship circles on its own; you choose only its orbit, collecting letters
// and dodging the rocks that drift the other way.
//
// Deterministic: no clock and no Math.random. A run carries its own seed, the caller passes the time that passed,
// and the same seed and the same hops replay the same run. A run is one object the panel's loop owns and this module
// changes in place, so a frame allocates nothing but a spawned letter or rock.
//
// The screen is a square, 0 to 1 each way, the moon in the middle. Angles are radians, growing clockwise on screen
// (y runs down), so the ship's angle grows and a rock's shrinks.

import { MOON_MAIL_SCORING } from '@livehuddle/document';

export const MOON_R = 0.11;
/** The three orbits' radii, inner to outer. */
export const ORBITS = [0.2, 0.3, 0.4] as const;
export const OUTER_ORBIT = ORBITS.length - 1;
export const START_ORBIT = 1;
export const SHIELDS = 3;

/** One step of the model: 60 a second. */
export const STEPS_PER_SECOND = 60;
export const STEP_MS = 1000 / STEPS_PER_SECOND;
/** The most one call to `advance` plays: a frame after a long stall never fast-forwards a run into a rock. */
export const MAX_FRAME_MS = 250;

export const SHIP_SPEED_START = 1.1;
/** Radians a second gained each second played. */
export const SHIP_SPEED_GAIN = 0.015;
export const SHIP_SPEED_MAX = 2.6;

export const LETTERS_MAX = 5;
export const ROCKS_MAX = 7;
export const FIRST_ROCK_MS = 2_000;
export const ROCK_EVERY_START_MS = 2_600;
/** Milliseconds taken off the rock interval each second played. */
export const ROCK_EVERY_GAIN = 15;
export const ROCK_EVERY_MIN_MS = 800;
export const ROCK_SPEED_MIN = 0.5;
export const ROCK_SPEED_MAX = 0.9;
export const ROCK_LIFE_MS = 9_000;
/** A new rock is never the third of a wall: rocks this close (radians) on the other two orbits move it onto theirs. */
export const ROCK_WALL_GAP = 0.6;

/** How near (play units of arc) the ship must pass to collect a letter, or to strike a rock. */
export const LETTER_REACH = 0.045;
export const ROCK_REACH = 0.035;
/** After a hit, nothing can hit the ship for this long. */
export const HURT_MS = 1_500;

const TAU = Math.PI * 2;
// A letter is due once this many steps have passed since the last: 900 ms is 54 steps exactly, compared in whole
// numbers so the bound never rests on a rounding.
const LETTER_EVERY_STEPS = Math.ceil((MOON_MAIL_SCORING.letterEveryMs * STEPS_PER_SECOND) / 1000);

export type MoonMailItem = {
  kind: 'letter' | 'rock';
  orbit: number;
  angle: number;
  /** Radians a second, anticlockwise (a rock's); 0 for a letter, which waits. */
  speed: number;
  /** Milliseconds since it appeared. */
  age: number;
};

export type MoonMailRun = {
  /** The random state (mulberry32). */
  seed: number;
  orbit: number;
  angle: number;
  items: MoonMailItem[];
  score: number;
  /** Letters in a row without a hit. */
  streak: number;
  shields: number;
  /** The run's time until which a rock passes through. */
  hurtUntil: number;
  /** The run's time of the last hop, for the drawing's glide. */
  hopAt: number;
  /** Whole steps played, and the whole milliseconds they make. */
  steps: number;
  ms: number;
  over: boolean;
  /** Letters collected and hits taken, for a flash per event. */
  letters: number;
  hits: number;
  /** Time handed to `advance` not yet played as a whole step. */
  carry: number;
  /** Steps since the last letter appeared. */
  letterSteps: number;
  /** The run's time the next rock is due. */
  nextRockAt: number;
};

// mulberry32: small, fast and well spread; one 32-bit state.
function rand(run: MoonMailRun): number {
  run.seed = (run.seed + 0x6d2b79f5) | 0;
  let t = run.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}

const randOrbit = (run: MoonMailRun) =>
  Math.min(OUTER_ORBIT, Math.floor(rand(run) * ORBITS.length));

/** An angle in [0, 2π). */
export function wrapAngle(a: number): number {
  const m = a % TAU;
  return m < 0 ? m + TAU : m;
}

/** The angle from `b` to `a`, in (-π, π]. */
export function angleBetween(a: number, b: number): number {
  const d = wrapAngle(a - b);
  return d > Math.PI ? d - TAU : d;
}

/** The ship's speed, radians a second, `ms` into a run. */
export function shipSpeed(ms: number): number {
  return Math.min(SHIP_SPEED_START + (SHIP_SPEED_GAIN * ms) / 1000, SHIP_SPEED_MAX);
}

/** How long after one rock the next is due, `ms` into a run. */
export function rockEveryMs(ms: number): number {
  return Math.max(ROCK_EVERY_MIN_MS, ROCK_EVERY_START_MS - (ROCK_EVERY_GAIN * ms) / 1000);
}

/** The multiplier a letter scores at with `streak` letters already in a row: ×1 to ×5. */
export function streakFor(streak: number): number {
  const { streakEvery, streakMax } = MOON_MAIL_SCORING;
  return Math.min(1 + Math.floor(streak / streakEvery), streakMax);
}

/** A new run from `seed`: the ship at the top of the middle orbit and three letters waiting ahead of it. */
export function newRun(seed: number): MoonMailRun {
  const run: MoonMailRun = {
    seed: seed | 0,
    orbit: START_ORBIT,
    angle: wrapAngle(-Math.PI / 2),
    items: [],
    score: 0,
    streak: 0,
    shields: SHIELDS,
    hurtUntil: 0,
    hopAt: Number.NEGATIVE_INFINITY,
    steps: 0,
    ms: 0,
    over: false,
    letters: 0,
    hits: 0,
    carry: 0,
    letterSteps: 0,
    nextRockAt: FIRST_ROCK_MS,
  };
  for (let i = 1; i <= MOON_MAIL_SCORING.startLetters; i += 1) {
    run.items.push(item('letter', randOrbit(run), run.angle + 1.2 * i, 0));
  }
  return run;
}

function item(kind: MoonMailItem['kind'], orbit: number, angle: number, speed: number) {
  return { kind, orbit, angle: wrapAngle(angle), speed, age: 0 };
}

function count(run: MoonMailRun, kind: MoonMailItem['kind']): number {
  let n = 0;
  for (const it of run.items) if (it.kind === kind) n += 1;
  return n;
}

/** Hop one orbit out or in, at once. False, and nothing changes, past either end or once the run is over. */
export function hop(run: MoonMailRun, dir: 'out' | 'in'): boolean {
  if (run.over) return false;
  const next = run.orbit + (dir === 'out' ? 1 : -1);
  if (next < 0 || next > OUTER_ORBIT) return false;
  run.orbit = next;
  run.hopAt = run.ms;
  return true;
}

/** The orbit a tap at (x, y) on the square hops toward: outside the ship's orbit is out, inside is in. */
export function hopForTap(run: MoonMailRun, x: number, y: number): 'out' | 'in' {
  return Math.hypot(x - 0.5, y - 0.5) > ORBITS[run.orbit]! ? 'out' : 'in';
}

/** Play `dtMs` of the run (at most MAX_FRAME_MS) in whole steps; answers how many steps it played. */
export function advance(run: MoonMailRun, dtMs: number): number {
  if (run.over) return 0;
  run.carry += Math.min(Math.max(0, dtMs), MAX_FRAME_MS);
  let played = 0;
  while (run.carry >= STEP_MS && !run.over) {
    run.carry -= STEP_MS;
    step(run);
    played += 1;
  }
  if (run.over) run.carry = 0;
  return played;
}

function step(run: MoonMailRun): void {
  run.steps += 1;
  run.ms = Math.floor((run.steps * 1000) / STEPS_PER_SECOND);
  const dt = 1 / STEPS_PER_SECOND;
  run.angle = wrapAngle(run.angle + shipSpeed(run.ms) * dt);
  for (const it of run.items) {
    it.age += STEP_MS;
    if (it.speed !== 0) it.angle = wrapAngle(it.angle - it.speed * dt);
  }
  spawn(run);
  meet(run);
}

function spawn(run: MoonMailRun): void {
  run.letterSteps += 1;
  if (run.letterSteps >= LETTER_EVERY_STEPS && count(run, 'letter') < LETTERS_MAX) {
    run.letterSteps = 0;
    const spread = (rand(run) * 2 - 1) * (Math.PI / 2);
    run.items.push(item('letter', randOrbit(run), run.angle + Math.PI + spread, 0));
  }
  if (run.ms >= run.nextRockAt && count(run, 'rock') < ROCKS_MAX) {
    run.nextRockAt = run.ms + rockEveryMs(run.ms);
    const angle = run.angle + Math.PI + (rand(run) * 2 - 1) * 0.5;
    const speed = ROCK_SPEED_MIN + rand(run) * (ROCK_SPEED_MAX - ROCK_SPEED_MIN);
    run.items.push(item('rock', clearOrbit(run, randOrbit(run), angle), angle, speed));
  }
}

// The orbit a new rock at `angle` takes: `orbit`, unless rocks near that angle already hold both the others, when it
// joins one of theirs, so three orbits are never walled off at once.
function clearOrbit(run: MoonMailRun, orbit: number, angle: number): number {
  let held = 0;
  for (const it of run.items) {
    if (it.kind === 'rock' && Math.abs(angleBetween(it.angle, angle)) < ROCK_WALL_GAP)
      held |= 1 << it.orbit;
  }
  if ((held | (1 << orbit)) !== (1 << ORBITS.length) - 1) return orbit;
  // The lowest orbit the others hold (held has both the other two here, so it is never empty).
  return 31 - Math.clz32(held & -held);
}

// Collect the letters and strike the rocks the ship meets on its orbit, and let old rocks go; compacts in place.
function meet(run: MoonMailRun): void {
  const { letterPoints } = MOON_MAIL_SCORING;
  const items = run.items;
  let kept = 0;
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i]!;
    let stays = !(it.kind === 'rock' && it.age >= ROCK_LIFE_MS);
    if (stays && !run.over && it.orbit === run.orbit) {
      const arc = Math.abs(angleBetween(it.angle, run.angle)) * ORBITS[it.orbit]!;
      if (it.kind === 'letter' && arc < LETTER_REACH) {
        run.score += letterPoints * streakFor(run.streak);
        run.streak += 1;
        run.letters += 1;
        stays = false;
      } else if (it.kind === 'rock' && arc < ROCK_REACH && run.ms >= run.hurtUntil) {
        run.shields -= 1;
        run.streak = 0;
        run.hurtUntil = run.ms + HURT_MS;
        run.hits += 1;
        stays = false;
        if (run.shields <= 0) run.over = true;
      }
    }
    if (stays) items[kept++] = it;
  }
  items.length = kept;
}
