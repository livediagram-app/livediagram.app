import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { dropForeignLinks } from './ai-steps';
import { planActions } from './plan-actions';
import { replanAfter, type LivePlan } from './replan';
import { bug, ctxFor } from './test-fixtures';
import type { AutomationStep } from './types';

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

// Work Tracker 846 (spec "How a step runs"): once each AI step answers, the rest of the rule is planned again from the
// card it left. A rule of three AI steps, each followed by a branch over a full plan's 2,000 cards, re-plans three
// times: that must stay a small part of a run (whose AI calls take seconds).
describe('planning the rest again after each AI step', () => {
  it('re-plans after each AI step on 2,000 cards within a few milliseconds each', () => {
    const items = Array.from({ length: 2000 }, (_, i) =>
      bug({ title: `Card ${i}`, priority: i % 2 ? 'high' : 'low' }, { id: `c${i}`, key: i + 1 }),
    );
    const card = items[0]!;
    const ai: AutomationStep = { kind: 'ai', task: 'triage', priority: true, labels: true };
    const branch: AutomationStep = {
      kind: 'for',
      related: { kind: 'saved_filter', tab: 't1', filter: 'sf-high' },
      conditions: [],
      then: [{ kind: 'add_label', label: 'seen' }],
    };
    const steps: AutomationStep[] = [ai, branch, ai, branch, ai, { kind: 'flag' }];
    const ctx = ctxFor(card, { items });
    const replanAll = () => {
      const planned = planActions(steps, ctx);
      const writes = 'failed' in planned ? planned.done : planned;
      const live: LivePlan = {
        lines: [...planned.lines],
        offset: 0,
        ai: [...(writes.ai ?? [])],
        sends: writes.sends,
        wait: undefined,
        failed: null,
        gone: undefined,
        turns: writes.turns,
      };
      for (const p of live.ai)
        replanAfter(live, p, planActions(steps, ctx, { from: p.step + 1, carry: p.carry }));
      return live;
    };
    expect(replanAll().ai).toHaveLength(3);
    // Measured on an M-series Mac under load: 18 ms CPU for the plan alone, 42 ms with its three re-plans (two
    // branches over 2,000 cards planned again); at most 100 AI steps a plan a day bound the extra to seconds a day.
    expect(cpuMsOf(replanAll)).toBeLessThan(cpuBudgetMs(300));
  });
});
