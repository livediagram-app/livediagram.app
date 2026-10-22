import { describe, expect, it } from 'vitest';
import { applyMigration, sqliteD1, type SqliteD1 } from '../test-sqlite-d1';

// Only events with a real actor count for Home (docs/specs/013-workspace/explorer-home.md
// "Timeline"; blueprint "Real edits"): the edits the retired personal-feed backfill reconstructed
// are marked by migration 0063, and Home leaves them out (routes/home.test.ts).

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;
let db: SqliteD1;

describe('migration 0063', () => {
  it('marks the edits backfilled before the mark existed, and only those', () => {
    db = sqliteD1({}, { before: '0063' });
    const insert = db.sql.prepare(
      `INSERT INTO timeline_events (id, actor_id, source_type, source_id, event_type, dedupe_key, title,
         occurred_at, snapshot, created_at)
       VALUES (?, 'owner', 'document', ?, ?, ?, 'x', ?, '{"documentId":"d"}', ?)`,
    );
    // Live: stored within milliseconds of its time, then walked forward by later saves.
    insert.run('live', 'd1', 'document_edited', 'a', NOW + 5 * 60_000, NOW + 3);
    // Backfilled: stored days after the save it reconstructs.
    insert.run('old', 'd2', 'document_edited', 'b', NOW - 3 * DAY, NOW);
    // Not an edit: a created row stored late stays as it is.
    insert.run('created', 'd3', 'document_created', '', NOW - 3 * DAY, NOW);
    applyMigration(db.sql, '0063');
    const marked = db.sql
      .prepare("SELECT id FROM timeline_events WHERE json_extract(snapshot, '$.backfilled') = 1")
      .all() as { id: string }[];
    expect(marked.map((r) => r.id)).toEqual(['old']);
  });
});
