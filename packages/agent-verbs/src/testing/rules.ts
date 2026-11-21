// Rules for the shared rule suites: an app's kinds as the item engine defines them, a listed rule, the rules list and
// a run, in the shapes the api's `…/automations` routes answer.
import type { ItemRun } from '@liveworkspace/automations/item';
import { defineItemKinds } from '@liveworkspace/automations/item';
import type { ItemListedRule, ItemRulesList, RuleProduct } from '../rules';
import { TEST_PRODUCT } from './product';

export const KINDS = defineItemKinds({ itemWord: 'document', collab: true, tabTemplates: true });

export const RULES: RuleProduct = {
  product: TEST_PRODUCT,
  kinds: KINDS,
  templates: [{ kind: 'retro', title: 'Retrospective' }],
};

export const BY = { id: 'u1', name: 'Ana Costa', color: '#7c3aed' };
export const AT = Date.UTC(2026, 10, 1, 9);

export function listed(over: Partial<ItemListedRule> = {}): ItemListedRule {
  return {
    id: 'r1',
    name: 'Comments by email',
    enabled: true,
    trigger: { kind: 'comment_added' },
    conditions: [],
    steps: [{ kind: 'email', to: { owner: true }, subject: 'New comment', body: '{{comment}}' }],
    chain: false,
    timeZone: 'UTC',
    made: { by: BY, at: AT },
    edited: { by: BY, at: AT, ai: true },
    stats: { lastRunAt: null, nextAt: null, runsThisWeek: 0, failuresInARow: 0 },
    needs: [],
    attention: [],
    ...over,
  };
}

export const TABS = [
  { id: 't1', name: 'Overview' },
  { id: 't2', name: 'Retro' },
];

export function listOf(rules: ItemListedRule[] = [listed()]): ItemRulesList {
  return {
    rules,
    runsToday: 3,
    runsPerDay: 1000,
    tabs: TABS,
    people: [BY],
  };
}

export function runOf(over: Partial<ItemRun> = {}): ItemRun {
  return {
    id: 'run1',
    ruleId: 'r1',
    ruleName: 'Comments by email',
    at: AT,
    result: 'done',
    tookMs: 12,
    subject: { id: 't1', title: 'Overview' },
    steps: [
      { kind: 'trigger', text: 'Ana Costa commented' },
      { kind: 'condition', ok: false, text: 'Tab is Retro' },
      { kind: 'action', ok: true, text: 'Sent email to the owner', already: true },
    ],
    ...over,
  };
}
