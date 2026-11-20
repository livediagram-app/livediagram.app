import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { CHANGED_SINCE_MAX_CHARS, changedFraction, changedSinceVerified } from './changed-since';

const line = (n: number) => `Step ${n} of the process is described in this sentence.`;
const page = (from: number, count: number) =>
  Array.from({ length: count }, (_x, at) => line(from + at)).join('\n');

describe('changed since verified', () => {
  it('is nothing for the same writing, or for none', () => {
    expect(changedFraction(page(0, 10), page(0, 10))).toBe(0);
    expect(changedFraction('', '')).toBe(0);
    expect(changedSinceVerified(page(0, 10), page(0, 10))).toBe(false);
  });

  it('is everything for writing that replaced nothing or was replaced whole', () => {
    expect(changedFraction('', page(0, 3))).toBe(1);
    expect(changedFraction(page(0, 3), '')).toBe(1);
    expect(changedFraction(page(0, 3), page(10, 3))).toBe(1);
  });

  it('says so only past a fifth of the characters', () => {
    const before = page(0, 10);
    // One sentence of ten rewritten: about a tenth.
    const small = before.replace(line(4), 'Step 4 is done differently now, by another team.');
    expect(changedFraction(before, small)).toBeGreaterThan(0.05);
    expect(changedSinceVerified(before, small)).toBe(false);
    // Three of ten rewritten: past a fifth.
    const large = [line(100), line(101), line(102), page(3, 7)].join('\n');
    expect(changedSinceVerified(before, large)).toBe(true);
  });

  it('does not count sentences that only moved', () => {
    expect(changedFraction(page(0, 10), `${page(5, 5)}\n${page(0, 5)}`)).toBe(0);
  });

  it('counts a sentence written twice twice', () => {
    expect(changedFraction('Same. Same. Other one.', 'Same. Other one.')).toBeGreaterThan(0);
    expect(changedFraction('Is it done? Yes! It is.', 'Is it done? Yes! It is.')).toBe(0);
  });

  it('reads blank lines as nothing', () => {
    expect(changedFraction('One.\n\n\nTwo.', 'One.\nTwo.\n')).toBe(0);
  });

  it('counts added writing against the longer version', () => {
    expect(changedSinceVerified(page(0, 10), page(0, 12))).toBe(false);
    expect(changedSinceVerified(page(0, 10), page(0, 14))).toBe(true);
  });

  it('compares what is past the bound by its length', () => {
    const base = 'x'.repeat(CHANGED_SINCE_MAX_CHARS);
    expect(changedFraction(base, base + 'y'.repeat(CHANGED_SINCE_MAX_CHARS))).toBe(0.5);
    expect(changedFraction(base + 'y', base + 'z')).toBe(0);
  });

  it('is linear: two 400,000 character versions within a CPU budget', () => {
    const before = page(0, 7000);
    const after = page(100, 7000);
    expect(before.length).toBeGreaterThan(CHANGED_SINCE_MAX_CHARS - 20_000);
    changedFraction(before.slice(0, 2000), after.slice(0, 2000));
    const spent = cpuMsOf(() => {
      changedFraction(before, after);
    });
    expect(spent).toBeLessThan(cpuBudgetMs(150));
  });
});
