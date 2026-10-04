import { describe, expect, it, vi } from 'vitest';
import { CHANGESET_RETENTION_MS, TRASH_RETENTION_MS } from '@livediagram/api-schema';
import { sqliteD1 } from './test-sqlite-d1';
import worker from './index';

// The daily cron purges the Trash (docs/specs/013-workspace/trash.md, "The
// purge"): what has waited 30 days goes, and the run says how many.

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
    const pending: Promise<unknown>[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await worker.scheduled(
      { cron: '0 3 * * *', scheduledTime: now, noRetry() {} } as ScheduledController,
      env,
      { waitUntil: (p: Promise<unknown>) => pending.push(p) } as unknown as ExecutionContext,
    );
    await Promise.all(pending);

    expect(
      sql
        .prepare('SELECT id FROM documents ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['live', 'waiting']);
    expect(log).toHaveBeenCalledWith('trash sweep: purged 1 documents');
    expect(error).not.toHaveBeenCalledWith('trash sweep failed', expect.anything());
    log.mockRestore();
    error.mockRestore();
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
