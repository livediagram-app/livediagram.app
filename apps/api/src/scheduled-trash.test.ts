import { describe, expect, it, vi } from 'vitest';
import { TRASH_RETENTION_MS } from '@livediagram/api-schema';
import { sqliteD1 } from './test-sqlite-d1';
import worker from './index';

// The daily cron purges the Trash (docs/specs/013-workspace/trash.md, "The
// purge"): what has waited 30 days goes, and the run says how many.

describe('the 03:00 cron', () => {
  it('purges diagrams 30 days in the Trash and logs the count', async () => {
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
    expect(log).toHaveBeenCalledWith('trash sweep: purged 1 diagrams');
    expect(error).not.toHaveBeenCalledWith('trash sweep failed', expect.anything());
    log.mockRestore();
    error.mockRestore();
  });
});
