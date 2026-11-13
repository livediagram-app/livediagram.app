import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultCatalogue,
  itemPersonId,
  type AutomationRun,
  type ItemTypeDef,
} from '@liveplanner/items';
import { endRepeatWorld } from '../test-repeat-world';
import { automationWorld, type AutomationWorld } from './test-automation-world';
import { runWaits } from './automation-waits';

// The triggers after Phase 3 and the Wait step, end to end (docs/specs/026-plan/automations.md "Triggers", "Wait";
// blueprint automations.md "The triggers after Phase 3", "The actions after Phase 3"): a write makes the event, the
// wake runs the rule, a derived trigger on the card it concerns, a held run going on when its time comes.
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

const TASK: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status', 'labels', 'checklist', 'f-blocked', 'f-parent'],
  custom: [
    {
      id: 'f-blocked',
      label: 'Blocked By',
      kind: 'card',
      linkType: 'task',
      multiple: true,
      blocks: true,
    },
    { id: 'f-parent', label: 'Parent', kind: 'card', linkType: 'task' },
  ],
};

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  w = await automationWorld();
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
const move = (id: string, status: string) =>
  w.send('POST', `/api/projects/A/items/${id}/move`, { status });
const set = (id: string, fields: Record<string, unknown>) =>
  w.send('POST', `/api/projects/A/items/${id}`, { set: fields });
const runs = async () =>
  (await (await w.call('GET', '/runs')).json<{ runs: AutomationRun[] }>()).runs;
const labelled = async (id: string) => (await card(id)).fields['labels'];

describe('card triggers', () => {
  it('Card Archived runs on an archive, and Card Restored on bringing it back', async () => {
    await w.rule({
      name: 'Gone',
      trigger: { kind: 'card_archived' },
      steps: [{ kind: 'add_label', label: 'gone' }],
    });
    await w.rule({
      name: 'Back',
      trigger: { kind: 'card_restored' },
      steps: [{ kind: 'add_label', label: 'back' }],
    });
    const c = await w.make('A', { title: 'Old' });
    expect((await set(c.id, { archived: true })).status).toBe(200);
    await room().alarm();
    expect(await labelled(c.id)).toEqual(['gone']);
    await w.send('POST', `/api/projects/A/items/${c.id}/move`, {
      status: 'todo',
      clear: ['archived'],
    });
    await room().alarm();
    expect(await labelled(c.id)).toEqual(['gone', 'back']);
  });

  it('Card Created never runs on a card put back: an undo of its delete is no new card', async () => {
    const c = await w.make('A', { title: 'Old' });
    expect((await set(c.id, { status: 'trash', trashedFrom: 'todo' })).status).toBe(200);
    const stored = await card(c.id);
    expect((await w.send('DELETE', `/api/projects/A/items/${c.id}`)).status).toBe(204);
    // A rule made after the card first was: nothing it ran before stops it.
    await w.rule({
      name: 'New',
      trigger: { kind: 'card_created' },
      steps: [{ kind: 'add_label', label: 'new' }],
    });
    const back = await w.send('POST', '/api/projects/A/items', {
      id: c.id,
      type: stored.type,
      key: stored.key,
      fields: stored.fields,
    });
    expect(back.status).toBe(201);
    await room().alarm();
    expect(await labelled(c.id)).toBeUndefined();
    expect(await runs()).toEqual([]);
    // A card made anew still runs it.
    const fresh = await w.make('A', { title: 'Fresh' });
    await room().alarm();
    expect(await labelled(fresh.id)).toEqual(['new']);
  });

  it('Checklist Completed runs when the last item is ticked, once', async () => {
    await w.rule({
      name: 'Ticked',
      trigger: { kind: 'checklist_completed' },
      steps: [{ kind: 'add_label', label: 'ready' }],
    });
    const c = await w.make('A', {
      title: 'List',
      checklist: [
        { text: 'a', done: true },
        { text: 'b', done: false },
      ],
    });
    await set(c.id, {
      checklist: [
        { text: 'a', done: true },
        { text: 'b', done: false },
        { text: 'c', done: false },
      ],
    });
    await room().alarm();
    expect(await labelled(c.id)).toBeUndefined();
    await set(c.id, {
      checklist: [
        { text: 'a', done: true },
        { text: 'b', done: true },
        { text: 'c', done: true },
      ],
    });
    await room().alarm();
    expect(await labelled(c.id)).toEqual(['ready']);
  });

  it('Column Over Limit runs on the card that takes the column past its limit', async () => {
    await w.rule({
      name: 'Too many',
      trigger: { kind: 'column_limit', status: 'doing', limit: 1 },
      steps: [{ kind: 'flag' }],
    });
    const a = await w.make('A', { title: 'A' });
    const b = await w.make('A', { title: 'B' });
    await move(a.id, 'doing');
    await room().alarm();
    expect((await card(a.id)).fields['flagged']).toBeUndefined();
    await move(b.id, 'doing');
    await room().alarm();
    expect((await card(b.id)).fields['flagged']).toBe(true);
    expect((await card(a.id)).fields['flagged']).toBeUndefined();
  });

  it('Card Unblocked runs on the blocked card once its last blocker is done', async () => {
    await w.rule({
      name: 'Free',
      trigger: { kind: 'card_unblocked' },
      steps: [{ kind: 'add_label', label: 'free' }],
    });
    const a = await w.make('A', { title: 'A' });
    const b = await w.make('A', { title: 'B' });
    const c = await w.make('A', { title: 'C', 'f-blocked': [a.id, b.id] });
    await move(a.id, 'done');
    await room().alarm();
    expect(await labelled(c.id)).toBeUndefined();
    await move(b.id, 'done');
    await room().alarm();
    expect(await labelled(c.id)).toEqual(['free']);
    const [run] = await runs();
    expect(run).toMatchObject({ result: 'done', card: { id: c.id } });
  });

  it('Related Cards Done runs on the parent once all its children are done', async () => {
    await w.rule({
      name: 'Close',
      trigger: { kind: 'related_done', related: 'children' },
      steps: [{ kind: 'move', status: 'done' }],
    });
    const parent = await w.make('A', { title: 'Parent' });
    const one = await w.make('A', { title: 'One', 'f-parent': parent.id });
    const two = await w.make('A', { title: 'Two', 'f-parent': parent.id });
    await move(one.id, 'done');
    await room().alarm();
    expect((await card(parent.id)).fields['status']).not.toBe('done');
    await move(two.id, 'done');
    await room().alarm();
    expect((await card(parent.id)).fields['status']).toBe('done');
  });
});

describe('derived triggers heard twice before a wake', () => {
  // Two blockers, two children or two cards into a column, done before the alarm: the wake reads the plan as it is
  // then for both events, which reach the same moment, so the rule runs once (spec "Triggers").
  const ranOn = async (id: string) =>
    (await runs()).filter((r) => r.card?.id === id && r.result !== 'no_match').length;

  it('Card Unblocked runs once when its last two blockers finish together', async () => {
    await w.rule({ name: 'Free', trigger: { kind: 'card_unblocked' }, steps: [{ kind: 'flag' }] });
    const a = await w.make('A', { title: 'A' });
    const b = await w.make('A', { title: 'B' });
    const c = await w.make('A', { title: 'C', 'f-blocked': [a.id, b.id] });
    await move(a.id, 'done');
    await move(b.id, 'done');
    await room().alarm();
    expect(await ranOn(c.id)).toBe(1);
    // Opened and finished again: a new moment, a new run.
    await move(b.id, 'todo');
    await move(b.id, 'done');
    await room().alarm();
    expect(await ranOn(c.id)).toBe(2);
  });

  it('Related Cards Done runs once when the last two children finish together', async () => {
    await w.rule({
      name: 'Close',
      trigger: { kind: 'related_done', related: 'children' },
      steps: [{ kind: 'flag' }],
    });
    const parent = await w.make('A', { title: 'Parent' });
    const one = await w.make('A', { title: 'One', 'f-parent': parent.id });
    const two = await w.make('A', { title: 'Two', 'f-parent': parent.id });
    await move(one.id, 'done');
    await move(two.id, 'done');
    await room().alarm();
    expect(await ranOn(parent.id)).toBe(1);
  });

  it('Column Over Limit runs once when two cards go past it together', async () => {
    await w.rule({
      name: 'Too many',
      trigger: { kind: 'column_limit', status: 'doing', limit: 1 },
      steps: [{ kind: 'flag' }],
    });
    const a = await w.make('A', { title: 'A' });
    const b = await w.make('A', { title: 'B' });
    await w.send('POST', '/api/projects/A/items/moves', {
      items: [
        { id: a.id, status: 'doing' },
        { id: b.id, status: 'doing' },
      ],
    });
    await room().alarm();
    const flagged = [await card(a.id), await card(b.id)].filter((c) => c.fields['flagged']);
    expect(flagged).toHaveLength(1);
  });

  it('Column Over Limit runs once, on the card one past the limit, when three come in before a wake', async () => {
    await w.rule({
      name: 'Too many',
      trigger: { kind: 'column_limit', status: 'doing', limit: 1 },
      steps: [{ kind: 'flag' }],
    });
    const cards = [
      await w.make('A', { title: 'A' }),
      await w.make('A', { title: 'B' }),
      await w.make('A', { title: 'C' }),
    ];
    for (const c of cards) await move(c.id, 'doing');
    await room().alarm();
    const flagged = [];
    for (const c of cards) if ((await card(c.id)).fields['flagged']) flagged.push(c.id);
    expect(flagged).toEqual([cards[1]!.id]);
  });
});

describe('comment triggers', () => {
  const thread = (itemId: string, text: string, extra: Record<string, unknown> = {}) =>
    w.send('POST', `/api/projects/A/items/${itemId}/threads`, { text, ...extra });

  it('All Threads Resolved runs when the last open thread on a card is resolved', async () => {
    await w.rule({
      name: 'Settled',
      trigger: { kind: 'threads_resolved' },
      steps: [{ kind: 'add_label', label: 'settled' }],
    });
    const c = await w.make('A', { title: 'Talked about' });
    const one = (await (await thread(c.id, 'First')).json<{ thread: { id: string } }>()).thread.id;
    const two = (await (await thread(c.id, 'Second')).json<{ thread: { id: string } }>()).thread.id;
    expect((await w.send('POST', `/api/projects/A/threads/${one}/resolve`)).status).toBe(200);
    await room().alarm();
    expect(await labelled(c.id)).toBeUndefined();
    expect((await w.send('POST', `/api/projects/A/threads/${two}/resolve`)).status).toBe(200);
    await room().alarm();
    expect(await labelled(c.id)).toEqual(['settled']);
  });

  it('Someone Mentioned runs on a comment that @mentions the person it names, and no other', async () => {
    const ana = await itemPersonId('u-ana');
    await w.rule({
      name: 'For Ana',
      trigger: { kind: 'mentioned', people: [ana] },
      steps: [{ kind: 'add_label', label: 'ana' }],
    });
    const c = await w.make('A', { title: 'Ask' });
    const d = await w.make('A', { title: 'Plain' });
    await thread(c.id, '@ana look', {
      mentions: [{ userId: 'u-ana', name: 'Ana', handle: 'ana' }],
    });
    await thread(d.id, 'No one');
    await room().alarm();
    expect(await labelled(c.id)).toEqual(['ana']);
    expect(await labelled(d.id)).toBeUndefined();
  });
});

describe('Wait', () => {
  it('holds the run, then goes on with the steps after it when its time comes', async () => {
    await w.rule({
      name: 'Later',
      steps: [{ kind: 'flag' }, { kind: 'wait', hours: 2 }, { kind: 'add_label', label: 'later' }],
    });
    const c = await w.make('A', { title: 'Wait for it' });
    await move(c.id, 'done');
    await room().alarm();
    expect((await card(c.id)).fields['flagged']).toBe(true);
    expect(await labelled(c.id)).toBeUndefined();
    const [held] = await runs();
    expect(held).toMatchObject({ result: 'waiting' });
    expect(held!.waitsUntil).toBeGreaterThan(Date.now() + 60 * 60_000);
    // Its time comes.
    plan()
      .db.prepare('UPDATE automation_waiting SET at = ?')
      .run(Date.now() - 1);
    room().automations.schedule.restoreTimes();
    await room().alarm();
    await room().alarm();
    expect(await labelled(c.id)).toEqual(['later']);
    const all = await runs();
    expect(all.map((r) => r.result).sort()).toEqual(['done', 'done']);
    expect(plan().db.prepare('SELECT COUNT(*) AS n FROM automation_waiting').get()!['n']).toBe(0);
  });

  // A run held at a Wait, its time come (the next wake queues it).
  const heldRun = async () => {
    const r = await w.rule({
      name: 'Later',
      steps: [{ kind: 'flag' }, { kind: 'wait', hours: 2 }, { kind: 'add_label', label: 'later' }],
    });
    const c = await w.make('A', { title: 'Wait for it' });
    await move(c.id, 'done');
    await room().alarm();
    plan()
      .db.prepare('UPDATE automation_waiting SET at = ?')
      .run(Date.now() - 1);
    room().automations.schedule.restoreTimes();
    return { r, c };
  };
  const ruleRuns = async (id: string) =>
    (await (await w.call('GET', `/runs?rule=${id}`)).json<{ runs: AutomationRun[] }>()).runs;

  it('settles a held run Skipped when the day is spent by its time, never Waiting past it', async () => {
    const { r, c } = await heldRun();
    const insert = plan().db.prepare(
      "INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES (?, 'x', ?, 'done', '{}')",
    );
    for (let i = 0; i < 1000; i += 1) insert.run(`old${i}`, Date.now());
    await room().alarm();
    await room().alarm();
    expect(await labelled(c.id)).toBeUndefined();
    expect(await ruleRuns(r.id)).toMatchObject([
      { result: 'skipped', reason: 'Daily limit reached: rules run again tomorrow' },
    ]);
  });

  it('settles a held run Skipped when its rule is turned off after its resume is queued', async () => {
    const { r, c } = await heldRun();
    const deps = room().automations.deps()!;
    runWaits(deps, room().automations.schedule, Date.now());
    expect((await w.call('POST', `/${r.id}/toggle`, { enabled: false })).status).toBe(200);
    await room().alarm();
    expect(await labelled(c.id)).toBeUndefined();
    expect(await ruleRuns(r.id)).toMatchObject([
      { result: 'skipped', reason: 'The rule changed while this run waited' },
    ]);
  });

  it('stops a held run at once when its rule is turned off, never going on when it is turned on again', async () => {
    const { r, c } = await heldRun();
    expect((await w.call('POST', `/${r.id}/toggle`, { enabled: false })).status).toBe(200);
    expect(await ruleRuns(r.id)).toMatchObject([
      { result: 'skipped', reason: 'The rule changed while this run waited' },
    ]);
    expect((await w.call('POST', `/${r.id}/toggle`, { enabled: true })).status).toBe(200);
    await room().alarm();
    await room().alarm();
    expect(await labelled(c.id)).toBeUndefined();
    expect(plan().db.prepare('SELECT COUNT(*) AS n FROM automation_waiting').get()!['n']).toBe(0);
  });

  it('stops a held run at once when its rule is deleted', async () => {
    const { r } = await heldRun();
    expect((await w.call('DELETE', `/${r.id}`)).status).toBe(204);
    expect(await ruleRuns(r.id)).toMatchObject([{ result: 'skipped' }]);
    expect(plan().db.prepare('SELECT COUNT(*) AS n FROM automation_waiting').get()!['n']).toBe(0);
  });

  it('goes on for a derived trigger too, on the card the trigger found', async () => {
    await w.rule({
      name: 'Free later',
      trigger: { kind: 'card_unblocked' },
      steps: [{ kind: 'flag' }, { kind: 'wait', hours: 2 }, { kind: 'add_label', label: 'later' }],
    });
    const a = await w.make('A', { title: 'A' });
    const c = await w.make('A', { title: 'C', 'f-blocked': [a.id] });
    await move(a.id, 'done');
    await room().alarm();
    expect((await card(c.id)).fields['flagged']).toBe(true);
    plan()
      .db.prepare('UPDATE automation_waiting SET at = ?')
      .run(Date.now() - 1);
    room().automations.schedule.restoreTimes();
    await room().alarm();
    await room().alarm();
    expect(await labelled(c.id)).toEqual(['later']);
    expect((await runs()).map((r) => r.result)).toEqual(['done', 'done']);
  });
});
