import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMigration, sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { backfillUserScope, recordDocumentEdited } from '../timeline';

// Only events with a real actor count for Home (docs/specs/013-workspace/explorer-home.md
// "Timeline"; blueprint "Real edits"): the Timeline backfill's reconstructed edit says so, never
// marks a real one, and the rows written before the mark are marked by migration 0063.

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;
let db: SqliteD1;

function edits() {
  return (
    db.sql
      .prepare(
        "SELECT actor_id, json_extract(snapshot, '$.backfilled') AS backfilled FROM timeline_events WHERE event_type = 'document_edited'",
      )
      .all() as { actor_id: string; backfilled: number | null }[]
  ).map((r) => r.backfilled);
}

function addDoc(savedAt: number) {
  db.sql
    .prepare(
      `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
       VALUES ('d1', 'owner', 'Payments', 0, ?, ?)`,
    )
    .run(savedAt, NOW - 30 * DAY);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the backfilled edit', () => {
  beforeEach(() => {
    db = sqliteD1();
  });

  it('says it is a reconstruction', async () => {
    addDoc(NOW - 2 * DAY);
    await backfillUserScope(db.env, 'owner');
    expect(edits()).toEqual([1]);
  });

  it('never marks a real edit already recorded for that day', async () => {
    addDoc(NOW);
    await recordDocumentEdited(
      db.env,
      { id: 'd1', name: 'Payments', ownerId: 'owner', teamId: null },
      'owner',
    );
    await backfillUserScope(db.env, 'owner');
    expect(edits()).toEqual([null]);
  });

  it('becomes real when a real edit lands on its day', async () => {
    addDoc(NOW - 60_000);
    await backfillUserScope(db.env, 'owner');
    await recordDocumentEdited(
      db.env,
      { id: 'd1', name: 'Payments', ownerId: 'owner', teamId: null },
      'owner',
    );
    expect(edits()).toEqual([null]);
  });
});

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
