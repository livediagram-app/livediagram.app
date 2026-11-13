import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationRule } from '@liveplanner/items';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import {
  automationWorld,
  ruleBody,
  type AutomationWorld,
} from '../plan-room/automations/test-automation-world';

// The Automations routes given hostile bodies and queries (docs/specs/026-plan/automations.md "Agents and the CLI";
// blueprint automations.md "Routes"): malformed JSON, wrong types, unknown keys and odd numbers each answer a clean
// 4xx with its code, never a 500.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

let w: AutomationWorld;
let rule: AutomationRule;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  w = await automationWorld();
  rule = await w.rule({});
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const TEXTS = [
  '',
  '{',
  'null',
  '[]',
  '"rule"',
  '7',
  '{"rule": 7}',
  '{"__proto__": {"name": "x"}}',
  '{"enabled": "yes"}',
  '{"ids": "x"}',
  '{"ids": [1, 2]}',
  '{"item": {"id": 1}}',
  '{"rule": null, "item": []}',
  JSON.stringify({ ...ruleBody(), steps: 'nope', extra: { deep: [1, 2] } }),
  JSON.stringify({ ...ruleBody(), name: 7 }),
  JSON.stringify({ ...ruleBody(), trigger: { kind: 'toString' } }),
  JSON.stringify({ ...ruleBody(), steps: [{ kind: 'constructor' }] }),
  '\u0000￿',
];

describe('hostile bodies', () => {
  it('answer every door with a clean 4xx and an error code', async () => {
    const doors: [string, string][] = [
      ['POST', ''],
      ['PUT', `/${rule.id}`],
      ['POST', `/${rule.id}/toggle`],
      ['POST', `/${rule.id}/run`],
      ['POST', '/order'],
      ['POST', '/test'],
      ['POST', '/draft'],
    ];
    for (const [method, path] of doors)
      for (const text of TEXTS) {
        const res = await w.callText(method, path, text);
        const where = `${method} ${path} ${text.slice(0, 60)}`;
        expect(res.status, where).toBeGreaterThanOrEqual(400);
        expect(res.status, where).toBeLessThan(500);
        expect(typeof (await res.json<{ error?: unknown }>()).error, where).toBe('string');
      }
  });

  it('keep a rule unchanged by a refused save', async () => {
    for (const text of TEXTS) await w.callText('PUT', `/${rule.id}`, text);
    const list = await (await w.call('GET', '')).json<{ rules: AutomationRule[] }>();
    expect(list.rules.map((r) => r.name)).toEqual([rule.name]);
  });

  it('name a Test on a Card refusal by the rule’s own path', async () => {
    const missing = await w.call('POST', '/test', { item: 'x' });
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ error: 'automation_invalid', path: 'rule' });
    const wrong = await w.call('POST', '/test', { rule: { ...ruleBody(), name: '' }, item: 'x' });
    expect(await wrong.json()).toMatchObject({ path: 'rule.name' });
  });
});

describe('hostile Audit Trail queries', () => {
  it('answer runs for any limit, since and result, never a 500', async () => {
    const queries = [
      'limit=2.5',
      'limit=-1',
      'limit=0',
      'limit=1e309',
      'limit=abc',
      'limit=999999999',
      'since=1.5',
      'since=-1e300',
      'since=abc',
      'result=__proto__',
      'result=done&result=failed',
      `rule=${'x'.repeat(5000)}`,
      'rule=%00',
    ];
    for (const q of queries) {
      const res = await w.call('GET', `/runs?${q}`);
      expect(res.status, q).toBe(200);
      expect(Array.isArray((await res.json<{ runs: unknown }>()).runs), q).toBe(true);
    }
  });
});
