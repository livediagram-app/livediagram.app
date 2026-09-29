import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { applyMigration, sqliteD1 } from '../test-sqlite-d1';

// Migration 0055 renames the container from diagram to document (docs/specs/006-document/document.md):
// the schema, and every stored value that names it. Seeded under the 0054 schema, then migrated.

function run(sql: DatabaseSync, statement: string, ...args: (string | number | null)[]) {
  sql.prepare(statement).run(...args);
}
const one = (sql: DatabaseSync, q: string, ...args: (string | number)[]) =>
  sql.prepare(q).get(...args) as Record<string, unknown> | undefined;
const all = (sql: DatabaseSync, q: string) => sql.prepare(q).all() as Record<string, unknown>[];

function seed(sql: DatabaseSync) {
  run(
    sql,
    "INSERT INTO diagrams (id, owner_id, name, shareable, saved_at, created_at) VALUES ('A', 'o', 'Roadmap', 0, 1, 1)",
  );
  run(
    sql,
    "INSERT INTO diagrams (id, owner_id, name, shareable, saved_at, created_at) VALUES ('B', 'o', 'Other', 0, 1, 1)",
  );
  const link = '{"kind":"diagram","diagramId":"B","name":"Other"}';
  run(
    sql,
    'INSERT INTO tabs (id, name, data, updated_at) VALUES (?, ?, ?, 1)',
    't1',
    'Tab',
    `{"kind":"diagram","elements":[{"id":"e","link":${link}}]}`,
  );
  run(
    sql,
    "INSERT INTO diagram_tabs (diagram_id, tab_id, order_index, added_at) VALUES ('A', 't1', 0, 1)",
  );
  run(
    sql,
    "INSERT INTO share_links (code, diagram_id, role, created_at) VALUES ('CODE', 'A', 'view', 1)",
  );
  run(sql, "INSERT INTO favourites (owner_id, diagram_id, created_at) VALUES ('o', 'A', 1)");
  run(
    sql,
    "INSERT INTO shared_with (owner_id, diagram_id, role, last_seen) VALUES ('v', 'A', 'view', 1)",
  );
  run(
    sql,
    'INSERT INTO change_log (id, tab_id, participant_id, kind, summary, element_ids, before_state, after_state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
    'c1',
    't1',
    'p',
    'edit',
    's',
    '["e"]',
    `[{"id":"e","link":${link}}]`,
    '[{"id":"e"}]',
  );
  run(
    sql,
    "INSERT INTO timeline_events (id, actor_id, source_type, source_id, event_type, dedupe_key, title, description, occurred_at, snapshot, created_at) VALUES ('ev1', 'o', 'diagram', 'A', 'diagram_created', 'k1', 'Diagram Created', 'Roadmap', 1, '{\"diagramId\":\"A\",\"diagramName\":\"Roadmap\"}', 1)",
  );
  run(
    sql,
    "INSERT INTO timeline_events (id, actor_id, source_type, source_id, event_type, dedupe_key, title, description, occurred_at, snapshot, created_at) VALUES ('ev2', 'o', 'team', 'T', 'team_diagram_added', 'k2', 'Added to Team', 'Roadmap', 1, '{}', 1)",
  );
  run(
    sql,
    "INSERT INTO timeline_event_scopes (event_id, scope_type, scope_id, added_at) VALUES ('ev1', 'diagram', 'A', 1)",
  );
  run(
    sql,
    "INSERT INTO timeline_scope_state (scope_type, scope_id, backfilled_at) VALUES ('diagram', 'A', 1)",
  );
  run(
    sql,
    'INSERT INTO user_preferences (owner_id, prefs, updated_at) VALUES (\'o\', \'{"notifyDiagramJoin":false,"theme":"dark"}\', 1)',
  );
  const events: [string, string, string | null][] = [
    ['Diagram', 'Created', 'Cloud'],
    ['Team', 'Added', 'Diagram'],
    ['Element', 'Linked', 'Diagram'],
    ['Action', 'Moved', 'DiagramToTeam'],
    ['Email', 'Sent', 'DiagramJoined'],
    ['UI', 'Toggled', 'NotifyDiagramJoinOff'],
    ['Page', 'View', '/diagram'],
    ['Mcp', 'Used', 'FindDiagrams'],
    ['Error', 'Api', 'Internal.Put.Diagrams.Tabs'],
    ['Error', 'Client', 'Uncaught.Diagram.TypeError'],
    ['Error', 'Api', 'Http500.SaveDiagramMeta'],
    ['Template', 'Used', 'ErDiagram'],
    ['Tab', 'Created', 'Diagram'],
    ['Help', 'View', 'add-to-diagram'],
    ['Help', 'Helpful', 'sharing-your-diagram'],
    ['Help', 'View', 'your-first-diagram'],
    ['Page', 'View', '/help/troubleshooting/diagram-not-loading'],
  ];
  for (const [category, action, type] of events)
    run(
      sql,
      'INSERT INTO events (category, action, type, ts) VALUES (?, ?, ?, 1)',
      category,
      action,
      type,
    );
}

function migrated() {
  const db = sqliteD1({}, { before: '0055' });
  seed(db.sql);
  applyMigration(db.sql, '0055');
  return db;
}

describe('migration 0055 (the container is a document)', () => {
  it('renames the tables and columns, keeping every row', () => {
    const { sql } = migrated();
    expect(all(sql, 'SELECT id FROM documents ORDER BY id').map((r) => r.id)).toEqual(['A', 'B']);
    expect(one(sql, "SELECT document_id FROM document_tabs WHERE tab_id = 't1'")).toEqual({
      document_id: 'A',
    });
    for (const table of ['share_links', 'favourites', 'shared_with']) {
      expect(one(sql, `SELECT document_id FROM ${table}`), table).toEqual({ document_id: 'A' });
    }
    const left = all(
      sql,
      "SELECT name FROM sqlite_master WHERE name LIKE '%diagram%' OR sql LIKE '%diagram_id%'",
    );
    expect(left).toEqual([]);
  });

  it('keeps the foreign keys cascading from the renamed table', () => {
    const { sql } = migrated();
    run(sql, "DELETE FROM documents WHERE id = 'A'");
    for (const table of ['document_tabs', 'share_links', 'favourites', 'shared_with']) {
      expect(one(sql, `SELECT count(*) AS n FROM ${table}`), table).toEqual({ n: 0 });
    }
  });

  it('upgrades element links and keeps the tab kind', () => {
    const { sql } = migrated();
    const data = JSON.parse(one(sql, "SELECT data FROM tabs WHERE id = 't1'")!.data as string);
    expect(data.kind).toBe('diagram');
    expect(data.elements[0].link).toEqual({ kind: 'document', documentId: 'B', name: 'Other' });
    const before = JSON.parse(
      one(sql, "SELECT before_state FROM change_log WHERE id = 'c1'")!.before_state as string,
    );
    expect(before[0].link).toEqual({ kind: 'document', documentId: 'B', name: 'Other' });
  });

  it('renames the timeline types, scopes, titles and snapshot keys', () => {
    const { sql } = migrated();
    expect(
      one(
        sql,
        "SELECT source_type, event_type, title, snapshot FROM timeline_events WHERE id = 'ev1'",
      ),
    ).toEqual({
      source_type: 'document',
      event_type: 'document_created',
      title: 'Document Created',
      snapshot: '{"documentId":"A","documentName":"Roadmap"}',
    });
    expect(one(sql, "SELECT event_type FROM timeline_events WHERE id = 'ev2'")).toEqual({
      event_type: 'team_document_added',
    });
    expect(one(sql, 'SELECT scope_type FROM timeline_event_scopes')).toEqual({
      scope_type: 'document',
    });
    expect(one(sql, 'SELECT scope_type FROM timeline_scope_state')).toEqual({
      scope_type: 'document',
    });
  });

  it('carries the notification opt-out to its new key', () => {
    const { sql } = migrated();
    expect(JSON.parse(one(sql, 'SELECT prefs FROM user_preferences')!.prefs as string)).toEqual({
      notifyDocumentJoin: false,
      theme: 'dark',
    });
  });

  it('renames the telemetry history and nothing that names a drawing or the tab kind', () => {
    const { sql } = migrated();
    const rows = all(sql, 'SELECT category, action, type FROM events ORDER BY id').map(
      (r) => `${r.category}|${r.action}|${r.type ?? ''}`,
    );
    expect(rows).toEqual([
      'Document|Created|Cloud',
      'Team|Added|Document',
      'Element|Linked|Document',
      'Action|Moved|DocumentToTeam',
      'Email|Sent|DocumentJoined',
      'UI|Toggled|NotifyDocumentJoinOff',
      'Page|View|/document',
      'Mcp|Used|FindDocuments',
      'Error|Api|Internal.Put.Documents.Tabs',
      'Error|Client|Uncaught.Document.TypeError',
      'Error|Api|Http500.SaveDocumentMeta',
      'Template|Used|ErDiagram',
      'Tab|Created|Diagram',
      'Help|View|add-to-document',
      'Help|Helpful|sharing-your-document',
      'Help|View|your-first-diagram',
      'Page|View|/help/troubleshooting/document-not-loading',
    ]);
  });
});
