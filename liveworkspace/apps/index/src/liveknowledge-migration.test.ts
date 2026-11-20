import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { assertD1Compound } from '@liveworkspace/api-kit/d1-compound-guard';
import { describe, expect, it } from 'vitest';
import {
  compare,
  foreignKeyProblems,
  itemsDescendants,
  LATEST_REBUILD_MIGRATION,
  rowCounts,
  snapshot,
} from '../scripts/items-rebuild-check';
import { body, call, makeItem, person, useHarness } from './test-support';

// 0026_items_liveknowledge.sql (liveknowledge/docs/specs/016-platform/platform-registration.md,
// liveworkspace/docs/specs/004-index/blueprints/items.md "Rebuilding items"): items takes liveknowledge's Knowledgebases, and
// the rebuild keeps every row of items and of every table that cascades from it, with their indexes, foreign keys
// and cascades.

const MIGRATIONS = fileURLToPath(new URL('../migrations/', import.meta.url).href);
const FILES = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const REBUILD = readFileSync(MIGRATIONS + LATEST_REBUILD_MIGRATION, 'utf8');

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

// Two scopes' folders and items, and rows in every table that references items (directly or through another that
// does), plus some in tables the rebuild leaves alone.
function seed(sql: DatabaseSync): void {
  sql.exec(`
    INSERT INTO folders (id, name, parent_id, owner_id, team_id, scope, created_at, updated_at) VALUES
      ('f1', 'Work', NULL, 'u1', NULL, 'p:u1', 1, 1),
      ('f3', 'Team', NULL, 'u2', 't1', 't:t1', 3, 3);
    INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, source, intent, summary, created_at,
                       updated_at, trashed_at, trash_reason, empty_swept_for, archived_at, content_at) VALUES
      ('i1', 'livediagram', 'canvas', 'u1', NULL, 'p:u1', 'f1', 'Flow', 'person', NULL, '{"hasContent":1}', 10, 11,
       NULL, NULL, NULL, NULL, 11),
      ('i2', 'liveplanner', 'plan', 'u1', NULL, 'p:u1', NULL, 'Plan', 'ai', 'roadmap', '{}', 12, 13, NULL, NULL, NULL,
       14, NULL),
      ('i3', 'livedocuments', 'document', 'u2', 't1', 't:t1', 'f3', 'Doc', NULL, NULL, '{"hasContent":0}', 14, 15,
       16, 'empty', 15, NULL, NULL),
      ('i4', 'livehuddle', 'space', 'u2', 't1', 't:t1', NULL, 'Space ''quoted''', 'template', NULL, '{}', 17,
       9007199254740993, 18, 'deleted', NULL, NULL, NULL);
    INSERT INTO opens (person_id, item_id, last_opened_at, hidden) VALUES
      ('u1', 'i1', 30, 0), ('u1', 'i2', 0, 1), ('u2', 'i3', 31, 0);
    INSERT INTO use_days (person_id, item_id, day, opens) VALUES
      ('u1', 'i1', 20000, 3), ('u1', 'i1', 20001, 1), ('u2', 'i3', 20001, 7);
    INSERT INTO events (id, app, item_id, actor_id, actor_name, type, title, detail, occurred_at) VALUES
      ('e1', 'livediagram', 'i1', 'u1', NULL, 'created', 'Flow', NULL, 40),
      ('e2', 'liveplanner', 'i2', 'u1', 'Ann', 'renamed', 'Plan', '{"from":"Old"}', 41),
      ('e3', 'liveworkspace', NULL, 'u2', NULL, 'team_joined', 'Team', NULL, 42);
    INSERT INTO share_links (code, item_id, level, tab_id, expiry, expires_at, created_at, public) VALUES
      ('c1', 'i1', 'view', NULL, 'never', NULL, 70, 0), ('c2', 'i1', 'edit', 'tab-1', 'week', 999, 71, 0),
      ('c3', 'i3', 'participate', NULL, 'month', 1000, 72, 1);
    INSERT INTO share_passwords (item_id, hash, updated_at) VALUES ('i1', 'pbkdf2-sha256$1$s$h', 80);
    INSERT INTO shared_with (person_id, item_id, share_code, last_seen) VALUES
      ('u2', 'i1', 'c1', 90), ('u3', 'i3', 'c3', 91);
    INSERT INTO placement_defaults (person_id, default_key, folder_id, updated_at) VALUES ('u1', 'mode:plan', 'f1', 100);
    INSERT INTO collab_threads (app, item_id, tab_id, tab_name, element_id, element_label, resolved, comment_count,
                                participant_ids, mentioned_ids, latest_text, latest_author_name, latest_author_color,
                                card, first_at, latest_at, latest_author_id, mentioned_by) VALUES
      ('livediagram', 'i1', 't1', 'Main', 'el1', 'Box', 0, 2, '["u1"]', '[]', 'Hi', 'Ann', '#f00', NULL, 110, 111,
       'u1', '{}'),
      ('liveplanner', 'i2', '~cards', '', 'card1', 'Card', 1, 1, '[]', '["u2"]', 'Done', 'Bo', '', '{"board":"b"}',
       112, 113, NULL, '{"u2":"u1"}');
    INSERT INTO collab_thread_people (app, item_id, tab_id, element_id, person_id) VALUES
      ('livediagram', 'i1', 't1', 'el1', 'u1'), ('liveplanner', 'i2', '~cards', 'card1', 'u2');
    INSERT INTO collab_actions (app, item_id, tab_id, tab_name, element_id, action_id, element_label, name, description,
                                status, assignee_id, assignee_name, assigner_id, assigner_name, team_id, card,
                                created_at, updated_at) VALUES
      ('livediagram', 'i1', 't1', 'Main', 'el1', 'a1', 'Box', 'Fix', '', 'open', 'u2', 'Bo', 'u1', 'Ann', NULL, NULL,
       120, 121);
    INSERT INTO collab_forms (app, item_id, tab_id, heading, board_tab_id, responses, latest_at, code) VALUES
      ('liveplanner', 'i2', 'form1', 'Sign up', 'board1', 4, 130, 'code-1');
    INSERT INTO collab_form_reads (person_id, item_id, tab_id, seen) VALUES ('u1', 'i2', 'form1', 3);
    INSERT INTO purge_tombstones (item_id, app, created_at) VALUES ('gone', 'livediagram', 140);
    INSERT INTO webhooks (id, item_id, kind, name, url_sealed, host, events, created_by, created_at) VALUES
      ('w1', 'i1', 'json', 'Hook', 'sealed', 'example.com', ',livediagram:renamed,', 'u1', 150);
    INSERT INTO webhook_deliveries (id, webhook_id, event_id, type, app, item_id, title, occurred_at, next_at) VALUES
      (7, 'w1', 'e1', 'renamed', 'livediagram', 'i1', 'Flow', 40, 41);
    INSERT INTO access_requests (id, item_id, requester_id, requester_name, note, state, asked_at) VALUES
      ('r1', 'i1', 'u3', 'Cy', 'Please', 'open', 160);
    INSERT INTO approvals (id, item_id, requested_by, note, due_day, snapshot_id, state, created_at) VALUES
      ('ap1', 'i3', 'u2', NULL, '2026-12-01', 's1', 'open', 170);
    INSERT INTO approval_people (approval_id, person_id, position, decision) VALUES
      ('ap1', 'u1', 0, 'pending'), ('ap1', 'u3', 1, 'approved');
    INSERT INTO connections (id, host_item_id, host_tab_id, target_item_id, share_code, pair_id, created_at,
                             confirmed_at) VALUES
      ('k1', 'i1', 'tab-1', 'i2', 'c1', NULL, 180, 181),
      ('k2', 'i2', NULL, 'i1', NULL, 'k1', 182, NULL);
  `);
}

describe(LATEST_REBUILD_MIGRATION, () => {
  it('rebuilds every table that references items, and no other', () => {
    const before = migrated((f) => f < LATEST_REBUILD_MIGRATION);
    const carried = [...REBUILD.matchAll(/^CREATE TABLE (\w+) \(/gm)].map((m) => m[1]!).sort();
    // A table that later comes to reference items must be carried by the next rebuild too.
    expect(carried).toEqual(['items_next', ...itemsDescendants(before)].sort());
  });

  it('keeps every row, column, foreign key, CHECK and index', () => {
    const sql = migrated((f) => f < LATEST_REBUILD_MIGRATION);
    seed(sql);
    const before = snapshot(sql);
    // Every table the rebuild touches has rows in it.
    for (const table of ['items', ...itemsDescendants(sql)])
      expect(before.tables[table]!.rows, table).toBeGreaterThan(0);

    rebuild(sql);
    const after = snapshot(sql);
    expect(compare(before, after)).toEqual([]);
    expect(rowCounts(after)).toEqual(rowCounts(before));
    expect(foreignKeyProblems(sql)).toEqual([]);
    // Only items' two CHECKs widened.
    expect(after.tables.items!.checks).toEqual(
      before.tables.items!.checks.map((c) =>
        c
          .replace("'livehuddle')", "'livehuddle', 'liveknowledge')")
          .replace("'space')", "'space', 'knowledgebase')"),
      ),
    );
    // Nothing is left aside.
    expect(Object.keys(after.tables).filter((t) => /^aside_|_next$/.test(t))).toEqual([]);
  });

  it('still cascades from items, approvals, webhooks, share links and folders', () => {
    const sql = migrated((f) => f < LATEST_REBUILD_MIGRATION);
    seed(sql);
    rebuild(sql);
    sql.exec(`DELETE FROM share_links WHERE code = 'c1'`);
    expect(count(sql, `connections WHERE id = 'k1' AND share_code IS NULL`)).toBe(1);
    sql.exec(`DELETE FROM items WHERE id = 'i1'`);
    for (const table of itemsDescendants(sql)) {
      const column = sql
        .prepare(
          `SELECT name FROM pragma_table_info('${table}') WHERE name IN ('item_id', 'host_item_id')`,
        )
        .get() as { name: string } | undefined;
      if (column) expect(count(sql, `${table} WHERE ${column.name} = 'i1'`), table).toBe(0);
    }
    expect(count(sql, 'webhooks')).toBe(0);
    expect(count(sql, 'webhook_deliveries')).toBe(0);
    // The connection the other way stays, its target and its pair cleared.
    expect(
      count(sql, `connections WHERE id = 'k2' AND target_item_id IS NULL AND pair_id IS NULL`),
    ).toBe(1);
    sql.exec(`DELETE FROM items WHERE id = 'i3'`);
    expect(count(sql, 'approvals')).toBe(0);
    expect(count(sql, 'approval_people')).toBe(0);
    // An event with no item stays.
    expect(count(sql, `events WHERE id = 'e3'`)).toBe(1);
    sql.exec(`DELETE FROM folders WHERE id = 'f1'`);
    expect(count(sql, 'items')).toBe(2);
  });

  it('takes a liveknowledge Knowledgebase, and still refuses an unknown app or kind', () => {
    const sql = migrated(() => true);
    const insert = (app: string, kind: string) =>
      sql.exec(`INSERT INTO items (id, app, kind, owner_id, scope, title, created_at, updated_at)
                VALUES ('${app}-${kind}', '${app}', '${kind}', 'u1', 'p:u1', 'T', 0, 0)`);
    insert('liveknowledge', 'knowledgebase');
    insert('livehuddle', 'space');
    expect(() => insert('livenope', 'knowledgebase')).toThrow(/CHECK constraint failed/);
    expect(() => insert('liveknowledge', 'nope')).toThrow(/CHECK constraint failed/);
  });

  it('runs on D1: no compound SELECT, no bound parameters', () => {
    expect(() => assertD1Compound(REBUILD)).not.toThrow();
    expect(REBUILD).not.toMatch(/\?\d*\b|\bUNION\b/);
  });
});

describe('a liveknowledge Knowledgebase through the index service', () => {
  useHarness();

  it('is made, listed and read back', async () => {
    const owner = await person('u_knowledge');
    const item = await makeItem(owner.auth, { app: 'liveknowledge', title: 'Handbook' });
    expect(item).toMatchObject({ app: 'liveknowledge', kind: 'knowledgebase', title: 'Handbook' });
    const listed = await body<{ items: { id: string }[] }>(
      await call('/items?app=liveknowledge', { auth: owner.auth }),
    );
    expect(listed.items.map((i) => i.id)).toEqual([item.id]);
  });
});
