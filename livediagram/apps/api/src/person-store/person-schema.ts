// A person's own SQLite (person-store.ts): what livediagram keeps for one person rather than for one canvas.
// livediagram ships fresh, so the schema is one step; a later change appends a step, never edits this one.

import type { DocumentSql } from '../document-room/document-db';

const V1 = `
-- Shape libraries (docs/specs/013-workspace/shape-libraries.md): the person's named sets of reusable shapes. The
-- items are the validated list as JSON (shape-library-row.ts parses it).
CREATE TABLE IF NOT EXISTS shape_libraries (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  source     TEXT    NOT NULL,
  items      TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

const STEPS: readonly string[] = [V1];

// Bring the person's SQLite up to date. Idempotent: the version row skips what already ran.
export function migratePersonSchema(sql: DocumentSql): void {
  sql.exec('CREATE TABLE IF NOT EXISTS _person_schema (version INTEGER NOT NULL)');
  const row = sql.exec('SELECT version FROM _person_schema LIMIT 1').toArray()[0];
  const at = typeof row?.version === 'number' ? row.version : 0;
  if (at >= STEPS.length) return;
  for (let step = at; step < STEPS.length; step++) sql.exec(STEPS[step]!);
  sql.exec('DELETE FROM _person_schema');
  sql.exec(`INSERT INTO _person_schema (version) VALUES (${STEPS.length})`);
}

// Whether the store holds anything at all: a read that writes nothing, for a store that may never have started.
export function hasPersonSchema(sql: DocumentSql): boolean {
  return (
    sql.exec("SELECT 1 AS present FROM sqlite_master WHERE name = '_person_schema'").toArray()
      .length > 0
  );
}
