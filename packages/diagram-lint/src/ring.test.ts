import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createRingTest, plainRingTest, type RingBox } from './ring';

const sq = (x: number, y: number, side = 100): RingBox => ({ x, y, width: side, height: side });
// A box whose centre is (cx, cy).
const at = (cx: number, cy: number, side = 100): RingBox => sq(cx - side / 2, cy - side / 2, side);
const ring = (cx: number, cy: number, r: number, count: number): RingBox[] =>
  Array.from({ length: count }, (_, i) =>
    at(cx + r * Math.cos((2 * Math.PI * i) / count), cy + r * Math.sin((2 * Math.PI * i) / count)),
  );

// A seeded random (mulberry32), so a failing board can be replayed.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Both tests' answers for every box asked.
const answers = (connected: RingBox[], asked: RingBox[]) => {
  const fast = createRingTest(connected);
  const plain = plainRingTest(connected);
  return { fast: asked.map(fast), plain: asked.map(plain) };
};

describe('createRingTest', () => {
  it('finds the hub of a ring and nothing off it', () => {
    const connected = ring(1000, 1000, 400, 8);
    const test = createRingTest(connected);
    expect(test(at(1000, 1000))).toBe(true);
    expect(test(at(1030, 990))).toBe(true);
    // Inside the ring's box, too far off its centre.
    expect(test(at(1300, 1000))).toBe(false);
    // Outside the ring's box.
    expect(test(at(5000, 1000))).toBe(false);
    expect(test(at(1000, -5000))).toBe(false);
  });

  it('needs three connected boxes', () => {
    expect(createRingTest([])(at(0, 0))).toBe(false);
    expect(createRingTest([at(-100, 0), at(100, 0)])(at(0, 0))).toBe(false);
    expect(plainRingTest([at(-100, 0), at(100, 0)])(at(0, 0))).toBe(false);
  });

  it('is no hub on a line of connected boxes (an empty bounding box)', () => {
    const connected = [at(0, 0), at(100, 0), at(200, 0)];
    expect(createRingTest(connected)(at(100, 0))).toBe(false);
    expect(plainRingTest(connected)(at(100, 0))).toBe(false);
    expect(createRingTest(connected.map((b) => sq(b.y, b.x)))(at(0, 100))).toBe(false);
  });

  it('answers as the plain test does for coordinates past the safe range', () => {
    const huge = [...ring(0, 0, 400, 6), at(1e300, 0)];
    const asked = [at(0, 0), at(1e300, 0), at(Number.NaN, 0)];
    const { fast, plain } = answers(huge, asked);
    expect(fast).toEqual(plain);
    const nan = [...ring(0, 0, 400, 6), sq(Number.NaN, 0)];
    expect(answers(nan, asked).fast).toEqual(answers(nan, asked).plain);
    // A safe ring, an unsafe box.
    const safe = ring(0, 0, 400, 6);
    expect(answers(safe, asked).fast).toEqual(answers(safe, asked).plain);
  });

  it('reads a crowded neighbourhood up to its cap, and searches past empty cells', () => {
    // A tight cluster in one corner and a ring far off: the cluster's cell holds more than the cap.
    const crowded = [
      ...Array.from({ length: 60 }, (_, i) => at(i % 8, Math.floor(i / 8))),
      ...ring(5000, 5000, 3000, 12),
    ];
    const asked = [at(3, 3), at(5000, 5000), at(2500, 2500), at(7000, 3000)];
    const { fast, plain } = answers(crowded, asked);
    expect(fast).toEqual(plain);
    // Boxes only round the edge of a square: the cells around its middle hold none.
    const sparse = Array.from({ length: 40 }, (_, i) => {
      const t = (i % 10) * 1000;
      return [at(t, 0), at(10000, t), at(10000 - t, 10000), at(0, 10000 - t)][Math.floor(i / 10)]!;
    });
    const middle = [at(5000, 5000), at(5000, 4000), at(2000, 8000)];
    const sparseAnswers = answers(sparse, middle);
    expect(sparseAnswers.fast).toEqual(sparseAnswers.plain);
    expect(sparseAnswers.fast[0]).toBe(true);
  });

  it('gives the plain answers on random boards, rings among them', () => {
    const random = seeded(20261108);
    for (let board = 0; board < 300; board++) {
      const connectedCount = 3 + Math.floor(random() * 40);
      const spread = 50 + random() * 4000;
      const connected: RingBox[] =
        board % 3 === 0
          ? // A ring, jittered so some boxes stray past the spread.
            ring(spread, spread, spread / 2, connectedCount).map((b) =>
              sq(b.x + (random() - 0.5) * spread * 0.4, b.y + (random() - 0.5) * spread * 0.4),
            )
          : Array.from({ length: connectedCount }, () =>
              sq(random() * spread, random() * spread, 20 + random() * 200),
            );
      const asked: RingBox[] = Array.from({ length: 30 }, () =>
        sq(random() * spread * 1.2 - spread * 0.1, random() * spread * 1.2 - spread * 0.1),
      );
      if (board % 3 === 0) asked.push(at(spread, spread), at(spread * 1.02, spread * 0.98));
      const { fast, plain } = answers(connected, asked);
      expect(fast, `board ${board}`).toEqual(plain);
    }
  });

  // The cost the plain test paid in the document's Durable Object on every changeset (4,000 isolated boxes beside
  // 4,000 connected ones: 16 million distances), against near-constant work per box.
  it('lints 4,000 isolated boxes beside 4,000 connected ones within budget', () => {
    const side = 90;
    const connected: RingBox[] = [];
    const isolated: RingBox[] = [];
    for (let i = 0; i < 8000; i++) {
      const box = sq((i % side) * 220, Math.floor(i / side) * 160);
      (i % 2 === 0 ? connected : isolated).push(box);
    }
    const test = createRingTest(connected);
    const spent = cpuMsOf(() => {
      for (const box of isolated) test(box);
    });
    expect(spent).toBeLessThan(cpuBudgetMs(40));
    expect(isolated.slice(0, 200).map(test)).toEqual(
      isolated.slice(0, 200).map(plainRingTest(connected)),
    );
  });
});
