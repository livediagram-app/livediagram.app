// Statements by project id or author id seek an index, against the real migrations: each of
// these tables is keyed by owner first, so without its own index a statement would read the whole table. A project delete
// cascades into the first four; the guest-to-account migration and account deletion run the last two.
import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';

const STATEMENTS = [
  'DELETE FROM favourites WHERE project_id = ?',
  'DELETE FROM project_opens WHERE project_id = ?',
  'DELETE FROM workbench_tickets WHERE project_id = ?',
  'DELETE FROM workbench_sessions WHERE project_id = ?',
  'UPDATE agent_changesets SET author_id = ? WHERE author_id = ?',
  'DELETE FROM agent_changesets WHERE author_id = ?',
];

describe('lookups by project and by author', () => {
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
      .prepare('EXPLAIN QUERY PLAN SELECT project_id FROM favourites WHERE owner_id = ?')
      .all('x')
      .map((row) => String(row['detail']));
    expect(plan.join('\n')).toMatch(
      /SEARCH favourites USING COVERING INDEX sqlite_autoindex_favourites_1/,
    );
  });
});
