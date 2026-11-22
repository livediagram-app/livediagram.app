import { AUTOMATION_ERRORS } from '@liveworkspace/api-schema/automations';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KeyAnswer } from '@liveworkspace/ai';
import { answerEvents, errorResponse, fakeFetch, streamResponse } from '@liveworkspace/ai/testing';
import { AI_DRAFT_PER_DAY } from '../../ai-draft';
import type { ItemRuleBody, ItemRun } from '../../item';
import { AUTOMATION_AI_PER_DAY, AUTOMATION_RULES_MAX, AUTOMATION_RUNS_PER_DAY } from '../../limits';
import type { AutomationsAi } from '../automation-ai';
import type { ItemCaller, ItemListedRule } from './route-kit';
import { ITEM_ROUTE_BODY_MAX } from './route-kit';
import { handleItemAutomationRoutes } from './routes';
import { BUDGET_SPENT, itemRunId } from './run';
import { ANA, BEN, rowsOf, world, type World } from './test-kit';

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const EDITOR: ItemCaller = { editor: true, signedIn: true, person: ANA, reader: true };
const AGENT: ItemCaller = { ...EDITOR, token: { readOnly: false } };

async function call(
  w: World,
  method: string,
  path: string,
  body?: unknown,
  caller: ItemCaller = EDITOR,
): Promise<{ status: number; body: Record<string, unknown>; response: Response | null }> {
  const url = new URL(`https://app.example/api/documents/item-1/automations${path}`);
  const segments = url.pathname.split('/').slice(5);
  const response = await handleItemAutomationRoutes({
    engine: w.engine,
    method,
    segments,
    url,
    caller,
    request: new Request(url, {
      method,
      ...(body === undefined
        ? {}
        : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    }),
  });
  if (!response) return { status: 0, body: {}, response };
  const text = await response.text();
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
    response,
  };
}

const body = (over: Partial<ItemRuleBody> = {}): ItemRuleBody => ({
  name: 'Snapshot on Join',
  trigger: { kind: 'joined' },
  conditions: [],
  steps: [{ kind: 'take_snapshot', name: 'Joined' }],
  chain: false,
  timeZone: 'UTC',
  ...over,
});
const ruleOf = (answer: { body: Record<string, unknown> }) => answer.body['rule'] as ItemListedRule;
const error = (answer: { status: number; body: Record<string, unknown> }) => [
  answer.status,
  answer.body['error'],
];

describe('the gate', () => {
  it('lets only a signed-in Editor of the whole item through', async () => {
    const w = world();
    for (const caller of [
      { ...EDITOR, editor: false },
      { ...EDITOR, signedIn: false },
    ])
      expect(error(await call(w, 'GET', '', undefined, caller))).toEqual([
        403,
        'automations_need_editor',
      ]);
    w.state.held = false;
    expect(error(await call(w, 'GET', ''))).toEqual([403, 'automations_need_editor']);
  });

  it('lets a read-only token read and nothing else', async () => {
    const w = world();
    const reader = { ...EDITOR, token: { readOnly: true } };
    expect((await call(w, 'GET', '', undefined, reader)).status).toBe(200);
    expect((await call(w, 'GET', '/runs', undefined, reader)).status).toBe(200);
    expect(error(await call(w, 'POST', '', body(), reader))).toEqual([403, 'read_only_token']);
  });

  it('answers null for a path that is none of its routes, and 405 for a verb a route lacks', async () => {
    const w = world();
    expect((await call(w, 'GET', '/a/b/c')).response).toBeNull();
    expect((await call(w, 'POST', '/r1/unknown')).response).toBeNull();
    for (const [method, path] of [
      ['PATCH', ''],
      ['GET', '/order'],
      ['GET', '/test'],
      ['GET', '/draft'],
      ['POST', '/runs'],
      ['POST', '/summary'],
      ['GET', '/r1'],
      ['GET', '/r1/toggle'],
      ['GET', '/r1/duplicate'],
      ['GET', '/r1/run'],
      ['GET', '/r1/secret'],
    ] as const)
      expect(error(await call(w, method, path))).toEqual([405, 'method_not_allowed']);
  });

  it('answers only codes the wire lists', async () => {
    const w = world();
    const answers = [
      await call(w, 'GET', '', undefined, { ...EDITOR, editor: false }),
      await call(w, 'PUT', '/nobody', body()),
      await call(w, 'POST', '', 'not json'),
    ];
    for (const answer of answers) expect(AUTOMATION_ERRORS).toContain(answer.body['error']);
  });
});

describe('rules', () => {
  it('makes a rule, on once it has a step, stamped by the caller, and lists it with its figures', async () => {
    const w = world();
    w.addTab('t1', 'Roadmap');
    const made = await call(w, 'POST', '', body());
    expect(made.status).toBe(201);
    const rule = ruleOf(made);
    expect(rule).toMatchObject({
      name: 'Snapshot on Join',
      enabled: true,
      made: { by: ANA },
      stats: { lastRunAt: null, nextAt: null, runsThisWeek: 0, failuresInARow: 0 },
      needs: [],
      attention: [],
    });
    expect(rule.made).not.toHaveProperty('ai');
    const empty = ruleOf(await call(w, 'POST', '', body({ name: 'Empty', steps: [] }), AGENT));
    expect(empty).toMatchObject({ enabled: false, made: { ai: true } });
    const list = await call(w, 'GET', '');
    expect(list.body).toMatchObject({
      runsToday: 0,
      runsPerDay: AUTOMATION_RUNS_PER_DAY,
      tabs: [{ id: 't1', name: 'Roadmap' }],
      people: [
        { id: ANA.id, name: ANA.name },
        { id: BEN.id, name: BEN.name },
      ],
    });
    expect((list.body['rules'] as ItemListedRule[]).map((r) => r.name)).toEqual([
      'Snapshot on Join',
      'Empty',
    ]);
  });

  it('refuses a rule that does not read, a name taken and a fifty-first rule', async () => {
    const w = world();
    expect((await call(w, 'POST', '', body())).status).toBe(201);
    const invalid = await call(w, 'POST', '', body({ trigger: { kind: 'edited', minutes: 1 } }));
    expect(invalid.body).toMatchObject({ error: 'automation_invalid', path: 'trigger.minutes' });
    expect(invalid.status).toBe(400);
    for (const raw of ['not json', '[1]', `"${'x'.repeat(ITEM_ROUTE_BODY_MAX)}"`])
      expect((await call(w, 'POST', '', raw)).body).toMatchObject({
        error: 'automation_invalid',
        path: 'body',
      });
    expect(error(await call(w, 'POST', '', body({ name: 'snapshot on join' })))).toEqual([
      409,
      'automation_name_taken',
    ]);
    for (let i = 1; i < AUTOMATION_RULES_MAX; i += 1) w.rule({});
    expect(error(await call(w, 'POST', '', body({ name: 'One More' })))).toEqual([
      409,
      'automation_rules_full',
    ]);
    const [first] = w.engine.store.list();
    expect(error(await call(w, 'POST', `/${first!.id}/duplicate`))).toEqual([
      409,
      'automation_rules_full',
    ]);
  });

  it('saves a rule as written now, keeping it off when it was, and stops what waited on the old one', async () => {
    const w = world();
    const rule = ruleOf(await call(w, 'POST', '', body()));
    w.rule({ name: 'Other' });
    const saved = await call(w, 'PUT', `/${rule.id}`, body({ name: 'Renamed', steps: [] }));
    expect(ruleOf(saved)).toMatchObject({ id: rule.id, name: 'Renamed', enabled: false });
    expect(ruleOf(saved).edited.at).toBeGreaterThanOrEqual(rule.made.at);
    expect(error(await call(w, 'PUT', `/${rule.id}`, body({ name: 'other' })))).toEqual([
      409,
      'automation_name_taken',
    ]);
    expect(error(await call(w, 'PUT', `/${rule.id}`, { name: '' }))).toEqual([
      400,
      'automation_invalid',
    ]);
    expect(error(await call(w, 'PUT', '/nobody', body()))).toEqual([404, 'automation_not_found']);
  });

  it('finds a rule deleted while its request’s body was read gone', async () => {
    const w = world();
    const rule = w.rule({});
    const get = vi.spyOn(w.engine.store, 'get');
    const gone = async (method: string, path: string, sent: unknown) => {
      get.mockImplementationOnce(() => rule).mockImplementationOnce(() => null);
      return error(await call(w, method, path, sent));
    };
    expect(await gone('PUT', `/${rule.id}`, body())).toEqual([404, 'automation_not_found']);
    expect(await gone('POST', `/${rule.id}/toggle`, { enabled: false })).toEqual([
      404,
      'automation_not_found',
    ]);
    expect(await gone('POST', `/${rule.id}/run`, {})).toEqual([404, 'automation_not_found']);
    get
      .mockImplementationOnce(() => rule)
      .mockImplementationOnce(() => ({ ...rule, enabled: false }));
    expect(error(await call(w, 'POST', `/${rule.id}/run`, {}))).toEqual([
      409,
      'automation_not_manual',
    ]);
  });

  it('turns a rule off and on, Resume clearing its pause and its failures', async () => {
    const w = world();
    const rule = w.rule({ trigger: { kind: 'joined' } });
    w.engine.store.update(
      { ...rule, enabled: false, paused: { reason: 'The snapshot is gone', at: 5 } },
      10,
    );
    const resumed = ruleOf(await call(w, 'POST', `/${rule.id}/toggle`, { enabled: true }));
    expect(resumed).toMatchObject({ enabled: true, stats: { failuresInARow: 0 } });
    expect(resumed).not.toHaveProperty('paused');
    expect(ruleOf(await call(w, 'POST', `/${rule.id}/toggle`, { enabled: false })).enabled).toBe(
      false,
    );
    expect((await call(w, 'POST', `/${rule.id}/toggle`, { enabled: 'yes' })).body).toMatchObject({
      error: 'automation_invalid',
      path: 'enabled',
    });
    expect((await call(w, 'POST', `/${rule.id}/toggle`, 'x')).status).toBe(400);
    const empty = w.rule({ steps: [], enabled: false });
    expect((await call(w, 'POST', `/${empty.id}/toggle`, { enabled: true })).body).toMatchObject({
      message: 'a rule needs a step to be on',
    });
    const unpicked = w.rule({ steps: [{ kind: 'revert_snapshot', snapshot: '' }], enabled: false });
    expect((await call(w, 'POST', `/${unpicked.id}/toggle`, { enabled: true })).body).toMatchObject(
      {
        message: 'pick what the rule still needs before turning it on',
      },
    );
  });

  it('duplicates a rule, off, under a free name, and deletes one', async () => {
    const w = world();
    const rule = w.rule({ name: 'Nightly' });
    w.engine.store.update({ ...rule, paused: { reason: 'x', at: 1 } });
    const copy = ruleOf(await call(w, 'POST', `/${rule.id}/duplicate`));
    expect(copy).toMatchObject({ name: 'Nightly copy', enabled: false });
    expect(copy).not.toHaveProperty('paused');
    expect(copy.id).not.toBe(rule.id);
    expect((await call(w, 'DELETE', `/${rule.id}`)).status).toBe(204);
    expect(error(await call(w, 'DELETE', `/${rule.id}`))).toEqual([404, 'automation_not_found']);
  });

  it('answers a rule deleted while the item was read with no figures of its own', async () => {
    const w = world();
    const outline = w.kit.outline;
    w.kit.outline = () => {
      w.sql.exec('DELETE FROM automation_rules');
      return outline();
    };
    expect(ruleOf(await call(w, 'POST', '', body())).stats.failuresInARow).toBe(0);
  });

  it('reorders the list, given every rule once', async () => {
    const w = world();
    const a = w.rule({});
    const b = w.rule({});
    expect((await call(w, 'POST', '/order', { ids: [b.id, a.id] })).status).toBe(204);
    expect(w.engine.store.list().map((r) => r.id)).toEqual([b.id, a.id]);
    for (const ids of [[a.id], [a.id, 7], 'x'])
      expect((await call(w, 'POST', '/order', { ids })).body).toMatchObject({
        error: 'automation_invalid',
        path: 'ids',
      });
    expect((await call(w, 'POST', '/order', 'x')).status).toBe(400);
  });

  it('says what a rule names that the item lacks, a time rule’s next moment and a hook’s address', async () => {
    const w = world();
    w.addTab('t1');
    w.rule({
      trigger: { kind: 'incoming_webhook' },
      conditions: [{ kind: 'tab', tabs: ['t1', 'gone-tab'] }],
      steps: [{ kind: 'revert_snapshot', snapshot: 'gone-snap' }],
    });
    w.rule({ trigger: { kind: 'scheduled', every: 'day', at: '09:00' } });
    w.rule({
      trigger: { kind: 'gone_kind' },
      steps: [{ kind: 'revert_snapshot', snapshot: 'snap-1' }],
    });
    w.sql.exec("DELETE FROM automation_schedule WHERE rule_id = 'r2'");
    const [hooked, timed, unknown] = (await call(w, 'GET', '')).body['rules'] as ItemListedRule[];
    expect(hooked).toMatchObject({
      needs: ['Tab gone-tab is gone', 'Snapshot gone-snap is gone'],
      attention: [
        { kind: 'tab', id: 'gone-tab' },
        { kind: 'snapshot', id: 'gone-snap' },
      ],
      hook: { url: 'https://app.example/api/hooks/automations/item-1/r1', secret: null },
    });
    expect(timed!.stats.nextAt).toBeNull();
    expect(unknown).toMatchObject({ needs: [], stats: { nextAt: null } });
  });
});

describe('what only a person may save, and what an item keeps', () => {
  const revert = (snapshot: string, name = `Revert ${snapshot}`) =>
    body({ name, steps: [{ kind: 'revert_snapshot', snapshot }] });

  it('refuses a token saving or duplicating a rule that reverts', async () => {
    const w = world();
    expect(error(await call(w, 'POST', '', revert('s1'), AGENT))).toEqual([
      403,
      'automation_needs_a_person',
    ]);
    const rule = ruleOf(await call(w, 'POST', '', revert('s1')));
    expect(error(await call(w, 'PUT', `/${rule.id}`, revert('s1'), AGENT))).toEqual([
      403,
      'automation_needs_a_person',
    ]);
    expect(error(await call(w, 'POST', `/${rule.id}/duplicate`, undefined, AGENT))).toEqual([
      403,
      'automation_needs_a_person',
    ]);
    expect((await call(w, 'POST', `/${rule.id}/duplicate`)).status).toBe(201);
  });

  it('refuses a token picking a connection on add, change or duplicate, and lets it keep one', async () => {
    const w = world();
    const notify = (webhook: string, text = 'Hi') => ({
      kind: 'notify',
      via: 'slack',
      webhook,
      text,
    });
    const posting = (...hooks: string[]) =>
      body({ name: `Post ${hooks.join(' ')}`, steps: hooks.map((h) => notify(h)) as never });
    const picks = [403, 'automation_connection_needs_a_person'];
    // Add: no connection at all.
    expect(error(await call(w, 'POST', '', posting('c1'), AGENT))).toEqual(picks);
    expect((await call(w, 'POST', '', body({ name: 'No Message' }), AGENT)).status).toBe(201);
    const rule = ruleOf(await call(w, 'POST', '', posting('c1')));
    // Change: the rule's own connection kept (its text changed) is fine; another, or a second, is not.
    const kept = body({ name: rule.name, steps: [notify('c1', 'Changed')] as never });
    expect((await call(w, 'PUT', `/${rule.id}`, kept, AGENT)).status).toBe(200);
    expect(error(await call(w, 'PUT', `/${rule.id}`, posting('c2'), AGENT))).toEqual(picks);
    expect(error(await call(w, 'PUT', `/${rule.id}`, posting('c1', 'c2'), AGENT))).toEqual(picks);
    // Dropping it is no pick.
    expect((await call(w, 'PUT', `/${rule.id}`, body({ name: rule.name }), AGENT)).status).toBe(
      200,
    );
    // Duplicate: a copy naming a connection is a person's.
    const named = ruleOf(await call(w, 'POST', '', posting('c3')));
    expect(error(await call(w, 'POST', `/${named.id}/duplicate`, undefined, AGENT))).toEqual(picks);
    expect((await call(w, 'POST', `/${named.id}/duplicate`)).status).toBe(201);
    expect((await call(w, 'POST', `/${rule.id}/duplicate`, undefined, AGENT)).status).toBe(201);
    // A person picks any.
    expect((await call(w, 'PUT', `/${rule.id}`, posting('c2'))).status).toBe(200);
  });

  it('keeps at most five snapshots for an item’s rules', async () => {
    const w = world();
    const made = [];
    for (let i = 1; i <= 5; i += 1) made.push(ruleOf(await call(w, 'POST', '', revert(`s${i}`))));
    expect(error(await call(w, 'POST', '', revert('s6')))).toEqual([
      409,
      'automation_snapshots_full',
    ]);
    expect((await call(w, 'POST', '', revert('s1', 'Again'))).status).toBe(201);
    const other = ruleOf(await call(w, 'POST', '', body({ name: 'Plain' })));
    expect(error(await call(w, 'PUT', `/${other.id}`, revert('s6', 'Plain')))).toEqual([
      409,
      'automation_snapshots_full',
    ]);
    // Picking another snapshot in a rule that already keeps one lets the old one go.
    expect((await call(w, 'PUT', `/${made[4]!.id}`, revert('s6', 'Revert s5'))).status).toBe(200);
  });
});

describe('Test Rule and Run Rule', () => {
  it('tests a rule as the builder holds it: a dry run, by the caller, on the tab asked', async () => {
    const w = world();
    w.addTab('t1', 'Roadmap');
    const tested = await call(w, 'POST', '/test', {
      rule: body({
        trigger: { kind: 'comment_added' },
        steps: [{ kind: 'take_snapshot', name: '{{tab.name}}' }],
      }),
      tab: 't1',
    });
    const run = tested.body['run'] as ItemRun;
    expect(run).toMatchObject({ result: 'done', ruleId: 'test', subject: { id: 't1' } });
    expect(run.steps.map((s) => ('text' in s ? s.text : ''))).toEqual([
      'Ana Costa commented on Roadmap',
      'Would take a snapshot named “Roadmap”',
    ]);
    expect(w.taken).toEqual([]);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_runs')).toEqual([]);
  });

  it('tests a time, a call, a settle and a hand-run rule as what each would hear', async () => {
    const w = world();
    const first = async (trigger: ItemRuleBody['trigger'], caller = EDITOR) => {
      const tested = await call(w, 'POST', '/test', { rule: body({ trigger }) }, caller);
      return (tested.body['run'] as ItemRun).steps[0];
    };
    expect(await first({ kind: 'scheduled', every: 'weekday', at: '09:00' })).toEqual({
      kind: 'trigger',
      text: 'Automation · Every Weekday at 9:00',
    });
    expect(await first({ kind: 'incoming_webhook' })).toEqual({
      kind: 'trigger',
      text: 'An Incoming Webhook call',
    });
    expect(await first({ kind: 'edited', minutes: 30 })).toMatchObject({
      text: 'Edited, then quiet for 30 minutes',
      by: ANA,
    });
    expect(await first({ kind: 'manual' }, AGENT)).toMatchObject({
      text: 'Ana Costa ran the rule',
    });
  });

  it('refuses a test of a rule that does not read, or on a tab the item lacks', async () => {
    const w = world();
    expect((await call(w, 'POST', '/test', { rule: 'x' })).body).toMatchObject({
      error: 'automation_invalid',
      path: 'rule',
    });
    expect((await call(w, 'POST', '/test', { rule: body({ name: '' }) })).body).toMatchObject({
      path: 'rule.name',
    });
    expect(error(await call(w, 'POST', '/test', { rule: body(), tab: 'nope' }))).toEqual([
      404,
      'tab_not_found',
    ]);
    expect(error(await call(w, 'POST', '/test', { rule: body(), tab: 7 }))).toEqual([
      404,
      'tab_not_found',
    ]);
    expect((await call(w, 'POST', '/test', 'x')).status).toBe(400);
  });

  it('runs a Run by Hand rule now, for real, and never another kind or one that is off', async () => {
    const w = world();
    w.addTab('t1', 'Roadmap');
    const rule = w.rule({ steps: [{ kind: 'take_snapshot', name: '{{person}} on {{tab.name}}' }] });
    const ran = await call(w, 'POST', `/${rule.id}/run`, { tab: 't1' }, AGENT);
    expect(ran.body['run']).toMatchObject({
      result: 'done',
      subject: { id: 't1', title: 'Roadmap' },
    });
    expect(w.taken[0]!.name).toBe('Ana Costa on Roadmap');
    expect((await call(w, 'POST', `/${rule.id}/run`, {})).status).toBe(200);
    expect(error(await call(w, 'POST', `/${rule.id}/run`, { tab: 'nope' }))).toEqual([
      404,
      'tab_not_found',
    ]);
    expect((await call(w, 'POST', `/${rule.id}/run`, 'x')).status).toBe(400);
    const other = w.rule({ trigger: { kind: 'joined' } });
    expect(error(await call(w, 'POST', `/${other.id}/run`, {}))).toEqual([
      409,
      'automation_not_manual',
    ]);
    w.engine.store.update({ ...rule, enabled: false });
    expect(error(await call(w, 'POST', `/${rule.id}/run`, {}))).toEqual([
      409,
      'automation_not_manual',
    ]);
  });

  it('answers 429 once the day’s budget is spent', async () => {
    const w = world();
    const rule = w.rule({});
    w.sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${AUTOMATION_RUNS_PER_DAY})
       INSERT INTO automation_runs (id, rule_id, at, result, body) SELECT 'x' || i, 'r', ?, 'done', '{}' FROM n`,
      Date.now(),
    );
    const spent = await call(w, 'POST', `/${rule.id}/run`, {});
    expect(error(spent)).toEqual([429, 'automation_budget_spent']);
    expect(Number(spent.response!.headers.get('Retry-After'))).toBeGreaterThan(0);
    // Said once on the Audit Trail for the rule today, however often it is asked.
    await call(w, 'POST', `/${rule.id}/run`, {});
    const lines = (await call(w, 'GET', `/runs?rule=${rule.id}`)).body['runs'] as ItemRun[];
    expect(lines).toMatchObject([{ result: 'skipped', reason: BUDGET_SPENT, ruleId: rule.id }]);
  });

  it('answers 500, not 429, for a run that could not be claimed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const w = world();
    const rule = w.rule({});
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('0-0-0-0-0');
    const id = await itemRunId('m:0-0-0-0-0', rule.id);
    w.sql.exec(
      "INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES (?, ?, ?, 'done', '{}')",
      id,
      rule.id,
      Date.now(),
    );
    expect(error(await call(w, 'POST', `/${rule.id}/run`, {}))).toEqual([
      500,
      'automation_run_failed',
    ]);
  });
});

describe('the Audit Trail, a secret and a summary', () => {
  it('lists runs newest first, filtered, never more than the list’s cap', async () => {
    const w = world();
    const rule = w.rule({});
    await call(w, 'POST', `/${rule.id}/run`, {});
    const all = await call(w, 'GET', '/runs');
    expect(all.body['runs']).toHaveLength(1);
    const filtered = await call(w, 'GET', `/runs?rule=${rule.id}&result=done&since=1&limit=5`);
    expect(filtered.body['runs']).toHaveLength(1);
    expect((await call(w, 'GET', '/runs?result=failed')).body['runs']).toEqual([]);
    expect((await call(w, 'GET', '/runs?result=bogus&since=x&limit=x')).body['runs']).toHaveLength(
      1,
    );
  });

  it('makes an Incoming Webhook rule’s secret once, for a person only', async () => {
    const w = world();
    const rule = w.rule({ trigger: { kind: 'incoming_webhook' } });
    const made = await call(w, 'POST', `/${rule.id}/secret`);
    expect(made.status).toBe(201);
    expect(made.response!.headers.get('Cache-Control')).toBe('no-store');
    expect(String(made.body['secret'])).toMatch(/^lwh_/);
    expect(made.body['hook']).toMatchObject({
      secret: { last4: String(made.body['secret']).slice(-4) },
    });
    expect(error(await call(w, 'POST', `/${rule.id}/secret`, undefined, AGENT))).toEqual([
      403,
      'automations_need_editor',
    ]);
    const other = w.rule({});
    expect(error(await call(w, 'POST', `/${other.id}/secret`))).toEqual([
      409,
      'automation_not_incoming',
    ]);
  });

  it('shows any reader one rule by id or name, from an allow-list', async () => {
    const w = world();
    const rule = w.rule({
      name: 'Tell the Team',
      trigger: { kind: 'joined' },
      steps: [
        { kind: 'email', to: { addresses: ['ana@example.com'] }, subject: 'S', body: 'B' },
        { kind: 'notify', via: 'slack', webhook: 'c1', name: 'Secret Channel', text: 'T' },
      ],
    });
    const viewer: ItemCaller = { editor: false, signedIn: false, person: BEN, reader: true };
    const byId = await call(w, 'GET', `/summary?rule=${rule.id}`, undefined, viewer);
    expect(byId.body['rule']).toMatchObject({
      id: rule.id,
      name: 'Tell the Team',
      on: true,
      trigger: 'Someone Joined',
      steps: [
        { kind: 'email', words: 'Send Email to typed-in addresses' },
        { kind: 'notify', via: 'slack', words: 'Post to Slack' },
      ],
    });
    expect(JSON.stringify(byId.body)).not.toMatch(/example\.com|Secret Channel|c1/);
    expect(
      (await call(w, 'GET', '/summary?name=tell%20the%20team', undefined, viewer)).status,
    ).toBe(200);
    for (const query of ['?rule=nobody', '?name=nobody', '', `?rule=${'x'.repeat(201)}`])
      expect(error(await call(w, 'GET', `/summary${query}`, undefined, viewer))).toEqual([
        404,
        'automation_not_found',
      ]);
    expect(
      error(await call(w, 'GET', '/summary', undefined, { ...viewer, reader: false })),
    ).toEqual([403, 'automations_need_editor']);
    w.state.held = false;
    expect(error(await call(w, 'GET', `/summary?rule=${rule.id}`, undefined, viewer))).toEqual([
      404,
      'automation_not_found',
    ]);
  });
});

describe('Describe a Rule', () => {
  const ask = { prompt: 'Snapshot this when someone joins', timeZone: 'Europe/Lisbon' };
  const drafting = (...replies: unknown[]): { w: World; asked: unknown[] } => {
    const asked: unknown[] = [];
    const client: AutomationsAi = {
      run: (_model, inputs) => {
        asked.push(inputs);
        const reply = replies.shift();
        return reply instanceof Error
          ? Promise.reject(reply)
          : Promise.resolve({ response: reply });
      },
    };
    return { w: world({ ai: { client } }), asked };
  };
  const drafted = {
    outcome: 'rule',
    rule: {
      name: 'Snapshot on Join',
      trigger: { kind: 'tab_added' },
      conditions: [{ kind: 'tab', tabs: ['roadmap', 'No Such Tab'] }],
      steps: [
        { kind: 'take_snapshot', name: 'Joined https://evil.example' },
        { kind: 'notify', via: 'slack', webhook: 'made-up', text: 'Hi' },
        { kind: 'revert_snapshot', snapshot: 'made-up' },
      ],
    },
  };

  it('answers a rule to open in the builder, with what is left to pick, and tells the model only tab names', async () => {
    const { w, asked } = drafting(drafted);
    w.addTab('t1', 'Roadmap');
    w.rule({ name: 'Snapshot on Join' });
    const answer = await call(w, 'POST', '/draft', ask);
    expect(answer.status).toBe(200);
    expect(answer.body['rule']).toMatchObject({
      name: 'Snapshot on Join 2',
      chain: false,
      timeZone: 'Europe/Lisbon',
      conditions: [{ kind: 'tab', tabs: ['t1', ''] }],
      steps: [
        { kind: 'take_snapshot', name: 'Joined' },
        { kind: 'notify', webhook: '' },
        { kind: 'revert_snapshot', snapshot: '' },
      ],
    });
    expect(answer.body['picks']).toEqual([
      { path: 'conditions.0', pick: 'tab' },
      { path: 'steps.1', pick: 'connection' },
      { path: 'steps.2', pick: 'snapshot' },
    ]);
    const sent = JSON.stringify(asked[0]);
    expect(sent).toContain('Roadmap');
    expect(sent).not.toContain(ANA.name);
    expect(w.engine.store.list()).toHaveLength(1);
    await w.settled();
    expect(w.events.map((e) => e.type)).toEqual(['AutomationAiDraft']);
    expect(w.engine.store.aiAsks).toBe(1);
  });

  it('asks once more with the check’s words, then gives up', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = {
      outcome: 'rule',
      rule: { name: 'X', trigger: { kind: 'nope' }, conditions: [], steps: [] },
    };
    const { w, asked } = drafting('not an object', bad);
    const answer = await call(w, 'POST', '/draft', ask);
    expect(error(answer)).toEqual([422, 'automation_draft_unreadable']);
    expect(asked).toHaveLength(2);
    expect(JSON.stringify(asked[1])).toContain('the reply must be one JSON object');
    const second = drafting(bad, drafted);
    expect((await call(second.w, 'POST', '/draft', ask)).status).toBe(200);
    expect(JSON.stringify(second.asked[1])).toContain('trigger.kind');
  });

  it('says so when the request is no rule, the model fails, or there is no model', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const off = drafting({ outcome: 'not_a_rule' });
    const answer = await call(off.w, 'POST', '/draft', ask);
    expect(error(answer)).toEqual([422, 'automation_draft_off_topic']);
    expect(answer.body['message']).toContain('this document');
    await off.w.settled();
    expect(off.w.events.map((e) => e.type)).toEqual(['AutomationAiDraft', 'AutomationAiOffTopic']);
    expect(error(await call(drafting(new Error('down')).w, 'POST', '/draft', ask))).toEqual([
      503,
      'automation_ai_unavailable',
    ]);
    expect(error(await call(world(), 'POST', '/draft', ask))).toEqual([
      503,
      'automation_ai_unavailable',
    ]);
  });

  it('refuses an empty or over-long request and a missing time zone', async () => {
    const { w } = drafting();
    for (const sent of [
      { timeZone: 'UTC' },
      { prompt: ' ', timeZone: 'UTC' },
      { prompt: 'x'.repeat(501), timeZone: 'UTC' },
    ])
      expect((await call(w, 'POST', '/draft', sent)).body).toMatchObject({
        error: 'automation_draft_invalid',
        path: 'prompt',
      });
    expect((await call(w, 'POST', '/draft', { prompt: 'x' })).body).toMatchObject({
      path: 'timeZone',
    });
    expect((await call(w, 'POST', '/draft', 'x')).status).toBe(400);
  });

  it('holds drafts to the day’s AI asks and to twenty a day', async () => {
    const spent = drafting(drafted);
    spent.w.sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${AUTOMATION_AI_PER_DAY})
       INSERT INTO automation_ai_drafts (at, retry) SELECT ?, 1 FROM n`,
      Date.now(),
    );
    const capped = await call(spent.w, 'POST', '/draft', ask);
    expect(error(capped)).toEqual([429, 'automation_ai_capped']);
    expect(capped.body['message']).toBe('This document has used its 100 AI steps today');
    const drafts = drafting(drafted);
    drafts.w.sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${AI_DRAFT_PER_DAY})
       INSERT INTO automation_ai_drafts (at, retry) SELECT ?, 0 FROM n`,
      Date.now(),
    );
    expect((await call(drafts.w, 'POST', '/draft', ask)).body['message']).toContain(
      'has drafted 20 rules today',
    );
  });

  it('counts an ask made while the item was read: a first past the cap is refused, a second not made', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fill = (w: World, count: number) =>
      w.sql.exec(
        `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${count})
         INSERT INTO automation_ai_drafts (at, retry) SELECT ?, 1 FROM n`,
        Date.now(),
      );
    const first = drafting(drafted);
    const outline = first.w.kit.outline;
    first.w.kit.outline = () => {
      fill(first.w, AUTOMATION_AI_PER_DAY);
      return outline();
    };
    expect(error(await call(first.w, 'POST', '/draft', ask))).toEqual([
      429,
      'automation_ai_capped',
    ]);
    const second = drafting('unreadable', drafted);
    fill(second.w, AUTOMATION_AI_PER_DAY - 1);
    expect(error(await call(second.w, 'POST', '/draft', ask))).toEqual([
      422,
      'automation_draft_unreadable',
    ]);
    expect(second.asked).toHaveLength(1);
  });

  // ai-keys.md "Every AI feature honours the choice": the caller's key, or the item's team's, drafts it.
  describe('on a key', () => {
    const KEY = 'sk-ant-api03-planted-secret-key-9z9z';
    const keyed = (answer: KeyAnswer | null): ItemCaller => ({ ...EDITOR, aiKey: async () => answer });
    const teamKey: KeyAnswer = {
      status: 'key',
      source: 'team',
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      key: KEY,
    };
    const onProvider = (respond: () => Response) => {
      const faked = fakeFetch(respond);
      vi.stubGlobal('fetch', faked.fetch);
      return faked.sent;
    };
    afterEach(() => vi.unstubAllGlobals());

    it('drafts on the provider, spending none of the item’s AI asks or drafts', async () => {
      const sent = onProvider(() => streamResponse(answerEvents([JSON.stringify(drafted)])));
      const { w, asked } = drafting();
      w.addTab('t1', 'Roadmap');
      w.sql.exec(
        `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${AUTOMATION_AI_PER_DAY})
         INSERT INTO automation_ai_drafts (at, retry) SELECT ?, 1 FROM n`,
        Date.now(),
      );
      const before = rowsOf(w.sql, 'SELECT COUNT(*) AS n FROM automation_ai_drafts');
      const answer = await call(w, 'POST', '/draft', ask, keyed(teamKey));
      expect(answer.status).toBe(200);
      expect(asked).toHaveLength(0);
      expect(sent).toHaveLength(1);
      expect(sent[0]!.headers['x-api-key']).toBe(KEY);
      expect(sent[0]!.body['model']).toBe('claude-opus-5-5');
      expect(rowsOf(w.sql, 'SELECT COUNT(*) AS n FROM automation_ai_drafts')).toEqual(before);
    });

    it('says a key the provider refuses, whose it is, and never drafts on built-in AI instead', async () => {
      onProvider(() => errorResponse(401, 'authentication_error'));
      const { w, asked } = drafting(drafted);
      const answer = await call(w, 'POST', '/draft', ask, keyed(teamKey));
      expect(error(answer)).toEqual([422, 'ai_key_failed']);
      expect(answer.body['aiKey']).toEqual({ source: 'team', provider: 'anthropic', kind: 'bad-key' });
      expect(JSON.stringify(answer.body)).not.toContain(KEY);
      expect(asked).toHaveLength(0);
    });

    it('says the provider’s own busy words where the key is fine', async () => {
      onProvider(() => errorResponse(529, 'overloaded_error'));
      const answer = await call(drafting().w, 'POST', '/draft', ask, keyed(teamKey));
      expect(error(answer)).toEqual([503, 'automation_ai_unavailable']);
      expect(answer.body['aiKey']).toBeUndefined();
    });

    it('refuses a key that will not open, and says accounts was unreachable, before any ask', async () => {
      const { w, asked } = drafting(drafted);
      const unreadable = await call(
        w,
        'POST',
        '/draft',
        ask,
        keyed({ status: 'unreadable', source: 'account' }),
      );
      expect(error(unreadable)).toEqual([422, 'ai_key_failed']);
      expect(unreadable.body['aiKey']).toEqual({
        source: 'account',
        provider: null,
        kind: 'unreadable',
      });
      const away = await call(w, 'POST', '/draft', ask, keyed({ status: 'unavailable' }));
      expect(error(away)).toEqual([503, 'automation_ai_unavailable']);
      expect(asked).toHaveLength(0);
    });

    it('drafts on built-in AI with no key, counting as before', async () => {
      const { w, asked } = drafting(drafted, drafted);
      expect((await call(w, 'POST', '/draft', ask, keyed({ status: 'none' }))).status).toBe(200);
      expect((await call(w, 'POST', '/draft', ask, keyed(null))).status).toBe(200);
      expect(asked).toHaveLength(2);
    });
  });
});
