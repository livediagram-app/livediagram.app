import { describe, expect, it } from 'vitest';
import { createApiRefusal } from '../api-refusal';
import { DOC_A, fakeApi, TEST_PRODUCT } from '../testing/product';
import { RULES, listOf, listed, runOf } from '../testing/rules';
import { createRuleRun } from './rule-run';
import type { ItemRulesList } from './rule-state';

// liveworkspace/docs/specs/018-automations/automations.md "Agents": list_rules' listing and change_rules' changes
// over the api's `…/automations` routes, as change_rules and the CLI's `rule` verbs run them.
const run = createRuleRun(RULES, createApiRefusal(TEST_PRODUCT));
const BASE = `/sketches/${DOC_A}/automations`;

type Sent = { method: string; path: string; body: unknown };

function api(list: ItemRulesList = listOf(), more: Record<string, unknown> = {}) {
  const sent: Sent[] = [];
  const record = async (request: Request) => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    const text = await request.text();
    sent.push({ method: request.method, path, body: text ? JSON.parse(text) : undefined });
  };
  const answer = (rule: unknown, status = 200) => Response.json({ rule }, { status });
  const client = fakeApi({
    [BASE]: async (request: Request) => {
      if (request.method === 'GET') return Response.json(list);
      const body: { name: string } = await request.json();
      sent.push({ method: 'POST', path: BASE, body });
      return answer(listed({ id: 'r2', name: body.name, needs: ['Pick a connection'] }), 201);
    },
    [`${BASE}/r1`]: async (request: Request) => {
      await record(request);
      if (request.method === 'DELETE') return new Response(null, { status: 204 });
      return answer(listed({ name: (sent.at(-1)!.body as { name: string }).name }));
    },
    [`${BASE}/r1/toggle`]: async (request: Request) => {
      await record(request);
      return answer(listed({ enabled: (sent.at(-1)!.body as { enabled: boolean }).enabled }));
    },
    [`${BASE}/r1/duplicate`]: async (request: Request) => {
      await record(request);
      return answer(listed({ id: 'r3', name: 'Comments by email copy', enabled: false }), 201);
    },
    [`${BASE}/test`]: async (request: Request) => {
      await record(request);
      return Response.json({ run: runOf({ id: 'test', subject: null }) });
    },
    [`${BASE}/r1/run`]: async (request: Request) => {
      await record(request);
      return Response.json({ run: runOf() });
    },
    ...more,
  });
  return { client, sent };
}

describe('list_rules’ listing', () => {
  it('answers every rule’s line with the tabs and people a rule names', async () => {
    const { client } = api();
    const read = await run.readRuleListing(client, DOC_A, {});
    expect(read.ok && read.listing).toEqual({
      rules: [
        expect.objectContaining({
          id: 'r1',
          sentence: 'When Comment Added then Send Email to the owner',
        }),
      ],
      tabs: [
        { id: 't1', name: 'Overview' },
        { id: 't2', name: 'Retro' },
      ],
      people: ['Ana Costa'],
      runsToday: 3,
      runsPerDay: 1000,
      count: 1,
    });
    expect(client.calls).toEqual([BASE]);
  });

  it('adds one rule whole and its runs when asked, bounded', async () => {
    const { client } = api(listOf(), {
      [`${BASE}/runs?rule=r1&limit=50`]: { runs: [runOf()] },
      [`${BASE}/runs?limit=20`]: { runs: [] },
    });
    const read = await run.readRuleListing(client, DOC_A, {
      rule: 'comments by email',
      runs: true,
      limit: 80,
    });
    expect(read.ok && read.listing.rule?.id).toBe('r1');
    expect(read.ok && read.listing.runs?.map((r) => r.tab)).toEqual(['Overview']);
    const all = await run.readRuleListing(client, DOC_A, { runs: true });
    expect(all.ok && all.listing.runs).toEqual([]);
  });

  it('refuses a rule it cannot name', async () => {
    const { client } = api({ rules: [], runsToday: 0, runsPerDay: 1000 });
    expect(await run.readRuleListing(client, DOC_A, { rule: 'Nope' })).toEqual({
      ok: false,
      code: 'rule_unknown',
      message: 'No rule "Nope": this sketch has no rules. Add one with add.',
    });
    const empty = await run.readRuleListing(client, DOC_A, {});
    expect(empty.ok && [empty.listing.tabs, empty.listing.people]).toEqual([[], []]);
  });
});

describe('change_rules’ changes', () => {
  it('adds, sets, turns off and on, copies, tests, runs and deletes, in order', async () => {
    const { client, sent } = api();
    const result = await run.applyRuleChanges(client, DOC_A, [
      {
        op: 'add',
        rule: { name: 'Edits', trigger: { kind: 'edited', minutes: 30, tab: 'Overview' } },
      },
      { op: 'set', rule: 'Comments by email', name: 'Mail', id: 'r1' } as never,
      { op: 'off', rule: 'r1' },
      { op: 'on', rule: 'r1' },
      { op: 'duplicate', rule: 'r1' },
      { op: 'test', rule: 'r1' },
      { op: 'test', rule: { name: 'Draft', trigger: { kind: 'manual' } }, tab: 'retro' },
      { op: 'run', rule: 'r1', tab: 'Overview' },
      { op: 'run', rule: 'r1' },
      { op: 'delete', rule: 'r1' },
    ]);
    expect(result).toEqual({
      applied: [
        '+ rule r2 "Edits" (on), needs attention: Pick a connection',
        '~ rule "Mail" changed (on)',
        '~ rule "Comments by email" off',
        '~ rule "Comments by email" on',
        '+ rule r3 "Comments by email copy" (off, a copy of "Comments by email")',
        '? tested "Comments by email": Done',
        '? tested "Draft" on tab "Retro": Done',
        '> ran "Comments by email" on tab "Overview": Done',
        '> ran "Comments by email": Done',
        '- rule "Comments by email"',
      ],
      runs: expect.any(Array),
    });
    expect(result.runs).toHaveLength(4);
    expect(sent[0]!.body).toEqual({
      name: 'Edits',
      trigger: { kind: 'edited', minutes: 30, tab: 't1' },
      conditions: [],
      steps: [],
      chain: false,
      timeZone: 'UTC',
    });
    // set sends the saved body with the parts given, never list_rules' own keys.
    expect(sent[1]).toMatchObject({ method: 'PUT', body: { name: 'Mail', chain: false } });
    expect(sent[1]!.body).not.toHaveProperty('id');
    expect(sent[2]!.body).toEqual({ enabled: false });
    expect(sent[5]!.body).toMatchObject({ rule: { name: 'Comments by email' } });
    expect(sent[5]!.body).not.toHaveProperty('tab');
    expect(sent[6]!.body).toMatchObject({ rule: { name: 'Draft', steps: [] }, tab: 't2' });
    expect(sent[7]!.body).toEqual({ tab: 't1' });
    expect(sent[8]!.body).toEqual({});
    expect(sent[9]!.method).toBe('DELETE');
  });

  it('sets every part it is given', async () => {
    const { client, sent } = api();
    await run.applyRuleChanges(client, DOC_A, [
      {
        op: 'set',
        rule: 'r1',
        trigger: { kind: 'manual' },
        conditions: [{ kind: 'weekday', days: [1] }],
        steps: [],
        chain: true,
        timeZone: 'Europe/London',
      },
    ]);
    expect(sent[0]!.body).toEqual({
      name: 'Comments by email',
      trigger: { kind: 'manual' },
      conditions: [{ kind: 'weekday', days: [1] }],
      steps: [],
      chain: true,
      timeZone: 'Europe/London',
    });
  });

  it('stops at a rule or a tab it cannot name, saying what it applied before', async () => {
    const { client } = api();
    const result = await run.applyRuleChanges(client, DOC_A, [
      { op: 'off', rule: 'r1' },
      { op: 'delete', rule: 'Gone' },
      { op: 'on', rule: 'r1' },
    ]);
    expect(result).toEqual({
      applied: ['~ rule "Comments by email" off'],
      runs: [],
      refusal: {
        code: 'rule_unknown',
        message: 'No rule "Gone". The rules: r1 "Comments by email"',
      },
    });
    const tab = await run.applyRuleChanges(client, DOC_A, [{ op: 'run', rule: 'r1', tab: 'Nope' }]);
    expect(tab.refusal?.code).toBe('tab_unknown');
    const noTabs = api({ rules: [listed()], runsToday: 0, runsPerDay: 1000 });
    const none = await run.applyRuleChanges(noTabs.client, DOC_A, [
      { op: 'test', rule: 'r1', tab: 'Overview' },
    ]);
    expect(none.refusal?.message).toBe('No tab "Overview": list_rules lists the tabs.');
  });

  it('names a rule the call added by its name in a later change, and forgets one it deleted', async () => {
    const { client } = api();
    const result = await run.applyRuleChanges(client, DOC_A, [
      { op: 'add', rule: { name: 'Fresh', trigger: { kind: 'manual' } } },
      { op: 'test', rule: 'Fresh' },
      { op: 'delete', rule: 'r1' },
      { op: 'off', rule: 'Comments by email' },
    ]);
    expect(result.applied).toHaveLength(3);
    expect(result.refusal?.code).toBe('rule_unknown');
  });

  it('stops at the api’s refusal in words, and lets a failure that is none throw', async () => {
    const refusing = api(listOf(), {
      [`${BASE}/r1/run`]: () => Response.json({ error: 'automation_not_manual' }, { status: 409 }),
      [`${BASE}/r1/toggle`]: () => Response.json({ error: 'boom' }, { status: 500 }),
    });
    const result = await run.applyRuleChanges(refusing.client, DOC_A, [{ op: 'run', rule: 'r1' }]);
    expect(result.refusal).toEqual({
      code: 'automation_not_manual',
      message:
        'The api refused it (automation_not_manual): run takes only a Run by Hand rule (trigger manual) that is on: turn it on, or try another rule with test.',
    });
    await expect(
      run.applyRuleChanges(refusing.client, DOC_A, [{ op: 'off', rule: 'r1' }]),
    ).rejects.toThrow('api 500');
  });

  it('reads the template titles only when the product has them', async () => {
    const bare = createRuleRun({ ...RULES, templates: undefined }, () => null);
    const { client } = api(
      listOf([listed({ steps: [{ kind: 'add_tab', template: 'retro', name: 'R' }] })]),
    );
    const read = await bare.readRuleListing(client, DOC_A, {});
    expect(read.ok && read.listing.rules[0]!.sentence).toBe(
      'When Comment Added then Add a Tab “R” from a template',
    );
    const named = await run.readRuleListing(client, DOC_A, {});
    expect(named.ok && named.listing.rules[0]!.sentence).toContain('from Retrospective');
  });
});
