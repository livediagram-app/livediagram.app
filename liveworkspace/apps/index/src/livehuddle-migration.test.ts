import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { assertD1Compound } from '@liveworkspace/api-kit/d1-compound-guard';
import { describe, expect, it } from 'vitest';
import {
  checksOf,
  compare,
  foreignKeyProblems,
  itemsDescendants,
  REBUILD_MIGRATION,
  REBUILT_TABLES,
  rowCounts,
  snapshot,
} from '../scripts/items-rebuild-check';
import { body, call, makeItem, person, useHarness } from './test-support';

// 0009_items_livehuddle.sql (Work Tracker #286, liveworkspace/docs/specs/004-index/blueprints/items.md "Rebuilding
// items"): items takes livehuddle's Spaces, and the rebuild keeps every row of items and of every table that cascades
// from it, with their indexes, foreign keys and cascades.

const MIGRATIONS = fileURLToPath(new URL('../migrations/', import.meta.url).href);
const FILES = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const REBUILD = readFileSync(MIGRATIONS + REBUILD_MIGRATION, 'utf8');

function migrated(upTo: (file: string) => boolean): DatabaseSync {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of FILES.filter(upTo)) sql.exec(readFileSync(MIGRATIONS + file, 'utf8'));
  return sql;
}

// As D1 runs a migration file: one transaction, foreign keys on.
function rebuild(sql: DatabaseSync): void {
  sql.exec('BEGIN');
  sql.exec(REBUILD);
  sql.exec('COMMIT');
}

const count = (sql: DatabaseSync, query: string) =>
  Number((sql.prepare(`SELECT count(*) AS n FROM ${query}`).get() as { n: number }).n);

// Two scopes' folders and items, and rows in every table that references items (directly or through
// timeline_events), plus some in tables the rebuild leaves alone.
function seed(sql: DatabaseSync): void {
  sql.exec(`
    INSERT INTO folders (id, name, parent_id, owner_id, team_id, scope, created_at, updated_at) VALUES
      ('f1', 'Work', NULL, 'u1', NULL, 'p:u1', 1, 1),
      ('f2', 'Inner', 'f1', 'u1', NULL, 'p:u1', 2, 2),
      ('f3', 'Team', NULL, 'u2', 't1', 't:t1', 3, 3);
    INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, source, intent, summary, created_at,
                       updated_at, trashed_at, trash_reason, empty_swept_for) VALUES
      ('i1', 'livediagram', 'canvas', 'u1', NULL, 'p:u1', 'f2', 'Flow', 'person', NULL, '{"hasContent":1}', 10, 11,
       NULL, NULL, NULL),
      ('i2', 'liveplanner', 'plan', 'u1', NULL, 'p:u1', NULL, 'Plan', 'ai', 'roadmap', '{}', 12, 13, NULL, NULL, NULL),
      ('i3', 'livedocuments', 'document', 'u2', 't1', 't:t1', 'f3', 'Doc', NULL, NULL, '{"hasContent":0}', 14, 15,
       16, 'empty', 15),
      ('i4', 'livedesign', 'design', 'u2', 't1', 't:t1', NULL, 'Design ''quoted''', 'template', NULL, '{}', 17,
       9007199254740993, 18, 'deleted', NULL);
    INSERT INTO favourites (person_id, item_id, created_at) VALUES ('u1', 'i1', 20), ('u2', 'i1', 21), ('u2', 'i3', 22);
    INSERT INTO opens (person_id, item_id, last_opened_at, hidden) VALUES
      ('u1', 'i1', 30, 0), ('u1', 'i2', 0, 1), ('u2', 'i3', 31, 0);
    INSERT INTO use_days (person_id, item_id, day, opens) VALUES
      ('u1', 'i1', 20000, 3), ('u1', 'i1', 20001, 1), ('u2', 'i3', 20001, 7);
    INSERT INTO timeline_events (id, app, item_id, actor_id, actor_name, type, title, detail, occurred_at) VALUES
      ('e1', 'livediagram', 'i1', 'u1', NULL, 'created', 'Flow', NULL, 40),
      ('e2', 'liveplanner', 'i2', 'u1', 'Ann', 'renamed', 'Plan', '{"from":"Old"}', 41),
      ('e3', 'liveworkspace', NULL, 'u2', NULL, 'team_joined', 'Team', NULL, 42),
      ('e4', 'livedocuments', 'i3', 'deleted', NULL, 'commented', 'Doc', '{"text":"hi"}', 43);
    INSERT INTO timeline_event_scopes (scope, event_id, app, occurred_at) VALUES
      ('p:u1', 'e1', 'livediagram', 40), ('p:u1', 'e2', 'liveplanner', 41), ('t:t1', 'e3', 'liveworkspace', 42),
      ('t:t1', 'e4', 'livedocuments', 43), ('p:u2', 'e1', 'livediagram', 40);
    INSERT INTO timeline_dismissals (person_id, event_id, created_at) VALUES ('u1', 'e1', 50), ('u2', 'e4', 51);
    INSERT INTO timeline_scope_state (person_id, last_seen_at) VALUES ('u1', 60);
    INSERT INTO share_links (code, item_id, level, tab_id, expiry, expires_at, created_at, public) VALUES
      ('c1', 'i1', 'view', NULL, 'never', NULL, 70, 0), ('c2', 'i1', 'edit', 'tab-1', 'week', 999, 71, 0),
      ('c3', 'i3', 'participate', NULL, 'month', 1000, 72, 1);
    INSERT INTO share_passwords (item_id, hash, updated_at) VALUES ('i1', 'pbkdf2-sha256$1$s$h', 80);
    INSERT INTO shared_with (person_id, item_id, share_code, last_seen) VALUES ('u2', 'i1', 'c1', 90), ('u3', 'i3', 'c3', 91);
    INSERT INTO placement_defaults (person_id, default_key, folder_id, updated_at) VALUES ('u1', 'mode:plan', 'f1', 100);
    INSERT INTO collab_threads (app, item_id, tab_id, tab_name, element_id, element_label, resolved, comment_count,
                                participant_ids, mentioned_ids, latest_text, latest_author_name, latest_author_color,
                                card, first_at, latest_at) VALUES
      ('livediagram', 'i1', 't1', 'Main', 'el1', 'Box', 0, 2, '["u1"]', '[]', 'Hi', 'Ann', '#f00', NULL, 110, 111),
      ('liveplanner', 'i2', '~cards', '', 'card1', 'Card', 1, 1, '[]', '["u2"]', 'Done', 'Bo', '', '{"board":"b"}',
       112, 113);
    INSERT INTO collab_thread_people (app, item_id, tab_id, element_id, person_id) VALUES
      ('livediagram', 'i1', 't1', 'el1', 'u1'), ('liveplanner', 'i2', '~cards', 'card1', 'u2');
    INSERT INTO collab_actions (app, item_id, tab_id, tab_name, element_id, action_id, element_label, name, description,
                                status, assignee_id, assignee_name, assigner_id, assigner_name, team_id, card,
                                created_at, updated_at) VALUES
      ('livediagram', 'i1', 't1', 'Main', 'el1', 'a1', 'Box', 'Fix', '', 'open', 'u2', 'Bo', 'u1', 'Ann', NULL, NULL,
       120, 121),
      ('livedocuments', 'i3', 't2', 'Page', 'el2', 'a2', 'Para', 'Read', 'Soon', 'wont-do', NULL, NULL, 'u2', NULL,
       't1', NULL, 122, 123);
    INSERT INTO collab_forms (app, item_id, tab_id, heading, board_tab_id, responses, latest_at, code) VALUES
      ('liveplanner', 'i2', 'form1', 'Sign up', 'board1', 4, 130, 'code-1'),
      ('liveplanner', 'i2', 'form2', 'Closed', NULL, 0, 131, NULL);
    INSERT INTO collab_form_reads (person_id, item_id, tab_id, seen) VALUES ('u1', 'i2', 'form1', 3);
    INSERT INTO purge_tombstones (item_id, app, created_at) VALUES ('gone', 'livediagram', 140);
    INSERT INTO webhooks (id, scope, kind, name, url_sealed, host, events, created_by, created_at) VALUES
      ('w1', 'p:u1', 'json', 'Hook', 'sealed', 'example.com', ',created,', 'u1', 150);
    INSERT INTO webhook_deliveries (webhook_id, event_id, type, app, item_id, title, occurred_at, next_at) VALUES
      ('w1', 'e1', 'created', 'livediagram', 'i1', 'Flow', 40, 41);
  `);
}

describe(REBUILD_MIGRATION, () => {
  it('rebuilds every table that references items, and no other', () => {
    const before = migrated((f) => f < REBUILD_MIGRATION);
    // A table that later comes to reference items must be carried by the rebuild too.
    expect(itemsDescendants(before)).toEqual(REBUILT_TABLES.filter((t) => t !== 'items').sort());
    for (const table of REBUILT_TABLES) {
      expect(REBUILD).toContain(`CREATE TABLE ${table === 'items' ? 'items_next' : table} (`);
    }
  });

  it('keeps every row, column, foreign key, CHECK and index', () => {
    const sql = migrated((f) => f < REBUILD_MIGRATION);
    seed(sql);
    const before = snapshot(sql);
    // Every table the rebuild touches has rows in it.
    for (const table of REBUILT_TABLES) expect(before.tables[table]!.rows).toBeGreaterThan(0);

    rebuild(sql);
    const after = snapshot(sql);
    expect(compare(before, after)).toEqual([]);
    expect(rowCounts(after)).toEqual(rowCounts(before));
    expect(foreignKeyProblems(sql)).toEqual([]);
    // Only items' two CHECKs widened.
    expect(after.tables.items!.checks).toEqual(
      before.tables.items!.checks.map((c) =>
        c
          .replace("'livedesign')", "'livedesign', 'livehuddle')")
          .replace("'design')", "'design', 'space')"),
      ),
    );
    // Nothing is left aside.
    expect(Object.keys(after.tables).filter((t) => /^aside_|_next$/.test(t))).toEqual([]);
    // The same schema as a database made fresh, rows aside.
    const fresh = snapshot(migrated(() => true));
    const shape = (s: typeof after) =>
      Object.fromEntries(
        Object.entries(s.tables).map(([t, { columns, foreignKeys, checks }]) => [
          t,
          { columns, foreignKeys, checks },
        ]),
      );
    expect(shape(fresh)).toEqual(shape(after));
    expect(fresh.indexes).toEqual(after.indexes);
  });

  it('still cascades from items, timeline events and folders', () => {
    const sql = migrated((f) => f < REBUILD_MIGRATION);
    seed(sql);
    rebuild(sql);
    const childTables = REBUILT_TABLES.filter(
      (t) => !['items', 'timeline_event_scopes', 'timeline_dismissals'].includes(t),
    );
    sql.exec(`DELETE FROM items WHERE id = 'i1'`);
    for (const table of childTables) {
      expect(count(sql, `${table} WHERE item_id = 'i1'`), table).toBe(0);
    }
    // e1 was i1's, so its scopes and dismissals went with it; e4's stay until it goes.
    expect(count(sql, `timeline_event_scopes WHERE event_id = 'e1'`)).toBe(0);
    expect(count(sql, `timeline_dismissals WHERE event_id = 'e1'`)).toBe(0);
    expect(count(sql, `timeline_dismissals WHERE event_id = 'e4'`)).toBe(1);
    sql.exec(`DELETE FROM timeline_events WHERE id = 'e4'`);
    expect(count(sql, `timeline_event_scopes WHERE event_id = 'e4'`)).toBe(0);
    expect(count(sql, `timeline_dismissals`)).toBe(0);
    // Other items' rows are untouched.
    expect(count(sql, `favourites WHERE item_id = 'i3'`)).toBe(1);
    expect(count(sql, `collab_forms WHERE item_id = 'i2'`)).toBe(2);
    // Deleting a folder still frees its items and drops its placement defaults.
    sql.exec(`DELETE FROM folders WHERE id = 'f3'`);
    expect(sql.prepare(`SELECT folder_id FROM items WHERE id = 'i3'`).get()).toEqual({
      folder_id: null,
    });
    sql.exec(`DELETE FROM folders WHERE id = 'f1'`);
    expect(count(sql, 'placement_defaults')).toBe(0);
    // A child still needs its parent, and the form code stays unique.
    expect(() =>
      sql.exec(`INSERT INTO favourites (person_id, item_id, created_at) VALUES ('u1', 'nope', 1)`),
    ).toThrow(/FOREIGN KEY constraint failed/);
    expect(() =>
      sql.exec(`INSERT INTO collab_forms (app, item_id, tab_id, heading, responses, latest_at, code)
                VALUES ('liveplanner', 'i2', 'form3', 'Again', 0, 1, 'code-1')`),
    ).toThrow(/UNIQUE constraint failed/);
  });

  it('takes a livehuddle Space, and still refuses an unknown app or kind', () => {
    const sql = migrated(() => true);
    const insert = (id: string, app: string, kind: string) =>
      sql.exec(`INSERT INTO items (id, app, kind, owner_id, scope, title, created_at, updated_at)
                VALUES ('${id}', '${app}', '${kind}', 'u1', 'p:u1', 'Standup', 1, 1)`);
    insert('s1', 'livehuddle', 'space');
    expect(count(sql, `items WHERE app = 'livehuddle' AND kind = 'space'`)).toBe(1);
    expect(() => insert('s2', 'livenope', 'space')).toThrow(/CHECK constraint failed/);
    expect(() => insert('s3', 'livehuddle', 'room')).toThrow(/CHECK constraint failed/);
  });

  it('runs on D1: no compound SELECT, no bound parameters', () => {
    expect(() => assertD1Compound(REBUILD)).not.toThrow();
    expect(REBUILD).not.toMatch(/\?|\bUNION\b/i);
  });
});

describe('a livehuddle Space through the index service', () => {
  useHarness();

  it('is made, listed and read back', async () => {
    const owner = await person('u_huddle');
    const item = await makeItem(owner.auth, { app: 'livehuddle', title: 'Standup' });
    expect(item).toMatchObject({ app: 'livehuddle', kind: 'space', title: 'Standup' });
    const listed = await body<{ items: { id: string }[] }>(
      await call('/items?app=livehuddle', { auth: owner.auth }),
    );
    expect(listed.items.map((i) => i.id)).toEqual([item.id]);
  });
});

describe('the rebuild check', () => {
  it('names every way two snapshots can differ', () => {
    const sql = migrated(() => true);
    seed(sql);
    const before = snapshot(sql);
    sql.exec(`
      DELETE FROM favourites WHERE person_id = 'u2' AND item_id = 'i3';
      UPDATE opens SET last_opened_at = 32 WHERE person_id = 'u2';
      DROP INDEX share_links_expires;
      CREATE INDEX share_links_created ON share_links (created_at);
      DROP INDEX collab_actions_item;
      CREATE INDEX collab_actions_item ON collab_actions (item_id);
      DROP TABLE purge_tombstones;
      CREATE TABLE scratch (id INTEGER PRIMARY KEY, blob BLOB, big INTEGER);
      INSERT INTO scratch (blob, big) VALUES (x'00ff', 9007199254740993);
      ALTER TABLE drive_people ADD COLUMN note TEXT;
      DROP TABLE timeline_scope_state;
      CREATE TABLE timeline_scope_state (person_id TEXT PRIMARY KEY, last_seen_at INTEGER NOT NULL CHECK (last_seen_at > 0));
      INSERT INTO timeline_scope_state VALUES ('u1', 60);
    `);
    const after = snapshot(sql);
    expect(after.tables.scratch!.rows).toBe(1);
    expect(compare(before, after)).toEqual([
      'drive_people: columns changed',
      'favourites: 3 rows before, 2 after',
      'opens: same count, different rows',
      'purge_tombstones: gone',
      'scratch: new',
      'timeline_scope_state: checks changed',
      'index collab_actions_item: changed',
      'index purge_tombstones_due: gone',
      'index share_links_created: new',
      'index share_links_expires: gone',
    ]);
    // A widened table's CHECKs may change; its foreign keys may not.
    expect(compare(before, after, ['timeline_scope_state'])).not.toContain(
      'timeline_scope_state: checks changed',
    );
  });

  it('reads CHECKs with nested parentheses and comments', () => {
    expect(
      checksOf(`CREATE TABLE t (
        a TEXT CHECK (a IN ('x', 'y')), -- (a comment)
        b INTEGER CHECK ((b > 0) AND (b < 10))
      )`),
    ).toEqual([`CHECK (a IN ('x', 'y'))`, `CHECK ((b > 0) AND (b < 10))`]);
  });

  it('reports a child whose parent is missing', () => {
    const sql = migrated(() => true);
    sql.exec('PRAGMA foreign_keys = OFF');
    sql.exec(`INSERT INTO favourites (person_id, item_id, created_at) VALUES ('u1', 'nope', 1)`);
    expect(foreignKeyProblems(sql)).toEqual(['favourites row 1: no items']);
  });

  it('orders a table without a primary key by every column', () => {
    const sql = new DatabaseSync(':memory:');
    sql.exec(
      `CREATE TABLE loose (a TEXT, b TEXT); INSERT INTO loose VALUES ('2', 'x'), ('1', 'y')`,
    );
    const first = snapshot(sql);
    sql.exec(`DELETE FROM loose; INSERT INTO loose VALUES ('1', 'y'), ('2', 'x')`);
    expect(compare(first, snapshot(sql))).toEqual([]);
  });

  it('leaves out wrangler’s migration log and SQLite’s own tables', () => {
    const sql = new DatabaseSync(':memory:');
    sql.exec(`CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);
              INSERT INTO d1_migrations (name) VALUES ('0009_items_livehuddle.sql')`);
    expect(snapshot(sql)).toEqual({ tables: {}, indexes: {} });
  });
});
