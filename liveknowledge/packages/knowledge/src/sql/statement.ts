// One SQL statement and the values bound to it, as a knowledgebase's Durable Object runs it
// (`ctx.storage.sql.exec(sql, ...params)`). Every statement this package makes stays inside the platform's limits
// (docs/specs/030-knowledgebase/blueprints/knowledge-package.md "Durable Object SQLite"): at most
// MAX_BOUND_PARAMETERS values a statement, and SQL text far under 100 KB.

export type SqlValue = string | number | null;
export type SqlStatement = { sql: string; params: SqlValue[] };

/** Cloudflare's limit on the values bound to one query, for D1 and for a Durable Object's SQLite alike. */
export const MAX_BOUND_PARAMETERS = 100;

/** `rows` (each of `columns.length` values) as INSERT statements of as many rows as the bound parameter limit
 *  lets one statement hold. `verb` is the statement's opening, `INSERT INTO` or `INSERT OR IGNORE INTO`. */
export function insertRows(
  verb: string,
  table: string,
  columns: readonly string[],
  rows: readonly (readonly SqlValue[])[],
): SqlStatement[] {
  const perStatement = Math.max(1, Math.floor(MAX_BOUND_PARAMETERS / columns.length));
  const row = `(${columns.map(() => '?').join(', ')})`;
  const statements: SqlStatement[] = [];
  for (let at = 0; at < rows.length; at += perStatement) {
    const batch = rows.slice(at, at + perStatement);
    statements.push({
      sql: `${verb} ${table} (${columns.join(', ')}) VALUES ${batch.map(() => row).join(', ')}`,
      params: batch.flat(),
    });
  }
  return statements;
}
