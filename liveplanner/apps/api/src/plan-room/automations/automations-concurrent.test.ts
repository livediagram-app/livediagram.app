import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_CAPPED,
  AUTOMATION_AI_PER_DAY,
  AUTOMATION_RUNS_PER_DAY,
  defaultCatalogue,
  type AutomationRun,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { AutomationListedRule } from '@liveplanner/api-schema';
import { endRepeatWorld } from '../test-repeat-world';
import { automationWorld, ruleBody, type AutomationWorld } from './test-automation-world';
import type { AutomationsAi } from '../../types';
import { rebaseLabels } from './automation-writes';
import * as items from '../../db/items';
import * as content from '../plan-content';

// Two people at once (docs/specs/026-plan/automations.md "Runs, limits and loops", "The daily cap", "A rule"): runs,
// Run Rule and rule writes interleaved at the awaits where a plan's room lets another request in (an AI call, a card
// read), each checked to keep the other's writes and the day's caps.
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);
// The reads a request awaits, passed through, so a test can hold one while another Editor's write lands.
vi.mock('../../db/items', async (real) => {
  const actual = await real<typeof import('../../db/items')>();
  return { ...actual, readItem: vi.fn(actual.readItem), listItems: vi.fn(actual.listItems) };
});
vi.mock('../plan-content', async (real) => {
  const actual = await real<typeof import('../plan-content')>();
  return { ...actual, readPlanHead: vi.fn(actual.readPlanHead) };
});

const TASK: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status', 'description', 'priority', 'labels'],
};

let calls = 0;
let answer: () => Promise<unknown>;
const ai: AutomationsAi = {
  run: () => {
    calls += 1;
    return answer();
  },
};

// A gate the next AI answer waits on: `asked` settles once the call is made, `release` lets it answer.
function heldAnswer(reply: unknown) {
  let asked!: () => void;
  let release!: () => void;
  const made = new Promise<void>((r) => (asked = r));
  const open = new Promise<void>((r) => (release = r));
  answer = async () => {
    asked();
    await open;
    return { response: reply };
  };
  return { made, release };
}

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  calls = 0;
  answer = () => Promise.resolve({ response: { summary: 'S.' } });
  w = await automationWorld();
  Reflect.set(w.env, 'AI', ai);
  w.plans.get('A')!.restart();
  const put = await w.send('PUT', '/api/projects/A/item-types', {
    itemTypes: { version: defaultCatalogue().version, types: [TASK] },
  });
  expect(put.status).toBeLessThan(300);
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const plan = () => w.plans.get('A')!;
const room = () => plan().room;
const card = async (id: string) => (await w.items('A')).find((i) => i.id === id)!;
const runs = async () =>
  (await (await w.call('GET', '/runs')).json<{ runs: AutomationRun[] }>()).runs;
const seedRuns = (n: number, steps: unknown[] = []) => {
  const insert = plan().db.prepare(
    "INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES (?, 'x', ?, 'done', ?)",
  );
  for (let i = 0; i < n; i += 1) insert.run(`old${i}`, Date.now(), JSON.stringify({ steps }));
};
const aiLines = (n: number) =>
  Array.from({ length: n }, () => ({ kind: 'action', ok: true, text: 'x', ai: true }));

describe('a run and a person writing the same card', () => {
  it('keeps the label a person added while the AI answered', async () => {
    await w.make('A', { title: 'Old', labels: ['billing'] });
    await w.rule({
      name: 'Triage',
      steps: [{ kind: 'ai', task: 'triage', priority: false, labels: true }],
    });
    const c = await w.make('A', { title: 'Checkout', labels: ['web'] });
    const held = heldAnswer({ labels: ['billing'] });
    await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'done' });
    const wake = room().alarm();
    await held.made;
    // A person adds a label while the model is thinking.
    const res = await w.send('POST', `/api/projects/A/items/${c.id}`, {
      set: { labels: ['web', 'urgent'] },
    });
    expect(res.status).toBeLessThan(300);
    held.release();
    await wake;
    expect(((await card(c.id)).fields['labels'] as string[]).sort()).toEqual([
      'billing',
      'urgent',
      'web',
    ]);
  });

  it("keeps a person's label on a card a rule labels, and a label a person took off stays off", async () => {
    // A rule that adds a label and then asks the AI: the label write lands first, a person's change after it.
    await w.rule({
      name: 'Tag',
      steps: [
        { kind: 'add_label', label: 'shipped' },
        { kind: 'remove_label', label: 'wip' },
      ],
    });
    const c = await w.make('A', { title: 'Checkout', labels: ['wip', 'web'] });
    await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'done' });
    // The person's write lands between the run's read of the card and its write.
    const read = room().alarm();
    await w.send('POST', `/api/projects/A/items/${c.id}`, { set: { labels: ['wip', 'mobile'] } });
    await read;
    const labels = ((await card(c.id)).fields['labels'] as string[]).sort();
    expect(labels).toContain('shipped');
    expect(labels).not.toContain('wip');
  });
});

describe('the day’s caps under runs at once', () => {
  it('never lets a wake and a Run Rule pass the 100 AI calls between them', async () => {
    seedRuns(1, aiLines(AUTOMATION_AI_PER_DAY - 1));
    await w.rule({ name: 'Wake', steps: [{ kind: 'ai', task: 'summarise' }] });
    const manual = await w.rule({
      name: 'Manual',
      trigger: { kind: 'manual' },
      steps: [{ kind: 'ai', task: 'summarise' }],
    });
    const a = await w.make('A', { title: 'A' });
    const b = await w.make('A', { title: 'B' });
    const held = heldAnswer({ summary: 'S.' });
    await w.send('POST', `/api/projects/A/items/${a.id}/move`, { status: 'done' });
    const wake = room().alarm();
    await held.made;
    // The wake's call is the 100th; a Run Rule now must not make a 101st.
    answer = () => Promise.resolve({ response: { summary: 'S.' } });
    const res = await w.call('POST', `/${manual.id}/run`, { item: b.id });
    held.release();
    await wake;
    expect(calls).toBe(1);
    const { run } = await res.json<{ run: AutomationRun }>();
    expect(run).toMatchObject({ result: 'skipped', reason: AI_CAPPED });
  });

  it('never lets a wake pass the 1,000 runs a day for Run Rules made while it ran', async () => {
    seedRuns(AUTOMATION_RUNS_PER_DAY - 2);
    await w.rule({ name: 'Wake', steps: [{ kind: 'ai', task: 'summarise' }] });
    const manual = await w.rule({
      name: 'Manual',
      trigger: { kind: 'manual' },
      steps: [{ kind: 'flag' }],
    });
    const a = await w.make('A', { title: 'A' });
    const b = await w.make('A', { title: 'B' });
    const c = await w.make('A', { title: 'C' });
    const held = heldAnswer({ summary: 'S.' });
    await w.send('POST', `/api/projects/A/items/${a.id}/move`, { status: 'done' });
    await w.send('POST', `/api/projects/A/items/${b.id}/move`, { status: 'done' });
    const wake = room().alarm();
    await held.made;
    // The 1,000th run, made while the wake's first one waits on its AI call.
    expect((await w.call('POST', `/${manual.id}/run`, { item: c.id })).status).toBe(200);
    answer = () => Promise.resolve({ response: { summary: 'S.' } });
    held.release();
    await wake;
    const list = await (await w.call('GET', '')).json<{ runsToday: number }>();
    expect(list.runsToday).toBe(AUTOMATION_RUNS_PER_DAY);
    // The wake's second card never ran.
    expect((await runs()).filter((r) => r.card?.id === b.id)).toHaveLength(0);
  });
});

describe('Assign in Turn at once', () => {
  it('two Run Rules at once assign two people in turn, never the same one twice', async () => {
    const people = ['Ana', 'Ben', 'Cy'].map((name) => ({
      id: `p-${name}`,
      name,
      color: '#123456',
    }));
    for (const p of people) await w.make('A', { title: `${p.name}'s`, assignee: p });
    const rule = await w.rule({
      name: 'Turns',
      trigger: { kind: 'manual' },
      steps: [{ kind: 'assign', to: { rotate: people.map((p) => p.id) } }],
    });
    const a = await w.make('A', { title: 'A' });
    const b = await w.make('A', { title: 'B' });
    // The first run's write waits (its card read for the write) until a second Run Rule has run whole.
    const real = vi.mocked(items.readItem).getMockImplementation()!;
    let n = 0;
    vi.mocked(items.readItem).mockImplementation(async (...args) => {
      n += 1;
      if (n === 3) await w.call('POST', `/${rule.id}/run`, { item: b.id });
      return real(...args);
    });
    await w.call('POST', `/${rule.id}/run`, { item: a.id });
    vi.mocked(items.readItem).mockImplementation(real);
    const names = [a, b].map(
      async (c) => ((await card(c.id)).fields['assignee'] as { name: string } | undefined)?.name,
    );
    expect((await Promise.all(names)).sort()).toEqual(['Ana', 'Ben']);
  });
});

describe('rebaseLabels', () => {
  const at = (labels?: string[]) => ({ fields: labels ? { labels } : {} }) as never;
  it('applies what the patch added and took off to the labels there now', () => {
    const patch = { set: { labels: ['web', 'shipped'] } };
    expect(rebaseLabels(patch, at(['web', 'wip']), at(['wip', 'web', 'mine']))).toEqual({
      set: { labels: ['web', 'mine', 'shipped'] },
    });
    // Nothing changed meanwhile: the patch as planned.
    expect(rebaseLabels(patch, at(['web', 'wip']), at(['web', 'wip']))).toBe(patch);
    // No labels in the patch.
    const flag = { set: { flagged: true } };
    expect(rebaseLabels(flag, at(['a']), at(['b']))).toBe(flag);
  });

  it('adds no label past the card’s cap', () => {
    const full = Array.from({ length: 12 }, (_, i) => `l${i}`);
    const patch = { set: { labels: ['l0', 'new'] } };
    expect(rebaseLabels(patch, at(['l0']), at(full))).toEqual({ set: { labels: full } });
    expect(rebaseLabels({ set: { labels: ['x'] } }, at(), at(['y']))).toEqual({
      set: { labels: ['y', 'x'] },
    });
  });
});

describe('Describe a Rule and a rule’s AI step at once', () => {
  it('refuses a first ask once a rule’s call spent the day while the plan was read', async () => {
    seedRuns(1, aiLines(AUTOMATION_AI_PER_DAY - 1));
    vi.mocked(items.listItems).mockImplementationOnce(async (...args) => {
      // A rule's run marks the day's 100th call meanwhile.
      seedRuns(0);
      plan()
        .db.prepare(
          "INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES ('p', 'x', ?, 'pending', ?)",
        )
        .run(Date.now(), JSON.stringify({ steps: [{ ai: true }] }));
      return vi.mocked(items.listItems).getMockImplementation()!(...args);
    });
    const res = await w.call('POST', '/draft', {
      prompt: 'When a card is done, flag it',
      timeZone: 'UTC',
    });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'automation_ai_capped', message: AI_CAPPED });
    expect(calls).toBe(0);
  });
});

describe('a rule changed while a request holds it', () => {
  // The request's read of the plan (its types, for a Set Field) or of the card held until `between` has run: another
  // Editor's write landing at that await.
  type Spy = {
    mockImplementationOnce: (f: never) => unknown;
    getMockImplementation: () => ((...a: never[]) => unknown) | undefined;
  };
  const holdOnce = (spy: Spy, between: () => Promise<unknown>) => {
    const real = spy.getMockImplementation()!;
    spy.mockImplementationOnce((async (...args: never[]) => {
      await between();
      return real(...args);
    }) as never);
  };

  it('Run Rule never runs a rule turned off while it read the card', async () => {
    const manual = await w.rule({
      name: 'Manual',
      trigger: { kind: 'manual' },
      steps: [{ kind: 'flag' }],
    });
    const c = await w.make('A', { title: 'C' });
    holdOnce(vi.mocked(items.readItem), () =>
      w.call('POST', `/${manual.id}/toggle`, { enabled: false }),
    );
    const ran = await w.call('POST', `/${manual.id}/run`, { item: c.id });
    expect(ran.status).toBe(409);
    expect((await card(c.id)).fields['flagged']).toBeUndefined();
    expect(await runs()).toHaveLength(0);
  });

  it('a save never turns back on a rule another Editor turned off meanwhile', async () => {
    const rule = await w.rule({
      name: 'Set',
      steps: [{ kind: 'set_field', field: 'priority', value: { text: 'high' } }],
    });
    holdOnce(vi.mocked(content.readPlanHead), () =>
      w.call('POST', `/${rule.id}/toggle`, { enabled: false }),
    );
    const saved = await w.call('PUT', `/${rule.id}`, ruleBody({ name: 'Set', steps: rule.steps }));
    expect(saved.status).toBe(200);
    expect((await saved.json<{ rule: AutomationListedRule }>()).rule.enabled).toBe(false);
    const list = await (await w.call('GET', '')).json<{ rules: AutomationListedRule[] }>();
    expect(list.rules[0]!.enabled).toBe(false);
  });

  it('a save of a rule another Editor deleted meanwhile is refused, never answered as saved', async () => {
    const rule = await w.rule({
      name: 'Set',
      steps: [{ kind: 'set_field', field: 'priority', value: { text: 'high' } }],
    });
    holdOnce(vi.mocked(content.readPlanHead), () => w.call('DELETE', `/${rule.id}`));
    const saved = await w.call('PUT', `/${rule.id}`, ruleBody({ name: 'Set', steps: rule.steps }));
    expect(saved.status).toBe(404);
    const list = await (await w.call('GET', '')).json<{ rules: AutomationListedRule[] }>();
    expect(list.rules).toHaveLength(0);
  });

  it('two Editors saving one rule: the later save stands whole, no step of the first mixed in', async () => {
    const rule = await w.rule({ name: 'Two' });
    const first = ruleBody({
      name: 'Two',
      steps: [{ kind: 'set_field', field: 'priority', value: { text: 'high' } }, { kind: 'flag' }],
    });
    const second = ruleBody({ name: 'Two', steps: [{ kind: 'unflag' }] });
    holdOnce(vi.mocked(content.readPlanHead), () => w.call('PUT', `/${rule.id}`, second));
    expect((await w.call('PUT', `/${rule.id}`, first)).status).toBe(200);
    const list = await (await w.call('GET', '')).json<{ rules: AutomationListedRule[] }>();
    // The first save landed last, whole.
    expect(list.rules[0]!.steps).toEqual(first.steps);
  });
});
