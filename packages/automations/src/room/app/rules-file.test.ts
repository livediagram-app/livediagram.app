import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEST_KINDS, world } from '../item/test-kit';
import { copiedRulesOf, hostRulesForFile, landedRuleStatements } from './rules-file';

afterEach(() => vi.restoreAllMocks());

// A database that records what was prepared and bound.
function fakeDb() {
  const bound: unknown[][] = [];
  const db = {
    prepare: (query: string) => ({
      bind: (...values: unknown[]) => (bound.push([query, ...values]), {}),
    }),
  } as unknown as D1Database;
  return { db, bound };
}

describe('the rules in a file', () => {
  it('are each rule’s body and whether it was on; none outside a room', () => {
    const w = world();
    expect(hostRulesForFile({})).toEqual([]);
    expect(copiedRulesOf({ AUTOMATIONS: w.engine }, new Map())).toBeNull();
    w.rule({ name: 'Weekly', trigger: { kind: 'tab_added' } });
    expect(hostRulesForFile({ AUTOMATIONS: w.engine })).toMatchObject([
      { name: 'Weekly', enabled: true, trigger: { kind: 'tab_added' } },
    ]);
    expect(hostRulesForFile({ AUTOMATIONS: w.engine })[0]).not.toHaveProperty('id');
    expect(copiedRulesOf({ AUTOMATIONS: w.engine }, new Map([['t1', 'n1']]))).toMatchObject({
      rules: [{ name: 'Weekly' }],
      tabs: [['t1', 'n1']],
    });
  });
});

describe('the rules landing in a new item', () => {
  it('land nothing for no rules', () => {
    const { db } = fakeDb();
    expect(landedRuleStatements(db, TEST_KINDS, null, 1)).toEqual([]);
    expect(landedRuleStatements(db, TEST_KINDS, { rules: [], tabs: [] }, 1)).toEqual([]);
    expect(
      landedRuleStatements(db, TEST_KINDS, { rules: 'x' as unknown as unknown[], tabs: [] }, 1),
    ).toEqual([]);
  });

  it('land each rule checked, off, its tabs at the new ids, and leave behind what does not read', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world();
    w.rule({ name: 'On a tab', trigger: { kind: 'edited', minutes: 5, tab: 't1' } });
    const copied = copiedRulesOf({ AUTOMATIONS: w.engine }, new Map([['t1', 'n1']]))!;
    const { db, bound } = fakeDb();
    const landed = landedRuleStatements(
      db,
      TEST_KINDS,
      {
        rules: [...copied.rules, { name: 'Other app', trigger: { kind: 'card_moved' } }],
        tabs: copied.tabs,
      },
      5,
    );
    expect(landed).toHaveLength(1);
    const [query, id, body, position] = bound[0]!;
    expect(String(query)).toContain('INSERT INTO automation_rules');
    expect(typeof id).toBe('string');
    expect(position).toBe(0);
    expect(JSON.parse(String(body))).toMatchObject({
      name: 'On a tab',
      enabled: false,
      trigger: { tab: 'n1' },
      made: { by: { name: 'Someone' }, at: 5 },
    });
    expect(info).toHaveBeenCalledWith('[automations] rules left behind', { dropped: 1 });
  });

  it('leaves a tab to pick when the copy says nothing of its tabs', () => {
    const w = world();
    w.rule({ name: 'On a tab', trigger: { kind: 'edited', minutes: 5, tab: 't1' } });
    const { db, bound } = fakeDb();
    const rules = hostRulesForFile({ AUTOMATIONS: w.engine });
    landedRuleStatements(db, TEST_KINDS, { rules, tabs: null as unknown as [string, string][] }, 5);
    expect(JSON.parse(String(bound[0]![2]))).toMatchObject({ trigger: { tab: '' } });
  });
});
