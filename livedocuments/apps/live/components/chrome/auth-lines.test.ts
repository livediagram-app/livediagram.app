import { describe, expect, it } from 'vitest';
import { randomTrace, STAGE_H, STAGE_W, TRACE_TONES } from './auth-lines';

// The Night Band lines (docs/specs/014-identity/auth-and-guest-access.md "The look: Night Band"): every route runs
// edge to edge in any direction, starting and ending off the stage so a line is never seen arriving or leaving.

// A small deterministic generator (mulberry32), so a run is repeatable.
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function numbers(d: string): number[] {
  return d.match(/-?\d+/g)!.map(Number);
}

function offstage([x, y]: number[]): boolean {
  return x! < 0 || x! > STAGE_W || y! < 0 || y! > STAGE_H;
}

describe('randomTrace', () => {
  const rand = seeded(42);
  const traces = Array.from({ length: 400 }, () => randomTrace(rand));

  it('enters through one edge and leaves through another', () => {
    for (const t of traces) expect(t.to).not.toBe(t.from);
  });

  it('starts and ends off the stage, with its bends on it', () => {
    for (const t of traces) {
      const n = numbers(t.d);
      expect(n).toHaveLength(8);
      expect(offstage(n.slice(0, 2))).toBe(true);
      expect(offstage(n.slice(6, 8))).toBe(true);
      for (const [x, y] of [n.slice(2, 4), n.slice(4, 6)]) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(STAGE_W);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(STAGE_H);
      }
    }
  });

  it('goes every way, not just across the top and bottom', () => {
    const pairs = new Set(traces.map((t) => `${t.from}>${t.to}`));
    // 4 edges, 3 exits each.
    expect(pairs.size).toBe(12);
  });

  it('draws in every tone', () => {
    expect(new Set(traces.map((t) => t.tone))).toEqual(new Set(TRACE_TONES));
  });

  it('is repeatable for a seed', () => {
    expect(randomTrace(seeded(7))).toEqual(randomTrace(seeded(7)));
  });
});
