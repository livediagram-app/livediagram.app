import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
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
