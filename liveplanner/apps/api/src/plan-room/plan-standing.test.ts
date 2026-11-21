import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import type { AutomationRule, AutomationRun } from '@liveplanner/items';
import { PROJECT_TRASHED_CLOSE, type AutomationSecretResponse } from '@liveplanner/api-schema';
import { ITEM_ARCHIVED_CLOSE } from '@liveworkspace/api-schema/room-wire';
import { endRepeatWorld } from './test-repeat-world';
import { automationWorld, type AutomationWorld } from './automations/test-automation-world';
import { STANDING_KEY, WAIT_PUT_AWAY } from './plan-standing';

// A plan archived or in the Trash runs no rule (docs/specs/026-plan/automations.md "Put away"; blueprint
// automations.md "Put away"): the index's push through the real worker's internal door, the room's schedules read as
// empty while it lasts, and on the way back each time rule takes its latest missed moment (a day late at most), a held
// run more than a day past its time is Skipped and a repeating card makes one copy. A plan that never heard (the index
// could not reach it) runs as before; a grant newer than the last word mends a lost move out.
vi.mock('../auth/accounts', async () => (await import('./test-accounts-mock')).accountsMock);

const QUARTER = 15 * 60_000;
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const INDEX_KEY = 'index-key';

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  w = await automationWorld();
  Reflect.set(w.env, 'INDEX_KEY', INDEX_KEY);
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
const moment = () => Math.floor(Date.now() / QUARTER) * QUARTER;
const clock = (ms: number) => new Date(ms).toISOString().slice(11, 16);

// The index's push, as the index sends it; each one a moment after the last, as the index writes them.
let told = 0;
const tell = (archived: boolean, trashed: boolean, at = Date.now() + ++told) =>
  w.raw(
    new Request('https://api.test/api/internal/items/A/standing', {
      method: 'POST',
      headers: { Authorization: `Bearer ${INDEX_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived, trashed, at }),
    }),
  );

// A Scheduled rule at the last quarter hour (UTC), flagging every card.
const daily = () =>
  w.rule({
    name: 'Daily',
    trigger: { kind: 'scheduled', every: 'day', at: clock(moment()) },
    steps: [{ kind: 'flag' }],
    timeZone: 'UTC',
  });
const dueAt = (rule: AutomationRule, at: number) => {
  plan()
    .db.prepare('UPDATE automation_schedule SET next_at = ? WHERE rule_id = ?')
    .run(at, rule.id);
  room().automations.schedule.restoreTimes();
};
// A run held at a Wait whose time was `at`.
async function held(at: number) {
  await w.rule({
    name: 'Later',
    steps: [{ kind: 'flag' }, { kind: 'wait', hours: 2 }, { kind: 'add_label', label: 'later' }],
  });
  const c = await w.make('A', { title: 'Wait for it' });
  await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'done' });
  await room().alarm();
  plan().db.prepare('UPDATE automation_waiting SET at = ?').run(at);
  room().automations.schedule.restoreTimes();
  return c;
}
const waiting = () =>
  plan().db.prepare('SELECT COUNT(*) AS n FROM automation_waiting').get()!['n'] as number;

describe('the standing door', () => {
  it('keeps where the plan stands, newest first, in the room’s storage', async () => {
    const at = Date.now();
    expect((await tell(true, false, at)).status).toBe(200);
    expect(room().standing.putAway).toBe(true);
    expect(await room().state.storage.get(STANDING_KEY)).toEqual({ putAway: true, at });
    // An older word (two calls that crossed) changes nothing; the same moment neither.
    await tell(false, false, at - 1);
    await tell(false, false, at);
    expect(room().standing.putAway).toBe(true);
    // In the Trash too, and back.
    await tell(false, true, at + 1);
    expect(room().standing.putAway).toBe(true);
    await tell(false, false, at + 2);
    expect(room().standing.putAway).toBe(false);
    expect(await room().state.storage.get(STANDING_KEY)).toEqual({ putAway: false, at: at + 2 });
  });

  it("takes the index's key alone and refuses a malformed body", async () => {
    const res = await w.raw(
      new Request('https://api.test/api/internal/items/A/standing', {
        method: 'POST',
        headers: { Authorization: 'Bearer nope', 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true, trashed: false, at: 1 }),
      }),
    );
    expect(res.status).toBe(401);
    const bad = await w.raw(
      new Request('https://api.test/api/internal/items/A/standing', {
        method: 'POST',
        headers: { Authorization: `Bearer ${INDEX_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      }),
    );
    expect(bad.status).toBe(400);
    expect(room().standing.putAway).toBe(false);
  });

  it('survives the room waking again', async () => {
    const rule = await daily();
    await tell(true, false);
    dueAt(rule, moment());
    // A woken object reads the stored standing before its schedules restore.
    room().standing.restore(await room().state.storage.get(STANDING_KEY));
    room().automations.restore(Date.now());
    expect(room().automations.schedule.timeAt).toBeNull();
    // A damaged key is no standing: the plan runs.
    room().standing.restore({ putAway: 'yes' });
    expect(room().standing.putAway).toBe(false);
  });
});

// A trash made anywhere reaches the room through this door (docs/specs/013-workspace/trash.md "Open editors"; Work
// Tracker 1141): the REST API's DELETE /api/projects/:id and MCP delete_project (which calls it) trash at the index,
// as the Explorer does, and the index pushes the standing here.
describe('a trashed plan’s open sessions', () => {
  type Socket = { sent: string[]; closed: [number, string] | null };
  // An open session as the hibernation runtime hands it to the room: an editor's, or an MCP live view's.
  const open = (role: 'edit' | 'view'): Socket => {
    const socket: Socket = { sent: [], closed: null };
    const ws = {
      send: (data: string) => void socket.sent.push(data),
      close: (code: number, reason: string) => void (socket.closed = [code, reason]),
      serializeAttachment: () => {},
      deserializeAttachment: () => ({
        presenceId: `p-${role}`,
        verifiedRole: role,
        presence: null,
      }),
    };
    (room().state as unknown as { sockets: unknown[] }).sockets.push(ws);
    return socket;
  };
  const ops = (s: Socket) =>
    s.sent
      .map((raw) => JSON.parse(raw) as { kind: string; from?: string; op?: { kind: string } })
      .filter((m) => m.kind === 'op');
  const sockets = () => (room().state as unknown as { sockets: unknown[] }).sockets;

  it('tells every session it was trashed and closes each with 4004', async () => {
    const editor = open('edit');
    const view = open('view');
    expect((await tell(false, true)).status).toBe(200);
    for (const s of [editor, view]) {
      expect(ops(s)).toEqual([{ kind: 'op', from: 'system', op: { kind: 'project-trashed' } }]);
      expect(s.closed).toEqual([PROJECT_TRASHED_CLOSE, 'project-trashed']);
    }
  });

  // Work Tracker 1242, one-explorer.md "Archived from elsewhere while open": MCP archive_project, the CLI, the Explorer.
  it('closes every session with 4010 on an archive, sending nothing first', async () => {
    const editor = open('edit');
    const view = open('view');
    expect((await tell(true, false)).status).toBe(200);
    for (const s of [editor, view]) {
      expect(ops(s)).toEqual([]);
      expect(s.closed).toEqual([ITEM_ARCHIVED_CLOSE, 'item-archived']);
    }
  });

  it('closes nothing on a move out, an older archive, or a trash older than the last word', async () => {
    const editor = open('edit');
    const at = Date.now();
    await tell(false, false, at);
    await tell(true, false, at - 1);
    await tell(true, false, at);
    await tell(false, true, at - 1);
    expect(ops(editor)).toEqual([]);
    expect(editor.closed).toBeNull();
  });

  it('opens again after a move out of Archived', async () => {
    open('edit');
    await tell(true, false);
    await tell(false, false);
    sockets().length = 0;
    const back = open('edit');
    expect(room().standing.putAway).toBe(false);
    expect(back.closed).toBeNull();
  });

  it('opens again after a restore: a later session hears the plan as before', async () => {
    open('edit');
    await tell(false, true);
    await tell(false, false);
    sockets().length = 0;
    const back = open('edit');
    expect(room().standing.putAway).toBe(false);
    room().broadcastSystemOp({ kind: 'project-meta', name: 'Back' });
    expect(ops(back).map((m) => m.op?.kind)).toEqual(['project-meta']);
    expect(back.closed).toBeNull();
  });

  it('closes every session when the worker broadcasts project-trashed itself', async () => {
    const editor = open('edit');
    const res = await room().fetch(
      new Request('https://room/broadcast', {
        method: 'POST',
        body: JSON.stringify({ op: { kind: 'project-trashed' } }),
      }),
    );
    expect(res.status).toBe(204);
    expect(editor.closed).toEqual([PROJECT_TRASHED_CLOSE, 'project-trashed']);
  });
});

describe('a plan put away', () => {
  for (const [kind, archived, trashed] of [
    ['archived', true, false],
    ['in the Trash', false, true],
  ] as const) {
    it(`runs no time rule while ${kind}, and never wakes for one`, async () => {
      const rule = await daily();
      const c = await w.make('A', { title: 'One' });
      await tell(archived, trashed);
      dueAt(rule, moment());
      expect(room().automations.schedule.timeAt).toBeNull();
      expect(room().automations.schedule.wakeAt).toBeNull();
      await room().alarm();
      await room().alarm();
      expect((await card(c.id)).fields['flagged']).toBeUndefined();
      expect(await runs()).toEqual([]);
    });
  }

  it('holds a Wait, hears no card write, and takes an Incoming Webhook call without running it', async () => {
    const c = await held(Date.now() - 1);
    await tell(true, false);
    await room().alarm();
    expect((await card(c.id)).fields['labels']).toBeUndefined();
    expect(waiting()).toBe(1);
    // A card write starts nothing: the rules hear no kind.
    expect(room().automations.kinds.size).toBe(0);
    const other = await w.make('A', { title: 'Moved while archived' });
    await w.send('POST', `/api/projects/A/items/${other.id}/move`, { status: 'done' });
    await room().alarm();
    expect((await card(other.id)).fields['flagged']).toBeUndefined();
    expect(plan().db.prepare('SELECT COUNT(*) AS n FROM automation_queue').get()!['n']).toBe(0);

    const hookRule = await w.rule({
      name: 'From CI',
      trigger: { kind: 'incoming_webhook' },
      steps: [{ kind: 'add_label', label: 'built' }],
    });
    const made = await (
      await w.call('POST', `/${hookRule.id}/secret`)
    ).json<AutomationSecretResponse>();
    const body = '{}';
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await w.raw(
      new Request(`https://api.test/api/hooks/automations/A/${hookRule.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Liveplanner-Signature': `sha256=${createHmac('sha256', made.secret).update(`${ts}.${body}`).digest('hex')}`,
          'X-Liveworkspace-Timestamp': ts,
        },
        body,
      }),
    );
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ queued: 0 });
    // A wrong secret is still refused.
    const wrong = await w.raw(
      new Request(`https://api.test/api/hooks/automations/A/${hookRule.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong' },
        body,
      }),
    );
    expect(wrong.status).toBe(401);
  });

  it('makes no repeating card copies', async () => {
    const source = await w.make('A', {
      title: 'Daily standup',
      repeat: { every: 'day', from: '2020-01-01', timeZone: 'UTC' },
    });
    await room().alarm();
    const before = (await w.items('A')).length;
    await tell(true, false);
    expect(room().repeats.at).toBeNull();
    // Its next day comes while it is put away.
    plan()
      .db.prepare('UPDATE item_repeats SET next_at = ?')
      .run(Date.now() - 1);
    room().repeats.restore(Date.now());
    expect(room().repeats.at).toBeNull();
    await room().alarm();
    expect(await w.items('A')).toHaveLength(before);
    expect(source.id).toBeTruthy();
  });

  it('drops what a wake that was running asked for, so the alarm stops asking', async () => {
    await tell(true, false);
    room().repeats.at = Date.now() - 1;
    room().automations.schedule.at = Date.now() - 1;
    await room().alarm();
    expect(room().repeats.at).toBeNull();
    expect(room().automations.schedule.wakeAt).toBeNull();
  });
});

describe('a plan that comes back', () => {
  it('runs a time rule once, for the latest moment it missed, a day late at most', async () => {
    const rule = await daily();
    const c = await w.make('A', { title: 'One' });
    await tell(true, false);
    // Waiting since three days before today's moment: today's is the one it takes.
    dueAt(rule, moment() - 3 * DAY);
    await room().alarm();
    expect((await card(c.id)).fields['flagged']).toBeUndefined();
    await tell(false, false);
    expect(room().automations.schedule.timeAt).toBe(moment() - 3 * DAY);
    await room().alarm();
    await room().alarm();
    expect((await card(c.id)).fields['flagged']).toBe(true);
    const done = (await runs()).filter((r) => r.result === 'done');
    expect(done).toHaveLength(1);
    // And moves on to the next moment.
    const next = plan()
      .db.prepare('SELECT next_at FROM automation_schedule WHERE rule_id = ?')
      .get(rule.id)!['next_at'] as number;
    expect(next).toBeGreaterThan(Date.now());
  });

  it('drops a moment more than a day late', async () => {
    const tracked: string[] = [];
    vi.spyOn(console, 'info').mockImplementation((line: unknown) => {
      if (typeof line === 'string') tracked.push(line);
    });
    // A weekly rule whose day was over a day ago: nothing runs on the way back.
    const day = new Date(moment() - 2 * DAY).getUTCDay();
    const rule = await w.rule({
      name: 'Weekly',
      trigger: { kind: 'scheduled', every: 'week', days: [day], at: clock(moment()) },
      steps: [{ kind: 'flag' }],
      timeZone: 'UTC',
    });
    const c = await w.make('A', { title: 'One' });
    await tell(false, true);
    dueAt(rule, moment() - 2 * DAY);
    await tell(false, false);
    await room().alarm();
    await room().alarm();
    expect((await card(c.id)).fields['flagged']).toBeUndefined();
    expect(tracked).toContain('[automations] time.missed');
  });

  it('goes on with a held run due within the day', async () => {
    const fresh = await held(Date.now() - HOUR);
    await tell(true, false);
    await tell(false, false);
    await room().alarm();
    await room().alarm();
    expect((await card(fresh.id)).fields['labels']).toEqual(['later']);
  });

  it('Skips a held run due more than a day before it came back', async () => {
    const stale = await held(Date.now() - 2 * DAY);
    await tell(true, false);
    await tell(false, false);
    expect(waiting()).toBe(0);
    const skipped = (await runs()).filter((r) => r.result === 'skipped');
    expect(skipped).toMatchObject([{ reason: WAIT_PUT_AWAY }]);
    await room().alarm();
    expect((await card(stale.id)).fields['labels']).toBeUndefined();
  });

  it('makes at most one repeating card copy, for today', async () => {
    const source = await w.make('A', {
      title: 'Daily standup',
      repeat: { every: 'day', from: '2020-01-01', timeZone: 'UTC' },
    });
    await room().alarm();
    // Its last copy was long ago, before it was archived.
    plan()
      .db.prepare('UPDATE item_repeats SET last_made = ?, next_at = ?')
      .run('2020-01-02', Date.now() - 30 * DAY);
    await tell(true, false);
    await tell(false, false);
    // A wake now, to settle each card afresh.
    expect(room().repeats.at).toBeLessThanOrEqual(Date.now());
    await room().alarm();
    await room().alarm();
    const copies = (await w.items('A')).filter(
      (i) => i.id !== source.id && i.fields['title'] === 'Daily standup',
    );
    expect(copies).toHaveLength(1);
  });
});

describe('failing open', () => {
  it('runs as before on a plan that never heard where it stands (the index unreachable)', async () => {
    const rule = await daily();
    const c = await w.make('A', { title: 'One' });
    expect(await room().state.storage.get(STANDING_KEY)).toBeUndefined();
    dueAt(rule, moment());
    await room().alarm();
    await room().alarm();
    expect((await card(c.id)).fields['flagged']).toBe(true);
  });

  it('answers 503 when the room cannot take it, so the index logs it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(room().state.storage, 'put').mockRejectedValueOnce(new Error('storage down'));
    expect((await tell(true, false)).status).toBe(503);
    expect(room().standing.putAway).toBe(false);
    expect(warn).toHaveBeenCalledWith('[internal] standing failed', expect.anything());
  });

  it('mends a lost move out from a grant signed after it was put away', async () => {
    const at = Date.now();
    await tell(true, false, at);
    // A grant from before the archive (a cached one) says nothing new.
    await room().takeGrantStanding({ iat: Math.floor(at / 1000) - 1 });
    expect(room().standing.putAway).toBe(true);
    // A grant built by hand (no iat) neither.
    await room().takeGrantStanding({});
    expect(room().standing.putAway).toBe(true);
    // A trashed grant agrees it is put away: nothing written.
    await room().takeGrantStanding({ iat: Math.floor(at / 1000) + 5, trashed: true });
    expect(await room().state.storage.get(STANDING_KEY)).toEqual({ putAway: true, at });
    await room().takeGrantStanding({ iat: Math.floor(at / 1000) + 5 });
    expect(room().standing.putAway).toBe(false);
  });

  it('takes a grant through a request, and a failed write never fails it', async () => {
    const at = Date.now() - 10_000;
    await tell(true, false, at);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(room().state.storage, 'put').mockRejectedValueOnce(new Error('storage down'));
    await room().takeGrantStanding({ iat: Math.floor(Date.now() / 1000) });
    expect(room().standing.putAway).toBe(true);
    expect(warn).toHaveBeenCalledWith('[standing] not taken from the grant', expect.anything());
  });

  it('writes nothing for a grant on a plan that never heard', async () => {
    await room().takeGrantStanding({ iat: Math.floor(Date.now() / 1000) });
    expect(await room().state.storage.get(STANDING_KEY)).toBeUndefined();
  });
});
