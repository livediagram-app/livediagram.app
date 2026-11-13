import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationRule, AutomationRun } from '@liveplanner/items';
import { endRepeatWorld } from '../test-repeat-world';
import { automationWorld, ruleBody, type AutomationWorld } from './test-automation-world';

// Generated rules through the real room (docs/specs/026-plan/automations.md "A rule", "Runs, limits and loops"), from
// a fixed seed: every rule the api saves lists, tests on a card and runs to an end the Audit Trail knows (Done,
// Failed with a reason, Skipped, No Match or Waiting), whatever ids it names, the plan's or gone or a prototype's.
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  w = await automationWorld();
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type R = () => number;
const pick = <T>(r: R, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

const IDS = ['todo', 'done', 'gone-x', '__proto__', 'constructor', 'toString'];
const FIELDS = [
  'priority',
  'due',
  'labels',
  'estimate',
  'assignee',
  'gone-f',
  '__proto__',
  'constructor',
];
const TEXTS = [
  '{{card.title}}',
  '{{card.field.constructor}}',
  '{{now - 2d}} {{card.due}}',
  'ünïcødé 🚀',
  'x'.repeat(2000),
];

const triggers = (r: R) =>
  pick(r, [
    { kind: 'manual' },
    { kind: 'card_moved', to: [pick(r, IDS)] },
    { kind: 'field_changed', fields: [pick(r, FIELDS)] },
    { kind: 'scheduled', every: 'day', at: '09:00' },
    { kind: 'stuck', days: 3, at: '09:00', statuses: [pick(r, IDS)] },
    { kind: 'incoming_webhook' },
    { kind: 'pull_request_checks', result: 'failing' },
    { kind: 'column_limit', status: pick(r, IDS), limit: 1 },
  ]);
const conditions = (r: R) =>
  pick(r, [
    { kind: 'column', statuses: [pick(r, IDS)] },
    { kind: 'type', not: true, types: [pick(r, IDS)] },
    { kind: 'field', field: pick(r, FIELDS), op: pick(r, ['empty', 'not_empty']) },
    { kind: 'field', field: pick(r, FIELDS), op: 'is', value: pick(r, TEXTS) },
    { kind: 'field', field: pick(r, FIELDS), op: 'before', value: { today: 3 } },
    { kind: 'saved_filter', tab: pick(r, ['t1', '__proto__']), filter: pick(r, IDS) },
  ]);
const actions = (r: R) =>
  pick(r, [
    { kind: 'move', status: pick(r, IDS) },
    { kind: 'set_field', field: pick(r, FIELDS), value: { text: pick(r, TEXTS) } },
    { kind: 'set_field', field: pick(r, FIELDS), value: { from: pick(r, FIELDS) } },
    { kind: 'clear_field', field: pick(r, FIELDS) },
    { kind: 'assign', to: { person: pick(r, IDS) } },
    { kind: 'assign', to: { rotate: [pick(r, IDS), pick(r, IDS), 'x'] } },
    { kind: 'add_label', label: pick(r, ['a', '__proto__']) },
    { kind: 'comment', text: pick(r, TEXTS) },
    { kind: 'set_type', type: pick(r, IDS) },
    { kind: 'add_checklist', items: [pick(r, TEXTS).slice(0, 100)] },
    { kind: 'link_card', field: pick(r, FIELDS), to: { card: pick(r, IDS) } },
    { kind: 'email', to: { person: pick(r, IDS) }, subject: 'S', body: pick(r, TEXTS) },
    { kind: 'mention', to: { assignee: true }, text: pick(r, TEXTS) },
    { kind: 'flag' },
    { kind: 'archive' },
  ]);
const steps = (r: R): unknown =>
  pick(r, [
    actions(r),
    actions(r),
    { kind: 'if', conditions: [conditions(r)], then: [actions(r)], else: [actions(r)] },
    {
      kind: 'for',
      related: pick(r, [{ kind: 'children' }, { kind: 'linked', field: pick(r, FIELDS) }]),
      conditions: [],
      then: [actions(r)],
    },
    { kind: 'wait', hours: 2 },
    { kind: 'notify', via: 'slack', webhook: pick(r, IDS), text: pick(r, TEXTS) },
    { kind: 'ai', task: 'summarise', field: pick(r, FIELDS) },
  ]);

const ENDS = new Set(['done', 'failed', 'skipped', 'no_match', 'waiting']);

describe('generated rules in a plan', () => {
  it('save, list, test on a card and run to an end the Audit Trail knows', async () => {
    const r = rng(0xa11ce);
    const card = await w.make('A', { title: 'Hostile', labels: ['a'] });
    const saved: AutomationRule[] = [];
    for (let i = 0; i < 40; i += 1) {
      const body = {
        ...ruleBody({ name: `Rule ${i}` }),
        trigger: triggers(r),
        conditions: r() < 0.5 ? [conditions(r)] : [],
        steps: [steps(r), ...(r() < 0.6 ? [steps(r)] : []), ...(r() < 0.3 ? [steps(r)] : [])],
      };
      const tested = await w.call('POST', '/test', { rule: body, item: card.id });
      const where = JSON.stringify(body).slice(0, 400);
      expect(tested.status, where).toBeLessThan(500);
      if (tested.status !== 200) {
        expect(tested.status, where).toBe(400);
        continue;
      }
      const { run } = await tested.json<{ run: AutomationRun }>();
      expect(ENDS.has(run.result), `${run.result} ${where}`).toBe(true);
      if (run.result === 'failed' || run.result === 'skipped')
        expect(run.reason?.trim(), where).toBeTruthy();
      for (const line of run.steps) expect(line.text, where).not.toMatch(/native code|\[object /);
      const made = await w.call('POST', '', body);
      expect(made.status, where).toBe(201);
      saved.push((await made.json<{ rule: AutomationRule }>()).rule);
    }
    expect(saved.length).toBeGreaterThan(10);
    const list = await w.call('GET', '');
    expect(list.status).toBe(200);
    const text = await list.text();
    expect(text).not.toMatch(/native code|\[object /);
    // A manual rule runs for real; a card moved and edited wakes every other one.
    for (const rule of saved.filter((x) => x.trigger.kind === 'manual' && x.enabled)) {
      const res = await w.call('POST', `/${rule.id}/run`, { item: card.id });
      expect(res.status).toBeLessThan(500);
    }
    await w.send('POST', `/api/projects/A/items/${card.id}/move`, { status: 'done' });
    await w.send('POST', `/api/projects/A/items/${card.id}`, { set: { priority: 'high' } });
    await w.plans.get('A')!.room.alarm();
    const runs = await (await w.call('GET', '/runs?limit=200')).json<{ runs: AutomationRun[] }>();
    expect(runs.runs.length).toBeGreaterThan(2);
    for (const run of runs.runs) {
      expect(ENDS.has(run.result), run.result).toBe(true);
      for (const line of run.steps) expect(line.text).not.toMatch(/native code|\[object /);
    }
  });
});
