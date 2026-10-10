import { describe, expect, it } from 'vitest';
import { applyMigration, sqliteD1 } from '../test-sqlite-d1';

// Migration 0080 adds the Participant level (docs/specs/013-workspace/share-roles.md "Moving to three levels"):
// a `level` column beside the two-valued `role`, so no existing row changes level and an old reader of `role`
// fails closed. Seeded under the 0079 schema, then migrated.
describe('migration 0080: participate links', () => {
  function seeded() {
    const { sql } = sqliteD1({}, { before: '0080' });
    sql
      .prepare(
        "INSERT INTO documents (id, name, owner_id, created_at, saved_at, shareable) VALUES ('d1', 'Retro', 'o1', 1, 1, 1)",
      )
      .run();
    sql
      .prepare(
        "INSERT INTO share_links (code, document_id, role, created_at) VALUES ('view1', 'd1', 'view', 1), ('edit1', 'd1', 'edit', 2)",
      )
      .run();
    sql
      .prepare(
        "INSERT INTO shared_with (owner_id, document_id, role, last_seen) VALUES ('g1', 'd1', 'view', 1)",
      )
      .run();
    applyMigration(sql, '0080');
    return sql;
  }

  it('leaves every existing link and visit at its level', () => {
    const sql = seeded();
    const links = sql.prepare('SELECT code, role, level FROM share_links ORDER BY code').all();
    expect(links.map((r) => ({ ...r }))).toEqual([
      { code: 'edit1', role: 'edit', level: null },
      { code: 'view1', role: 'view', level: null },
    ]);
    const visit = sql.prepare('SELECT role, level FROM shared_with').get();
    expect({ ...visit }).toEqual({ role: 'view', level: null });
  });

  it('stores a participate link with a view role, and refuses an unknown level', () => {
    const sql = seeded();
    sql
      .prepare(
        "INSERT INTO share_links (code, document_id, role, level, created_at) VALUES ('part1', 'd1', 'view', 'participate', 3)",
      )
      .run();
    expect(() =>
      sql
        .prepare(
          "INSERT INTO share_links (code, document_id, role, level, created_at) VALUES ('bad1', 'd1', 'view', 'admin', 4)",
        )
        .run(),
    ).toThrow(/CHECK/);
    expect(() =>
      sql
        .prepare(
          "INSERT INTO shared_with (owner_id, document_id, role, level, last_seen) VALUES ('g2', 'd1', 'view', 'owner', 1)",
        )
        .run(),
    ).toThrow(/CHECK/);
  });

  it('gives tickets an adder key column', () => {
    const sql = seeded();
    const cols = sql.prepare("SELECT name FROM pragma_table_info('ws_tickets')").all();
    expect(cols.map((c) => (c as { name: string }).name)).toContain('adder_key');
  });
});
