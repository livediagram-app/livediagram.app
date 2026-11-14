import { describe, expect, it } from 'vitest';
import { ApiError } from '@liveworkspace/api-client';
import type { AutomationListedRule } from '@liveplanner/api-schema';
import type { AutomationTrigger } from '@liveplanner/items';
import { DOC_A, fakeApi } from '../testing/fake-api';
import { CARD, listed, listOf, PLAN, run } from '../testing/rules';
import { applyRuleChanges, type RuleChange } from './rule-changes';
import { readRuleListing } from './rule-read';
import { ruleRefusalOf } from './rule-refusals';
import { listedRule, listedRuleBody } from './rule-listing';
import {
  readRuleRuns,
  readRulesState,
  rulesPath,
  sentenceOutlineOf,
  type RulesState,
} from './rule-state';

// docs/specs/026-plan/automations.md "Agents and the CLI": the reads, the changes in order, and the refusals' words.
const base = rulesPath(DOC_A);
const plan = `/projects/${DOC_A}/plan`;
const refusal = (status: number, body: unknown) => Response.json(body, { status });

function world(
  rules: AutomationListedRule[] = [listed()],
  answer: (r: Request, body: Record<string, unknown> | null) => Response | null = () => null,
) {
  const sent: string[] = [];
  const bodies: unknown[] = [];
  const write = async (r: Request) => {
    const path = new URL(r.url).pathname.replace(/^\/api/, '');
    sent.push(`${r.method} ${path.replace(base, '')}`);
    const text = await r.text();
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    if (body) bodies.push(body);
    const special = answer(r, body);
    if (special) return special;
    if (r.method === 'DELETE') return new Response(null, { status: 204 });
    if (path.endsWith('/test') || path.endsWith('/run')) return Response.json({ run: run() });
    const id = path.endsWith('/duplicate') ? 'r9' : path === base ? 'new' : path.split('/')[4]!;
    const enabled = path.endsWith('/toggle')
      ? body!['enabled'] === true
      : !path.endsWith('/duplicate');
    return Response.json({
      rule: listed({
        ...(body ?? {}),
        id,
        enabled,
        name: path.endsWith('/duplicate')
          ? 'Done stamp copy'
          : ((body?.['name'] as string) ?? 'Done stamp'),
      }),
    });
  };
  const api = fakeApi({
    [base]: (r: Request) => (r.method === 'GET' ? Response.json(listOf(rules)) : write(r)),
    [plan]: PLAN,
    [`/projects/${DOC_A}/items`]: { items: [CARD], rev: 1 },
    [`${base}/runs`]: { runs: [run()] },
    [`${base}/r1`]: write,
    [`${base}/r1/toggle`]: write,
    [`${base}/r1/duplicate`]: write,
    [`${base}/r1/run`]: write,
    [`${base}/test`]: write,
  });
  return { api, sent, bodies };
}

async function apply(changes: RuleChange[], w = world()) {
  const state: RulesState = await readRulesState(w.api, DOC_A);
  return { ...(await applyRuleChanges(w.api, DOC_A, changes, state)), ...w };
}

describe('reading the rules', () => {
  it('reads the rules and the plan together, and the runs only when asked', async () => {
    const w = world();
    const read = await readRuleListing(w.api, DOC_A, {});
    expect(read).toMatchObject({
      ok: true,
      listing: { count: 1, people: ['Ana Costa'], runsToday: 4, runsPerDay: 1000 },
    });
    expect(w.api.calls.sort()).toEqual([base, plan].sort());
    const one = await readRuleListing(w.api, DOC_A, { rule: 'Done stamp', runs: true, limit: 5 });
    expect(one).toMatchObject({
      ok: true,
      listing: { rule: { id: 'r1' }, runs: [{ id: 'run1' }] },
    });
    expect(w.api.calls).toContain(`${base}/runs?rule=r1&limit=5`);
    await readRuleListing(w.api, DOC_A, { runs: true });
    expect(w.api.calls).toContain(`${base}/runs?limit=20`);
    expect(await readRuleListing(w.api, DOC_A, { rule: 'Nope' })).toMatchObject({
      ok: false,
      code: 'rule_unknown',
    });
  });

  it('keeps the runs within 50, and reads a plan with no people', async () => {
    const w = world();
    await readRuleRuns(w.api, DOC_A, { limit: 500 });
    expect(w.api.calls).toContain(`${base}/runs?limit=50`);
    const bare = fakeApi({
      [base]: { rules: [], runsToday: 0, runsPerDay: 1000 },
      [plan]: PLAN,
    });
    expect(await readRuleListing(bare, DOC_A, {})).toMatchObject({
      ok: true,
      listing: { people: [], count: 0 },
    });
  });
});

describe('changing the rules', () => {
  it('adds, sets, turns on and off, copies and deletes, in order', async () => {
    const r = await apply([
      { op: 'add', rule: { name: 'Bug stamp', trigger: { kind: 'card_moved', to: ['Done'] } } },
      { op: 'set', rule: 'Done stamp', steps: [{ kind: 'move', status: 'To Do' }] },
      { op: 'off', rule: 'r1' },
      { op: 'on', rule: 'r1' },
      { op: 'duplicate', rule: 'Done stamp' },
      { op: 'delete', rule: 'r1' },
    ]);
    expect(r.refusal).toBeUndefined();
    expect(r.applied).toEqual([
      '+ rule new "Bug stamp" (on)',
      '~ rule "Done stamp" changed (on)',
      '~ rule "Done stamp" off',
      '~ rule "Done stamp" on',
      '+ rule r9 "Done stamp copy" (off, a copy of "Done stamp")',
      '- rule "Done stamp"',
    ]);
    expect(r.sent).toEqual([
      'POST ',
      'PUT /r1',
      'POST /r1/toggle',
      'POST /r1/toggle',
      'POST /r1/duplicate',
      'DELETE /r1',
    ]);
    // An added rule takes the defaults and the plan's ids; a set lays its parts over the saved body.
    expect(r.bodies[0]).toEqual({
      name: 'Bug stamp',
      trigger: { kind: 'card_moved', to: ['done'] },
      conditions: [],
      steps: [],
      chain: false,
      timeZone: 'UTC',
    });
    expect(r.bodies[1]).toMatchObject({
      name: 'Done stamp',
      timeZone: 'Europe/London',
      steps: [{ kind: 'move', status: 'todo' }],
    });
    expect(r.bodies.slice(2)).toEqual([{ enabled: false }, { enabled: true }]);
  });

  // Spec "A rule read back writes back": list_rules' rule (or rule get) pasted into add, set or test is taken, its id,
  // enabled and stamps left out of what the api is sent.
  it('takes a rule read back whole, sending the api only its body', async () => {
    const read = {
      id: 'r1',
      enabled: true,
      made: { by: { id: 'p1', name: 'Ana Costa' }, at: 1 },
      edited: { by: { id: 'p1', name: 'Ana Costa' }, at: 2 },
      name: 'Pasted',
      trigger: { kind: 'card_moved', to: ['done'] },
      conditions: [],
      steps: [{ kind: 'add_label', label: 'shipped' }],
      chain: false,
      timeZone: 'Europe/London',
    };
    const r = await apply([
      { op: 'add', rule: read },
      { op: 'set', ...read, rule: 'Done stamp' },
      { op: 'test', rule: read, card: '#12' },
    ]);
    expect(r.refusal).toBeUndefined();
    const sentKeys = ['chain', 'conditions', 'name', 'steps', 'timeZone', 'trigger'];
    expect(Object.keys(r.bodies[0] as object).sort()).toEqual(sentKeys);
    expect(Object.keys(r.bodies[1] as object).sort()).toEqual(sentKeys);
    expect(Object.keys((r.bodies[2] as { rule: object }).rule).sort()).toEqual(sentKeys);
  });

  // Card Moved's Card Types round trip: written by name, saved by id, listed back by name in the sentence.
  it('writes Card Moved’s card types by name and lists them back', async () => {
    const r = await apply([
      {
        op: 'add',
        rule: {
          name: 'Bug done',
          trigger: { kind: 'card_moved', types: ['Bug'], from: ['To Do'], to: ['Done'] },
          steps: [{ kind: 'add_label', label: 'shipped' }],
        },
      },
    ]);
    expect(r.refusal).toBeUndefined();
    const trigger: AutomationTrigger = {
      kind: 'card_moved',
      types: ['bug'],
      from: ['todo'],
      to: ['done'],
    };
    expect(r.bodies[0]).toMatchObject({ trigger });
    const saved = listed({ trigger });
    const state = await readRulesState(world([saved]).api, DOC_A);
    expect(listedRule(saved, sentenceOutlineOf(state)).sentence).toBe(
      'When Card Moved for Bug from To Do to Done then Add Label shipped',
    );
    expect(listedRuleBody(saved).trigger).toEqual(trigger);
  });

  it('says when a saved rule needs attention', async () => {
    const w = world([listed()], (_r, body) =>
      body && 'name' in body
        ? Response.json({
            rule: listed({ name: body['name'] as string, needs: ['Column qa is gone'] }),
          })
        : null,
    );
    const r = await apply([{ op: 'set', rule: 'r1', name: 'Renamed' }], w);
    expect(r.applied).toEqual([
      '~ rule "Renamed" changed (on), needs attention: Column qa is gone',
    ]);
  });

  // Work Tracker 780: a person named as list_rules lists them saves as their id, in an add, a set and a test alike;
  // a name the plan lacks goes as written, for the api to flag.
  it('saves a person named as list_rules lists them by their id', async () => {
    const listing = await readRuleListing(world().api, DOC_A, {});
    expect(listing.ok && listing.listing.people).toEqual(['Ana Costa']);
    const mention = (person: string) => [{ kind: 'mention', to: { person }, text: 'Look' }];
    const w = world();
    await apply(
      [
        {
          op: 'add',
          rule: { name: 'Tell Ana', trigger: { kind: 'manual' }, steps: mention('Ana Costa') },
        },
        { op: 'set', rule: 'r1', steps: mention('p_ana') },
        {
          op: 'test',
          rule: { name: 'Tell', trigger: { kind: 'manual' }, steps: mention('Thomas Gone') },
          card: '#12',
        },
      ],
      w,
    );
    const steps = w.bodies.map((b) => {
      const body = b as { steps?: unknown; rule?: { steps: unknown } };
      return body.steps ?? body.rule?.steps;
    });
    expect(steps).toEqual([mention('p_ana'), mention('p_ana'), mention('Thomas Gone')]);
  });

  it('tests a saved rule or a body, and runs one, on a card read once', async () => {
    const r = await apply([
      { op: 'test', rule: 'Done stamp', card: '#12' },
      { op: 'test', rule: { name: 'Draft', trigger: { kind: 'manual' } }, card: '12' },
      { op: 'run', rule: 'r1', card: '#12' },
    ]);
    expect(r.applied).toEqual([
      '? tested "Done stamp" on #12: Done',
      '? tested "Draft" on #12: Done',
      '> ran "Done stamp" on #12: Done',
    ]);
    expect(r.runs).toHaveLength(3);
    expect(r.bodies[0]).toMatchObject({
      item: 'card12',
      ruleId: 'r1',
      rule: { name: 'Done stamp' },
    });
    expect(r.bodies[1]).not.toHaveProperty('ruleId');
    expect(r.bodies[2]).toEqual({ item: 'card12' });
    expect(r.api.calls.filter((c) => c.endsWith('/items'))).toHaveLength(1);
  });

  it('stops at a rule or a card it cannot name, saying what was applied before', async () => {
    const r = await apply([
      { op: 'off', rule: 'r1' },
      { op: 'on', rule: 'Nope' },
      { op: 'delete', rule: 'r1' },
    ]);
    expect(r.applied).toEqual(['~ rule "Done stamp" off']);
    expect(r.refusal).toMatchObject({ code: 'rule_unknown' });
    const card = await apply([{ op: 'run', rule: 'r1', card: '#99' }]);
    expect(card.refusal).toMatchObject({ code: 'item_unknown' });
  });

  it('stops at the api’s refusal with its code and the part at fault, and throws on an outage', async () => {
    const w = world([listed()], (r) =>
      r.method === 'PUT'
        ? refusal(400, {
            error: 'automation_invalid',
            path: 'steps.0.status',
            message: 'steps.0.status must be an id',
          })
        : r.url.endsWith('/run')
          ? refusal(503, { error: 'busy' })
          : null,
    );
    const r = await apply([{ op: 'set', rule: 'r1', steps: [{ kind: 'move' }] }], w);
    expect(r.refusal).toEqual({
      code: 'automation_invalid',
      message:
        'The api refused the rule (automation_invalid at steps.0.status): steps.0.status must be an id. Fix that part and send the change again.',
    });
    await expect(apply([{ op: 'run', rule: 'r1', card: '#12' }], w)).rejects.toThrow(/503/);
  });
});

describe('ruleRefusalOf', () => {
  const err = (status: number, body: unknown) =>
    new ApiError(status, typeof body === 'string' ? body : JSON.stringify(body));
  it('words each rule code the api answers, and the rest as every tool does', () => {
    expect(ruleRefusalOf(err(400, { error: 'automation_value_unknown' }))).toEqual({
      code: 'automation_value_unknown',
      message:
        'The api refused the rule (automation_value_unknown). A {{value}} the rule does not know: the values are listed in change_rules’ rule format.',
    });
    expect(ruleRefusalOf(err(403, { error: 'read_only_token' }))!.message).toMatch(
      /^The api refused it \(read_only_token\): this token is read-only/,
    );
    expect(ruleRefusalOf(err(429, { error: 'automation_budget_spent' }))!.message).toMatch(
      /1,000 runs today/,
    );
    expect(ruleRefusalOf(err(409, { error: 'something_else' }))).toEqual({
      code: 'something_else',
      message: 'The api refused it (something_else).',
    });
    expect(ruleRefusalOf(err(404, 'not json'))).toMatchObject({ code: 'http_404' });
    expect(ruleRefusalOf(err(500, { error: 'automation_invalid' }))).toBeNull();
    expect(ruleRefusalOf(new Error('boom'))).toBeNull();
  });
});
