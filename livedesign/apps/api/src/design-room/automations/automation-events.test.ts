import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livedesign/design';
import { box, ANA, BEN, DOC, roomWorld, type RoomWorld } from './test-automation-world';
import { STANDING_KEY } from './design-automations';

// Each moment a design's rules hear, queued where it happens (docs/specs/013-workspace/automations.md; blueprint
// automations.md "Event call sites"), in the design's real room: who made it, what it carries, and that nothing at
// all is written while no rule hears it.

const BASE = `/api/designs/${DOC}`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function started(
  tabs = [
    { id: 't1', name: 'Letter', elements: [box('a')] },
    { id: 't2', name: 'Deck', elements: [] },
  ],
): Promise<RoomWorld> {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  const w = roomWorld();
  await w.create(tabs);
  return w;
}

const hearing = (w: RoomWorld, kind: string, more: Record<string, unknown> = {}) =>
  w.rule({ trigger: { kind, ...more } });

describe('with no rule on', () => {
  it('queues nothing, stamps nothing and keeps no writer for any of the moments', async () => {
    const w = await started();
    await w.saveTab('t1', [box('a'), box('b')]);
    await w.send('PUT', `${BASE}/tabs/t3`, { id: 't3', name: 'New', elements: [] });
    await w.send('DELETE', `${BASE}/tabs/t2`);
    await w.send('POST', `${BASE}/snapshots`, { name: 'One' });
    await w.send('PUT', `${BASE}/components/c1`, {
      id: 'c1',
      name: 'Button',
      width: 120,
      height: 60,
      elements: [box('e1')],
      updatedAt: 0,
    });
    await w.room.joined(DOC, BEN, 'view');
    await w.room.accessRequested(DOC, { id: BEN, name: 'Ben' });
    for (const table of [
      'automation_queue',
      'automation_edits',
      'automation_settles',
      'automation_writer',
      'automation_hears',
      'automation_collab_seen',
    ])
      expect(w.rows(`SELECT * FROM ${table}`), table).toEqual([]);
    expect(w.room.automations.schedule.wakeAt).toBeNull();
  });
});

describe('tabs', () => {
  it('names whoever added and removed a tab', async () => {
    const w = await started();
    await hearing(w, 'tab_added');
    await hearing(w, 'tab_removed');
    await w.send('PUT', `${BASE}/tabs/t3`, { id: 't3', name: 'Roadmap', elements: [] });
    await w.send('DELETE', `${BASE}/tabs/t2`);
    expect(w.queued()).toMatchObject([
      {
        kind: 'tab_added',
        tab: 't3',
        by: { id: ANA },
        role: 'editor',
        data: { 'tab.name': 'Roadmap' },
      },
      { kind: 'tab_removed', tab: 't2', by: { id: ANA }, data: { 'tab.name': 'Deck' } },
    ]);
    // The writer's window closed with the write.
    expect(w.rows('SELECT * FROM automation_writer')).toEqual([]);
  });

  it('starts an Edited, Then Quiet stretch on a save, and runs the rule once it is quiet', async () => {
    const w = await started();
    const rule = await w.rule({
      trigger: { kind: 'edited', minutes: 5 },
      steps: [{ kind: 'take_snapshot', name: 'After {{tab.name}}' }],
    });
    await w.saveTab('t1', [box('a'), box('b')]);
    expect(w.rows('SELECT rule_id, key FROM automation_settles')).toEqual([
      { rule_id: rule.id, key: '' },
    ]);
    // Still inside the quiet: nothing runs.
    await w.alarm();
    expect(w.runs()).toEqual([]);
    vi.useFakeTimers({ now: Date.now() + 6 * 60_000, toFake: ['Date'] });
    await w.alarm();
    expect(w.runs()).toMatchObject([{ ruleId: rule.id, result: 'done' }]);
    expect(w.rows('SELECT name FROM snapshots WHERE item_id = ?', DOC)).toEqual([
      { name: 'After Letter' },
    ]);
    // Fired once: no stretch is left, and the rule's own snapshot started none.
    expect(w.rows('SELECT * FROM automation_settles')).toEqual([]);
  });
});

describe('snapshots', () => {
  it("queues Snapshot Taken for a person's take, with who", async () => {
    const w = await started();
    await hearing(w, 'snapshot_taken');
    expect((await w.send('POST', `${BASE}/snapshots`, { name: 'One' })).status).toBe(201);
    expect(w.queued()).toMatchObject([{ kind: 'snapshot_taken', by: { id: ANA }, role: 'editor' }]);
  });

  it("does not queue it for a rule's own snapshot", async () => {
    const w = await started();
    await hearing(w, 'snapshot_taken');
    const taker = await w.rule({ steps: [{ kind: 'take_snapshot', name: 'By a rule' }] });
    await w.send('POST', `${BASE}/automations/${taker.id}/run`, {});
    expect(w.rows('SELECT name FROM snapshots WHERE item_id = ?', DOC)).toEqual([
      { name: 'By a rule' },
    ]);
    expect(w.queued()).toEqual([]);
  });

  it("keeps a person's revert silent: no edit, no tab added or removed", async () => {
    const w = await started();
    const snap = await w.send('POST', `${BASE}/snapshots`, { name: 'Clean' });
    const { snapshot } = await snap.json<{ snapshot: { id: string } }>();
    await w.send('PUT', `${BASE}/tabs/t3`, { id: 't3', name: 'Scratch', elements: [box('z')] });
    await hearing(w, 'edited', { minutes: 5 });
    await hearing(w, 'tab_added');
    await hearing(w, 'tab_removed');
    const reverted = await w.send('POST', `${BASE}/snapshots/${snapshot.id}/revert`);
    expect(reverted.status).toBe(200);
    // The revert removed t3 and rewrote the rest.
    expect(w.rows('SELECT tab_id FROM design_tabs ORDER BY order_index')).toEqual([
      { tab_id: 't1' },
      { tab_id: 't2' },
    ]);
    expect(w.queued()).toEqual([]);
    expect(w.rows('SELECT * FROM automation_settles')).toEqual([]);
    expect(w.rows('SELECT * FROM automation_edits')).toEqual([]);
    expect(w.rows('SELECT * FROM automation_writer')).toEqual([]);
  });

  it('keeps a snapshot a rule names: marked kept, not deletable, never removed to make room', async () => {
    const w = await started();
    const snap = await w.send('POST', `${BASE}/snapshots`, { name: 'Clean' });
    const { snapshot } = await snap.json<{ snapshot: { id: string } }>();
    const rule = await w.rule({
      steps: [{ kind: 'revert_snapshot', snapshot: snapshot.id, name: 'Clean' }],
    });
    for (let i = 0; i < 7; i += 1) await w.send('POST', `${BASE}/snapshots`, { name: `S${i}` });
    const list = await (
      await w.send('GET', `${BASE}/snapshots`)
    ).json<{
      snapshots: { id: string; kept: boolean }[];
    }>();
    expect(list.snapshots.filter((s) => s.kept).map((s) => s.id)).toEqual([snapshot.id]);
    expect(list.snapshots).toHaveLength(6);
    const refused = await w.send('DELETE', `${BASE}/snapshots/${snapshot.id}`);
    expect(refused.status).toBe(409);
    // The rule gone, it is an ordinary snapshot again.
    await w.send('DELETE', `${BASE}/automations/${rule.id}`);
    expect((await w.send('DELETE', `${BASE}/snapshots/${snapshot.id}`)).status).toBe(204);
  });
});

describe('people', () => {
  it('queues Someone Joined for a first time in through a link', async () => {
    const w = await started();
    await hearing(w, 'joined');
    await w.room.joined(DOC, BEN, 'participate');
    expect(w.queued()).toMatchObject([
      { kind: 'joined', by: { id: BEN, name: 'Someone' }, role: 'participant' },
    ]);
  });

  it('queues Access Requested with whoever asked', async () => {
    const w = await started();
    await hearing(w, 'access_requested');
    await w.room.accessRequested(DOC, { id: BEN, name: 'Ben Okafor', requestId: 'req-1' });
    expect(w.queued()).toMatchObject([
      { id: 'access:req-1', kind: 'access_requested', by: { id: BEN, name: 'Ben Okafor' } },
    ]);
  });

  it('starts nothing in a design never started', async () => {
    const w = roomWorld();
    await w.room.accessRequested(DOC, { id: BEN, name: 'Ben' });
    expect(w.rows("SELECT name FROM sqlite_master WHERE type = 'table'")).toEqual([]);
  });
});

describe('Component Changed', () => {
  const main = (id: string, name: string) => ({
    id,
    name,
    width: 120,
    height: 60,
    elements: [box('e1')],
    updatedAt: 0,
  });
  const put = (w: RoomWorld, id: string, name: string, who?: Parameters<RoomWorld['send']>[3]) =>
    w.send('PUT', `${BASE}/components/${id}`, main(id, name), who);

  it('settles a burst of changes into one run, 2 minutes after the last, named by the last', async () => {
    const w = await started();
    const rule = await w.rule({
      trigger: { kind: 'component_changed' },
      steps: [{ kind: 'take_snapshot', name: 'After {{component.name}}' }],
    });
    for (const name of ['Button', 'Button 2', 'Primary Button'])
      expect((await put(w, 'c1', name)).status).toBe(200);
    // One stretch, carrying the last change.
    expect(w.rows('SELECT rule_id, key FROM automation_settles')).toEqual([
      { rule_id: rule.id, key: '' },
    ]);
    await w.alarm();
    expect(w.runs()).toEqual([]);
    vi.useFakeTimers({ now: Date.now() + 3 * 60_000, toFake: ['Date'] });
    await w.alarm();
    expect(w.runs()).toMatchObject([{ ruleId: rule.id, result: 'done' }]);
    expect(w.rows('SELECT name FROM snapshots WHERE item_id = ?', DOC)).toEqual([
      { name: 'After Primary Button' },
    ]);
    expect(w.rows('SELECT * FROM automation_settles')).toEqual([]);
  });

  it('keeps to its one component when it picks one', async () => {
    const w = await started();
    const rule = await w.rule({ trigger: { kind: 'component_changed', component: 'c2' } });
    await put(w, 'c1', 'Button');
    expect(w.rows('SELECT * FROM automation_settles')).toEqual([]);
    await put(w, 'c2', 'Card');
    expect(w.rows('SELECT rule_id, key FROM automation_settles')).toEqual([
      { rule_id: rule.id, key: 'c2' },
    ]);
  });

  it('is an agent’s too when a token changes a component', async () => {
    const w = await started();
    await hearing(w, 'agent_changed');
    expect((await put(w, 'c1', 'Button', { token: { name: 'Deploy Bot' } })).status).toBe(200);
    expect(w.queued()).toMatchObject([
      { kind: 'agent_changed', by: { id: ANA, name: 'Deploy Bot' }, role: 'agent' },
    ]);
    expect(w.queued()[0]).not.toHaveProperty('tab');
    // A person's change is no agent's.
    await put(w, 'c1', 'Button 2');
    expect(w.queued()).toHaveLength(1);
  });
});

describe('Agent Made Changes', () => {
  it('queues once per changeset a token wrote, by the token’s name', async () => {
    const w = await started();
    await hearing(w, 'agent_changed');
    const body = { operations: [{ op: 'add', element: box('b') }] };
    const res = await w.send('POST', `${BASE}/tabs/t1/changesets`, body, {
      token: { name: 'Deploy Bot' },
    });
    expect(res.status).toBe(200);
    expect(w.queued()).toMatchObject([
      { kind: 'agent_changed', tab: 't1', by: { id: ANA, name: 'Deploy Bot' }, role: 'agent' },
    ]);
    // A person's changeset is no agent's.
    const mine = await w.send('POST', `${BASE}/tabs/t1/changesets`, {
      operations: [{ op: 'add', element: box('c') }],
    });
    expect(mine.status).toBe(200);
    expect(w.queued()).toHaveLength(1);
  });
});

describe('Comment Added', () => {
  const comment = (id: string, text: string) => ({
    id,
    text,
    createdAt: 1,
    authorName: 'Ana Costa',
    authorColor: '#111111',
  });
  const withThread = (id: string, comments: ReturnType<typeof comment>[]) =>
    ({ ...box(id), commentThread: { comments, resolved: false } }) as unknown as Element;

  it('is heard where the outbox drains, the threads standing when the rule came on starting nothing', async () => {
    const w = await started([{ id: 't1', name: 'Letter', elements: [withThread('a', [])] }]);
    await hearing(w, 'comment_added');
    // The baseline: the tab's threads as they stand.
    w.room.flushAt = Date.now();
    await w.alarm();
    await w.saveTab('t1', [withThread('a', [comment('c1', 'Looks good')])]);
    w.room.flushAt = Date.now();
    await w.alarm();
    expect(w.runs()).toMatchObject([{ result: 'done' }]);
  });
});

describe('a design put away', () => {
  it('hears nothing and wakes for nothing while archived or in the Trash, and takes up again when back', async () => {
    const w = await started();
    await hearing(w, 'tab_added');
    await w.rule({ trigger: { kind: 'scheduled', every: 'day', at: '09:00' } });
    expect(w.room.automations.schedule.wakeAt).not.toBeNull();

    await w.room.takeStanding(DOC, { archived: true, trashed: false, at: 1000 });
    expect(w.room.standing.putAway).toBe(true);
    expect(w.room.automations.schedule.wakeAt).toBeNull();
    expect(w.rows('SELECT * FROM automation_hears')).toEqual([]);
    await w.send('PUT', `${BASE}/tabs/t3`, { id: 't3', name: 'While away', elements: [] });
    expect(w.queued()).toEqual([]);

    // An older word changes nothing; a newer one brings it back.
    await w.room.takeStanding(DOC, { archived: false, trashed: false, at: 500 });
    expect(w.room.standing.putAway).toBe(true);
    await w.room.takeStanding(DOC, { archived: false, trashed: false, at: 2000 });
    expect(w.room.standing.putAway).toBe(false);
    expect(w.room.automations.schedule.wakeAt).not.toBeNull();
    await w.send('PUT', `${BASE}/tabs/t4`, { id: 't4', name: 'Back', elements: [] });
    expect(w.queued()).toMatchObject([{ kind: 'tab_added', tab: 't4' }]);
  });

  it('comes back on a grant signed after it was put away', async () => {
    const w = await started();
    await hearing(w, 'tab_added');
    await w.room.takeStanding(DOC, { archived: false, trashed: true, at: Date.now() - 60_000 });
    expect(w.room.standing.putAway).toBe(true);
    await w.room.takeGrantStanding({ iat: Math.floor(Date.now() / 1000) });
    expect(w.room.standing.putAway).toBe(false);
  });

  it('keeps no standing for a design that never heard one, whatever its grants say', async () => {
    const w = await started();
    await w.room.takeGrantStanding({ iat: 1, trashed: true });
    expect(w.room.standing.putAway).toBe(false);
    expect(await w.room.state.storage.get(STANDING_KEY)).toBeUndefined();
  });
});

describe('a purge', () => {
  it('leaves nothing heard and nothing to wake for', async () => {
    const w = await started();
    await hearing(w, 'tab_added');
    await w.rule({ trigger: { kind: 'scheduled', every: 'day', at: '09:00' } });
    await w.room.purge(DOC);
    expect(w.room.automations.kinds.size).toBe(0);
    expect(w.room.automations.schedule.wakeAt).toBeNull();
    expect(w.room.collab.at).toBeNull();
  });
});
