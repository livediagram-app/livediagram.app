import { describe, expect, it } from 'vitest';
import { SNAPSHOTS_KEPT, SNAPSHOT_CHUNK_CHARS, SNAPSHOT_MAX_BYTES } from './limits';
import {
  advanceGeneration,
  chunkText,
  deleteSnapshot,
  getSnapshot,
  listSnapshots,
  readGeneration,
  readSnapshotText,
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
