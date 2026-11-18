// Guests from before accounts stamped them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Guests"):
// the daily cron sends accounts its guest owners once, 500 a run after a saved cursor, over the binding alone.
import { describe, expect, it } from 'vitest';
import {
  ACCOUNTS_BINDING_ORIGIN,
  GUEST_SEEN_BACKFILL_PAGE,
  GUEST_SEEN_BACKFILL_PATH,
} from '@liveworkspace/auth-client/guest-seen-backfill';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { backfillGuestSeen, GUEST_SEEN_BACKFILL_JOB } from './guest-seen-backfill';
import worker from './index';
import { h, useHarness } from './test-support';
import type { Env } from './env';

useHarness();

const guest = (n: number) => `guest_${n.toString(16).padStart(8, '0')}-6d7e-4f3b-9a51-2c1d0e9f8a7b`;
const NOW = Date.UTC(2026, 10, 18, 4, 23);

type Sent = { url: string; auth: string | null; ids: string[] };

// A stand-in for the ACCOUNTS binding: records each call and answers as accounts would, or with `status`.
function accounts(status = 200) {
  const sent: Sent[] = [];
  const binding = {
    fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      const { ids } = JSON.parse(String(init.body)) as { ids: string[] };
      sent.push({ url: String(input), auth: headers.get('authorization'), ids });
      return status === 200
        ? Response.json({ added: ids.length })
        : Response.json({ error: 'x' }, { status });
    },
  } as unknown as Fetcher;
  return { sent, env: { ...h.db.env, ACCOUNTS: binding } as Env };
}

let nextItem = 0;
function addItems(owners: string[]) {
  const insert = h.db.sql.prepare(
    `INSERT INTO items (id, app, kind, owner_id, team_id, scope, title, created_at, updated_at)
     VALUES (?, 'livediagram', 'canvas', ?, NULL, ?, 't', 1, 1)`,
  );
  h.db.sql.exec('BEGIN');
  for (const owner of owners) insert.run(`item-${nextItem++}`, owner, `p:${owner}`);
  h.db.sql.exec('COMMIT');
}

const cursor = () =>
  h.db.sql
    .prepare('SELECT cursor, finished_at FROM cron_cursors WHERE job = ?')
    .get(GUEST_SEEN_BACKFILL_JOB) as { cursor: string; finished_at: number | null } | undefined;

describe('sending accounts the guests it has never seen', () => {
  it('sends each guest owner once, over the binding with the key, and never an account', async () => {
    addItems([guest(2), guest(1), guest(1), 'user_ada', 'user_bea', 'guest_old-shape', guest(3)]);
    const { sent, env } = accounts();
    expect(await backfillGuestSeen(env, NOW)).toEqual({ sent: 3, added: 3, finished: true });
    expect(sent).toEqual([
      {
        url: `${ACCOUNTS_BINDING_ORIGIN}${GUEST_SEEN_BACKFILL_PATH}`,
        auth: 'Bearer merge-key',
        ids: [guest(1), guest(2), guest(3)],
      },
    ]);
    // The cursor is the last owner read, a malformed one it skipped included.
    expect(cursor()).toEqual({ cursor: 'guest_old-shape', finished_at: NOW });
    // Finished: never again, whatever comes later.
    addItems([guest(0)]);
    expect(await backfillGuestSeen(env, NOW)).toEqual({ skipped: 'finished' });
    expect(sent).toHaveLength(1);
  });

  it('leaves out a guest already merged into someone', async () => {
    addItems([guest(1), guest(2)]);
    h.db.sql
      .prepare('INSERT INTO person_aliases (guest_id, person_id, merged_at) VALUES (?, ?, 1)')
      .run(guest(1), 'user_ada');
    const { sent, env } = accounts();
    await backfillGuestSeen(env, NOW);
    expect(sent.map((s) => s.ids)).toEqual([[guest(2)]]);
  });

  it('takes 500 a run after the saved cursor, and finishes on a short page', async () => {
    const owners = Array.from({ length: GUEST_SEEN_BACKFILL_PAGE + 20 }, (_, i) => guest(i));
    addItems(owners);
    const { sent, env } = accounts();
    expect(await backfillGuestSeen(env, NOW)).toEqual({
      sent: GUEST_SEEN_BACKFILL_PAGE,
      added: GUEST_SEEN_BACKFILL_PAGE,
      finished: false,
    });
    expect(cursor()).toEqual({ cursor: guest(GUEST_SEEN_BACKFILL_PAGE - 1), finished_at: null });
    expect(await backfillGuestSeen(env, NOW + 1)).toEqual({ sent: 20, added: 20, finished: true });
    expect(sent[1]!.ids).toEqual(owners.slice(GUEST_SEEN_BACKFILL_PAGE));
  });

  it('keeps the cursor where it was when accounts fails, so the page goes again', async () => {
    addItems([guest(1)]);
    const failing = accounts(503);
    await expect(backfillGuestSeen(failing.env, NOW)).rejects.toThrow('accounts answered 503');
    expect(cursor()).toBeUndefined();
    const { sent, env } = accounts();
    expect(await backfillGuestSeen(env, NOW)).toMatchObject({ sent: 1, finished: true });
    expect(sent[0]!.ids).toEqual([guest(1)]);
  });

  it('finishes with nothing to send, and does nothing without the binding or the key', async () => {
    addItems(['user_ada']);
    expect(await backfillGuestSeen(h.db.env, NOW)).toEqual({ skipped: 'unset' });
    const { env } = accounts();
    expect(await backfillGuestSeen({ ...env, MERGE_KEY: ' ' }, NOW)).toEqual({ skipped: 'unset' });
    expect(await backfillGuestSeen(env, NOW)).toEqual({ sent: 0, added: 0, finished: true });
    expect(cursor()).toEqual({ cursor: 'guest_', finished_at: NOW });
  });

  it('runs in the daily cron, a page of 500 among 20,000 items inside the budget, through the owner index', async () => {
    const plan = h.db.sql
      .prepare(
        `EXPLAIN QUERY PLAN SELECT DISTINCT owner_id FROM items
         WHERE owner_id > ?1 AND owner_id < ?2 AND owner_id NOT IN (SELECT guest_id FROM person_aliases)
         ORDER BY owner_id LIMIT ?3`,
      )
      .all('guest_', 'guest`', GUEST_SEEN_BACKFILL_PAGE)
      .map((r) => String((r as { detail: string }).detail))
      .join('\n');
    expect(plan).toMatch(/items USING (COVERING )?INDEX items_owner/);
    expect(plan).not.toMatch(/TEMP B-TREE/);
    // 20,000 items: 4,000 accounts' and 16,000 of 2,000 guests, so a page reads through many items per owner.
    addItems(
      Array.from({ length: 20_000 }, (_, i) =>
        i % 5 === 0 ? `user_${i}` : guest(Math.floor(i / 8)),
      ),
    );
    const { sent, env } = accounts();
    const ms = await cpuMsOfAsync(() =>
      worker.scheduled({ cron: '23 4 * * *' } as ScheduledController, env),
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]!.ids).toHaveLength(GUEST_SEEN_BACKFILL_PAGE);
    expect(ms).toBeLessThan(cpuBudgetMs(1_000));
  });
});
