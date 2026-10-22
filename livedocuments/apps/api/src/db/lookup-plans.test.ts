// Statements by document id or author id seek an index (the baseline migration), against the real migrations: each of
// these tables is keyed by owner first, and these statements used to read the whole table. A document delete
// cascades into the first four; the guest-to-account migration and account deletion run the last two.
import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';

const STATEMENTS = [
  'DELETE FROM favourites WHERE document_id = ?',
  'DELETE FROM document_opens WHERE document_id = ?',
  'DELETE FROM workbench_tickets WHERE document_id = ?',
  'DELETE FROM workbench_sessions WHERE document_id = ?',
  'UPDATE agent_changesets SET author_id = ? WHERE author_id = ?',
  'DELETE FROM agent_changesets WHERE author_id = ?',
];

describe('lookups by document and by author', () => {
  const { sql } = sqliteD1();
  it.each(STATEMENTS)('%s seeks an index', (statement) => {
    const binds = (statement.match(/\?/g) ?? []).map(() => 'x');
    const plan = sql
      .prepare(`EXPLAIN QUERY PLAN ${statement}`)
      .all(...binds)
      .map((row) => String(row['detail']));
    expect(plan[0]).toMatch(/^SEARCH /);
    expect(plan.filter((detail) => /^SCAN /.test(detail))).toEqual([]);
  });

  it('keeps one index for reads by owner: the favourites primary key', () => {
    const plan = sql
      .prepare('EXPLAIN QUERY PLAN SELECT document_id FROM favourites WHERE owner_id = ?')
      .all('x')
      .map((row) => String(row['detail']));
    expect(plan.join('\n')).toMatch(
      /SEARCH favourites USING COVERING INDEX sqlite_autoindex_favourites_1/,
    );
  });
});
