// mulberry32: the one small, fast, seeded stream of numbers in [0, 1). Anything that must look
// random yet come out the same on every device and render (a sketch's wobble, a gallery's dealt
// order, a hero's hand-drawn marks) draws from this, seeded from a fixed number or from
// `fnv1aString` of an id.

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
