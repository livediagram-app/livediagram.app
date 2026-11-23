import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { listedRule, ruleNamesOf, type ItemListedRule } from '@liveworkspace/agent-verbs/rules';
import { KINDS } from '@livedocuments/document/automations';
import { verbById, verbsOf } from '../catalogue';
import { mcpChangeRules, mcpListRules } from '../mcp/rule-tools';
import { ruleRun } from '../rules';
import { contextOf, DOC_A, fakeApi } from '../testing/fake-api';

// docs/specs/013-workspace/automations.md "Agents": this product's list_rules, change_rules and `rule` verbs over its
// rules routes (`/api/documents/:id/automations[/…]`) and its kinds, a refusal in its words, and the listing's cost.
const BASE = `/documents/${DOC_A}/automations`;
const OWN = 'version_named';
const BY = { id: 'u1', name: 'Ana Costa', color: '#7c3aed' };
const AT = Date.UTC(2026, 10, 1, 9);

function rule(over: Partial<ItemListedRule> = {}): ItemListedRule {
  return {
    id: 'r1',
    name: 'Tell the owner',
    enabled: true,
    trigger: { kind: OWN },
    conditions: [],
    steps: [
      { kind: 'email', to: { owner: true }, subject: 'It happened', body: 'On {{tab.name}}' },
    ],
    chain: false,
    timeZone: 'UTC',
    made: { by: BY, at: AT },
    edited: { by: BY, at: AT },
    stats: { lastRunAt: null, nextAt: null, runsThisWeek: 0, failuresInARow: 0 },
    needs: [],
    attention: [],
    ...over,
  };
}

const listOf = (rules: ItemListedRule[] = [rule()]) => ({
  rules,
  runsToday: 2,
  runsPerDay: 1000,
  tabs: [{ id: 't1', name: 'Overview' }],
  people: [{ id: 'u1', name: 'Ana Costa' }],
});

type Sent = { method: string; path: string; body: unknown };

function api(refusal?: { error: string; status: number }) {
  const sent: Sent[] = [];
  const write =
    (answer: (body: Record<string, unknown>) => unknown) => async (request: Request) => {
      const text = await request.text();
      const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      sent.push({
        method: request.method,
        path: new URL(request.url).pathname.replace(/^\/api/, ''),
        body,
      });
      if (refusal) return Response.json({ error: refusal.error }, { status: refusal.status });
      return Response.json(answer(body));
    };
  const client = fakeApi({
    [`/documents/${DOC_A}`]: { document: { id: DOC_A, name: 'Launch', tabs: [] } },
    [BASE]: (request: Request) =>
      request.method === 'GET'
        ? Response.json(listOf())
        : write((body) => ({ rule: rule({ id: 'r2', name: body['name'] as string }) }))(request),
    [`${BASE}/test`]: write(() => ({
      run: {
        id: 'run1',
        ruleId: 'test',
        ruleName: 'Tell the owner',
        at: AT,
        result: 'done',
        tookMs: 4,
        subject: { id: 't1', title: 'Overview' },
        steps: [{ kind: 'action', ok: true, text: 'Would send an email to the owner' }],
      },
    })),
    [`${BASE}/r1/toggle`]: write((body) => ({
      rule: rule({ enabled: body['enabled'] as boolean }),
    })),
  });
  return { client, sent };
}

describe('the rule tools and verbs', () => {
  it('are in the catalogue and the MCP’s tools, keyed as this product’s other tools are', () => {
    expect(verbsOf('rule').map((v) => v.id)).toEqual([
      'rule.ls',
      'rule.get',
      'rule.add',
      'rule.set',
      'rule.on',
      'rule.off',
      'rule.rm',
      'rule.duplicate',
      'rule.test',
      'rule.run',
      'rule.log',
    ]);
    expect(Object.keys(mcpListRules.mcpShapes.input)[0]).toBe('documentId');
    expect(Object.keys(mcpChangeRules.mcpShapes.input)).toEqual(['documentId', 'changes']);
  });

  it('describe this product’s own trigger in the rule format', () => {
    const schema = JSON.stringify(mcpChangeRules.input.toJSONSchema());
    expect(schema).toContain(`"kind\\":\\"${OWN}\\"`);
    expect(schema).toContain(KINDS.trigger(OWN)!.format.slice(0, 40).replaceAll('"', '\\"'));
    expect(schema).toContain('as list_versions lists them');
  });

  it('list the rules, each in the words this product’s kinds give it', async () => {
    const { client } = api();
    const ls = verbById('rule.ls')!;
    const out = await ls.run!(contextOf(client), { doc: DOC_A });
    expect(ls.text!(out)[0]).toContain(`"Tell the owner": When ${KINDS.trigger(OWN)!.name}`);
    expect(out).toMatchObject({ tabs: [{ id: 't1', name: 'Overview' }], people: ['Ana Costa'] });
  });

  it('add a rule naming a tab by name, test it, and turn one off, over the api’s routes', async () => {
    const { client, sent } = api();
    const result = await ruleRun.applyRuleChanges(client, DOC_A, [
      {
        op: 'add',
        rule: {
          name: 'Snapshot',
          trigger: { kind: 'edited', minutes: 30, tab: 'Overview' },
          steps: [{ kind: 'take_snapshot', name: '{{now.date}}' }],
        },
      },
      { op: 'test', rule: 'Tell the owner', tab: 'overview' },
      { op: 'off', rule: 'r1' },
    ]);
    expect(result.applied).toEqual([
      '+ rule r2 "Snapshot" (on)',
      '? tested "Tell the owner" on tab "Overview": Done',
      '~ rule "Tell the owner" off',
    ]);
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual([
      `POST ${BASE}`,
      `POST ${BASE}/test`,
      `POST ${BASE}/r1/toggle`,
    ]);
    expect(sent[0]!.body).toMatchObject({
      trigger: { kind: 'edited', minutes: 30, tab: 't1' },
      timeZone: 'UTC',
    });
    expect(sent[1]!.body).toMatchObject({ rule: { name: 'Tell the owner' }, tab: 't1' });
  });

  it('refuse in this product’s words', async () => {
    const cases: [string, number, string][] = [
      ['automations_need_editor', 403, 'an Editor of the whole document'],
      ['read_only_token', 403, 'this token is read-only'],
      ['automation_needs_a_person', 403, 'leave the revert_snapshot step out'],
      ['automation_rules_full', 409, 'the document holds 50, the most one can'],
      ['automation_runs_used', 429, 'automation runs for this month are used'],
      ['automation_budget_spent', 429, 'the document has made its 1,000 runs today'],
    ];
    for (const [error, status, words] of cases) {
      const { client } = api({ error, status });
      const result = await ruleRun.applyRuleChanges(client, DOC_A, [{ op: 'off', rule: 'r1' }]);
      expect(result.refusal?.code, error).toBe(error);
      expect(result.refusal?.message, error).toContain(words);
    }
    const ls = await ruleRun.readRuleListing(api().client, DOC_A, { rule: 'Nope' });
    expect(ls).toMatchObject({ ok: false, code: 'rule_unknown' });
  });

  // The worst case past any document's: 100 rules (an item holds 50) named at the longest, each at its 10 conditions
  // and 20 steps. The shared suite measures its twin at 3.5 to 5.1 ms of CPU a listing; the budget is 40.
  it('list the worst case of rules within a CPU budget', () => {
    const rules = Array.from({ length: 100 }, (_, i) =>
      rule({
        id: `r${i}`,
        name: `${i} ${'n'.repeat(60)}`.slice(0, 60),
        conditions: Array.from({ length: 10 }, () => ({ kind: 'tab', tabs: ['t1', 'gone'] })),
        steps: Array.from({ length: 20 }, (_, j) => ({
          kind: 'email',
          to: { person: 'u1' },
          subject: `Step ${j}`,
          body: 'b'.repeat(2000),
        })),
      }),
    );
    const list = listOf(rules);
    let lines = 0;
    const ms = cpuMsOf(() => {
      for (let round = 0; round < 10; round += 1) {
        const names = ruleNamesOf(list, { kinds: KINDS });
        lines = list.rules.map((r) => listedRule(r, KINDS, names)).length;
      }
    });
    expect(lines).toBe(100);
    expect(ms / 10).toBeLessThan(cpuBudgetMs(40));
  });
});
