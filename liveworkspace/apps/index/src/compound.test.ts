import { unionAll } from '@liveworkspace/api-kit/d1-compound';
import { describe, expect, it } from 'vitest';
import { testDb } from './test-sqlite-d1';

// The helper and the guard are tested in @liveworkspace/api-kit; this holds the index's test database to them.
const terms = (n: number) => Array.from({ length: n }, (_, i) => `SELECT ${i} AS x`);

describe('the test database refuses what D1 refuses', () => {
  it('on every statement it prepares', () => {
    const { env } = testDb();
    expect(() => env.INDEX_DB.prepare(terms(6).join(' UNION ALL '))).toThrow(/too many terms/);
  });

  it('and runs a nested union of any length', async () => {
    const { env } = testDb();
    const row = await env.INDEX_DB.prepare(
      `SELECT COUNT(*) AS n FROM (${unionAll(terms(26))})`,
    ).first();
    expect(row).toEqual({ n: 26 });
  });
});
