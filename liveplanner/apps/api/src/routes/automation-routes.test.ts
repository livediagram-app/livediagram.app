import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOMATION_RULES_MAX, type AutomationRule, type AutomationRun } from '@liveplanner/items';
import type { AutomationListedRule, AutomationsListResponse } from '@liveplanner/api-schema';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import {
  automationWorld,
  ruleBody,
  type AutomationWorld,
  type Caller,
} from '../plan-room/automations/test-automation-world';

// The Automations routes (docs/specs/026-plan/automations.md "Who can use it"; blueprint automations.md "Routes"):
// an Editor's of the whole plan, signed in, in person; the rule's checks; Test on a Card and Run Rule.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  w = await automationWorld();
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const room = () => w.plans.get('A')!.room;
const body = async <T>(res: Response | Promise<Response>) => (await (await res).json()) as T;
const listOf = async () => body<AutomationsListResponse>(w.call('GET', ''));

describe('who may use them', () => {
  const allowed: Caller[] = ['owner', 'team', 'editor_link'];
  const refused: Caller[] = ['tab_editor_link', 'participant', 'viewer', 'token', 'guest'];

  it.each(allowed)('a %s lists, makes and runs rules', async (who) => {
    expect((await w.call('GET', '', undefined, who)).status).toBe(200);
    const res = await w.call('POST', '', ruleBody(), who);
    expect(res.status).toBe(201);
    const { rule } = await body<{ rule: AutomationRule }>(res);
    expect((await w.call('GET', `/runs`, undefined, who)).status).toBe(200);
    expect((await w.call('POST', `/${rule.id}/duplicate`, undefined, who)).status).toBe(201);
  });

  it.each(refused)('a %s is refused every route', async (who) => {
    const held = await w.rule({});
    const doors: [string, string, unknown?][] = [
      ['GET', ''],
      ['POST', '', ruleBody({ name: 'Other' })],
      ['PUT', `/${held.id}`, ruleBody()],
      ['DELETE', `/${held.id}`],
      ['POST', `/${held.id}/toggle`, { enabled: false }],
      ['POST', `/${held.id}/duplicate`],
      ['POST', `/${held.id}/run`, { item: 'x' }],
      ['POST', '/order', { ids: [held.id] }],
      ['POST', '/test', { rule: ruleBody(), item: 'x' }],
      ['GET', '/runs'],
    ];
    for (const [method, path, payload] of doors) {
      const res = await w.call(method, path, payload, who);
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(await res.json()).toEqual({ error: 'automations_need_editor' });
    }
    expect((await listOf()).rules).toHaveLength(1);
  });
});

describe('the rules', () => {
  it('makes a rule on once it has an action, last in the list, with its figures', async () => {
    const draft = await w.rule({ name: 'Draft', steps: [] });
    const on = await w.rule({ name: 'On' });
    expect(draft.enabled).toBe(false);
    expect(on.enabled).toBe(true);
    const list = await listOf();
    expect(list.rules.map((r) => r.name)).toEqual(['Draft', 'On']);
    expect(list.rules[1]).toMatchObject({
      made: { by: { name: 'Someone' } },
      stats: { lastRunAt: null, runsThisWeek: 0, failuresInARow: 0 },
      needs: [],
    });
    expect(list).toMatchObject({ runsToday: 0, runsPerDay: 1000 });
  });

  it('refuses a rule that does not read, a name taken, and the 51st rule', async () => {
    const bad = await w.call('POST', '', { ...ruleBody(), steps: [{ kind: 'move' }] });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: 'automation_invalid', path: 'steps.0.status' });
    const unknown = await w.call(
      'POST',
      '',
      ruleBody({ steps: [{ kind: 'comment', text: '{{nope}}' }] }),
    );
    expect(await unknown.json()).toMatchObject({ error: 'automation_value_unknown' });
    expect((await w.call('POST', '', 'not json')).status).toBe(400);
    await w.rule({});
    const taken = await w.call('POST', '', ruleBody({ name: 'done STAMP' }));
    expect(taken.status).toBe(409);
    expect(await taken.json()).toMatchObject({ error: 'automation_name_taken', path: 'name' });
    for (let i = 1; i < AUTOMATION_RULES_MAX; i += 1) await w.rule({ name: `R${i}` });
    const full = await w.call('POST', '', ruleBody({ name: 'One more' }));
    expect(await full.json()).toEqual({ error: 'automation_rules_full' });
    const held = (await listOf()).rules[0]!;
    expect(await body(w.call('POST', `/${held.id}/duplicate`))).toEqual({
      error: 'automation_rules_full',
    });
  });

  it('saves, toggles, duplicates, orders and deletes', async () => {
    const a = await w.rule({ name: 'A' });
    const b = await w.rule({ name: 'B' });
    const saved = await body<{ rule: AutomationListedRule }>(
      w.call('PUT', `/${a.id}`, ruleBody({ name: 'A2', steps: [{ kind: 'flag' }] })),
    );
    expect(saved.rule).toMatchObject({ id: a.id, name: 'A2', enabled: true, made: a.made });
    expect((await w.call('PUT', `/${a.id}`, ruleBody({ name: 'b' }))).status).toBe(409);
    // A save that drops every action turns it off.
    const emptied = await body<{ rule: AutomationRule }>(
      w.call('PUT', `/${a.id}`, ruleBody({ name: 'A2', steps: [] })),
    );
    expect(emptied.rule.enabled).toBe(false);
    const refused = await w.call('POST', `/${a.id}/toggle`, { enabled: true });
    expect(await refused.json()).toMatchObject({ error: 'automation_invalid', path: 'steps' });
    expect((await w.call('POST', `/${a.id}/toggle`, { enabled: 'yes' })).status).toBe(400);
    const off = await body<{ rule: AutomationRule }>(
      w.call('POST', `/${b.id}/toggle`, { enabled: false }),
    );
    expect(off.rule.enabled).toBe(false);
    expect(room().automations.kinds.size).toBe(0);
    const copy = await body<{ rule: AutomationRule }>(w.call('POST', `/${b.id}/duplicate`));
    expect(copy.rule).toMatchObject({ name: 'B copy', enabled: false });
    expect((await w.call('POST', '/order', { ids: [copy.rule.id, b.id, a.id] })).status).toBe(204);
    expect((await listOf()).rules.map((r) => r.name)).toEqual(['B copy', 'B', 'A2']);
    expect((await w.call('POST', '/order', { ids: [a.id] })).status).toBe(400);
    expect((await w.call('POST', '/order', { ids: [a.id, a.id, b.id] })).status).toBe(400);
    expect((await w.call('POST', '/order', { ids: [a.id, b.id, 'x'] })).status).toBe(400);
    expect((await w.call('DELETE', `/${b.id}`)).status).toBe(204);
    expect(await body(w.call('DELETE', `/${b.id}`))).toEqual({ error: 'automation_not_found' });
    expect((await w.call('PATCH', `/${a.id}`)).status).toBe(405);
    expect((await w.call('GET', `/${a.id}/toggle`)).status).toBe(405);
    expect((await w.call('PUT', '')).status).toBe(405);
  });

  it('says what a rule names that the plan lacks', async () => {
    await w.rule({ steps: [{ kind: 'move', status: 'qa' }] });
    expect((await listOf()).rules[0]!.needs).toEqual(['Column qa is gone']);
  });
});

describe('Test on a Card and Run Rule', () => {
  it('tests a rule on a card, changing nothing and logging nothing', async () => {
    const c = await w.make('A', { title: 'Try me' });
    const res = await body<{ run: AutomationRun }>(
      w.call('POST', '/test', {
        rule: ruleBody({ steps: [{ kind: 'move', status: 'done' }] }),
        item: c.id,
      }),
    );
    expect(res.run).toMatchObject({
      result: 'done',
      steps: [{ kind: 'trigger' }, { kind: 'action', ok: true, text: 'Move to Done' }],
    });
    expect((await w.items('A'))[0]!.fields['status']).toBe('todo');
    expect(await body(w.call('GET', '/runs'))).toEqual({ runs: [] });
    expect((await w.call('POST', '/test', { rule: ruleBody(), item: 'nope' })).status).toBe(404);
    const bad = await body(w.call('POST', '/test', { rule: { name: '' }, item: c.id }));
    expect(bad).toMatchObject({ error: 'automation_invalid', path: 'rule.name' });
  });

  it('runs a Run from a Card rule now, and logs it', async () => {
    const manual = await w.rule({
      name: 'Escalate',
      trigger: { kind: 'manual' },
      steps: [{ kind: 'flag' }],
    });
    const moved = await w.rule({});
    const c = await w.make('A', { title: 'Hot' });
    const { run } = await body<{ run: AutomationRun }>(
      w.call('POST', `/${manual.id}/run`, { item: c.id }),
    );
    expect(run).toMatchObject({ result: 'done', ruleName: 'Escalate' });
    expect((await w.items('A'))[0]!.fields['flagged']).toBe(true);
    const logged = await body<{ runs: AutomationRun[] }>(
      w.call('GET', `/runs?rule=${manual.id}&result=done&since=0&limit=5`),
    );
    expect(logged.runs).toHaveLength(1);
    expect(await body(w.call('POST', `/${moved.id}/run`, { item: c.id }))).toEqual({
      error: 'automation_not_manual',
    });
    expect((await w.call('POST', `/${manual.id}/run`, { item: 'nope' })).status).toBe(404);
    // Past the day's budget nothing runs.
    const insert = w.plans
      .get('A')!
      .db.prepare(
        "INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES (?, 'x', ?, 'done', '{}')",
      );
    for (let i = 0; i < 1000; i += 1) insert.run(`old${i}`, Date.now());
    const spent = await w.call('POST', `/${manual.id}/run`, { item: c.id });
    expect(spent.status).toBe(429);
    expect(
      (await body<AutomationsListResponse>(w.call('GET', ''))).rules[0]!.stats.runsThisWeek,
    ).toBe(1);
  });
});
