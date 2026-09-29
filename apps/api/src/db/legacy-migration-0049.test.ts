import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { applyMigration, sqliteD1 } from '../test-sqlite-d1';

// Migration 0049 drops the legacy tabs.diagram_id + tabs.order_index
// (docs/specs/006-document/tab-document-many-to-many.md, phase 5). `tabs` is a
// PARENT table: dropping it cascades into diagram_tabs, change_log and both
// collab-index tables, so the rebuild must hand every child row back.

const T0 = 1_700_000_000_000;

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

// Under the 0048 schema: a tab shared by two diagrams, a tab of one, an
// orphan tab no diagram links, history (one entry with no tab), and index rows.
function seedLegacy(sql: DatabaseSync) {
  for (const id of ['A', 'B']) {
    insert(sql, 'diagrams', {
      id,
      owner_id: 'owner',
      name: id,
      shareable: 0,
      saved_at: T0,
      created_at: T0,
    });
  }
  const tabs = [
    ['shared', 'A', 0],
    ['solo', 'B', 1],
    ['orphan', 'A', 2],
  ] as const;
  for (const [id, home, order] of tabs) {
    insert(sql, 'tabs', {
      id,
      diagram_id: home,
      name: `Tab ${id}`,
      order_index: order,
      data: `{"elements":[],"n":"${id}"}`,
      updated_at: T0 + order,
    });
  }
  insert(sql, 'diagram_tabs', { diagram_id: 'A', tab_id: 'shared', order_index: 0, added_at: T0 });
  insert(sql, 'diagram_tabs', {
    diagram_id: 'B',
    tab_id: 'shared',
    order_index: 1,
    added_at: T0 + 5,
    folder: 'Ref',
  });
  insert(sql, 'diagram_tabs', { diagram_id: 'B', tab_id: 'solo', order_index: 0, added_at: T0 });
  for (const [id, tabId] of [
    ['l1', 'shared'],
    ['l2', 'solo'],
    ['l3', null],
  ] as const) {
    insert(sql, 'change_log', {
      id,
      tab_id: tabId,
      participant_id: 'owner',
      kind: 'edit',
      summary: id,
      element_ids: '[]',
      before_state: '{}',
      after_state: '{}',
      created_at: T0,
    });
  }
  insert(sql, 'collab_actions', {
    tab_id: 'shared',
    element_id: 'e1',
    action_id: 'a1',
    element_label: 'Box',
    name: 'Do it',
    description: '',
    status: 'open',
    assigner_id: 'owner',
    created_at: T0,
    updated_at: T0,
  });
  insert(sql, 'collab_threads', {
    tab_id: 'solo',
    element_id: 'e2',
    element_label: 'Box',
    resolved: 0,
    comment_count: 1,
    participant_ids: '["owner"]',
    latest_text: 'Hi',
    latest_author_name: 'Otter',
    latest_author_color: '#f80',
    first_at: T0,
    latest_at: T0,
  });
}

function snapshot(sql: DatabaseSync) {
  const all = (q: string) =>
    sql
      .prepare(q)
      .all()
      .map((r) => ({ ...r }));
  return {
    tabs: all('SELECT id, name, data, updated_at FROM tabs ORDER BY id'),
    links: all('SELECT * FROM diagram_tabs ORDER BY diagram_id, tab_id'),
    history: all('SELECT * FROM change_log ORDER BY id'),
    actions: all('SELECT * FROM collab_actions ORDER BY tab_id'),
    threads: all('SELECT * FROM collab_threads ORDER BY tab_id'),
  };
}

describe('migration 0049 (drop tabs.diagram_id + tabs.order_index)', () => {
  it('drops both legacy columns and their index', () => {
    const { sql } = sqliteD1();

    const columns = sql
      .prepare('PRAGMA table_info(tabs)')
      .all()
      .map((c) => c.name);
    expect(columns).toEqual(['id', 'name', 'data', 'updated_at']);
    expect(
      sql.prepare("SELECT name FROM sqlite_master WHERE name = 'tabs_diagram_idx'").get(),
    ).toBe(undefined);
  });

  it('hands back every tab, link, history entry and index row', () => {
    const { sql } = sqliteD1({}, { before: '0049' });
    seedLegacy(sql);
    const before = snapshot(sql);

    applyMigration(sql, '0049');

    expect(snapshot(sql)).toEqual(before);
    expect(sql.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('leaves the children cascading from the rebuilt table', () => {
    const { sql } = sqliteD1({}, { before: '0049' });
    seedLegacy(sql);
    applyMigration(sql, '0049');

    sql.prepare("DELETE FROM tabs WHERE id = 'shared'").run();

    const left = snapshot(sql);
    expect(left.links.map((l) => l.tab_id)).toEqual(['solo']);
    expect(left.history.map((h) => h.id)).toEqual(['l2', 'l3']);
    expect(left.actions).toEqual([]);
  });

  it('no longer lets deleting a diagram reach a tab directly', () => {
    const { sql } = sqliteD1({}, { before: '0049' });
    seedLegacy(sql);
    applyMigration(sql, '0049');

    sql.prepare("DELETE FROM diagrams WHERE id = 'A'").run();

    expect(snapshot(sql).tabs.map((t) => t.id)).toEqual(['orphan', 'shared', 'solo']);
  });
});
