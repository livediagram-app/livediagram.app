import { describe, expect, it } from 'vitest';
import { applyMigration, sqliteD1 } from '../test-sqlite-d1';

// Migration 0053 rebuilds collab_actions keyed per action
// (docs/specs/012-collaboration/action-panel.md "The data"). A rebuilt table is tested the way
// docs/specs/003-system-architecture/testing.md asks: seed rows under the OLD schema, run the migration, and
// compare every row.

const T0 = 1_700_000_000_000;

describe('migration 0053: collab_actions keyed per action', () => {
  it('keeps every row, byte for byte, and then allows two actions on one element', () => {
    const { sql } = sqliteD1({}, { before: '0053' });
    sql
      .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'T', '{}', ?)`)
      .run(T0);
    const insert = sql.prepare(
      `INSERT INTO collab_actions
         (tab_id, element_id, action_id, element_label, name, description, status,
          assignee_user_id, assignee_member_id, assignee_name, assigner_id, assigner_name,
          team_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insert.run(
      't1',
      'e1',
      'a1',
      'Box',
      'Ship it',
      'soon',
      'open',
      'u1',
      null,
      'Sam',
      'u2',
      'Tom',
      null,
      T0,
      T0 + 1,
    );
    insert.run(
      't1',
      'e2',
      'a2',
      'Card',
      'Review',
      '',
      'done',
      null,
      'm9',
      null,
      'u2',
      null,
      'tm',
      T0,
      T0 + 2,
    );
    // Under the old key a second action on e1 collides.
    expect(() =>
      insert.run(
        't1',
        'e1',
        'a3',
        'Box',
        'Another',
        '',
        'open',
        null,
        null,
        null,
        'u2',
        null,
        null,
        T0,
        T0,
      ),
    ).toThrow();
    const before = sql.prepare('SELECT * FROM collab_actions ORDER BY action_id').all();

    applyMigration(sql, '0053');

    expect(sql.prepare('SELECT * FROM collab_actions ORDER BY action_id').all()).toEqual(before);
    insert.run(
      't1',
      'e1',
      'a3',
      'Box',
      'Another',
      '',
      'open',
      null,
      null,
      null,
      'u2',
      null,
      null,
      T0,
      T0,
    );
    expect(
      sql.prepare(`SELECT COUNT(*) AS n FROM collab_actions WHERE element_id = 'e1'`).get(),
    ).toEqual({ n: 2 });
    // The read indexes came back with the rebuild.
    const indexes = sql
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'collab_actions'`,
      )
      .all()
      .map((r) => (r as { name: string }).name);
    expect(indexes).toEqual(
      expect.arrayContaining([
        'collab_actions_assignee_idx',
        'collab_actions_assigner_idx',
        'collab_actions_member_idx',
      ]),
    );
  });
});
