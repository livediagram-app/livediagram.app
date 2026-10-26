import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { D1_COMPOUND_MAX, unionAll } from './d1-compound';
import { assertD1Compound } from './d1-compound-guard';

const terms = (n: number) => Array.from({ length: n }, (_, i) => `SELECT ${i} AS x`);

describe('unionAll', () => {
  it('joins up to five terms flat', () => {
    expect(unionAll(terms(1))).toBe('SELECT 0 AS x');
    expect(unionAll(terms(D1_COMPOUND_MAX))).toBe(terms(5).join(' UNION ALL '));
  });

  it('nests more in groups D1 accepts, and keeps every row', () => {
    const sql = new DatabaseSync(':memory:');
    for (const n of [6, 25, 26, 130]) {
      const query = `SELECT COUNT(*) AS n, SUM(x) AS total FROM (${unionAll(terms(n))})`;
      expect(() => assertD1Compound(query)).not.toThrow();
      expect({ ...sql.prepare(query).get() }).toEqual({ n, total: (n * (n - 1)) / 2 });
    }
  });
});

describe('assertD1Compound refuses what D1 refuses', () => {
  it('a sixth term at one level, whichever operators join them', () => {
    expect(() => assertD1Compound(terms(6).join(' UNION ALL '))).toThrow(/too many terms/);
    expect(() =>
      assertD1Compound(
        terms(3).join(' UNION ') + ' INTERSECT SELECT 1 EXCEPT SELECT 2 UNION SELECT 3',
      ),
    ).toThrow(/too many terms/);
    expect(() => assertD1Compound(terms(3).join(' union all '), 2)).toThrow(/too many terms/);
  });

  it('but not five, nor terms split across levels or statements', () => {
    expect(() => assertD1Compound(terms(5).join(' UNION ALL '))).not.toThrow();
    const four = terms(4).join(' UNION ALL ');
    expect(() =>
      assertD1Compound(`SELECT * FROM (${four}) UNION ALL SELECT * FROM (${four})`),
    ).not.toThrow();
    expect(() => assertD1Compound(`${four};\n${four};`)).not.toThrow();
  });

  it('nor words in strings, quoted names or comments', () => {
    expect(() =>
      assertD1Compound(`SELECT 'a UNION b UNION c UNION d UNION e UNION f' AS x`),
    ).not.toThrow();
    expect(() =>
      assertD1Compound(`SELECT 1 AS "union union union union union union"`),
    ).not.toThrow();
    expect(() =>
      assertD1Compound(
        `-- union union union union union union\nSELECT 1 /* union union union union union union */`,
      ),
    ).not.toThrow();
  });
});
