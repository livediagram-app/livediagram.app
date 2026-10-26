import { describe, expect, it } from 'vitest';
import { D1_COMPOUND_MAX, unionAll } from './compound';
import { assertD1Compound, testDb } from './test-sqlite-d1';

const terms = (n: number) => Array.from({ length: n }, (_, i) => `SELECT ${i} AS x`);

describe('unionAll', () => {
  it('joins up to five terms flat, as before', () => {
    expect(unionAll(terms(1))).toBe('SELECT 0 AS x');
    expect(unionAll(terms(D1_COMPOUND_MAX))).toBe(terms(5).join(' UNION ALL '));
  });

  it('nests more in groups D1 accepts, and keeps every row', () => {
    const { sql } = testDb();
    for (const n of [6, 25, 26, 130]) {
      const query = `SELECT COUNT(*) AS n, SUM(x) AS total FROM (${unionAll(terms(n))})`;
      expect(() => assertD1Compound(query)).not.toThrow();
      expect(sql.prepare(query).get()).toEqual({ n, total: (n * (n - 1)) / 2 });
    }
  });
});

describe('the test database refuses what D1 refuses', () => {
  it('a sixth term at one level, but not five, nor terms split across levels or quoted', () => {
    expect(() => assertD1Compound(terms(6).join(' UNION ALL '))).toThrow(/too many terms/);
    expect(() =>
      assertD1Compound(
        terms(3).join(' UNION ') + ' INTERSECT SELECT 1 EXCEPT SELECT 2 UNION SELECT 3',
      ),
    ).toThrow(/too many terms/);
    expect(() => assertD1Compound(terms(5).join(' UNION ALL '))).not.toThrow();
    expect(() =>
      assertD1Compound(
        `SELECT * FROM (${terms(4).join(' UNION ALL ')}) UNION ALL SELECT * FROM (${terms(4).join(' UNION ALL ')})`,
      ),
    ).not.toThrow();
    expect(() =>
      assertD1Compound(`SELECT 'a UNION b UNION c UNION d UNION e UNION f' AS x`),
    ).not.toThrow();
  });

  it('on every statement it prepares', async () => {
    const { env } = testDb();
    expect(() => env.INDEX_DB.prepare(terms(6).join(' UNION ALL '))).toThrow(/too many terms/);
  });
});
