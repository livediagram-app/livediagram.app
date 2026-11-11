import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Auth } from './auth.ts';
import { deleteAccount } from './delete-account.ts';
import { storeDeletionCode } from './deletion-code.ts';
import {
  purgeFromIndex,
  recordPendingPurge,
  retryPendingPurges,
  STALE_PURGE_DAYS,
  type IndexPurgeConfig,
} from './index-purge.ts';
import { answerInvitation, createTeam, inviteMember, teamsClaim } from './teams.ts';
import { addUser, testD1 } from './test-d1.ts';

const INDEX_URL = 'https://liveworkspace.app/api/index';

type Sent = { url: string; auth: string | null; body: unknown };

let db: D1Database;
let sql: DatabaseSync;
let sent: Sent[];
let answer: () => Response | Promise<Response>;

// The index, behind its service binding.
const indexService = {
  fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
    sent.push({
      url: String(input),
      auth: new Headers(init.headers).get('authorization'),
      body: JSON.parse(String(init.body)),
    });
    return answer();
  },
} as unknown as Fetcher;

const config: IndexPurgeConfig = { indexUrl: INDEX_URL, indexService, indexKey: 'merge-key' };

const pending = () =>
  sql.prepare('SELECT userId, teamIds, attempts, lastError FROM pending_purges').all();

beforeEach(() => {
  ({ db, sql } = testD1());
  sent = [];
  answer = () => Response.json({ done: true, items: 3 });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('purgeFromIndex', () => {
  it("sends the request with accounts' key and clears it once the index has it", async () => {
    await recordPendingPurge(db, 'user_ada', ['team_1']);
    expect(await purgeFromIndex(db, config, 'user_ada')).toBe(true);
    expect(sent).toEqual([
      {
        url: `${INDEX_URL}/internal/purge-person`,
        auth: 'Bearer merge-key',
        body: { personId: 'user_ada', teamIds: ['team_1'] },
      },
    ]);
    expect(pending()).toEqual([]);
  });

  it('keeps the request, and says so, when the index refuses or is unreachable', async () => {
    await recordPendingPurge(db, 'user_ada', []);
    answer = () => new Response(null, { status: 503 });
    expect(await purgeFromIndex(db, config, 'user_ada')).toBe(false);
    answer = () => Promise.reject(new TypeError('network'));
    expect(await purgeFromIndex(db, config, 'user_ada')).toBe(false);
    expect(pending()).toEqual([
      { userId: 'user_ada', teamIds: '[]', attempts: 2, lastError: 'TypeError' },
    ]);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('keeps the request when the index is not set up', async () => {
    await recordPendingPurge(db, 'user_ada', []);
    expect(await purgeFromIndex(db, {}, 'user_ada')).toBe(false);
    expect(sent).toEqual([]);
    expect(pending()).toMatchObject([{ lastError: 'index_not_configured' }]);
  });
});

describe('retryPendingPurges', () => {
  it('sends every waiting request again until the index takes it, louder the longer it fails', async () => {
    await recordPendingPurge(db, 'user_ada', []);
    await recordPendingPurge(db, 'user_bea', ['team_2']);
    answer = () => new Response(null, { status: 500 });
    for (let i = 0; i < 3; i++) {
      expect(await retryPendingPurges(db, config)).toEqual({
        sent: 0,
        failed: 2,
        waiting: 2,
        dropped: 0,
      });
    }
    // The third failure of each is an error, not a warning.
    expect(console.error).toHaveBeenCalledTimes(2);

    answer = () => Response.json({ done: false, items: 500 });
    expect(await retryPendingPurges(db, config)).toEqual({
      sent: 2,
      failed: 0,
      waiting: 0,
      dropped: 0,
    });
    expect(pending()).toEqual([]);
    expect(sent.at(-1)).toMatchObject({ body: { personId: 'user_bea', teamIds: ['team_2'] } });
    // Nothing waiting: nothing sent.
    sent = [];
    expect(await retryPendingPurges(db, config)).toEqual({
      sent: 0,
      failed: 0,
      waiting: 0,
      dropped: 0,
    });
    expect(sent).toEqual([]);
  });

  it('drops a request whose account is still open 30 days after its first try, never one whose account is gone', async () => {
    const day = 86_400_000;
    const start = 1_000_000_000_000;
    addUser(sql, { id: 'user_open', email: 'open@example.com' });
    await recordPendingPurge(db, 'user_open', ['team_1', 'team_2'], start);
    await recordPendingPurge(db, 'user_gone', [], start);
    answer = () => new Response(null, { status: 500 });
    // Inside the 30 days: the open account's request waits, unsent.
    expect(await retryPendingPurges(db, config, start + 29 * day)).toEqual({
      sent: 0,
      failed: 1,
      waiting: 1,
      dropped: 0,
    });
    expect(await retryPendingPurges(db, config, start + STALE_PURGE_DAYS * day + 1)).toEqual({
      sent: 0,
      failed: 1,
      waiting: 1,
      dropped: 1,
    });
    expect(console.warn).toHaveBeenCalledWith(
      '[accounts] index purges dropped, their accounts never closed',
      { dropped: 1, teams: 2 },
    );
    expect(pending()).toEqual([expect.objectContaining({ userId: 'user_gone', attempts: 2 })]);
    expect(sent.map((s) => (s.body as { personId: string }).personId)).toEqual([
      'user_gone',
      'user_gone',
    ]);
  });
});

describe('deleteAccount', () => {
  // Better Auth's part, stood in for: introspection says the token is Ada's, and deleting the user
  // deletes the row.
  const auth = {
    handler: async () => Response.json({ active: true, sub: 'user_ada', client_id: 'livediagram' }),
    $context: Promise.resolve({
      internalAdapter: {
        deleteUser: async (id: string) => {
          sql.prepare('DELETE FROM "user" WHERE id = ?').run(id);
        },
      },
    }),
  } as unknown as Auth;

  // Closing needs the code emailed to Ada (deletion-code.ts), stored here as if she had asked for it.
  const closeRequest = () =>
    new Request('https://liveworkspace.app/api/auth/delete-account', {
      method: 'POST',
      headers: { authorization: `Basic ${btoa('livediagram:secret')}` },
      body: JSON.stringify({ token: 'access-token', code: '123456' }),
    });
  const close = () => deleteAccount(closeRequest(), db, { auth, index: config });

  beforeEach(async () => {
    addUser(sql, { id: 'user_ada', email: 'ada@example.com' });
    addUser(sql, { id: 'user_bea', email: 'bea@example.com' });
    await storeDeletionCode(db, 'user_ada', '123456');
  });

  it('refuses a body of null as a bad request, closing nothing', async () => {
    const res = await deleteAccount(
      new Request('https://liveworkspace.app/api/auth/delete-account', {
        method: 'POST',
        headers: { authorization: `Basic ${btoa('livediagram:secret')}` },
        body: 'null',
      }),
      db,
      { auth, index: config },
    );
    expect(res.status).toBe(400);
    expect(sql.prepare('SELECT id FROM "user"').all()).toHaveLength(2);
  });

  it('tells the index, naming the teams that closed with the account', async () => {
    const solo = (await createTeam(db, { id: 'user_ada', email: 'ada@example.com' }, 'Solo')) as {
      ok: true;
      value: { id: string };
    };
    expect(await teamsClaim(db, 'user_ada')).toHaveLength(1);

    const res = await close();
    expect(await res.json()).toEqual({ deleted: true });
    expect(sent).toEqual([
      expect.objectContaining({ body: { personId: 'user_ada', teamIds: [solo.value.id] } }),
    ]);
    expect(pending()).toEqual([]);
    expect(sql.prepare('SELECT id FROM "user"').all()).toEqual([{ id: 'user_bea' }]);
  });

  it('disconnects the account’s Google Drive mirror once the account is gone', async () => {
    const disconnected: string[] = [];
    const res = await deleteAccount(closeRequest(), db, {
      auth,
      index: config,
      closeWorkbench: async () => {},
      disconnectDrive: (userId) => {
        // The account is already closed when Drive is told.
        expect(sql.prepare('SELECT id FROM "user" WHERE id = ?').all(userId)).toEqual([]);
        disconnected.push(userId);
      },
    });
    expect(res.status).toBe(200);
    expect(disconnected).toEqual(['user_ada']);
  });

  it('still closes the account when the index is down, and leaves the purge for the cron', async () => {
    answer = () => new Response(null, { status: 502 });
    const res = await close();
    expect(res.status).toBe(200);
    expect(sql.prepare('SELECT id FROM "user" WHERE id = ?').all('user_ada')).toEqual([]);
    expect(pending()).toEqual([
      { userId: 'user_ada', teamIds: '[]', attempts: 1, lastError: 'status_502' },
    ]);

    answer = () => Response.json({ done: true, items: 0 });
    expect(await retryPendingPurges(db, config)).toMatchObject({ sent: 1, waiting: 0 });
  });

  it('still names the teams that closed when a try stopped part way and the person tries again', async () => {
    const solo = (await createTeam(db, { id: 'user_ada', email: 'ada@example.com' }, 'Solo')) as {
      ok: true;
      value: { id: string };
    };
    // The first try closes her team, then fails before the user goes.
    const failing = {
      ...auth,
      $context: Promise.resolve({
        internalAdapter: {
          deleteUser: async () => {
            throw new Error('D1 hiccup');
          },
        },
      }),
    } as unknown as Auth;
    await expect(
      deleteAccount(closeRequest(), db, { auth: failing, index: config }),
    ).rejects.toThrow('D1 hiccup');
    expect(sql.prepare('SELECT id FROM "user" WHERE id = ?').all('user_ada')).toHaveLength(1);
    // Her account is still open: the cron leaves the request alone.
    expect(await retryPendingPurges(db, config)).toEqual({
      sent: 0,
      failed: 0,
      waiting: 0,
      dropped: 0,
    });
    expect(sent).toEqual([]);

    await storeDeletionCode(db, 'user_ada', '123456');
    expect(await (await close()).json()).toEqual({ deleted: true });
    expect(sent).toEqual([
      expect.objectContaining({ body: { personId: 'user_ada', teamIds: [solo.value.id] } }),
    ]);
    expect(pending()).toEqual([]);
  });

  it('leaves no accounts row holding the closed account’s id', async () => {
    const ada = { id: 'user_ada', email: 'ada@example.com' };
    const bea = { id: 'user_bea', email: 'bea@example.com' };
    // A team Ada made and invited Bea to (Bea joined, so it outlives her), an invitation of hers still waiting,
    // and old livediagram guests: one she claimed, one she was claiming when she closed, one Bea claimed.
    const team = (await createTeam(db, ada, 'Shared')) as { ok: true; value: { id: string } };
    const invited = await inviteMember(db, ada, team.value.id, bea.email, 'member');
    if (!invited.ok) throw new Error(invited.error);
    await answerInvitation(db, bea, invited.value.member.id, true);
    await inviteMember(db, ada, team.value.id, 'cy@example.com', 'member');
    const guest = sql.prepare(
      `INSERT INTO legacy_guest (id, firstSeenAt, claimedAt, claimedBy, claimingBy, claimingUntil)
       VALUES (?, 1, ?, ?, ?, ?)`,
    );
    guest.run('guest_a', 5, 'user_ada', null, null);
    guest.run('guest_b', null, null, 'user_ada', Date.now() + 60_000);
    guest.run('guest_c', 5, 'user_bea', null, null);

    expect((await close()).status).toBe(200);

    // Every column of every table, searched for the id. The event outbox holds the team events it has yet to
    // hand the index (which anonymises them there): it is a queue, emptied as the index takes them.
    const tables = sql
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
           AND name NOT IN ('d1_migrations', 'index_events_outbox')`,
      )
      .all() as { name: string }[];
    const holding: string[] = [];
    for (const { name } of tables) {
      const columns = sql.prepare(`SELECT name FROM pragma_table_info(?)`).all(name) as {
        name: string;
      }[];
      for (const column of columns) {
        const { n } = sql
          .prepare(
            `SELECT COUNT(*) AS n FROM "${name}" WHERE CAST("${column.name}" AS TEXT) LIKE '%user_ada%'`,
          )
          .get() as { n: number };
        if (n > 0) holding.push(`${name}.${column.name}`);
      }
    }
    expect(holding).toEqual([]);
    expect(tables.length).toBeGreaterThan(20);
    // What she touched now names `deleted`, and Bea's stay hers.
    expect(
      sql
        .prepare('SELECT id, claimedBy, claimingBy, claimingUntil FROM legacy_guest ORDER BY id')
        .all(),
    ).toEqual([
      { id: 'guest_a', claimedBy: 'deleted', claimingBy: null, claimingUntil: null },
      { id: 'guest_b', claimedBy: null, claimingBy: null, claimingUntil: null },
      { id: 'guest_c', claimedBy: 'user_bea', claimingBy: null, claimingUntil: null },
    ]);
    expect(
      sql.prepare('SELECT DISTINCT invitedBy FROM team_member WHERE invitedBy IS NOT NULL').all(),
    ).toEqual([{ invitedBy: 'deleted' }]);
  });

  it('keeps the teams an earlier request named and adds new ones', async () => {
    await recordPendingPurge(db, 'user_gone', ['team_1', 'team_2']);
    await recordPendingPurge(db, 'user_gone', ['team_2', 'team_3']);
    expect(JSON.parse((pending()[0] as { teamIds: string }).teamIds).sort()).toEqual([
      'team_1',
      'team_2',
      'team_3',
    ]);
  });
});
