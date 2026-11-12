import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import {
  AUTOMATION_RULES_MAX,
  ITEMS_MAX,
  defaultCatalogue,
  type AutomationRun,
  type Item,
} from '@liveplanner/items';
import type { AutomationsListResponse } from '@liveplanner/api-schema';
import type { FormDefinition } from '@liveplanner/forms';
import { respond } from '../../forms/respond';
import { makeTestRouteContext } from '../../routes/test-route-context';
import { endRepeatWorld } from '../test-repeat-world';
import { AUTOMATION_NO_MATCH_LOG_MAX } from './automation-log';
import { automationWorld, type AutomationWorld } from './test-automation-world';

// A run the card refuses part way, the day's budget against No Match runs, and a Form Response rule started by a
// real response (docs/specs/026-plan/automations.md "Actions", "Runs, limits and loops", "Triggers").
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  w = await automationWorld();
  const catalogue = structuredClone(defaultCatalogue()) as unknown as {
    types: { id: string; fields?: string[]; custom?: unknown[] }[];
  };
  const task = catalogue.types.find((t) => t.id === 'task')!;
  task.fields = [...(task.fields ?? []), 'f-sev', 'f-calc'];
  task.custom = [
    ...(task.custom ?? []),
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low', 'High'], required: true },
    { id: 'f-calc', label: 'Score', kind: 'calculated', calculation: 'formula', formula: '1' },
  ];
  const put = await w.send('PUT', '/api/projects/A/item-types', { itemTypes: catalogue });
  if (put.status !== 200) throw new Error(`item types answered ${put.status}: ${await put.text()}`);
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const plan = () => w.plans.get('A')!;
const room = () => plan().room;
const move = (id: string, status: string) =>
  w.send('POST', `/api/projects/A/items/${id}/move`, { status });
const card = async (id: string): Promise<Item> => (await w.items('A')).find((i) => i.id === id)!;
const runs = async (query = '') =>
  (await (await w.call('GET', `/runs${query}`)).json<{ runs: AutomationRun[] }>()).runs;
const list = async () => (await w.call('GET', '')).json<AutomationsListResponse>();
const make = (title: string) => w.make('A', { title, 'f-sev': 'High' });

describe('a step the card refuses', () => {
  it.each([
    [
      'sets a Calculated field',
      { kind: 'set_field', field: 'f-calc', value: { number: 3 } },
      'Score is worked out, never set',
    ],
    [
      'clears a required field',
      { kind: 'clear_field', field: 'f-sev' },
      'Task cards need Severity',
    ],
  ] as const)('fails when it %s, the steps before it done', async (_what, refused, reason) => {
    await w.rule({ steps: [{ kind: 'add_label', label: 'shipped' }, refused, { kind: 'flag' }] });
    const c = await make('Refused');
    await move(c.id, 'done');
    await room().alarm();
    const [run] = await runs();
    expect(run).toMatchObject({ result: 'failed', reason });
    expect(run!.steps.at(-1)).toMatchObject({ kind: 'action', ok: false, text: reason });
    const after = await card(c.id);
    expect(after.fields['labels']).toEqual(['shipped']);
    expect(after.fields['flagged']).toBeUndefined();
    expect(after.fields['f-sev']).toBe('High');
  });

  it('fails Create Card on a full plan, the card change before it done', async () => {
    await w.rule({
      steps: [
        { kind: 'add_label', label: 'shipped' },
        { kind: 'create_card', type: 'note', title: 'Follow up' },
      ],
    });
    const c = await make('Full');
    // The plan filled to the card cap behind the routes' backs.
    plan().db.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${ITEMS_MAX - 1})
       INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
       SELECT plan_id, id || '-' || n.i, type, item_key + n.i, rank, fields, rev, created_at, updated_at, created_by,
              updated_by
         FROM items, n WHERE id = '${c.id}'`,
    );
    await move(c.id, 'done');
    await room().alarm();
    const [run] = await runs();
    expect(run).toMatchObject({
      result: 'failed',
      reason: 'The plan holds as many cards as it may',
    });
    expect((await card(c.id)).fields['labels']).toEqual(['shipped']);
    expect(plan().db.prepare('SELECT COUNT(*) AS n FROM items').get()).toEqual({ n: ITEMS_MAX });
  });
});

describe('the day and the log against No Match runs', () => {
  it('50 broad rules that match nothing never spend the budget a real rule needs', async () => {
    for (let i = 0; i < AUTOMATION_RULES_MAX - 1; i += 1)
      await w.rule({
        name: `Broad ${i}`,
        trigger: { kind: 'field_changed', fields: ['priority'] },
        conditions: [{ kind: 'field', field: 'title', op: 'contains', value: `never ${i}` }],
        steps: [{ kind: 'flag' }],
      });
    await w.rule({ name: 'Stamp' });
    const c = await make('Busy');
    // 30 saves past 49 rules: 1,470 No Match runs, more than the day's 1,000. Held to CPU time, not the wall clock,
    // so a loaded runner can't fail it (the test's own timeout is generous for the same reason).
    const ms = await cpuMsOfAsync(async () => {
      for (let i = 0; i < 30; i += 1) {
        await w.send('POST', `/api/projects/A/items/${c.id}`, {
          set: { priority: i % 2 ? 'high' : 'low' },
        });
        room().automations.schedule.at = Date.now();
        await room().alarm();
      }
    });
    expect(ms).toBeLessThan(cpuBudgetMs(3000));
    expect((await list()).runsToday).toBe(0);
    // The Rules list counts as the meter does: a rule that only failed to match has not run.
    const broad = (await list()).rules.find((r) => r.name === 'Broad 0')!;
    expect(broad.stats).toMatchObject({ lastRunAt: null, runsThisWeek: 0 });
    await move(c.id, 'done');
    await room().alarm();
    expect((await card(c.id)).fields['labels']).toEqual(['shipped']);
    expect((await list()).runsToday).toBe(1);
    // The log kept the run, and only the newest 500 No Match rows beside it.
    expect(await runs('?result=done')).toHaveLength(1);
    const rows = plan()
      .db.prepare("SELECT COUNT(*) AS n FROM automation_runs WHERE result = 'no_match'")
      .get();
    expect(rows).toEqual({ n: AUTOMATION_NO_MATCH_LOG_MAX });
  }, 30_000);

  it('keeps 2,000 real runs however many No Match rows come after them', async () => {
    await w.rule({
      name: 'Never',
      conditions: [{ kind: 'field', field: 'title', op: 'is', value: 'nope' }],
    });
    const insert = plan().db.prepare(
      "INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES (?, 'x', ?, 'done', '{}')",
    );
    // Two days back, so they hold no place in today's budget.
    for (let i = 0; i < 2000; i += 1) insert.run(`real${i}`, Date.now() - 2 * 24 * 60 * 60 * 1000);
    for (let i = 0; i < 3; i += 1) {
      const c = await make(`Nothing ${i}`);
      await move(c.id, 'done');
      await room().alarm();
    }
    const kept = plan().db.prepare(
      'SELECT result, COUNT(*) AS n FROM automation_runs GROUP BY result ORDER BY result',
    );
    expect(kept.all()).toEqual([
      { result: 'done', n: 2000 },
      { result: 'no_match', n: 3 },
    ]);
  });
});

describe('a Form Response rule', () => {
  const form: FormDefinition = {
    v: 1,
    heading: 'Bug Report',
    sections: [
      {
        id: 's-1',
        title: '',
        questions: [
          {
            id: 'q-sum',
            type: 'short',
            prompt: 'Summary',
            required: true,
            goesTo: { to: 'title' },
          },
          {
            id: 'q-sev',
            type: 'single',
            prompt: 'Severity',
            options: ['Low', 'High'],
            required: true,
            goesTo: { to: 'field', fieldId: 'f-sev' },
          },
        ],
      },
    ],
    destination: { tabId: 't1', typeId: 'task', status: 'todo' },
  };

  it('runs on a response through the form, as the form', async () => {
    const put = await w.send('PUT', '/api/projects/A/tabs/f1', {
      id: 'f1',
      name: 'Form',
      kind: 'form',
      elements: [],
      form,
    });
    expect(put.status).toBeLessThan(300);
    plan().db.exec(
      "INSERT INTO form_links (code, project_id, tab_id, created_at) VALUES ('code1234', 'A', 'f1', 1)",
    );
    await w.rule({
      name: 'Triage',
      trigger: { kind: 'form_response', formTab: 'f1' },
      conditions: [{ kind: 'who', not: true, who: [{ role: 'editor' }] }],
      steps: [{ kind: 'add_label', label: 'from form' }],
    });
    // A card an Editor makes is no response.
    await make('By hand');
    const ctx = makeTestRouteContext('POST', '/api/forms/code1234', {
      env: room().roomEnv!,
      owner: null,
      body: { answers: { 'q-sum': 'Login broken', 'q-sev': 'High' } },
      headers: { 'CF-Connecting-IP': '203.0.113.9' },
    });
    const warn = vi.spyOn(console, 'warn');
    const res = await respond(ctx, 'code1234');
    expect(res.status, JSON.stringify(warn.mock.calls)).toBe(201);
    await room().alarm();
    const made = (await w.items('A')).find((i) => i.fields['title'] === 'Login broken')!;
    expect(made.fields['labels']).toEqual(['from form']);
    const all = await runs();
    expect(all).toMatchObject([{ result: 'done', ruleName: 'Triage', card: { id: made.id } }]);
    expect(all[0]!.steps[0]).toMatchObject({
      kind: 'trigger',
      text: 'A form response made the card',
    });
  });
});
