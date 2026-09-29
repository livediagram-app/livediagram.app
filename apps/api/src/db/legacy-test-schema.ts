// Test seeding that works on either side of migration 0055, which renamed the container's
// tables and columns from diagram to document (docs/specs/006-document/document.md). Tests of
// an older migration seed rows under the schema of that time, then migrate forward. Not a
// `.test.ts` file, so vitest doesn't collect it as a suite.
import type { DatabaseSync } from 'node:sqlite';

function renamed(sql: DatabaseSync): boolean {
  return Boolean(
    sql.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'documents'").get(),
  );
}

export function insertDocumentRow(
  sql: DatabaseSync,
  id: string,
  ownerId: string,
  name: string,
): void {
  const table = renamed(sql) ? 'documents' : 'diagrams';
  sql
    .prepare(
      `INSERT INTO ${table} (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, 0, 0)`,
    )
    .run(id, ownerId, name);
}

export function linkDocumentTab(
  sql: DatabaseSync,
  documentId: string,
  tabId: string,
  orderIndex = 0,
): void {
  const [table, column] = renamed(sql)
    ? ['document_tabs', 'document_id']
    : ['diagram_tabs', 'diagram_id'];
  sql
    .prepare(`INSERT INTO ${table} (${column}, tab_id, order_index, added_at) VALUES (?, ?, ?, 0)`)
    .run(documentId, tabId, orderIndex);
}
