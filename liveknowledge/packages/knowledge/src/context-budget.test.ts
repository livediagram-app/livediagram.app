import { describe, expect, it } from 'vitest';
import {
  CONTEXT_BUDGET_TOKENS,
  assembleContext,
  estimateTokens,
  fitsContextBudget,
} from './context-budget';

const page = (id: string, chars: number) => ({
  id,
  title: `Page ${id}`,
  markdown: 'x'.repeat(chars),
});

describe('the context budget', () => {
  it('estimates tokens as characters / 4, rounded up to 10', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('x')).toBe(10);
    expect(estimateTokens('x'.repeat(40))).toBe(10);
    expect(estimateTokens('x'.repeat(41))).toBe(20);
    expect(estimateTokens('x'.repeat(4000))).toBe(1000);
  });

  it('is 8,000 tokens, and a page fits while the total stays inside it', () => {
    expect(CONTEXT_BUDGET_TOKENS).toBe(8000);
    expect(fitsContextBudget(1000, 7000)).toBe(true);
    expect(fitsContextBudget(1010, 7000)).toBe(false);
    expect(fitsContextBudget(50, 60, 100)).toBe(false);
  });

  it('assembles the pages in the order given, within the budget', () => {
    const context = assembleContext([
      page('a', 12_000),
      page('b', 16_000),
      page('c', 12_000),
      page('d', 4_000),
    ]);
    expect(context.pages.map((p) => [p.id, p.tokens])).toEqual([
      ['a', 3000],
      ['b', 4000],
      ['d', 1000],
    ]);
    expect(context.tokens).toBe(8000);
    expect(context.leftOut).toEqual([{ id: 'c', title: 'Page c', tokens: 3000 }]);
    expect(assembleContext([])).toEqual({ pages: [], tokens: 0, leftOut: [] });
    expect(assembleContext([page('a', 400)], 50).leftOut).toHaveLength(1);
  });
});
