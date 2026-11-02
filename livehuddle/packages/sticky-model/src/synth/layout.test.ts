import { describe, expect, it } from 'vitest';
import { layoutNotes, looseNotes } from './layout';
import { rngFrom } from './rng';

describe('looseNotes', () => {
  it('numbers its notes on from the given id', () => {
    const notes = looseNotes(rngFrom(1), 200, 200, 30, 17);
    expect(notes.length).toBeGreaterThan(0);
    notes.forEach((n, i) => expect(n.id).toBe(17 + i));
  });

  it('turns notes far further than a wall arrangement does', () => {
    const angles = Array.from({ length: 20 }, (_, s) => looseNotes(rngFrom(s), 200, 200, 30, 1))
      .flat()
      .map((n) => Math.abs(n.angle));
    expect(Math.max(...angles)).toBeGreaterThan(0.5);
  });

  it('keeps note centres where it is told to', () => {
    const left = (x: number) => x < 50;
    for (let s = 0; s < 10; s += 1) {
      for (const n of looseNotes(rngFrom(s), 200, 200, 20, 1, left)) expect(n.cx).toBeLessThan(50);
    }
  });
});

describe('layoutNotes', () => {
  it('gives some walls whole groups of a much smaller pad', () => {
    const smallCounts = Array.from(
      { length: 40 },
      (_, s) =>
        layoutNotes(rngFrom(s), 400, 400, 40).filter((n) => Math.max(n.w, n.h) < 0.45 * 40).length,
    );
    expect(smallCounts.some((n) => n >= 6)).toBe(true);
  });
});

describe('fanned stacks', () => {
  it('lap some notes over others diagonally, both axes at once', () => {
    let diagonal = 0;
    for (let s = 0; s < 40; s += 1) {
      const notes = layoutNotes(rngFrom(s), 400, 400, 40);
      for (const a of notes) {
        for (const b of notes) {
          if (a === b) continue;
          const dx = Math.abs(a.cx - b.cx) / a.w;
          const dy = Math.abs(a.cy - b.cy) / a.h;
          if (dx > 0.12 && dx < 0.55 && dy > 0.12 && dy < 0.55) diagonal += 1;
        }
      }
    }
    expect(diagonal).toBeGreaterThan(10);
  });
});
