import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_CONDITIONS_MAX,
  AUTOMATION_NAME_MAX,
} from '@liveworkspace/automations';
import { KINDS, listOf, listed } from '../testing/rules';
import { listedRule, ruleNamesOf } from './rule-listing';
import { namedRuleBody } from './rule-names';

// liveworkspace/docs/specs/018-automations/automations.md "Agents": list_rules stays cheap past any item's worst
// case: 100 rules (twice the 50 an item holds), each named at the longest a name may be and at its 10 conditions and
// 20 steps, over 200 tabs and 100 people, the names made once a call. Measured on an M-series Mac at 3.5 to 5.1 ms of
// CPU a listing under a load average of 45, naming a body at 0.11 to 0.16 ms; the budgets are 40 and 5.
const TAB_COUNT = 200;
const PEOPLE = 100;
const RULE_COUNT = 100;

const tabs = Array.from({ length: TAB_COUNT }, (_, i) => ({ id: `t${i}`, name: `Tab ${i}` }));
const people = Array.from({ length: PEOPLE }, (_, i) => ({ id: `u${i}`, name: `Person ${i}` }));

function fullRule(i: number) {
  return listed({
    id: `r${i}`,
    name: `${i} ${'x'.repeat(AUTOMATION_NAME_MAX)}`.slice(0, AUTOMATION_NAME_MAX),
    trigger: { kind: 'edited', minutes: 30, tab: `t${i}` },
    conditions: Array.from({ length: AUTOMATION_CONDITIONS_MAX }, (_, j) => ({
      kind: 'tab',
      tabs: [`t${j}`, `t${j + 1}`, `t${j + 2}`],
    })),
    steps: Array.from({ length: AUTOMATION_ACTIONS_MAX }, (_, j) => ({
      kind: 'email',
      to: { person: `u${j}` },
      subject: `Step ${j} on {{tab.name}}`,
      body: 'b'.repeat(2000),
    })),
    needs: ['Tab t999 is gone'],
  });
}

describe('listing the worst case of rules', () => {
  const list = {
    ...listOf(Array.from({ length: RULE_COUNT }, (_, i) => fullRule(i))),
    tabs,
    people,
  };

  it(`lists ${RULE_COUNT} full rules within its CPU budget`, () => {
    let lines = 0;
    const ms = cpuMsOf(() => {
      for (let round = 0; round < 10; round += 1) {
        const names = ruleNamesOf(list, { kinds: KINDS });
        lines = list.rules.map((r) => listedRule(r, KINDS, names)).length;
      }
    });
    expect(lines).toBe(RULE_COUNT);
    expect(ms / 10).toBeLessThan(cpuBudgetMs(40));
  });

  it('names a full rule’s body by name within its CPU budget', () => {
    const body = {
      ...fullRule(0),
      trigger: { kind: 'edited', minutes: 30, tab: `Tab ${TAB_COUNT - 1}` },
    };
    let named = body;
    const ms = cpuMsOf(() => {
      for (let round = 0; round < 100; round += 1) named = namedRuleBody(body, list);
    });
    expect(named.trigger).toEqual({ kind: 'edited', minutes: 30, tab: `t${TAB_COUNT - 1}` });
    expect(ms / 100).toBeLessThan(cpuBudgetMs(5));
  });
});
