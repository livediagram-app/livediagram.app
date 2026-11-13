// The team audit log (team-audit-log.md): a team's item events, its own events from accounts and its items deleted
// for good land in the log in the same batch, once each; a personal item, a token or a folder move never do; rows
// past the year are swept; closing an account anonymises its rows and a closed team's log goes.
import { TEAM_AUDIT_RETENTION_MS } from '@liveworkspace/index-client';
import type { SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { budgetOf, purgePerson } from './account-purge';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import worker from './index';
import {
  accountAuditStatement,
  itemAuditStatement,
  sweepTeamAudit,
  TEAM_AUDIT_SWEEP_CHUNK,
  TEAM_AUDIT_SWEEP_ROUNDS,
} from './team-audit';
import { call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const DAY = 86_400_000;
const START = 20_400 * DAY;

afterEach(() => vi.useRealTimers());

// Each call a second on, so the log's order is the order things were done in.
function tick() {
  let now = START;
  vi.useFakeTimers({ toFake: ['Date'], now });
  return () => vi.setSystemTime((now += 1000));
}

type Row = {
  team_id: string;
  id: string;
  type: string;
  app: string;
  actor_id: string | null;
  actor_name: string | null;
  subject_id: string | null;
  item_id: string | null;
  title: string;
  detail: string | null;
  occurred_at: number;
};

const log = (team: string): Row[] =>
  h.db.sql
    .prepare('SELECT * FROM team_audit_events WHERE team_id = ? ORDER BY occurred_at, id')
    .all(team) as Row[];
const kinds = (team: string) => log(team).map((r) => `${r.type} ${r.title}`);
const count = () =>
  (h.db.sql.prepare('SELECT COUNT(*) AS n FROM team_audit_events').get() as { n: number }).n;

const sendAccountEvents = (events: unknown[]) =>
  call('/internal/events', { method: 'POST', auth: 'merge-key', body: { events } });

describe("a team item's events", () => {
  it('logs shares, unshares, trash, restore and a delete for good, with who and the name then', async () => {
    const next = tick();
    const ada = await person('user_au1', { teams: [{ id: 'team_au' }] });
    const item = await makeItem(ada.auth, { title: 'Budget', teamId: 'team_au' });
    next();
    await call(`/items/${item.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { title: 'Budget 2' },
    });
    next();
    await call(`/items/${item.id}/share`, {
      method: 'POST',
      auth: ada.auth,
      body: { level: 'view' },
    });
    next();
    await call(`/items/${item.id}/share`, {
      method: 'POST',
      auth: ada.auth,
      body: { level: 'view', public: true },
    });
    next();
    await call(`/items/${item.id}/share`, { method: 'DELETE', auth: ada.auth });
    next();
    await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth });
    next();
    await call(`/items/${item.id}/restore`, { method: 'POST', auth: ada.auth });
    next();
    await call(`/items/${item.id}?permanent=true`, { method: 'DELETE', auth: ada.auth });

    // Made and renamed are History's, not the log's.
    expect(kinds('team_au')).toEqual([
      'shared Budget 2',
      'shared Budget 2',
      'unshared Budget 2',
      'trashed Budget 2',
      'restored Budget 2',
      'deleted Budget 2',
    ]);
    const rows = log('team_au');
    expect(rows.every((r) => r.actor_id === 'user_au1' && r.item_id === item.id)).toBe(true);
    expect(rows.every((r) => r.app === 'liveplanner')).toBe(true);
    expect(rows.map((r) => (r.detail ? JSON.parse(r.detail) : null)).slice(0, 2)).toEqual([
      { level: 'view' },
      { level: 'view', public: 'true' },
    ]);
    // The item is gone; its rows stay.
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM items WHERE id = ?').get(item.id)).toEqual({
      n: 0,
    });
  });

  it("logs nothing for a person's own item", async () => {
    const bea = await person('user_au2');
    const item = await makeItem(bea.auth, { title: 'Mine' });
    await call(`/items/${item.id}/share`, {
      method: 'POST',
      auth: bea.auth,
      body: { level: 'view' },
    });
    await call(`/items/${item.id}`, { method: 'DELETE', auth: bea.auth });
    await call(`/items/${item.id}?permanent=true`, { method: 'DELETE', auth: bea.auth });
    expect(count()).toBe(0);
  });

  it('logs a move for the team it left and the one it went to, and a folder move for none', async () => {
    const next = tick();
    const cy = await person('user_au3', { teams: [{ id: 'team_m1' }, { id: 'team_m2' }] });
    const item = await makeItem(cy.auth, { title: 'Plan' });
    const patch = (body: Record<string, unknown>) =>
      call(`/items/${item.id}`, { method: 'PATCH', auth: cy.auth, body });
    next();
    expect((await patch({ teamId: 'team_m1' })).status).toBe(200);
    next();
    const folder = (await (
      await call('/folders', {
        method: 'POST',
        auth: cy.auth,
        body: { name: 'F', teamId: 'team_m1' },
      })
    ).json()) as { folder: { id: string } };
    await patch({ folderId: folder.folder.id });
    next();
    await patch({ teamId: 'team_m2' });
    next();
    await patch({ teamId: null });

    const moves = (team: string) =>
      log(team).map((r) => {
        const d = JSON.parse(r.detail!) as Record<string, string | null>;
        return `${r.type} ${d.fromTeamId ?? '-'}>${d.teamId ?? '-'}`;
      });
    expect(moves('team_m1')).toEqual(['moved ->team_m1', 'moved team_m1>team_m2']);
    expect(moves('team_m2')).toEqual(['moved team_m1>team_m2', 'moved team_m2>-']);
    expect(count()).toBe(4);
  });

  it('logs a teammate taking it offline as trashed, and its owner taking it offline as deleted', async () => {
    const owner = await person('user_au4', { teams: [{ id: 'team_off' }] });
    const mate = await person('user_au5', { teams: [{ id: 'team_off' }] });
    const a = await makeItem(owner.auth, { title: 'A', teamId: 'team_off' });
    const b = await makeItem(owner.auth, { title: 'B', teamId: 'team_off' });
    await call(`/items/${a.id}?permanent=true&reason=offline`, {
      method: 'DELETE',
      auth: mate.auth,
    });
    await call(`/items/${b.id}?permanent=true&reason=offline`, {
      method: 'DELETE',
      auth: owner.auth,
    });
    expect(
      log('team_off').map((r) => [r.type, r.title, r.actor_id, r.detail && JSON.parse(r.detail)]),
    ).toEqual([
      ['trashed', 'A', 'user_au5', null],
      ['deleted', 'B', 'user_au4', { reason: 'offline' }],
    ]);
  });

  it('logs each item of an emptied team Trash as deleted by whoever emptied it', async () => {
    const di = await person('user_au6', { teams: [{ id: 'team_tr' }] });
    for (const title of ['X', 'Y']) {
      const item = await makeItem(di.auth, { title, teamId: 'team_tr' });
      await call(`/items/${item.id}`, { method: 'DELETE', auth: di.auth });
    }
    expect((await call('/trash?team=team_tr', { method: 'DELETE', auth: di.auth })).ok).toBe(true);
    expect(
      log('team_tr')
        .filter((r) => r.type === 'deleted')
        .map((r) => `${r.title} ${r.actor_id}`)
        .sort(),
    ).toEqual(['X user_au6', 'Y user_au6']);
  });
});

describe("a team's own events, from accounts", () => {
  const joined = {
    id: 'team_joined:team_ac:user_ac2',
    type: 'team_joined',
    actorId: 'user_ac2',
    actorName: 'Bea',
    title: 'Guild',
    detail: { teamId: 'team_ac', personId: 'user_ac2', memberName: 'Bea', via: 'link' },
    at: START,
  };

  it("logs a team's events for its team alone, once, and never a token's or a team's deletion", async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: START });
    const token = {
      id: 'token_created:tok1',
      type: 'token_created',
      actorId: 'user_ac2',
      title: 'CI',
      at: START,
    };
    const deleted = {
      id: 'team_deleted:team_gone',
      type: 'team_deleted',
      actorId: 'user_ac2',
      title: 'Gone',
      detail: { teamId: 'team_gone' },
      at: START,
    };
    expect((await sendAccountEvents([joined, token, deleted])).status).toBe(204);
    // Sent again, later (accounts resends): nothing new, and the row keeps its time.
    vi.setSystemTime(START + 5000);
    expect((await sendAccountEvents([{ ...joined, at: START + 5000 }])).status).toBe(204);
    expect(log('team_ac')).toEqual([
      {
        team_id: 'team_ac',
        id: joined.id,
        type: 'team_joined',
        app: 'liveworkspace',
        actor_id: 'user_ac2',
        actor_name: 'Bea',
        subject_id: 'user_ac2',
        item_id: null,
        title: 'Guild',
        detail: JSON.stringify(joined.detail),
        occurred_at: START,
      },
    ]);
    expect(count()).toBe(1);
  });

  it('anonymises who did it and whom it is about when their account closes, and drops a closed team', async () => {
    const changed = {
      id: 'team_role_changed:team_ac:user_ac3:1',
      type: 'team_role_changed',
      actorId: 'user_ac2',
      actorName: 'Bea',
      title: 'Guild',
      detail: { teamId: 'team_ac', personId: 'user_ac3', memberName: 'Cy', role: 'admin' },
      at: START + 1,
    };
    const solo = {
      ...joined,
      id: 'team_joined:team_solo:user_ac2',
      title: 'Solo',
      detail: { ...joined.detail, teamId: 'team_solo' },
    };
    expect((await sendAccountEvents([joined, changed, solo])).status).toBe(204);
    // Someone else's rows are left alone.
    const before = log('team_ac').find((r) => r.type === 'team_role_changed')!;
    await purgePerson(h.db.env, 'user_ac3', [], budgetOf({ ms: 60_000, calls: 100 }));
    const cyGone = log('team_ac').find((r) => r.type === 'team_role_changed')!;
    expect(cyGone.subject_id).toBe('deleted');
    expect(JSON.parse(cyGone.detail!)).toEqual({
      teamId: 'team_ac',
      personId: 'deleted',
      memberName: null,
      role: 'admin',
    });
    expect(cyGone.actor_id).toBe(before.actor_id);

    await purgePerson(h.db.env, 'user_ac2', ['team_solo'], budgetOf({ ms: 60_000, calls: 100 }));
    expect(log('team_solo')).toEqual([]);
    const rows = log('team_ac');
    expect(rows.map((r) => [r.type, r.actor_id, r.actor_name, r.subject_id])).toEqual([
      ['team_joined', 'deleted', null, 'deleted'],
      ['team_role_changed', 'deleted', null, 'deleted'],
    ]);
    expect(rows.every((r) => !r.detail!.includes('Bea') && !r.detail!.includes('user_ac'))).toBe(
      true,
    );
  });
});

describe('keeping it a year', () => {
  it('sweeps rows past the year, the oldest first and at most the bound, and keeps the rest', async () => {
    const now = START + 400 * DAY;
    const insert = h.db.sql.prepare(
      `INSERT INTO team_audit_events (team_id, id, type, app, title, occurred_at)
       VALUES ('team_sw', ?, 'shared', 'liveplanner', 'T', ?)`,
    );
    for (let i = 0; i < 5; i++) insert.run(`old${i}`, now - TEAM_AUDIT_RETENTION_MS - 10 + i);
    insert.run('young', now - TEAM_AUDIT_RETENTION_MS + 1);
    // A chunk of 3, one round: the three oldest go, and it says more are left.
    expect(await sweepTeamAudit(h.db.env, now, { chunk: 3, rounds: 1 })).toEqual({
      deleted: 3,
      more: true,
    });
    expect(log('team_sw').map((r) => r.id)).toEqual(['old3', 'old4', 'young']);
    expect(await sweepTeamAudit(h.db.env, now)).toEqual({ deleted: 2, more: false });
    expect(log('team_sw').map((r) => r.id)).toEqual(['young']);
    expect(await sweepTeamAudit(h.db.env, now)).toEqual({ deleted: 0, more: false });
  });

  it('runs chunk after chunk until one takes less than a chunk, within its rounds and its time', async () => {
    const now = START + 400 * DAY;
    const insert = h.db.sql.prepare(
      `INSERT INTO team_audit_events (team_id, id, type, app, title, occurred_at)
       VALUES ('team_sw', ?, 'shared', 'liveplanner', 'T', ?)`,
    );
    for (let i = 0; i < 12; i++) insert.run(`old${i}`, now - TEAM_AUDIT_RETENTION_MS - 100 + i);
    // Exactly four chunks: the fifth statement takes none, so it finishes.
    expect(await sweepTeamAudit(h.db.env, now, { chunk: 3, rounds: 5 })).toEqual({
      deleted: 12,
      more: false,
    });
    for (let i = 0; i < 12; i++) insert.run(`again${i}`, now - TEAM_AUDIT_RETENTION_MS - 100 + i);
    // Out of rounds: two chunks of 5 go, the oldest first, and the rest wait.
    expect(await sweepTeamAudit(h.db.env, now, { chunk: 5, rounds: 2 })).toEqual({
      deleted: 10,
      more: true,
    });
    expect(log('team_sw').map((r) => r.id)).toEqual(['again10', 'again11']);
    // Out of time: one statement always runs, then the deadline stops it.
    for (let i = 0; i < 12; i++) insert.run(`late${i}`, now - TEAM_AUDIT_RETENTION_MS - 50 + i);
    expect(await sweepTeamAudit(h.db.env, now, { chunk: 5, ms: 0 })).toEqual({
      deleted: 5,
      more: true,
    });
  });

  it('clears a backlog many chunks deep in one daily cron run, through the age index, within budget', async () => {
    // The run reads the clock for its cutoff: held still, so the rows just inside the year stay inside it.
    const now = START + 400 * DAY;
    vi.useFakeTimers({ toFake: ['Date'], now });
    const cut = now - TEAM_AUDIT_RETENTION_MS;
    const sql = h.db.sql;
    const plan = sql
      .prepare(
        `EXPLAIN QUERY PLAN DELETE FROM team_audit_events WHERE rowid IN (
           SELECT rowid FROM team_audit_events WHERE occurred_at < ? ORDER BY occurred_at LIMIT ?)`,
      )
      .all(cut, TEAM_AUDIT_SWEEP_CHUNK)
      .map((r) => String((r as { detail: string }).detail))
      .join('\n');
    expect(plan).toMatch(/team_audit_events USING (COVERING )?INDEX team_audit_age/);
    expect(plan).not.toMatch(/TEMP B-TREE/);
    // 12,000 rows past the year (24 chunks, more than twice the old 5,000 a day) across 40 teams, beside 20,000 kept.
    const OLD = 12_000;
    const insert = sql.prepare(
      `INSERT INTO team_audit_events (team_id, id, type, app, title, occurred_at)
       VALUES (?, ?, 'shared', 'liveplanner', 'T', ?)`,
    );
    sql.exec('BEGIN');
    for (let i = 0; i < OLD; i++) insert.run(`team_${i % 40}`, `old-${i}`, cut - 1 - i);
    for (let i = 0; i < 20_000; i++) insert.run(`team_${i % 40}`, `kept-${i}`, cut + 1 + i);
    sql.exec('COMMIT');
    const ms = await cpuMsOfAsync(() =>
      worker.scheduled({ cron: '23 4 * * *' } as ScheduledController, h.db.env),
    );
    const left = (where: string) =>
      (
        sql.prepare(`SELECT COUNT(*) AS n FROM team_audit_events WHERE ${where}`).get() as {
          n: number;
        }
      ).n;
    expect(left(`occurred_at < ${cut}`)).toBe(0);
    expect(left('true')).toBe(20_000);
    console.info(
      `[team audit] daily run: ${OLD} rows past the year (${OLD / TEAM_AUDIT_SWEEP_CHUNK} chunks) beside 20,000 kept, swept in ${ms.toFixed(1)} ms of CPU`,
    );
    expect(ms).toBeLessThan(cpuBudgetMs(2_000));
    // Its bound: 200 statements of 500, so 100,000 rows a day at most.
    expect(TEAM_AUDIT_SWEEP_CHUNK * TEAM_AUDIT_SWEEP_ROUNDS).toBe(100_000);
  }, 60_000);
});

describe('the bound', () => {
  const plan = (statement: D1PreparedStatement) => {
    const { query, args } = statement as unknown as { query: string; args: unknown[] };
    return h.db.sql
      .prepare(`EXPLAIN QUERY PLAN ${query}`)
      .all(...(args as SQLInputValue[]))
      .map((r) => String((r as { detail: string }).detail));
  };
  const scans = (lines: string[]) =>
    lines.filter((l) => /\bSCAN (e|i|items|events|team_audit_events)\b(?! USING)/.test(l));

  it('writes each kind with one indexed statement, never scanning the events or the log', () => {
    // Records each statement's text and binds, for its plan.
    const db = {
      prepare: (query: string) => ({ bind: (...args: unknown[]) => ({ query, args }) }),
    } as unknown as D1Database;
    const statements = [
      itemAuditStatement(db, 'ev1')!,
      itemAuditStatement(db, 'ev1', ['team_a', null, 'team_b'])!,
      accountAuditStatement(db, [
        { id: 'a', type: 'team_joined', detail: { teamId: 'team_a' } },
        { id: 'b', type: 'team_renamed', detail: null },
      ])!,
    ];
    for (const statement of statements) expect(scans(plan(statement))).toEqual([]);
    expect(itemAuditStatement(db, 'ev1', [null])).toBeNull();
    expect(
      accountAuditStatement(db, [{ id: 'b', type: 'created', detail: { teamId: 'team_a' } }]),
    ).toBeNull();
  });
});
