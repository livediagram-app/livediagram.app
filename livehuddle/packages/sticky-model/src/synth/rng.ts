// A seeded random source, so a synthetic wall is a pure function of its seed:
// a training set can be regenerated instead of stored, and a failing test
// names the one wall it failed on. Mulberry32: tiny, fast, well mixed.

export type Rng = {
  next: () => number;
  range: (min: number, max: number) => number;
  int: (min: number, maxInclusive: number) => number;
  chance: (p: number) => boolean;
  pick: <T>(items: readonly T[]) => T;
  // Log-uniform: sizes spread evenly across scales, not piled at the top.
  logRange: (min: number, max: number) => number;
  gauss: () => number;
};

export function rngFrom(seed: number): Rng {
  let a = seed >>> 0 || 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (min: number, max: number) => min + (max - min) * next();
  return {
    next,
    range,
    int: (min, maxInclusive) => Math.floor(range(min, maxInclusive + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)]!,
    logRange: (min, max) => Math.exp(range(Math.log(min), Math.log(max))),
    gauss: () => {
      const u = Math.max(1e-9, next());
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    },
  };
}
