import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultCatalogue, type AutomationRun, type Item } from '@liveplanner/items';
import { endRepeatWorld } from '../test-repeat-world';
import { exportProjectFile, readProjectFile } from '../project-file';
import { automationWorld, type AutomationWorld } from './test-automation-world';

// A plan's rules running on its own alarm (docs/specs/026-plan/automations.md "Runs, limits and loops"), end to
// end: the real worker writes a card, the write queues the event, the room's wake runs the rule.
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

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

const plan = () => w.plans.get('A')!;
const room = () => plan().room;
const move = (id: string, status: string) =>
  w.send('POST', `/api/projects/A/items/${id}/move`, { status });
const card = async (id: string) => (await w.items('A')).find((i) => i.id === id)!;
const runs = async (query = '') =>
  (await (await w.call('GET', `/runs${query}`)).json<{ runs: AutomationRun[] }>()).runs;

describe('a rule on its trigger', () => {
  it('adds the label when a card reaches Done, once, by Automation', async () => {
    await w.rule({});
    const c = await w.make('A', { title: 'Ship it' });
    expect((await move(c.id, 'done')).status).toBe(200);
    expect(room().automations.schedule.at).not.toBeNull();
    await room().alarm();
    const after: Item = await card(c.id);
    expect(after.fields['labels']).toEqual(['shipped']);
    expect(after.updatedBy).toMatchObject({ id: 'automation', name: 'Done stamp' });
    const [run] = await runs();
    expect(run).toMatchObject({ result: 'done', ruleName: 'Done stamp', card: { id: c.id } });
    expect(room().automations.schedule.at).toBeNull();
  });
});

describe('runs, limits and loops', () => {
  it('never runs a rule twice for one trigger, however often the wake comes', async () => {
    await w.rule({ steps: [{ kind: 'comment', text: 'Shipped {{card.title}}' }] });
    const c = await w.make('A', { title: 'Once' });
    await move(c.id, 'done');
    // The same event queued again (a retry after a wake that died), and the wake run twice.
    const [queued] = plan().db.prepare('SELECT event FROM automation_queue').all();
    plan()
      .db.prepare('INSERT INTO automation_queue (event, at) VALUES (?, 0)')
      .run(queued!['event'] as string);
    await room().alarm();
    await room().alarm();
    expect(await runs()).toHaveLength(1);
    const threads = plan().db.prepare('SELECT comments FROM card_threads').all();
    expect(threads).toHaveLength(1);
    const comments = JSON.parse(String(threads[0]!['comments'])) as unknown[];
    expect(comments[0]).toMatchObject({
      text: 'Shipped Once',
      authorName: 'Automation',
      automation: { rule: 'Done stamp' },
    });
  });

  it('never hears its own changes, and a rule that keeps them to itself starts nothing', async () => {
    // A moves to Review on any field change; B, hearing moves to Review, would stamp it.
    await w.rule({
      name: 'Bounce',
      trigger: { kind: 'field_changed', fields: ['priority'] },
      steps: [{ kind: 'move', status: 'review' }],
    });
    await w.rule({
      name: 'Stamp',
      trigger: { kind: 'card_moved', to: ['review'] },
      steps: [{ kind: 'flag' }],
    });
    const c = await w.make('A', { title: 'Loop' });
    await w.send('POST', `/api/projects/A/items/${c.id}`, { set: { priority: 'high' } });
    await room().alarm();
    await room().alarm();
    const after = await card(c.id);
    expect(after.fields['status']).toBe('review');
    expect(after.fields['flagged']).toBeUndefined();
    const stamp = (await runs()).find((r) => r.ruleName === 'Stamp');
    expect(stamp).toMatchObject({ result: 'skipped', reason: "Started by another rule's change" });
  });

  it('lets a chain run five rules deep, then stops it', async () => {
    // Two rules that pass a card back and forth, each letting its changes start the other.
    await w.rule({
      name: 'Ping',
      trigger: { kind: 'card_moved', to: ['todo'] },
      steps: [{ kind: 'move', status: 'doing' }],
      chain: true,
    });
    await w.rule({
      name: 'Pong',
      trigger: { kind: 'card_moved', to: ['doing'] },
      steps: [{ kind: 'move', status: 'todo' }],
      chain: true,
    });
    const c = await w.make('A', { title: 'Chain' }, 'backlog');
    await move(c.id, 'todo');
    for (let i = 0; i < 8; i += 1) await room().alarm();
    const all = await runs();
    expect(all.filter((r) => r.result === 'done')).toHaveLength(5);
    expect(all.filter((r) => r.result === 'skipped')).toMatchObject([
      { ruleName: 'Pong', reason: 'Chain stopped after 5 rules' },
    ]);
    expect((await card(c.id)).fields['status']).toBe('doing');
  });

  it('runs a rule no more once it pauses, even on triggers the same wake still holds', async () => {
    const rule = await w.rule({ steps: [{ kind: 'move', status: 'gone-column' }] });
    for (let i = 0; i < 12; i += 1) {
      const c = await w.make('A', { title: `F${i}` });
      await move(c.id, 'done');
    }
    await room().alarm();
    expect(await runs(`?rule=${rule.id}`)).toHaveLength(10);
  });

  it('pauses a rule after ten failures in a row, and Resume turns it on again', async () => {
    const rule = await w.rule({ steps: [{ kind: 'move', status: 'gone-column' }] });
    for (let i = 0; i < 10; i += 1) {
      const c = await w.make('A', { title: `F${i}` });
      await move(c.id, 'done');
      await room().alarm();
    }
    const list = await (
      await w.call('GET', '')
    ).json<{
      rules: { enabled: boolean; paused?: { reason: string }; stats: { failuresInARow: number } }[];
    }>();
    expect(list.rules[0]).toMatchObject({ enabled: false, stats: { failuresInARow: 10 } });
    expect(list.rules[0]!.paused?.reason).toMatch(/gone/);
    // Off now: a card reaching Done runs nothing.
    expect(room().automations.kinds.size).toBe(0);
    const resumed = await (
      await w.call('POST', `/${rule.id}/toggle`, { enabled: true })
    ).json<{
      rule: { enabled: boolean; paused?: unknown; stats: { failuresInARow: number } };
    }>();
    expect(resumed.rule).toMatchObject({ enabled: true, stats: { failuresInARow: 0 } });
    expect(resumed.rule.paused).toBeUndefined();
    expect([...room().automations.kinds]).toEqual(['moved']);
  });

  it('runs no more than the day allows', async () => {
    await w.rule({});
    const today = Date.now();
    const insert = plan().db.prepare(
      "INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES (?, 'x', ?, 'done', '{}')",
    );
    for (let i = 0; i < 1000; i += 1) insert.run(`old${i}`, today);
    const c = await w.make('A', { title: 'Over' });
    await move(c.id, 'done');
    await room().alarm();
    expect((await card(c.id)).fields['labels']).toBeUndefined();
    const list = await (await w.call('GET', '')).json<{ runsToday: number; runsPerDay: number }>();
    expect(list).toMatchObject({ runsToday: 1000, runsPerDay: 1000 });
  });

  it('logs no match for a card gone before its turn, and for conditions that do not hold', async () => {
    await w.rule({ conditions: [{ kind: 'field', field: 'priority', op: 'is', value: 'high' }] });
    const a = await w.make('A', { title: 'Low' });
    const b = await w.make('A', { title: 'Gone' });
    await move(a.id, 'done');
    await move(b.id, 'done');
    await w.send('DELETE', `/api/projects/A/items/${b.id}`);
    await room().alarm();
    const all = await runs('?result=no_match');
    expect(all).toHaveLength(2);
    expect(all.filter((r) => r.reason === 'The card is gone')).toHaveLength(1);
    expect(all.find((r) => r.card?.id === a.id)?.steps[1]).toMatchObject({
      kind: 'condition',
      ok: false,
    });
  });

  it('hears a comment, and makes a card', async () => {
    await w.send('PUT', '/api/projects/A/item-types', { itemTypes: defaultCatalogue() });
    await w.rule({
      name: 'Follow up',
      trigger: { kind: 'comment_added' },
      steps: [
        { kind: 'create_card', type: 'task', title: 'Follow up {{card.title}}', status: 'todo' },
      ],
    });
    const c = await w.make('A', { title: 'Talk' });
    const res = await w.send('POST', `/api/projects/A/items/${c.id}/threads`, {
      text: 'A thought',
    });
    expect(res.status).toBe(201);
    await room().alarm();
    const made = (await w.items('A')).find((i) => i.fields['title'] === 'Follow up Talk');
    expect(made).toMatchObject({ createdBy: { id: 'automation' }, fields: { status: 'todo' } });
  });

  it('answers a burst past the queue with one Skipped line', async () => {
    await w.rule({ trigger: { kind: 'card_created' } });
    plan().db.exec(
      "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 500) INSERT INTO automation_queue (event, at) SELECT 'not json', 0 FROM n",
    );
    await w.make('A', { title: 'Dropped' });
    // A full batch asks for the next wake a second on.
    for (let i = 0; i < 21; i += 1) {
      room().automations.schedule.at = Date.now();
      await room().alarm();
    }
    const skipped = await runs('?result=skipped');
    expect(skipped).toMatchObject([{ reason: 'Too many changes at once' }]);
    // The line is the Audit Trail's own, no run: it spends none of the day's runs.
    const list = await (await w.call('GET', '')).json<{ runsToday: number }>();
    expect(list.runsToday).toBe(0);
  });

  it('hears again after the room wakes on the same storage', async () => {
    await w.rule({});
    plan().restart();
    await new Promise((r) => setTimeout(r, 0));
    expect([...room().automations.kinds]).toEqual(['moved']);
  });
});

describe('a plan with no rule that is on', () => {
  it('runs no Automations statement on a save', async () => {
    const off = await w.rule({ steps: [] });
    expect(off.enabled).toBe(false);
    const c = await w.make('A', { title: 'Quiet' });
    const seen: string[] = [];
    const prepare = plan().db.prepare.bind(plan().db);
    const exec = plan().db.exec.bind(plan().db);
    vi.spyOn(plan().db, 'prepare').mockImplementation((q: string) => (seen.push(q), prepare(q)));
    vi.spyOn(plan().db, 'exec').mockImplementation((q: string) => (seen.push(q), exec(q)));
    await move(c.id, 'done');
    await w.send('POST', `/api/projects/A/items/${c.id}`, { set: { priority: 'high' } });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.filter((q) => q.includes('automation_'))).toEqual([]);
    expect(room().automations.schedule.at).toBeNull();
  });

  it('adds exactly one statement to a save once a rule hears it', async () => {
    await w.rule({});
    const c = await w.make('A', { title: 'Heard' });
    const seen: string[] = [];
    const prepare = plan().db.prepare.bind(plan().db);
    vi.spyOn(plan().db, 'prepare').mockImplementation((q: string) => (seen.push(q), prepare(q)));
    await move(c.id, 'done');
    expect(seen.filter((q) => q.includes('automation_'))).toHaveLength(1);
  });
});

describe('copies, exports and deletes', () => {
  // An empty plan's room, as a copy's target is.
  const emptyRoom = async (id: string) => {
    await w.send('GET', `/api/projects/${id}/items`);
    return w.plans.get(id)!;
  };
  const ruleRows = (db: { prepare: (q: string) => { all: () => unknown[] } }) =>
    db.prepare('SELECT id, enabled, failures FROM automation_rules ORDER BY position').all();

  it('a duplicate keeps the rules as they were, with an empty Audit Trail', async () => {
    await w.rule({});
    await w.rule({ name: 'Draft', steps: [] });
    const c = await w.make('A', { title: 'Logged' });
    await move(c.id, 'done');
    await room().alarm();
    const source = await room().exportCopy('A', null, null);
    expect(source!.copy.automations?.map((r) => [r.name, r.enabled])).toEqual([
      ['Done stamp', true],
      ['Draft', false],
    ]);
    // Through a link, or of one tab: none.
    const linked = await room().exportCopy('A', null, { by: null, code: 'c', ip: null });
    expect(linked!.copy.automations).toBeUndefined();
    expect((await room().exportCopy('A', 't1', null))!.copy.automations).toBeUndefined();
    const b = await emptyRoom('B');
    await b.room.importCopy('B', source!.copy);
    expect(ruleRows(b.db)).toMatchObject([
      { enabled: 1, failures: 0 },
      { enabled: 0, failures: 0 },
    ]);
    expect(b.db.prepare('SELECT COUNT(*) AS n FROM automation_runs').get()).toEqual({ n: 0 });
    expect([...b.room.automations.kinds]).toEqual(['moved']);
  });

  it("the plan's file carries the rules, and a file read into a new plan brings them back off", async () => {
    const held = await w.rule({});
    const file = await exportProjectFile(room().roomEnv!, 'A', null);
    if (file.status !== 'ok') throw new Error(file.status);
    const read = readProjectFile(String(file.body));
    if (!read.ok) throw new Error(read.failure);
    const [rule] = read.content.copy.automations!;
    expect(rule).toMatchObject({ name: 'Done stamp', enabled: false, made: held.made });
    expect(rule!.id).not.toBe(held.id);
    const c = await emptyRoom('C');
    await c.room.importCopy('C', read.content.copy);
    expect(ruleRows(c.db)).toMatchObject([{ enabled: 0 }]);
    expect(c.room.automations.kinds.size).toBe(0);
  });

  it('a delete drops them with the rest of the plan', async () => {
    await w.rule({});
    await room().purge('A');
    expect(room().automations.kinds.size).toBe(0);
    const tables = plan()
      .db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'automation_%'")
      .all();
    expect(tables).toEqual([]);
  });
});
