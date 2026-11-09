import { describe, expect, it } from 'vitest';
import { PLAN_SQL_BOUND_PARAMETERS_MAX, sqliteD1 } from './test-sqlite-d1';

// The test plans' storage refuses what a Durable Object's SQLite refuses (docs/specs/015-api/api.md "Storage"), so a
// query binding a value per key fails its test rather than production.
describe('the test plan storage', () => {
  const select = (n: number) =>
    `SELECT 1 AS one WHERE 1 IN (${Array.from({ length: n }, () => '?').join(', ')})`;

  it('runs a statement with 100 bound parameters', async () => {
    const { env } = sqliteD1();
    const binds = Array.from({ length: PLAN_SQL_BOUND_PARAMETERS_MAX }, () => 1);
    const row = await env.PLAN_DB.prepare(select(binds.length))
      .bind(...binds)
      .first<{ one: number }>();
    expect(row?.one).toBe(1);
  });

  it('refuses a statement with 101, as a Durable Object does', async () => {
    const { env } = sqliteD1();
    const binds = Array.from({ length: PLAN_SQL_BOUND_PARAMETERS_MAX + 1 }, () => 1);
    await expect(
      env.PLAN_DB.prepare(select(binds.length))
        .bind(...binds)
        .first(),
    ).rejects.toThrow(/too many SQL variables/);
  });
});
