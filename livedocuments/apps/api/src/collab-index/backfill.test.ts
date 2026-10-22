import { describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { collabIndexStatements } from '../db/collab-index';
import { backfillCollabIndex } from './backfill';

// The collaboration index backfill (docs/specs/013-workspace/inbox.md §2.3) writes from blobs
// it read earlier, so each tab's rows are guarded on the revision it read: a save landing in between
// already indexed the newer blob, and the backfill must not write the older one back over it.

const thread = (text: string) => ({
  id: 'a',
  type: 'shape',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  commentThread: {
    resolved: false,
    comments: [{ id: 'c1', text, createdAt: 1, authorName: 'Priya', authorColor: '#000' }],
  },
});

function seed(db: SqliteD1, text: string) {
  db.sql
    .prepare("INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Tab', ?, 1)")
    .run(JSON.stringify({ elements: [thread(text)] }));
  db.sql.exec(`
    INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Payments', 1, 1, 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
  `);
}

const indexed = (db: SqliteD1) =>
  (db.sql.prepare('SELECT latest_text FROM collab_threads').all() as { latest_text: string }[]).map(
    (r) => r.latest_text,
  );

describe('backfillCollabIndex', () => {
  it('indexes a tab nobody saved meanwhile', async () => {
    const db = sqliteD1();
    seed(db, 'old');
    await backfillCollabIndex(db.env, 'owner');
    expect(indexed(db)).toEqual(['old']);
  });

  it('leaves the index a save wrote between its read and its write', async () => {
    const db = sqliteD1();
    seed(db, 'old');
    const batch = db.env.DB.batch.bind(db.env.DB);
    // A save lands just before the backfill's batch: the newer blob, indexed in its own batch.
    vi.spyOn(db.env.DB, 'batch').mockImplementationOnce(async (stmts) => {
      const elements = [thread('new')] as never;
      db.sql
        .prepare("UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 't1'")
        .run(JSON.stringify({ elements }));
      await batch(collabIndexStatements(db.env, 't1', elements));
      return batch(stmts);
    });
    await backfillCollabIndex(db.env, 'owner');
    expect(indexed(db)).toEqual(['new']);
  });
});
