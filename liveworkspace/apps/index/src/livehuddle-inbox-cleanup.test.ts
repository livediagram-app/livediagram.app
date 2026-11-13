import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { assertD1Compound } from '@liveworkspace/api-kit/d1-compound-guard';
import { describe, expect, it } from 'vitest';

// scripts/livehuddle-inbox-cleanup.sql (Work Tracker 736; liveworkspace/docs/specs/004-index/blueprints/inbox.md
// "livehuddle's old rows"): livehuddle's Inbox rows from before it stopped pushing go, every other app's stay, and a
// second run changes nothing.

const MIGRATIONS = fileURLToPath(new URL('../migrations/', import.meta.url).href);
const CLEANUP = readFileSync(
  fileURLToPath(new URL('../scripts/livehuddle-inbox-cleanup.sql', import.meta.url).href),
  'utf8',
);

function migrated(): DatabaseSync {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort())
    sql.exec(readFileSync(MIGRATIONS + file, 'utf8'));
  return sql;
}

// A canvas of livediagram's, a plan of liveplanner's and two Spaces of livehuddle's, each with Inbox rows.
function seed(sql: DatabaseSync): void {
  sql.exec(`
    INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, source, intent, summary, created_at,
                       updated_at, trashed_at, trash_reason, empty_swept_for) VALUES
      ('d1', 'livediagram', 'canvas', 'u1', NULL, 'p:u1', NULL, 'Flow', NULL, NULL, '{}', 1, 1, NULL, NULL, NULL),
      ('p1', 'liveplanner', 'plan', 'u1', NULL, 'p:u1', NULL, 'Plan', NULL, NULL, '{}', 1, 1, NULL, NULL, NULL),
      ('s1', 'livehuddle', 'space', 'u1', NULL, 'p:u1', NULL, 'Office', NULL, NULL, '{}', 1, 1, NULL, NULL, NULL),
      ('s2', 'livehuddle', 'space', 'u2', NULL, 'p:u2', NULL, 'Pod', NULL, NULL, '{}', 1, 1, NULL, NULL, NULL);
    INSERT INTO collab_threads (app, item_id, tab_id, tab_name, element_id, element_label, resolved, comment_count,
                                participant_ids, mentioned_ids, latest_text, latest_author_name, latest_author_color,
                                card, first_at, latest_at) VALUES
      ('livediagram', 'd1', 't1', 'Main', 'el1', 'Box', 0, 2, '["u1"]', '["u2"]', 'Hi', 'Ann', '', NULL, 1, 2),
      ('liveplanner', 'p1', '~cards', '', 'card1', 'Card', 0, 1, '["u1"]', '[]', 'Go', 'Ann', '', '{}', 1, 2),
      ('livehuddle', 's1', 't1', 'Lobby', 'el1', 'Desk', 0, 3, '["u1"]', '["u2"]', '@Bo look', 'Ann', '', NULL, 1, 2),
      ('livehuddle', 's2', 't9', 'Pod', 'el7', 'Sofa', 1, 1, '["u2"]', '[]', 'Done', 'Bo', '', NULL, 1, 2);
    INSERT INTO collab_thread_people (app, item_id, tab_id, element_id, person_id) VALUES
      ('livediagram', 'd1', 't1', 'el1', 'u1'), ('livediagram', 'd1', 't1', 'el1', 'u2'),
      ('liveplanner', 'p1', '~cards', 'card1', 'u1'),
      ('livehuddle', 's1', 't1', 'el1', 'u1'), ('livehuddle', 's1', 't1', 'el1', 'u2'),
      ('livehuddle', 's2', 't9', 'el7', 'u2');
    INSERT INTO collab_actions (app, item_id, tab_id, tab_name, element_id, action_id, element_label, name, description,
                                status, assignee_id, assignee_name, assigner_id, assigner_name, team_id, card,
                                created_at, updated_at) VALUES
      ('livediagram', 'd1', 't1', 'Main', 'el1', 'a1', 'Box', 'Fix', '', 'open', 'u2', 'Bo', 'u1', 'Ann', NULL, NULL,
       1, 2),
      ('liveplanner', 'p1', '~cards', '', 'card1', 'c1', 'Card', 'Ship', '', 'open', 'u1', 'Ann', 'u2', 'Bo', NULL,
       '{}', 1, 2),
      ('livehuddle', 's1', 't1', 'Lobby', 'el1', 'a9', 'Desk', 'Tidy', '', 'open', 'u2', 'Bo', 'u1', 'Ann', NULL, NULL,
       1, 2);
  `);
}

const appsIn = (sql: DatabaseSync, table: string) =>
  (sql.prepare(`SELECT app, count(*) AS n FROM ${table} GROUP BY app ORDER BY app`).all() as {
    app: string;
    n: number;
  }[]).map((r) => `${r.app}:${r.n}`);

const cleanup = (sql: DatabaseSync) => {
  sql.exec('BEGIN');
  sql.exec(CLEANUP);
  sql.exec('COMMIT');
};

describe('livehuddle-inbox-cleanup.sql', () => {
  it("deletes livehuddle's threads, their people and its actions, and nothing of any other app", () => {
    const sql = migrated();
    seed(sql);
    cleanup(sql);
    expect(appsIn(sql, 'collab_threads')).toEqual(['livediagram:1', 'liveplanner:1']);
    expect(appsIn(sql, 'collab_thread_people')).toEqual(['livediagram:2', 'liveplanner:1']);
    expect(appsIn(sql, 'collab_actions')).toEqual(['livediagram:1', 'liveplanner:1']);
    // The Spaces themselves stay: only their Inbox rows went.
    expect(sql.prepare("SELECT count(*) AS n FROM items WHERE app = 'livehuddle'").get()).toEqual({
      n: 2,
    });
  });

  it('changes nothing a second time, or on an index with no livehuddle rows', () => {
    const sql = migrated();
    seed(sql);
    cleanup(sql);
    const before = ['collab_threads', 'collab_thread_people', 'collab_actions'].map((t) =>
      appsIn(sql, t),
    );
    cleanup(sql);
    expect(['collab_threads', 'collab_thread_people', 'collab_actions'].map((t) => appsIn(sql, t))).toEqual(
      before,
    );
    expect(() => cleanup(migrated())).not.toThrow();
  });

  it('is plain statements D1 takes: no compound select, no bound parameter', () => {
    for (const statement of CLEANUP.split(';').filter((s) => s.includes('DELETE')))
      expect(() => assertD1Compound(statement)).not.toThrow();
    expect(CLEANUP).not.toContain('?');
    expect(CLEANUP.match(/^DELETE FROM \w+ WHERE app = 'livehuddle';$/gm)).toHaveLength(3);
  });
});
