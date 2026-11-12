import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { dropForeignLinks } from './ai-steps';

// An AI step's answer is model output, so its links are untrusted text: a link full of sentence marks must cost
// linear time to check against the card's own links (CodeQL js/polynomial-redos on the trailing-marks trim).
// CPU time, never wall-clock.

const answer = (n: number) => `See https://x.example/${'!'.repeat(n)}a and more.`;

describe('dropping foreign links from an AI answer', () => {
  it('keeps its cost linear on a link of many sentence marks', () => {
    const small = answer(20_000);
    const large = answer(80_000);
    expect(dropForeignLinks(small, '')).not.toContain('https://');
    const smallMs = cpuMsOf(() => dropForeignLinks(small, ''));
    const largeMs = cpuMsOf(() => dropForeignLinks(large, ''));
    // Four times the input must cost well under eight times as much (quadratic would be sixteen).
    expect(largeMs).toBeLessThan(Math.max(smallMs * 8, cpuBudgetMs(20)));
    expect(largeMs).toBeLessThan(cpuBudgetMs(100));
  });
});
