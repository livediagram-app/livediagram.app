// A real SQLite with FTS5 (Node's own, `node:sqlite`) for the tests of the SQL this package makes: the statements
// are run, not only read. It stands in for a Durable Object's `ctx.storage.sql`, and refuses a statement the
// platform would (more bound values than MAX_BOUND_PARAMETERS, SQL over 100 KB).
import { DatabaseSync } from 'node:sqlite';
import { KNOWLEDGE_SCHEMA } from '../sql/schema';
import { MAX_BOUND_PARAMETERS, type SqlStatement } from '../sql/statement';

const MAX_SQL_BYTES = 100_000;

export function knowledgeDb() {
  const db = new DatabaseSync(':memory:');
  const check = ({ sql, params }: SqlStatement) => {
    if (params.length > MAX_BOUND_PARAMETERS) throw new Error('too many bound parameters');
    if (new TextEncoder().encode(sql).length > MAX_SQL_BYTES) throw new Error('statement too long');
  };
  const api = {
    /** Runs statements in order, in one transaction, as the room does. */
    run(statements: SqlStatement | readonly SqlStatement[]) {
      const list: readonly SqlStatement[] = 'sql' in statements ? [statements] : statements;
      db.exec('BEGIN');
      try {
        for (const statement of list) {
          check(statement);
          db.prepare(statement.sql).run(...statement.params);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    /** A query's rows. */
    all<T>(statement: SqlStatement): T[] {
      check(statement);
      return db.prepare(statement.sql).all(...statement.params) as T[];
    },
    /** Rows of plain SQL, for assertions. */
    rows<T>(sql: string): T[] {
      return db.prepare(sql).all() as T[];
    },
    schema() {
      for (const sql of KNOWLEDGE_SCHEMA) db.exec(sql);
    },
  };
  api.schema();
  return api;
}
