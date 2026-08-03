import { describe, expect, it } from 'vitest';

import {
  alphaOf,
  REACTION_PALETTE,
  spawnBurst,
  stepParticles,
  type Particle,
} from './reaction-particles';

// The burst physics (spec/135). Worth testing because the numbers are the
// effect: a burst with no spread, no gravity or a frame-rate-dependent drag
// looks wrong in a way no type check catches.

// A fixed generator, so a failure is reproducible rather than "sometimes".
const seeded = (n: number) => {
  let s = n;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

const REACTIONS = ['confetti', 'sparkles', 'hearts', 'applause', 'fireworks'] as const;

describe('spawnBurst', () => {
  it('throws a substantial number of particles for every reaction', () => {
    for (const r of REACTIONS) {
      // The old emoji version had 8-14. The point of the rewrite is that a
      // burst is a crowd.
      expect(spawnBurst(r, 1, seeded(7)).length).toBeGreaterThanOrEqual(26);
    }
  });

  it('gives particles different speeds, so they do not travel as one block', () => {
    const speeds = spawnBurst('confetti', 1, seeded(3)).map((p) => Math.hypot(p.vx, p.vy));
    expect(new Set(speeds.map((s) => Math.round(s))).size).toBeGreaterThan(20);
  });

  it('scales the burst with the pad', () => {
    const fast = (ps: Particle[]) => Math.max(...ps.map((p) => Math.hypot(p.vx, p.vy)));
    const small = fast(spawnBurst('confetti', 1, seeded(11)));
    const big = fast(spawnBurst('confetti', 2.5, seeded(11)));
    expect(big).toBeGreaterThan(small * 2);
  });

  it('clamps a silly scale rather than trusting it', () => {
    // A pad dragged to 4000px wide should not launch particles a mile.
    const huge = spawnBurst('confetti', 40, seeded(5));
    const at3 = spawnBurst('confetti', 3, seeded(5));
    expect(Math.max(...huge.map((p) => p.vx))).toBeCloseTo(Math.max(...at3.map((p) => p.vx)), 5);
  });

  it('launches confetti upward and pulls it back down', () => {
    const ps = spawnBurst('confetti', 1, seeded(9));
    // Canvas y grows downward, so "up" is negative.
    expect(ps.filter((p) => p.vy < 0).length).toBeGreaterThan(ps.length * 0.7);
    expect(ps.every((p) => p.gravity > 0)).toBe(true);
  });

  it('floats hearts instead of dropping them', () => {
    const ps = spawnBurst('hearts', 1, seeded(9));
    expect(ps.every((p) => p.gravity < 0)).toBe(true);
    expect(ps.every((p) => p.sway > 0)).toBe(true);
  });

  it('staggers the firework shells so they do not all go off at once', () => {
    const delays = new Set(
      spawnBurst('fireworks', 1, seeded(4)).map((p) => Math.round(p.age * 100)),
    );
    expect(delays.size).toBeGreaterThan(1);
    expect(Math.min(...delays)).toBeLessThan(0);
  });

  it('uses each reaction its own palette', () => {
    for (const r of REACTIONS) {
      const used = new Set(spawnBurst(r, 1, seeded(21)).map((p) => p.color));
      const allowed = new Set<string>([...REACTION_PALETTE[r]!, '#ffffff']);
      for (const c of used) expect(allowed.has(c)).toBe(true);
      // More than one colour, or it reads as debris rather than a party.
      expect(used.size).toBeGreaterThan(1);
    }
  });
});

describe('stepParticles', () => {
  const one = (over: Partial<Particle> = {}): Particle[] => [
    {
      x: 0,
      y: 0,
      vx: 100,
      vy: 0,
      rot: 0,
      spin: 0,
      size: 4,
      color: '#fff',
      age: 0,
      life: 1,
      kind: 'dot',
      gravity: 0,
      drag: 0,
      flutter: 0,
      flutterRate: 0,
      sway: 0,
      swayRate: 0,
      ...over,
    },
  ];

  it('moves a particle by its velocity', () => {
    expect(stepParticles(one(), 0.5)[0]!.x).toBeCloseTo(50, 5);
  });

  it('applies gravity', () => {
    expect(stepParticles(one({ gravity: 100 }), 0.5)[0]!.vy).toBeCloseTo(50, 5);
  });

  it('retires a particle once its life is up', () => {
    expect(stepParticles(one({ age: 0.99 }), 0.02)).toHaveLength(0);
  });

  it('keeps a delayed particle alive before it starts', () => {
    const [p] = stepParticles(one({ age: -0.3 }), 0.1);
    expect(p).toBeDefined();
    // Not moved yet: a delayed spark must not drift while it waits.
    expect(p!.x).toBe(0);
  });

  it('is frame-rate independent, which a flat drag subtraction would not be', () => {
    // The same elapsed time in one big step and in twenty small ones must land
    // in the same place, or a 120Hz screen shows a different burst to a 60Hz one.
    const big = stepParticles(one({ drag: 2 }), 0.2)[0]!;
    let small = one({ drag: 2 });
    for (let i = 0; i < 20; i++) small = stepParticles(small, 0.01);
    expect(small[0]!.x).toBeCloseTo(big.x, 0);
  });
});

describe('alphaOf', () => {
  const p = (over: Partial<Particle>): Particle => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rot: 0,
    spin: 0,
    size: 4,
    color: '#fff',
    age: 0,
    life: 1,
    kind: 'ribbon',
    gravity: 0,
    drag: 0,
    flutter: 0,
    flutterRate: 0,
    sway: 0,
    swayRate: 0,
    ...over,
  });

  it('is invisible before it starts and fades in', () => {
    expect(alphaOf(p({ age: -0.2 }))).toBe(0);
    expect(alphaOf(p({ age: 0.04 }))).toBeCloseTo(0.5, 1);
  });

  it('holds through the middle and fades out at the end', () => {
    expect(alphaOf(p({ age: 0.5 }))).toBe(1);
    expect(alphaOf(p({ age: 0.99 }))).toBeLessThan(0.1);
  });

  it('never returns a negative alpha', () => {
    for (const age of [0, 0.3, 0.9, 1]) expect(alphaOf(p({ age }))).toBeGreaterThanOrEqual(0);
  });
});
