import { describe, expect, it } from 'vitest';
import { meetsBar, score } from './truth';

// The bar of plans/0007-event-storming-photo-95.md, as the sweep measures it.
const truth = (notes: { x: number; y: number; kind?: string }[]) => ({
  photo: 'wall',
  labelledOn: { width: 1000, height: 1000 },
  notes: notes.map((n) => ({ x: n.x, y: n.y, w: 0.05, h: 0.05, kind: n.kind ?? 'domain-event' })),
});
const box = (x: number, y: number, w = 50, h = 50, kind = 'domain-event') => ({ x, y, w, h, kind });

describe('score', () => {
  it('counts a box that holds two notes as MERGED', () => {
    // Two notes side by side, one box over both: one merged box, whatever
    // the matcher makes of it.
    const t = truth([
      { x: 0.1, y: 0.1 },
      { x: 0.15, y: 0.1 },
    ]);
    expect(score(t, [box(100, 100, 100, 50)], 1000, 1000).merged).toBe(1);
    expect(score(t, [box(100, 100), box(150, 100)], 1000, 1000).merged).toBe(0);
  });

  it('reports actors apart, and recall without them', () => {
    const t = truth([
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.1 },
      { x: 0.5, y: 0.1, kind: 'actor' },
    ]);
    const s = score(t, [box(100, 100), box(300, 100)], 1000, 1000);
    expect(s.actors).toEqual({ truth: 1, matched: 0 });
    expect(s.recallWithoutActors).toBe(1);
    expect(s.recall).toBeCloseTo(2 / 3);
  });
});

describe('meetsBar', () => {
  const t = truth(
    Array.from({ length: 20 }, (_, i) => ({ x: (i % 10) * 0.09, y: i < 10 ? 0.1 : 0.5 })),
  );
  const all = t.notes.map((n) => box(n.x * 1000, n.y * 1000));

  it('passes a wall found whole, with nothing extra and nothing merged', () => {
    expect(meetsBar(score(t, all, 1000, 1000))).toBe(true);
  });

  it('fails a wall missing more than one note in twenty', () => {
    expect(meetsBar(score(t, all.slice(2), 1000, 1000))).toBe(false);
  });

  it('fails a wall with junk on it', () => {
    const junk = [box(950, 950), box(900, 950)];
    expect(meetsBar(score(t, [...all, ...junk], 1000, 1000))).toBe(false);
  });

  it('fails a wall with a single merged box, however good the rest', () => {
    const merged = [...all.slice(2), box(0, 100, 140, 50)];
    expect(meetsBar(score(t, merged, 1000, 1000))).toBe(false);
  });
});
