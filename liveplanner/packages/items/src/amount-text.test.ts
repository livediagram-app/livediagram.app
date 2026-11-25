import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { amountOf } from './amount-text';

// An amount as text (docs/specs/026-plan/plan-board.md "Import CSV", plan-agents.md).
describe('amountOf', () => {
  it.each([
    ['£12,500', 12500],
    ['1200.50', 1200.5],
    ['$1,234.56', 1234.56],
    ['1,234,567', 1234567],
    ['1,200', 1200],
    // A decimal comma, as a European spreadsheet writes it, never read as grouping.
    ['1.234,50 €', 1234.5],
    ['12,5', 12.5],
    ['12,50', 12.5],
    ['1.234.567', 1234567],
    ['-£40', -40],
    ['€ -3,75', -3.75],
    ['12.345', 12.35],
    ['0', 0],
  ])('reads %s as %s', (text, want) => {
    expect(amountOf(text)).toBe(want);
  });

  it.each(['', 'soon', '£', '1-2', '--5'])('reads %j as no amount', (text) => {
    expect(amountOf(text)).toBeUndefined();
  });

  it('stays linear on a long run of separators', () => {
    const text = `${'1,'.repeat(50_000)}5`;
    const ms = cpuMsOf(() => amountOf(text));
    expect(ms).toBeLessThan(cpuBudgetMs(80));
  });
});
