// The package's statements (`SqlStatement`, @liveknowledge/knowledge) run on the document's database: the room's own
// SQLite behind the D1 surface the routes use (`env.DOCUMENT_DB`). Text is always bound, never written into SQL.
import type { SqlStatement } from '@liveknowledge/knowledge';
import type { DocumentEnv } from '../types';

/** The handle the knowledge bookkeeping writes through. In the room it is the database whose writes note nothing
 *  (`KNOWLEDGE_DB`): a read counted, a question logged, a counter bumped or a key stored is no edit of the
 *  knowledgebase, so it must not reach History, Most Used or the outbox. A page's own fields go through
 *  `DOCUMENT_DB`, as any write of a tab does. */
export const knowledgeDb = (env: DocumentEnv): D1Database => env.KNOWLEDGE_DB ?? env.DOCUMENT_DB;

const bound = (env: DocumentEnv, statement: SqlStatement) =>
  knowledgeDb(env)
    .prepare(statement.sql)
    .bind(...statement.params);

/** A read's rows. */
export async function rowsOf<T>(env: DocumentEnv, statement: SqlStatement): Promise<T[]> {
  return (await bound(env, statement).all<T>()).results ?? [];
}

/** Statements as one transaction. */
export async function runAll(env: DocumentEnv, statements: readonly SqlStatement[]): Promise<void> {
  if (statements.length > 0) await knowledgeDb(env).batch(statements.map((s) => bound(env, s)));
}

export const sqlOf = (sql: string, ...params: SqlStatement['params']): SqlStatement => ({
  sql,
  params,
});
