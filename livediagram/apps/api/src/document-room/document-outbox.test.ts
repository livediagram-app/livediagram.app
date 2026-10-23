import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { deleteTabRow, upsertTab } from '../db/tabs';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { DRAIN_TABS, drainOutbox, jsonChunks, readContentSummary } from './document-outbox';

// What a document pushes to D1 (document-outbox.ts): the triggers key each change in the write's own transaction, and
// a drain turns the keys into one D1 batch. Real SQLite (test-sqlite-d1.ts), where a document's tables sit beside
// D1's; `drainOutbox` is called directly, so the D1 reads below use the raw handle (no automatic push).

const T0 = 1_700_000_000_000;

const box = (id: string, extra: Record<string, unknown> = {}): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  label: id,
  ...extra,
});

const actionOn = (id: string): Element =>
  box(id, {
    action: {
      id: `act-${id}`,
      name: 'Do it',
      description: '',
      assignee: { userId: 'owner', name: 'Owner' },
      teamId: null,
      assignerId: 'owner',
      assignerName: 'Owner',
      status: 'open',
      createdAt: T0,
      updatedAt: T0,
    },
  });

function document(): SqliteD1 {
  const db = sqliteD1();
  db.sql.exec(`INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
               VALUES ('P', 'owner', 'P', 1, ${T0}, ${T0})`);
  return db;
}

const rows = (db: SqliteD1, query: string) => db.sql.prepare(query).all();
const keys = (db: SqliteD1) =>
  rows(db, "SELECT kind || ':' || key AS k FROM outbox WHERE document_id = 'P' ORDER BY id").map(
    (r) => String(r.k),
  );

describe('the outbox', () => {
  it('keys a tab write in the same transaction, and a drain pushes its Inbox rows and empties it', async () => {
    const db = document();
    await upsertTab(db.env, 'P', { id: 't1', name: 'Board', elements: [actionOn('a')] }, 0);
    // A new tab links into the document, so the document's image set is pushed too (a tab's images find their
    // document through its link).
    expect(keys(db)).toEqual(['tab:t1', 'images:', 'summary:']);
    expect(rows(db, 'SELECT * FROM collab_actions')).toEqual([]);

    const pushed = await drainOutbox(db.env, 'P');

    expect(pushed).toMatchObject({ more: false });
    expect(keys(db)).toEqual([]);
    expect(rows(db, 'SELECT document_id, tab_id, tab_name, action_id FROM collab_actions')).toEqual(
      [{ document_id: 'P', tab_id: 't1', tab_name: 'Board', action_id: 'act-a' }],
    );
    const summary = rows(db, "SELECT content_summary FROM documents WHERE id = 'P'")[0]!;
    expect(JSON.parse(String(summary.content_summary))).toMatchObject({
      hasContent: true,
      tabCounts: { t1: 1 },
    });
  });

  it('replaces a tab’s rows on the next write, and drops them, and its tab-scoped links, when the tab goes', async () => {
    const db = document();
    await upsertTab(db.env, 'P', { id: 't1', name: 'Board', elements: [actionOn('a')] }, 0);
    await drainOutbox(db.env, 'P');
    await upsertTab(db.env, 'P', { id: 't1', name: 'Renamed', elements: [actionOn('b')] }, 0);
    await drainOutbox(db.env, 'P');
    expect(rows(db, 'SELECT tab_name, action_id FROM collab_actions')).toEqual([
      { tab_name: 'Renamed', action_id: 'act-b' },
    ]);

    db.sql.exec(`INSERT INTO share_links (code, document_id, role, created_at, tab_id)
                 VALUES ('tabbed', 'P', 'view', ${T0}, 't1'), ('whole', 'P', 'view', ${T0}, NULL)`);
    await deleteTabRow(db.env, 'P', 't1');
    await drainOutbox(db.env, 'P');
    expect(rows(db, 'SELECT * FROM collab_actions')).toEqual([]);
    expect(rows(db, 'SELECT code FROM share_links')).toEqual([{ code: 'whole' }]);
  });

  it('writes nothing for a document whose document row is gone', async () => {
    const db = document();
    await upsertTab(db.env, 'P', { id: 't1', name: 'Board', elements: [actionOn('a')] }, 0);
    db.sql.exec('PRAGMA foreign_keys = OFF');
    db.sql.exec("DELETE FROM documents WHERE id = 'P'");
    db.sql.exec('PRAGMA foreign_keys = ON');
    await drainOutbox(db.env, 'P');
    expect(rows(db, 'SELECT * FROM collab_actions')).toEqual([]);
  });

  it('pushes the images the document places to D1 and the media queue, and only a changed set', async () => {
    const db = document();
    const picture = (id: string, imageId: string): Element =>
      ({ id, type: 'image', x: 0, y: 0, width: 10, height: 10, imageId }) as unknown as Element;
    await upsertTab(db.env, 'P', { id: 't1', name: 'A', elements: [picture('p1', 'img-1')] }, 0);
    await upsertTab(db.env, 'P', { id: 't2', name: 'B', elements: [picture('p2', 'img-1')] }, 1);
    await drainOutbox(db.env, 'P');
    expect(rows(db, 'SELECT document_id, image_id FROM document_images')).toEqual([
      { document_id: 'P', image_id: 'img-1' },
    ]);
    expect(rows(db, 'SELECT document_id FROM media_ref_outbox')).toEqual([{ document_id: 'P' }]);

    // A save that keeps the set owes the media service nothing.
    db.sql.exec('DELETE FROM media_ref_outbox');
    await upsertTab(db.env, 'P', { id: 't2', name: 'B', elements: [] }, 1);
    await drainOutbox(db.env, 'P');
    expect(rows(db, 'SELECT image_id FROM document_images')).toEqual([{ image_id: 'img-1' }]);
    expect(rows(db, 'SELECT document_id FROM media_ref_outbox')).toEqual([]);

    await upsertTab(db.env, 'P', { id: 't1', name: 'A', elements: [] }, 0);
    await drainOutbox(db.env, 'P');
    expect(rows(db, 'SELECT image_id FROM document_images')).toEqual([]);
    expect(rows(db, 'SELECT document_id FROM media_ref_outbox')).toEqual([{ document_id: 'P' }]);
  });

  it(`takes at most ${DRAIN_TABS} tabs a drain, saying there is more`, async () => {
    const db = document();
    for (let i = 0; i < DRAIN_TABS + 5; i++) {
      await upsertTab(db.env, 'P', { id: `t${i}`, name: `T${i}`, elements: [] }, i);
    }
    const tabKeys = keys(db).filter((k) => k.startsWith('tab:')).length;
    expect(tabKeys).toBe(DRAIN_TABS + 5);
    const first = await drainOutbox(db.env, 'P');
    expect(first.more).toBe(true);
    expect(first.keys).toBeLessThan(DRAIN_TABS + 5 + 1);
    // The test store pushes the rest before its own D1 batch (test-sqlite-d1.ts); the room drains again.
    expect(keys(db)).toEqual([]);
  });
});

describe('readContentSummary', () => {
  it('counts an article tab with no elements as content', async () => {
    const db = document();
    const article = { blocks: [{ id: 'b1', type: 'title', runs: [{ text: 'Notes' }] }] };
    await upsertTab(
      db.env,
      'P',
      { id: 'a', name: 'Essay', elements: [], articles: { f1: article } } as never,
      0,
    );
    // An article's writing lives beside the elements: its tab counts none, and is still content.
    const { summary } = await readContentSummary(db.env, 'P');
    expect(summary).toMatchObject({ hasContent: true, firstTabCount: 0 });
  });

  it('counts a body that is not JSON as content, failing safe', async () => {
    const db = document();
    await upsertTab(db.env, 'P', { id: 't', name: 'T', elements: [] }, 0);
    db.sql.exec("UPDATE tabs SET data = '{not json', rev = rev + 1 WHERE id = 't'");
    expect((await readContentSummary(db.env, 'P')).summary.hasContent).toBe(true);
  });

  it('is empty for a document of empty tabs', async () => {
    const db = document();
    await upsertTab(db.env, 'P', { id: 't', name: 'T', elements: [] }, 0);
    expect((await readContentSummary(db.env, 'P')).summary.hasContent).toBe(false);
  });
});

describe('jsonChunks', () => {
  it('keeps every bound value under 1 MB, in order, splitting only between rows', () => {
    const row = { text: 'x'.repeat(100_000) };
    const chunks = jsonChunks(Array.from({ length: 25 }, () => row));
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1_000_000);
    expect(chunks.flatMap((c) => JSON.parse(c) as unknown[])).toHaveLength(25);
  });

  it('makes no chunk for no rows', () => {
    expect(jsonChunks([])).toEqual([]);
  });
});
