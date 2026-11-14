// A stale local database names itself in development, and only there.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STALE_LOCAL_DATABASE, warnIfLocalDatabaseStale } from './local-db-hint';
import { call, h, person, useHarness } from './test-support';

useHarness();

afterEach(() => vi.restoreAllMocks());

const missing = new Error('D1_ERROR: no such column: opens: SQLITE_ERROR');

describe('warnIfLocalDatabaseStale', () => {
  it('warns in development for a missing column or table, including one in the cause', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(warnIfLocalDatabaseStale({ ENVIRONMENT: 'development' }, missing)).toBe(true);
    const wrapped = new Error('failed', { cause: new Error('no such table: use_days') });
    expect(warnIfLocalDatabaseStale({ ENVIRONMENT: 'development' }, wrapped)).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(STALE_LOCAL_DATABASE);
  });

  it('says nothing outside development, for other errors, or for a non-error', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(warnIfLocalDatabaseStale({ ENVIRONMENT: 'production' }, missing)).toBe(false);
    expect(warnIfLocalDatabaseStale({ ENVIRONMENT: 'development' }, new Error('boom'))).toBe(false);
    expect(warnIfLocalDatabaseStale({ ENVIRONMENT: 'development' }, 'no such column')).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('a request on a local database missing a column', () => {
  it('answers 500 and says why', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ada = await person('user_a');
    const db = h.db.env.INDEX_DB;
    const real = db.prepare.bind(db);
    // Most Used reads `opens`, which a database from before 0007 lacks.
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      if (sql.includes('SUM(opens)')) throw missing;
      return real(sql);
    });
    const res = await call('/items?view=recent&limit=16&used=4', { auth: ada.auth });
    expect(res.status).toBe(500);
    expect(warn).toHaveBeenCalledWith(STALE_LOCAL_DATABASE);
  });
});
