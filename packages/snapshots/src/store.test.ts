import { describe, expect, it } from 'vitest';
import { SNAPSHOTS_KEPT, SNAPSHOT_CHUNK_CHARS, SNAPSHOT_MAX_BYTES } from './limits';
import {
  advanceGeneration,
  chunkText,
  clearSnapshotAuthors,
  deleteSnapshot,
  getSnapshot,
  listSnapshots,
  readGeneration,
  readSnapshotText,
  renameSnapshot,
  rewriteSnapshotText,
  SNAPSHOT_SCHEMA,
  snapshotId,
  takeSnapshot,
  utf8Bytes,
} from './store';
import { testDb } from './test/db';

const author = { id: 'user_a', name: 'Ada', color: '#f00' };

describe('utf8Bytes', () => {
  it('counts each encoding width', () => {
    expect(utf8Bytes('a')).toBe(1);
    expect(utf8Bytes('é')).toBe(2);
    expect(utf8Bytes('€')).toBe(3);
    expect(utf8Bytes('😀')).toBe(4);
    // A lone surrogate, high at the end and high before a non-low: three bytes each, as a replacement.
    expect(utf8Bytes('\ud83d')).toBe(3);
    expect(utf8Bytes('\ud83da')).toBe(4);
    expect(utf8Bytes('\ude00')).toBe(3);
    expect(utf8Bytes('a😀é')).toBe(new TextEncoder().encode('a😀é').length);
  });
});

describe('chunkText', () => {
  it('keeps empty text as one empty chunk', () => {
    expect(chunkText('')).toEqual(['']);
  });

  it('cuts at the size and never between a surrogate pair', () => {
    expect(chunkText('abcdef', 4)).toEqual(['abcd', 'ef']);
    // The pair would straddle the cut at 4: the cut moves back one.
    expect(chunkText('abc😀de', 4)).toEqual(['abc', '😀de']);
    expect(chunkText('abcd', 4)).toEqual(['abcd']);
  });

  it('keeps every chunk under the 2 MB row limit at the default size', () => {
    const worst = '€'.repeat(SNAPSHOT_CHUNK_CHARS * 2);
    for (const chunk of chunkText(worst)) expect(utf8Bytes(chunk)).toBeLessThan(2_000_000);
  });
});

describe('the store', () => {
  it('takes, lists, reads and deletes a snapshot', async () => {
    const { db } = testDb();
    expect(await listSnapshots(db, 'p1')).toEqual([]);
    const taken = await takeSnapshot(db, {
      itemId: 'p1',
      text: 'hello',
      name: 'First',
      kind: 'manual',
      author,
      now: 10,
    });
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    expect(taken.snapshot).toMatchObject({
      name: 'First',
      kind: 'manual',
      bytes: 5,
      createdAt: 10,
    });
    const list = await listSnapshots(db, 'p1');
    expect(list).toEqual([taken.snapshot]);
    expect(await getSnapshot(db, 'p1', taken.snapshot.id)).toEqual(taken.snapshot);
    expect(await getSnapshot(db, 'other', taken.snapshot.id)).toBeNull();
    expect(await readSnapshotText(db, 'p1', taken.snapshot.id)).toBe('hello');
    expect(await readSnapshotText(db, 'p1', 'missing')).toBeUndefined();
    expect(await deleteSnapshot(db, 'p1', taken.snapshot.id)).toBe(true);
    expect(await deleteSnapshot(db, 'p1', taken.snapshot.id)).toBe(false);
    expect(await listSnapshots(db, 'p1')).toEqual([]);
  });

  it('keeps an author-less snapshot without one', async () => {
    const { db } = testDb();
    await takeSnapshot(db, {
      itemId: 'p1',
      text: 'x',
      name: null,
      kind: 'before-revert',
      author: null,
    });
    const [only] = await listSnapshots(db, 'p1');
    expect(only).toMatchObject({ author: null, name: null, kind: 'before-revert' });
  });

  it('reads an author with no id or colour stored as empty strings', async () => {
    const { db, sql } = testDb();
    await takeSnapshot(db, { itemId: 'p1', text: 'x', name: null, kind: 'manual', author });
    sql.exec('UPDATE snapshots SET author_id = NULL, author_color = NULL');
    const [only] = await listSnapshots(db, 'p1');
    expect(only!.author).toEqual({ id: '', name: 'Ada', color: '' });
  });

  it('keeps only the latest five: a sixth drops the oldest', async () => {
    const { db, sql } = testDb();
    const ids: string[] = [];
    for (let i = 0; i < SNAPSHOTS_KEPT + 1; i += 1) {
      const taken = await takeSnapshot(db, {
        itemId: 'p1',
        text: `v${i}`,
        name: `n${i}`,
        kind: 'manual',
        author,
        now: 100 + i,
      });
      if (taken.ok) ids.push(taken.snapshot.id);
    }
    const list = await listSnapshots(db, 'p1');
    expect(list.map((s) => s.name)).toEqual(['n5', 'n4', 'n3', 'n2', 'n1']);
    expect(await readSnapshotText(db, 'p1', ids[0]!)).toBeUndefined();
    // Its chunks went with it.
    const orphans = sql
      .prepare('SELECT COUNT(*) AS n FROM snapshot_chunks WHERE snapshot_id = ?')
      .get(ids[0]!) as { n: number };
    expect(orphans.n).toBe(0);
  });

  it('keeps each item to its own five', async () => {
    const { db } = testDb();
    for (let i = 0; i < SNAPSHOTS_KEPT; i += 1) {
      await takeSnapshot(db, {
        itemId: 'a',
        text: 'a',
        name: null,
        kind: 'manual',
        author,
        now: i,
      });
    }
    await takeSnapshot(db, { itemId: 'b', text: 'b', name: null, kind: 'manual', author, now: 99 });
    expect(await listSnapshots(db, 'a')).toHaveLength(SNAPSHOTS_KEPT);
    expect(await listSnapshots(db, 'b')).toHaveLength(1);
  });

  it('refuses a snapshot over the cap and writes nothing', async () => {
    const { db } = testDb();
    const text = 'x'.repeat(SNAPSHOT_MAX_BYTES + 1);
    const taken = await takeSnapshot(db, {
      itemId: 'p1',
      text,
      name: null,
      kind: 'manual',
      author,
    });
    expect(taken).toEqual({ ok: false, reason: 'too_large' });
    expect(await listSnapshots(db, 'p1')).toEqual([]);
  });

  it('stores a body over many chunks and reads it back whole', async () => {
    const { db, sql } = testDb();
    const text = `${'a'.repeat(SNAPSHOT_CHUNK_CHARS)}😀${'b'.repeat(10)}`;
    const taken = await takeSnapshot(db, {
      itemId: 'p1',
      text,
      name: null,
      kind: 'manual',
      author,
    });
    if (!taken.ok) throw new Error('not taken');
    const count = sql
      .prepare('SELECT chunks FROM snapshots WHERE id = ?')
      .get(taken.snapshot.id) as { chunks: number };
    expect(count.chunks).toBe(2);
    expect(await readSnapshotText(db, 'p1', taken.snapshot.id)).toBe(text);
  });

  it('reads a snapshot with a missing chunk as unreadable', async () => {
    const { db, sql } = testDb();
    const text = 'a'.repeat(SNAPSHOT_CHUNK_CHARS + 5);
    const taken = await takeSnapshot(db, {
      itemId: 'p1',
      text,
      name: null,
      kind: 'manual',
      author,
    });
    if (!taken.ok) throw new Error('not taken');
    sql.prepare('DELETE FROM snapshot_chunks WHERE seq = 0').run();
    expect(await readSnapshotText(db, 'p1', taken.snapshot.id)).toBeNull();
    // Renumbered, same count, out of order: still unreadable.
    sql
      .prepare('INSERT INTO snapshot_chunks (snapshot_id, seq, data) VALUES (?, 5, ?)')
      .run(taken.snapshot.id, 'z');
    expect(await readSnapshotText(db, 'p1', taken.snapshot.id)).toBeNull();
  });
});

// SN31 to SN33: save points of one part of an item (livedocuments' named versions, scoped `tab:<id>`).
describe('a scoped take', () => {
  it('takes its own id, keeps every one and runs its statements in the same batch', async () => {
    const { db, sql } = testDb();
    sql.exec('CREATE TABLE beside (snapshot_id TEXT PRIMARY KEY)');
    const ids: string[] = [];
    for (let i = 0; i < SNAPSHOTS_KEPT + 2; i += 1) {
      const id = snapshotId();
      const taken = await takeSnapshot(db, {
        itemId: 'tab:t1',
        text: `v${i}`,
        name: `n${i}`,
        kind: 'manual',
        author,
        now: i,
        id,
        keep: null,
        alongside: (sid) => [db.prepare('INSERT INTO beside (snapshot_id) VALUES (?)').bind(sid)],
      });
      expect(taken.ok && taken.snapshot.id).toBe(id);
      ids.push(id);
    }
    expect(await listSnapshots(db, 'tab:t1')).toHaveLength(SNAPSHOTS_KEPT + 2);
    const beside = sql.prepare('SELECT snapshot_id FROM beside ORDER BY rowid').all() as {
      snapshot_id: string;
    }[];
    expect(beside.map((r) => r.snapshot_id)).toEqual(ids);
    // The item's own snapshots keep their five, untouched by the scope.
    for (let i = 0; i < SNAPSHOTS_KEPT + 1; i += 1) {
      await takeSnapshot(db, {
        itemId: 'D',
        text: 'd',
        name: null,
        kind: 'manual',
        author,
        now: i,
      });
    }
    expect(await listSnapshots(db, 'D')).toHaveLength(SNAPSHOTS_KEPT);
    expect(await listSnapshots(db, 'tab:t1')).toHaveLength(SNAPSHOTS_KEPT + 2);
  });

  it('writes nothing when a statement alongside fails', async () => {
    const { db } = testDb();
    await expect(
      takeSnapshot(db, {
        itemId: 'tab:t1',
        text: 'x',
        name: 'n',
        kind: 'manual',
        author,
        keep: null,
        alongside: () => [db.prepare('INSERT INTO no_such_table VALUES (1)')],
      }),
    ).rejects.toThrow();
    expect(await listSnapshots(db, 'tab:t1')).toEqual([]);
  });

  it('renames in place, within its item only', async () => {
    const { db } = testDb();
    const taken = await takeSnapshot(db, {
      itemId: 'tab:t1',
      text: 'x',
      name: 'One',
      kind: 'manual',
      author,
    });
    if (!taken.ok) throw new Error('not taken');
    expect(await renameSnapshot(db, 'tab:t1', taken.snapshot.id, 'Two')).toBe(true);
    expect((await getSnapshot(db, 'tab:t1', taken.snapshot.id))!.name).toBe('Two');
    expect(await renameSnapshot(db, 'D', taken.snapshot.id, 'Three')).toBe(false);
    expect(await renameSnapshot(db, 'tab:t1', 'missing', 'Three')).toBe(false);
  });

  it('rewrites its text whole, chunked, and refuses what a take would', async () => {
    const { db, sql } = testDb();
    const taken = await takeSnapshot(db, {
      itemId: 'tab:t1',
      text: 'short',
      name: null,
      kind: 'manual',
      author,
    });
    if (!taken.ok) throw new Error('not taken');
    const id = taken.snapshot.id;
    const long = `${'a'.repeat(SNAPSHOT_CHUNK_CHARS)}é`;
    expect(await rewriteSnapshotText(db, 'tab:t1', id, long)).toBe('ok');
    expect(await readSnapshotText(db, 'tab:t1', id)).toBe(long);
    const head = sql.prepare('SELECT bytes, chunks FROM snapshots WHERE id = ?').get(id) as {
      bytes: number;
      chunks: number;
    };
    expect(head).toEqual({ bytes: SNAPSHOT_CHUNK_CHARS + 2, chunks: 2 });
    expect(await rewriteSnapshotText(db, 'D', id, 'x')).toBe('missing');
    expect(await rewriteSnapshotText(db, 'tab:t1', id, 'x'.repeat(SNAPSHOT_MAX_BYTES + 1))).toBe(
      'too_large',
    );
    expect(await readSnapshotText(db, 'tab:t1', id)).toBe(long);
  });

  it('exports the schema it runs', () => {
    expect(SNAPSHOT_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS snapshots');
    expect(SNAPSHOT_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS snapshot_chunks');
  });
});

describe('clearing a closed account off its snapshots (SN34)', () => {
  const gone = { id: 'deleted', name: 'Deleted account' };
  const take = (
    db: Parameters<typeof takeSnapshot>[0],
    itemId: string,
    who: typeof author,
    text = 'body',
  ) => takeSnapshot(db, { itemId, text, name: 'Kept', kind: 'manual', author: who, keep: null });

  it('names every snapshot they took Deleted account, under each of their ids, and nothing else', async () => {
    const { db, sql } = testDb();
    await take(db, 'D', author, 'theirs');
    await take(db, 'tab:t1', { id: 'guest_was', name: 'Ada as a guest', color: '#0f0' });
    await take(db, 'D', { id: 'user_b', name: 'Bea', color: '#00f' }, 'hers');
    const before = sql
      .prepare('SELECT snapshot_id, seq, data FROM snapshot_chunks ORDER BY rowid')
      .all();

    expect(await clearSnapshotAuthors(db, ['user_a', 'guest_was'], gone)).toBe(2);

    const rows = sql
      .prepare(
        'SELECT item_id, name, kind, author_id, author_name, author_color, bytes FROM snapshots ORDER BY rowid',
      )
      .all();
    expect(rows).toEqual([
      {
        item_id: 'D',
        name: 'Kept',
        kind: 'manual',
        author_id: 'deleted',
        author_name: 'Deleted account',
        author_color: '#f00',
        bytes: 6,
      },
      {
        item_id: 'tab:t1',
        name: 'Kept',
        kind: 'manual',
        author_id: 'deleted',
        author_name: 'Deleted account',
        author_color: '#0f0',
        bytes: 4,
      },
      {
        item_id: 'D',
        name: 'Kept',
        kind: 'manual',
        author_id: 'user_b',
        author_name: 'Bea',
        author_color: '#00f',
        bytes: 4,
      },
    ]);
    // The bodies are the item's, and stay as they were.
    expect(
      sql.prepare('SELECT snapshot_id, seq, data FROM snapshot_chunks ORDER BY rowid').all(),
    ).toEqual(before);
    // A second run finds no snapshot of theirs.
    expect(await clearSnapshotAuthors(db, ['user_a', 'guest_was'], gone)).toBe(0);
  });

  it('reads a database it has not seen, and makes no table where there is none', async () => {
    const { db, sql } = testDb();
    await take(db, 'D', author);
    // A fresh handle over the same SQLite: the schema has not run on it.
    expect(await clearSnapshotAuthors(testDb(sql).db, ['user_a'], gone)).toBe(1);

    const empty = testDb();
    expect(await clearSnapshotAuthors(empty.db, ['user_a'], gone)).toBe(0);
    expect(
      empty.sql.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get(),
    ).toEqual({ n: 0 });
  });

  it('does nothing for no ids', async () => {
    const { db } = testDb();
    await take(db, 'D', author);
    expect(await clearSnapshotAuthors(db, [], gone)).toBe(0);
    expect((await listSnapshots(db, 'D'))[0]!.author).toEqual(author);
  });
});

describe('the generation', () => {
  it('reads 0 without creating a table, then advances and keeps', async () => {
    const { db, sql } = testDb();
    expect(await readGeneration(db, 'p1')).toBe(0);
    const tables = sql
      .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'snapshot_state'")
      .get() as { n: number };
    expect(tables.n).toBe(0);
    expect(await advanceGeneration(db, 'p1')).toBe(1);
    expect(await advanceGeneration(db, 'p1')).toBe(2);
    expect(await readGeneration(db, 'p1')).toBe(2);
    expect(await readGeneration(db, 'p2')).toBe(0);
  });

  it('reads a stored generation through a fresh handle', async () => {
    const first = testDb();
    await advanceGeneration(first.db, 'p1');
    // The same database behind a new handle (a woken room): read from the table.
    const again = testDb(first.sql).db;
    expect(await readGeneration(again, 'p1')).toBe(1);
    expect(await readGeneration(again, 'p9')).toBe(0);
  });
});
