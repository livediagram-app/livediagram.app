import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { advance, hop, newRun, ORBITS, ROCK_LIFE_MS, type MoonMailRun } from './moon-mail';
import {
  createMoonMailPainter,
  documentSkyLayer,
  HOP_GLIDE_MS,
  MOON_MAIL_COLORS,
  paintSky,
  type MakeSkyLayer,
} from './moon-mail-paint';

// docs/specs/009-elements/social-pieces.md "Moon Mail", "Reduced motion"; blueprint "The drawing": a frame painted on
// a recording context, so the test sees every call the canvas would get.

type Call = { op: string; args: unknown[]; alpha: number; fill: unknown; stroke: unknown };

function recorder() {
  const calls: Call[] = [];
  const state = { globalAlpha: 1, fillStyle: '' as unknown, strokeStyle: '' as unknown };
  const gradient = { addColorStop: () => {} };
  const record =
    (op: string) =>
    (...args: unknown[]) => {
      calls.push({
        op,
        args,
        alpha: state.globalAlpha,
        fill: state.fillStyle,
        stroke: state.strokeStyle,
      });
      return op === 'createRadialGradient' ? gradient : undefined;
    };
  const ops = [
    'setTransform',
    'drawImage',
    'fillRect',
    'strokeRect',
    'beginPath',
    'arc',
    'rect',
    'moveTo',
    'lineTo',
    'quadraticCurveTo',
    'closePath',
    'fill',
    'stroke',
    'setLineDash',
    'fillText',
    'createRadialGradient',
  ];
  const ctx: Record<string, unknown> = Object.assign(state, {
    lineWidth: 1,
    font: '',
    textAlign: 'start',
  });
  for (const op of ops) ctx[op] = record(op);
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

// A recording layer: the sky is painted into it once, and copied with drawImage.
function layers() {
  const made: { calls: Call[] }[] = [];
  const make: MakeSkyLayer = () => {
    const r = recorder();
    made.push(r);
    return { source: {} as CanvasImageSource, ctx: r.ctx };
  };
  return { make, made };
}

const frame = (now: number, reduced = false) => ({ now, px: 400, reduced });
const count = (calls: Call[], op: string) => calls.filter((c) => c.op === op).length;

describe('the sky', () => {
  it('is painted once per size into its layer and copied each frame', () => {
    const { make, made } = layers();
    const painter = createMoonMailPainter(make);
    const run = newRun(1);
    const a = recorder();
    painter.paint(a.ctx, run, frame(0));
    painter.paint(a.ctx, run, frame(16));
    expect(made).toHaveLength(1);
    expect(count(a.calls, 'drawImage')).toBe(2);
    painter.paint(a.ctx, run, { ...frame(32), px: 600 });
    expect(made).toHaveLength(2);
  });

  it('is painted on the frame itself when no layer can be made', () => {
    const painter = createMoonMailPainter(() => null);
    const a = recorder();
    painter.paint(a.ctx, newRun(1), frame(0));
    expect(count(a.calls, 'drawImage')).toBe(0);
    expect(a.calls.filter((c) => c.op === 'fillRect')).not.toHaveLength(0);
  });

  it('draws the moon, its craters and the three orbits', () => {
    const r = recorder();
    paintSky(r.ctx);
    const arcs = r.calls.filter((c) => c.op === 'arc').map((c) => c.args[2]);
    for (const radius of ORBITS) expect(arcs).toContain(radius);
    expect(count(r.calls, 'fillRect')).toBe(1);
  });

  it('makes no layer outside a page', () => {
    expect(documentSkyLayer(10)).toBeNull();
  });
});

describe('a frame', () => {
  it('draws each letter as an envelope with its seal and each rock as an outline', () => {
    const run = newRun(7);
    advance(run, 250);
    run.items.push({ kind: 'rock', orbit: 2, angle: 1, speed: 0.6, age: 100 });
    const painter = createMoonMailPainter(() => null);
    const r = recorder();
    painter.paint(r.ctx, run, frame(0, true));
    const letters = run.items.filter((it) => it.kind === 'letter').length;
    expect(count(r.calls, 'rect')).toBe(letters);
    expect(r.calls.filter((c) => c.op === 'fill' && c.fill === MOON_MAIL_COLORS.seal)).toHaveLength(
      letters,
    );
    expect(r.calls.filter((c) => c.op === 'fill' && c.fill === MOON_MAIL_COLORS.rock)).toHaveLength(
      1,
    );
  });

  it('pops a new letter in from nothing, never drawing a negative radius (a canvas throws on one)', () => {
    const run = newRun(7);
    run.items = [{ kind: 'letter', orbit: 1, angle: 1, speed: 0, age: 0 }];
    const painter = createMoonMailPainter(() => null);
    const r = recorder();
    painter.paint(r.ctx, run, frame(0));
    expect(count(r.calls, 'rect')).toBe(0);
    for (const age of [1, 30, 90, 179, 400]) {
      run.items[0]!.age = age;
      const at = recorder();
      painter.paint(at.ctx, run, frame(age));
      for (const c of at.calls.filter((c) => c.op === 'arc'))
        expect(c.args[2] as number).toBeGreaterThanOrEqual(0);
    }
  });

  it('fades a rock at the end of its life and draws none once it is gone', () => {
    const run = newRun(7);
    run.items = [{ kind: 'rock', orbit: 0, angle: 1, speed: 0.6, age: ROCK_LIFE_MS - 300 }];
    const painter = createMoonMailPainter(() => null);
    const r = recorder();
    painter.paint(r.ctx, run, frame(0));
    const rockFill = r.calls.find((c) => c.op === 'fill' && c.fill === MOON_MAIL_COLORS.rock);
    expect(rockFill?.alpha).toBeCloseTo(0.5);
    run.items[0]!.age = ROCK_LIFE_MS;
    const r2 = recorder();
    painter.paint(r2.ctx, run, frame(16));
    expect(r2.calls.some((c) => c.fill === MOON_MAIL_COLORS.rock)).toBe(false);
  });

  // The ship's translation is the last setTransform before its hull: its centre in device pixels.
  const shipAt = (calls: Call[]) => {
    const hull = calls.findIndex((c) => c.op === 'fill' && c.fill === MOON_MAIL_COLORS.ship);
    const t = calls
      .slice(0, hull)
      .reverse()
      .find((c) => c.op === 'setTransform')!;
    const [, , , , x, y] = t.args as [number, number, number, number, number, number];
    return Math.hypot(x / 400 - 0.5, y / 400 - 0.5);
  };

  it('glides the ship between orbits under full motion and jumps under reduced', () => {
    const run = newRun(3);
    const painter = createMoonMailPainter(() => null);
    painter.paint(recorder().ctx, run, frame(0));
    hop(run, 'out');
    const mid = recorder();
    painter.paint(mid.ctx, run, frame(1));
    expect(shipAt(mid.calls)).toBeCloseTo(ORBITS[1], 3);
    advance(run, HOP_GLIDE_MS / 2);
    const half = recorder();
    painter.paint(half.ctx, run, frame(2));
    const r = shipAt(half.calls);
    expect(r).toBeGreaterThan(ORBITS[1]);
    expect(r).toBeLessThan(ORBITS[2]);
    hop(run, 'in');
    const jumped = recorder();
    painter.paint(jumped.ctx, run, frame(3, true));
    expect(shipAt(jumped.calls)).toBeCloseTo(ORBITS[1], 3);
  });

  it('blinks a hurt ship under full motion and dims it steadily under reduced', () => {
    const run = newRun(3);
    run.hurtUntil = 10_000;
    const painter = createMoonMailPainter(() => null);
    const shipAlpha = (reduced: boolean, ms: number) => {
      run.ms = ms;
      const r = recorder();
      painter.paint(r.ctx, run, frame(ms, reduced));
      return r.calls.find((c) => c.op === 'fill' && c.fill === MOON_MAIL_COLORS.ship)!.alpha;
    };
    expect(new Set([shipAlpha(false, 0), shipAlpha(false, 100)]).size).toBe(2);
    expect(shipAlpha(true, 0)).toBe(0.45);
    expect(shipAlpha(true, 100)).toBe(0.45);
    run.hurtUntil = 0;
    expect(shipAlpha(true, 200)).toBe(1);
  });

  it('rings a letter met with its points and flashes a hit, never under reduced motion', () => {
    const play = (reduced: boolean) => {
      const run = newRun(3);
      const painter = createMoonMailPainter(() => null);
      painter.paint(recorder().ctx, run, frame(0, reduced));
      run.letters += 1;
      run.score += 20;
      run.hits += 1;
      const r = recorder();
      painter.paint(r.ctx, run, frame(100, reduced));
      const later = recorder();
      painter.paint(later.ctx, run, frame(2_000, reduced));
      return { now: r.calls, later: later.calls };
    };
    const full = play(false);
    expect(full.now.find((c) => c.op === 'fillText')?.args[0]).toBe('+20');
    expect(count(full.now, 'strokeRect')).toBe(1);
    expect(count(full.later, 'fillText') + count(full.later, 'strokeRect')).toBe(0);
    const still = play(true);
    expect(count(still.now, 'fillText') + count(still.now, 'strokeRect')).toBe(0);
  });

  it('forgets the last run’s moments when a new run is painted', () => {
    const painter = createMoonMailPainter(() => null);
    const first = newRun(1);
    painter.paint(recorder().ctx, first, frame(0));
    first.letters += 1;
    first.score += 10;
    painter.paint(recorder().ctx, first, frame(10));
    const r = recorder();
    painter.paint(r.ctx, newRun(2), frame(20));
    expect(count(r.calls, 'fillText')).toBe(0);
  });
});

describe('the frame loop’s cost', () => {
  // A seeded autopilot hops toward the nearest letter: the busiest the screen gets.
  function autopilot(run: MoonMailRun) {
    const letter = run.items.find((it) => it.kind === 'letter');
    if (letter && letter.orbit !== run.orbit) hop(run, letter.orbit > run.orbit ? 'out' : 'in');
  }

  it('plays and paints 10 minutes of Moon Mail (36,000 frames) inside its CPU budget', () => {
    const painter = createMoonMailPainter(layers().make);
    // A context that keeps nothing, so the budget measures the painter and not a recorder.
    const gradient = { addColorStop() {} };
    const noop = Object.fromEntries(
      Object.keys(recorder().ctx as unknown as object).map((k) => [k, () => gradient]),
    ) as unknown as CanvasRenderingContext2D;
    let run = newRun(42);
    let frames = 0;
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 36_000; i += 1) {
        if (run.over) run = newRun(i);
        autopilot(run);
        advance(run, 1000 / 60);
        painter.paint(noop, run, { now: i * 16.7, px: 672, reduced: false });
        frames += 1;
      }
    });
    expect(frames).toBe(36_000);
    expect(ms).toBeLessThan(cpuBudgetMs(600));
  });
});
