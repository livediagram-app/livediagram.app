import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  box,
  suggestionBox,
  ANA,
  BEN,
  DOC,
  roomWorld,
  type RoomWorld,
} from './test-automation-world';
import { STANDING_KEY } from './space-automations';

// Each moment a Space's rules hear, queued where it happens (docs/specs/013-workspace/automations.md; blueprint
// automations.md "Event call sites"), in the Space's real room: who made it, what it carries, and that nothing at all
// is written while no rule hears it.

const BASE = `/api/documents/${DOC}`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function started(
  tabs = [
    { id: 't1', name: 'Lobby', elements: [box('a'), suggestionBox('s')] },
    { id: 't2', name: 'Garden', elements: [] },
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
    expect((await w.drop('t1', 's', 'Hello')).status).toBe(201);
    await w.saveTab('t1', [box('a'), box('b')]);
    await w.send('PUT', `${BASE}/tabs/t3`, { id: 't3', name: 'New', elements: [] });
    await w.send('DELETE', `${BASE}/tabs/t2`);
    await w.send('POST', `${BASE}/snapshots`, { name: 'One' });
    await w.room.joined(DOC, BEN, 'view');
    await w.room.accessRequested(DOC, { id: BEN, name: 'Ben' });
    w.leave(await w.visit('k-ana', 't1'));
    for (const table of [
      'automation_queue',
      'automation_edits',
      'automation_settles',
      'automation_writer',
      'automation_hears',
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
      { kind: 'tab_removed', tab: 't2', by: { id: ANA }, data: { 'tab.name': 'Garden' } },
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
      { name: 'After Lobby' },
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
    expect(w.rows('SELECT tab_id FROM document_tabs ORDER BY order_index')).toEqual([
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

  it('starts nothing in a Space never started', async () => {
    const w = roomWorld();
    await w.room.accessRequested(DOC, { id: BEN, name: 'Ben' });
    expect(w.rows("SELECT name FROM sqlite_master WHERE type = 'table'")).toEqual([]);
  });
});

describe('Someone Arrived', () => {
  it('fires once for a burst of arrivals into an empty tab, naming the first one', async () => {
    const w = await started();
    await hearing(w, 'someone_arrived');
    await w.visit('k-ana', 't1', { name: 'Ana' });
    await w.visit('k-ben', 't1', { name: 'Ben', level: 'participate' });
    await w.visit('k-cy', 't1', { name: 'Cy' });
    // Three visits, one of them into an empty tab: the rule's `empty` (on) hears only that one.
    expect(w.queued()).toMatchObject([
      {
        kind: 'someone_arrived',
        tab: 't1',
        by: { id: '', name: 'Ana' },
        role: 'editor',
        data: { 'visit.empty': true },
      },
      {
        kind: 'someone_arrived',
        by: { name: 'Ben' },
        role: 'participant',
        data: { 'visit.empty': false },
      },
      { kind: 'someone_arrived', by: { name: 'Cy' }, data: { 'visit.empty': false } },
    ]);
  });

  it('starts nothing for a second device or a reconnect inside the grace', async () => {
    const w = await started();
    await hearing(w, 'someone_arrived');
    const first = await w.visit('k-ana', 't1', { name: 'Ana' });
    await w.visit('k-ana', 't1', { name: 'Ana' });
    w.leave(first);
    expect(w.queued()).toHaveLength(1);
    const all = w.room.state.getWebSockets() as unknown as Parameters<RoomWorld['leave']>[0][];
    for (const ws of all) w.leave(ws);
    await w.visit('k-ana', 't1', { name: 'Ana' });
    expect(w.queued()).toHaveLength(1);
  });

  it('hears a move into another tab as arriving there', async () => {
    const w = await started();
    await hearing(w, 'someone_arrived');
    const ws = await w.visit('k-ana', 't1', { name: 'Ana' });
    w.focus(ws, 't2');
    expect(w.queued().map((e) => e.tab)).toEqual(['t1', 't2']);
  });

  it('writes no visit event and probes nothing more while no rule hears one', async () => {
    const w = await started();
    const ws = await w.visit('k-ana', 't1');
    w.leave(ws);
    expect(w.rows('SELECT name, left_at IS NOT NULL AS left FROM tab_attendance')).toEqual([
      { name: 'k-ana', left: 1 },
    ]);
    expect(w.rows('SELECT * FROM automation_queue')).toEqual([]);
    expect(w.rows('SELECT * FROM automation_settles')).toEqual([]);
  });
});

describe('Everyone Left', () => {
  it('starts a quiet stretch when the last one leaves, carrying who was there', async () => {
    const w = await started();
    const rule = await hearing(w, 'everyone_left', { minutes: 10 });
    const ana = await w.visit('k-ana', 't1', { name: 'Ana' });
    const ben = await w.visit('k-ben', 't1', { name: 'Ben' });
    w.leave(ana);
    // Ben is still there: nothing starts.
    expect(w.rows('SELECT * FROM automation_settles')).toEqual([]);
    w.leave(ben);
    const [row] = w.rows('SELECT rule_id, key, data FROM automation_settles');
    expect(row).toMatchObject({ rule_id: rule.id, key: 't1' });
    expect(JSON.parse(String(row!['data']))).toMatchObject({
      tab: 't1',
      data: { 'visit.people': 'Ana, Ben', 'visit.count': 2, 'visit.minutes': 0 },
    });
    // Its edges never sit on the queue.
    expect(w.queued()).toEqual([]);
  });

  it('is called off when someone comes back, even inside the grace', async () => {
    const w = await started();
    await hearing(w, 'everyone_left', { minutes: 10 });
    const ana = await w.visit('k-ana', 't1', { name: 'Ana' });
    w.leave(ana);
    expect(w.rows('SELECT * FROM automation_settles')).toHaveLength(1);
    await w.visit('k-ana', 't1', { name: 'Ana' });
    expect(w.rows('SELECT * FROM automation_settles')).toEqual([]);
  });

  it('keeps to its tab', async () => {
    const w = await started();
    await hearing(w, 'everyone_left', { minutes: 10, tab: 't2' });
    w.leave(await w.visit('k-ana', 't1'));
    expect(w.rows('SELECT * FROM automation_settles')).toEqual([]);
    w.leave(await w.visit('k-ana', 't2'));
    expect(w.rows('SELECT key FROM automation_settles')).toEqual([{ key: 't2' }]);
  });

  it('starts nothing when a restart sweeps the visits a deploy left open', async () => {
    const w = await started();
    await hearing(w, 'everyone_left', { minutes: 10 });
    await w.visit('k-ana', 't1');
    for (const ws of w.room.state.getWebSockets()) (ws as unknown as { close(): void }).close();
    const { sweepStaleAttendance } = await import('../room-attendance');
    sweepStaleAttendance(w.room);
    expect(w.rows('SELECT left_at IS NOT NULL AS left FROM tab_attendance')).toEqual([{ left: 1 }]);
    expect(w.rows('SELECT * FROM automation_settles')).toEqual([]);
  });
});

describe('Suggestion Dropped', () => {
  it('queues a note with its tab and nobody behind it', async () => {
    const w = await started();
    await hearing(w, 'suggestion_dropped');
    const res = await w.drop('t1', 's', '  More plants please  ');
    expect(res.status).toBe(201);
    const [event] = w.queued();
    expect(event).toMatchObject({
      kind: 'suggestion_dropped',
      tab: 't1',
      data: { suggestion: 'More plants please' },
    });
    expect(event!.by).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain(BEN);
  });
});

describe('a Space put away', () => {
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

  it('keeps no standing for a Space that never heard one, whatever its grants say', async () => {
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
  });
});
