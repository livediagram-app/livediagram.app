// D1 refuses a compound SELECT of more than five terms ("too many terms in compound SELECT"), where SQLite's own
// default, and so the tests' node:sqlite, allows 500. Measured on the production database, 2026-10-26.
export const D1_COMPOUND_MAX = 5;

/**
 * Terms joined by UNION ALL, nested in groups of at most D1_COMPOUND_MAX so no one compound passes D1's limit. Each
 * term keeps its own plan (a bounded range read through its index); only the joining changes. Every term must
 * select the same columns.
 */
export function unionAll(terms: string[]): string {
  if (terms.length <= D1_COMPOUND_MAX) return terms.join(' UNION ALL ');
  const groups: string[] = [];
  for (let i = 0; i < terms.length; i += D1_COMPOUND_MAX) {
    groups.push(`SELECT * FROM (${terms.slice(i, i + D1_COMPOUND_MAX).join(' UNION ALL ')})`);
  }
  return unionAll(groups);
}
