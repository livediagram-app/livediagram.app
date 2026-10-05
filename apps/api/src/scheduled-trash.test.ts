import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHANGESET_RETENTION_MS,
  EMPTY_DOCUMENT_STALE_MS,
  TRASH_RETENTION_MS,
} from '@livediagram/api-schema';
import { sqliteD1 } from './test-sqlite-d1';
import worker from './index';

// The daily cron purges the Trash (docs/specs/013-workspace/trash.md, "The
// purge"): what has waited 30 days goes, and the run says how many. It also
// moves documents empty for 30 days into the Trash
// (docs/specs/013-workspace/empty-document-cleanup.md), where they wait their
// own 30 days.

// The handler reads the wall clock, so the run's `now` is set as the system time.
async function runCron(env: Parameters<typeof worker.scheduled>[1], now: number) {
  vi.useFakeTimers({ toFake: ['Date'], now });
  const pending: Promise<unknown>[] = [];
  await worker.scheduled(
    { cron: '0 3 * * *', scheduledTime: now, noRetry() {} } as ScheduledController,
    env,
    { waitUntil: (p: Promise<unknown>) => pending.push(p) } as unknown as ExecutionContext,
  );
  await Promise.all(pending);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the 03:00 cron', () => {
  it('purges documents 30 days in the Trash and logs the count', async () => {
    const { env, sql } = sqliteD1();
    const now = Date.now();
    for (const [id, trashedAt] of [
      ['expired', now - TRASH_RETENTION_MS - 1000],
      ['waiting', now - 1000],
      ['live', null],
    ] as const) {
      sql
        .prepare(
          `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at, trashed_at)
           VALUES (?, 'owner', ?, 0, 0, 0, ?)`,
        )
        .run(id, id, trashedAt);
    }
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await runCron(env, now);

    expect(
      sql
        .prepare('SELECT id FROM documents ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['live', 'waiting']);
    expect(log).toHaveBeenCalledWith('trash sweep: purged 1 documents');
    expect(error).not.toHaveBeenCalledWith('trash sweep failed', expect.anything());
  });

  it('moves an empty document to the Trash and never purges it in the same run', async () => {
    const { env, sql } = sqliteD1();
    const now = Date.now();
    // Created and last saved long enough ago that a clock counting from either
    // would already be past both 30-day windows.
    const longAgo = now - EMPTY_DOCUMENT_STALE_MS - TRASH_RETENTION_MS - 1000;
    sql
      .prepare(
        `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
         VALUES ('empty', 'owner', 'empty', 0, ?, ?)`,
      )
      .run(longAgo, longAgo);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runCron(env, now);

    expect(sql.prepare(`SELECT trash_reason FROM documents WHERE id = 'empty'`).get()).toEqual({
      trash_reason: 'empty',
    });
    expect(log).toHaveBeenCalledWith('empty sweep: moved 1 documents to the Trash');
    expect(log).toHaveBeenCalledWith('trash sweep: purged 0 documents');

    // A day later it is still in the Trash; only 30 days after the move does it go.
    await runCron(env, now + 24 * 60 * 60 * 1000);
    expect(sql.prepare(`SELECT COUNT(*) AS n FROM documents`).get()).toEqual({ n: 1 });
    await runCron(env, now + TRASH_RETENTION_MS);
    expect(sql.prepare(`SELECT COUNT(*) AS n FROM documents`).get()).toEqual({ n: 0 });
  });
});

describe('the 03:00 cron and agent changesets', () => {
  it('sweeps changesets past their retention and logs the count (docs/specs/024-agents/agent-changesets.md)', async () => {
    const { env, sql } = sqliteD1();
    const now = Date.now();
    sql.exec(`INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
              VALUES ('D', 'owner', 'D', 0, 0, 0)`);
    sql.exec(
      `INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'T', '{"elements":[]}', 0)`,
    );
    for (const [id, rev, createdAt] of [
      ['cs_old', 1, now - CHANGESET_RETENTION_MS - 1000],
      ['cs_new', 2, now - 1000],
    ] as const) {
      sql
        .prepare(
          `INSERT INTO agent_changesets (id, document_id, tab_id, rev, author_id, author_name,
             author_color, fingerprints, added, changed, removed, created_at)
           VALUES (?, 'D', 't1', ?, 'owner', 'O', '#000', '{}', 1, 0, 0, ?)`,
        )
        .run(id, rev, createdAt);
    }
    const pending: Promise<unknown>[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await worker.scheduled(
      { cron: '0 3 * * *', scheduledTime: now, noRetry() {} } as ScheduledController,
      env,
      { waitUntil: (p: Promise<unknown>) => pending.push(p) } as unknown as ExecutionContext,
    );
    await Promise.all(pending);
    expect(
      sql
        .prepare('SELECT id FROM agent_changesets')
        .all()
        .map((r) => r.id),
    ).toEqual(['cs_new']);
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^changesets sweep: deleted 1 rows older than \d+$/),
    );
    log.mockRestore();
  });
});
