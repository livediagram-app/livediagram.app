import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { AutomationListedRule } from '@liveplanner/api-schema';
import {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_CONDITIONS_MAX,
  AUTOMATION_RULES_MAX,
} from '@liveplanner/items';
import { listed, listOf, PLAN } from '../testing/rules';
import { listedRule } from './rule-listing';
import { namedRuleBody } from './rule-names';
import { sentenceOutlineOf } from './rule-state';

// docs/specs/026-plan/automations.md "Agents and the CLI", "Limits and cost": list_rules on a full plan (50 rules,
// each at its 10 conditions and 20 actions) stays cheap, its sentences worked out once per call. Measured on an
// M-series Mac at 1.4 to 1.8 ms of CPU a listing; the budget is 20.
function fullRule(i: number): AutomationListedRule {
  return listed({
    id: `r${i}`,
    name: `Rule ${i}`,
    trigger: { kind: 'card_moved', from: ['todo'], to: ['done'] },
    conditions: Array.from({ length: AUTOMATION_CONDITIONS_MAX }, () => ({
      kind: 'field' as const,
      field: 'f-sev',
      op: 'is' as const,
      value: 'High',
    })),
    steps: Array.from({ length: AUTOMATION_ACTIONS_MAX }, (_, j) => ({
      kind: 'comment' as const,
      text: `Step ${j} for {{card.title}}`,
    })),
    needs: ['Column qa is gone'],
  });
}

describe('listing a full plan of rules', () => {
  it(`lists ${AUTOMATION_RULES_MAX} full rules within its CPU budget`, () => {
    const state = {
      list: listOf(Array.from({ length: AUTOMATION_RULES_MAX }, (_, i) => fullRule(i))),
      plan: PLAN,
    };
    let lines = 0;
    const ms = cpuMsOf(() => {
      for (let round = 0; round < 10; round += 1) {
        const outline = sentenceOutlineOf(state);
        lines = state.list.rules.map((r) => listedRule(r, outline)).length;
      }
    });
    expect(lines).toBe(AUTOMATION_RULES_MAX);
    expect(ms / 10).toBeLessThan(cpuBudgetMs(20));
  });

  it('names a full rule’s body within its CPU budget', () => {
    const state = { list: listOf(), plan: PLAN };
    const body = fullRule(0);
    const ms = cpuMsOf(() => {
      for (let round = 0; round < 100; round += 1) namedRuleBody(body, state);
    });
    expect(ms / 100).toBeLessThan(cpuBudgetMs(5));
  });
});
