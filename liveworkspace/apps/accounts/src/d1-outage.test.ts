import { describe, expect, it } from 'vitest';
import { watchedD1, withD1OutageWatch } from './d1-outage.ts';

const OUTAGE = 'D1_ERROR: internal error';

// A D1 whose every call fails with `message`, by rejecting or (`sync`) by throwing.
function failingD1(message: string, sync = false): D1Database {
  const fail = () => {
    if (sync) throw new Error(message);
    return Promise.reject(new Error(message));
  };
  const statement = { bind: () => statement, first: fail, all: fail, run: fail };
  return { prepare: () => statement, batch: fail, exec: fail, version: 1 } as unknown as D1Database;
}

describe('withD1OutageWatch', () => {
  it('throws the outage when the answer is an error', async () => {
    const db = watchedD1(failingD1(OUTAGE));
    const run = withD1OutageWatch(async () => {
      await db
        .prepare('SELECT 1')
        .bind(1)
        .first()
        .catch(() => null);
      return new Response(null, { status: 500 });
    });
    await expect(run).rejects.toThrow(OUTAGE);
  });

  it('notes a call that throws without a promise', async () => {
    const db = watchedD1(failingD1(OUTAGE, true));
    const run = withD1OutageWatch(async () => {
      try {
        await db.batch([]);
      } catch {
        // Swallowed, as Better Auth does.
      }
      return new Response(null, { status: 401 });
    });
    await expect(run).rejects.toThrow(OUTAGE);
  });

  it('keeps a good answer even after an outage', async () => {
    const db = watchedD1(failingD1(OUTAGE));
    const res = await withD1OutageWatch(async () => {
      await db.exec('SELECT 1').catch(() => null);
      return new Response('ok');
    });
    expect(res.status).toBe(200);
  });

  it('leaves an error answer alone when D1 failed for another reason', async () => {
    const db = watchedD1(failingD1('D1_ERROR: no such table: user'));
    const res = await withD1OutageWatch(async () => {
      await db
        .prepare('SELECT 1')
        .all()
        .catch(() => null);
      return new Response(null, { status: 500 });
    });
    expect(res.status).toBe(500);
  });

  it('notes nothing outside a request, and passes plain values through', async () => {
    const db = watchedD1(failingD1(OUTAGE));
    expect((db as unknown as { version: number }).version).toBe(1);
    await expect(db.prepare('SELECT 1').run()).rejects.toThrow(OUTAGE);
  });
});
