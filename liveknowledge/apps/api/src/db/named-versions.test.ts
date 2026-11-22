import { describe, expect, it, vi } from 'vitest';
import {
  SNAPSHOT_CHUNK_CHARS,
  SNAPSHOT_MAX_BYTES,
  listSnapshots,
  takeSnapshot,
} from '@liveworkspace/snapshots/server';
import { mentionsAnySql } from '@liveworkspace/index-app';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import {
  anonymiseNamedVersions,
  countNamedVersions,
  getNamedVersion,
  keepNamedVersion,
  namedScope,
  namedVersionAtRev,
  renameNamedVersion,
  unnameNamedVersion,
} from './named-versions';
import { getVersion, listVersions, nameVersion, namedVersionCount, versionAtRev } from './versions';

// Named versions in the snapshots' store on real SQLite (docs/specs/006-document/blueprints/version-history.md VH20
// to VH24): kept with their revision row in one batch, read beside `tab_versions`, renamed, unnamed into `tab_versions`,
// gone with their tab, and anonymised.

const AUTHOR = { id: 'user_a', name: 'Ada', color: '#123456' };
const body = (label: string, pad = 0) =>
  JSON.stringify({ elements: [{ id: 'a', type: 'shape', label, note: 'x'.repeat(pad) }] });

function setUp(): SqliteD1 {
  const db = sqliteD1();
  db.sql
    .prepare(
      "INSERT INTO document (id, saved_at, created_at, name, owner_id) VALUES ('D', 0, 1, 'Doc', 'o')",
    )
    .run();
  db.sql
    .prepare(
      "INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES ('t1', 'Pitch', ?, 1000, 1, 1)",
    )
    .run(body('first'));
  db.sql
    .prepare(
      "INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('D', 't1', 0, 1)",
    )
    .run();
  return db;
}

function write(db: SqliteD1, label: string, at: number, pad = 0) {
  db.sql
    .prepare("UPDATE tabs SET data = ?, updated_at = ?, rev = rev + 1 WHERE id = 't1'")
    .run(body(label, pad), at);
}

// A version kept as every version before Work Tracker 1097 was: a row of `tab_versions`.
function oldVersion(db: SqliteD1, id: string, rev: number, name: string | null, at: number) {
  db.sql
    .prepare(
      `INSERT INTO tab_versions (id, tab_id, rev, kind, name, author_id, author_name, author_color, tab_name, data,
                                 bytes, element_count, saved_at, created_at)
       VALUES (?, 't1', ?, 'manual', ?, 'user_a', 'Ada', '#123456', 'Pitch', ?, 10, 1, ?, ?)`,
    )
    .run(id, rev, name, body(`old ${rev}`), at, at);
}

const count = (db: SqliteD1, table: string) =>
  (db.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

const keep = (db: SqliteD1, name: string, now = 5000) =>
  keepNamedVersion(db.env, { tabId: 't1', name, author: AUTHOR, now });

describe('keeping a named version', () => {
  it('keeps the stored tab as a save point of its tab, with its revision row', async () => {
    const db = setUp();
    const kept = await keep(db, 'Draft');
    expect(kept).toMatchObject({
      tabId: 't1',
      rev: 1,
      kind: 'manual',
      name: 'Draft',
      author: { name: 'Ada', color: '#123456' },
      savedAt: 1000,
      createdAt: 5000,
      bytes: body('first').length,
      elementCount: 1,
    });
    expect(kept!.id).toMatch(/^s_[0-9a-f]{16}$/);
    // In the snapshots' store under the tab's scope, never the document's own list.
    expect(await listSnapshots(db.env.DOCUMENT_DB, namedScope('t1'))).toHaveLength(1);
    expect(await listSnapshots(db.env.DOCUMENT_DB, 'D')).toEqual([]);
    expect(count(db, 'tab_versions')).toBe(0);
    const stored = await getNamedVersion(db.env, 't1', kept!.id);
    expect(stored).toMatchObject({ tabName: 'Pitch', data: body('first') });
    expect(await namedVersionAtRev(db.env, 't1', 1)).toMatchObject({ id: kept!.id });
    expect(await namedVersionAtRev(db.env, 't1', 2)).toBeNull();
    expect(await countNamedVersions(db.env, 't1')).toBe(1);
  });

  it('answers undefined for no such tab', async () => {
    const db = setUp();
    expect(
      await keepNamedVersion(db.env, { tabId: 'nope', name: 'x', author: AUTHOR, now: 1 }),
    ).toBeUndefined();
  });

  it('keeps nothing when another version took the revision first', async () => {
    const db = setUp();
    await keep(db, 'First');
    expect(await keep(db, 'Second')).toBeNull();
    expect(count(db, 'tab_named_versions')).toBe(1);
    expect(count(db, 'snapshots')).toBe(1);
    expect(count(db, 'snapshot_chunks')).toBe(1);
  });

  it('throws when the store refuses the body, so the route falls back', async () => {
    const db = setUp();
    db.sql
      .prepare("UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 't1'")
      .run('x'.repeat(SNAPSHOT_MAX_BYTES + 1));
    await expect(keep(db, 'Huge')).rejects.toThrow(/too large/);
    expect(count(db, 'snapshots')).toBe(0);
  });

  it('keeps a tab over one chunk whole', async () => {
    const db = setUp();
    write(db, 'big', 1100, SNAPSHOT_CHUNK_CHARS);
    const kept = await keep(db, 'Big');
    expect(
      (db.sql.prepare('SELECT chunks FROM snapshots').get() as { chunks: number }).chunks,
    ).toBe(2);
    expect((await getNamedVersion(db.env, 't1', kept!.id))!.data).toBe(
      body('big', SNAPSHOT_CHUNK_CHARS),
    );
  });

  it('reads a version with a missing chunk as an unreadable body', async () => {
    const db = setUp();
    const kept = await keep(db, 'Draft');
    db.sql.prepare('DELETE FROM snapshot_chunks').run();
    expect((await getNamedVersion(db.env, 't1', kept!.id))!.data).toBe('');
    expect(await getNamedVersion(db.env, 't2', kept!.id)).toBeNull();
  });
});

describe('names in the snapshots store', () => {
  it('renames in place', async () => {
    const db = setUp();
    const kept = await keep(db, 'One');
    expect(await renameNamedVersion(db.env, 't1', kept!.id, 'Two')).toMatchObject({
      id: kept!.id,
      name: 'Two',
    });
    expect(await renameNamedVersion(db.env, 't1', 's_missing', 'Two')).toBeNull();
  });

  it('unnames into tab_versions under the same id, and the snapshot rows go', async () => {
    const db = setUp();
    const kept = await keep(db, 'One');
    expect(await unnameNamedVersion(db.env, 't1', kept!.id)).toBe(1);
    const row = db.sql.prepare('SELECT * FROM tab_versions').get() as Record<string, unknown>;
    expect(row).toMatchObject({
      id: kept!.id,
      rev: 1,
      kind: 'manual',
      name: null,
      author_id: 'user_a',
      author_name: 'Ada',
      tab_name: 'Pitch',
      data: body('first'),
      saved_at: 1000,
      created_at: 5000,
    });
    expect(count(db, 'tab_named_versions') + count(db, 'snapshots')).toBe(0);
    expect(count(db, 'snapshot_chunks')).toBe(0);
    expect(await unnameNamedVersion(db.env, 't1', kept!.id)).toBeNull();
  });

  it('leaves the automatic version already holding the revision when unnaming', async () => {
    const db = setUp();
    const kept = await keep(db, 'One');
    oldVersion(db, 'v_auto', 1, null, 900);
    expect(await unnameNamedVersion(db.env, 't1', kept!.id)).toBe(1);
    const rows = db.sql.prepare('SELECT id FROM tab_versions').all() as { id: string }[];
    expect(rows.map((r) => r.id)).toEqual(['v_auto']);
    // nameVersion answers the row that now holds the revision.
    const again = await keep(db, 'Two');
    expect(await nameVersion(db.env, 't1', again!.id, null)).toMatchObject({ id: 'v_auto' });
  });
});

describe('gone with the tab', () => {
  it("deletes a tab's named versions and their chunks, never the document's snapshots", async () => {
    const db = setUp();
    await keep(db, 'One');
    write(db, 'second', 1100);
    await keep(db, 'Two');
    await takeSnapshot(db.env.DOCUMENT_DB, {
      itemId: 'D',
      text: 'doc',
      name: null,
      kind: 'manual',
      author: AUTHOR,
    });
    expect(count(db, 'snapshots')).toBe(3);
    db.sql.prepare("DELETE FROM tabs WHERE id = 't1'").run();
    expect(count(db, 'tab_named_versions')).toBe(0);
    expect(count(db, 'snapshots')).toBe(1);
    expect(count(db, 'snapshot_chunks')).toBe(1);
    expect(await listSnapshots(db.env.DOCUMENT_DB, 'D')).toHaveLength(1);
  });
});

describe('reading both stores', () => {
  it('lists old-store versions only, as before', async () => {
    const db = setUp();
    oldVersion(db, 'v_old1', 1, 'Old', 900);
    oldVersion(db, 'v_old2', 2, null, 950);
    const list = await listVersions(db.env, 't1');
    expect(list.map((v) => v.id)).toEqual(['v_old2', 'v_old1']);
    expect(await namedVersionCount(db.env, 't1')).toBe(1);
  });

  it('lists new-store versions only', async () => {
    const db = setUp();
    const kept = await keep(db, 'New');
    expect((await listVersions(db.env, 't1')).map((v) => v.id)).toEqual([kept!.id]);
    expect(await namedVersionCount(db.env, 't1')).toBe(1);
  });

  it('merges both newest first, and leaves out an automatic one at a named revision', async () => {
    const db = setUp();
    oldVersion(db, 'v_named', 7, 'Old name', 800);
    oldVersion(db, 'v_auto', 8, null, 1200);
    const kept = await keep(db, 'New'); // rev 1, saved 1000
    // The idle copy of rev 1 once the tab moves on after a pause: the same revision as the named one.
    oldVersion(db, 'v_dup', 1, null, 1000);
    const list = await listVersions(db.env, 't1');
    expect(list.map((v) => v.id)).toEqual(['v_auto', kept!.id, 'v_named']);
    expect(await namedVersionCount(db.env, 't1')).toBe(2);
    // A tie on saved time goes to the newer revision.
    oldVersion(db, 'v_tie', 9, 'Tie', 1000);
    expect((await listVersions(db.env, 't1')).map((v) => v.id)).toEqual([
      'v_auto',
      'v_tie',
      kept!.id,
      'v_named',
    ]);
    // Both open by id; the revision reads the named one first.
    expect((await getVersion(db.env, 't1', 'v_named'))!.summary.name).toBe('Old name');
    expect((await getVersion(db.env, 't1', kept!.id))!.summary.name).toBe('New');
    expect(await getVersion(db.env, 't1', 's_missing')).toBeNull();
    expect(await versionAtRev(db.env, 't1', 1)).toMatchObject({ id: kept!.id });
    expect(await versionAtRev(db.env, 't1', 8)).toMatchObject({ id: 'v_auto' });
  });

  it('names in whichever store holds the version', async () => {
    const db = setUp();
    oldVersion(db, 'v_old', 7, 'Old', 800);
    const kept = await keep(db, 'New');
    expect(await nameVersion(db.env, 't1', 'v_old', 'Renamed old')).toMatchObject({
      id: 'v_old',
      name: 'Renamed old',
    });
    expect(await nameVersion(db.env, 't1', kept!.id, 'Renamed new')).toMatchObject({
      id: kept!.id,
      name: 'Renamed new',
    });
    expect(await nameVersion(db.env, 't1', kept!.id, null)).toMatchObject({
      id: kept!.id,
      name: null,
    });
    expect(await nameVersion(db.env, 't1', 's_missing', null)).toBeNull();
  });

  it('keeps reading tab_versions when the snapshots store cannot be read', async () => {
    const db = setUp();
    oldVersion(db, 'v_old', 7, 'Old', 800);
    await keep(db, 'New');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    db.sql.exec('DROP TABLE tab_named_versions');
    expect((await listVersions(db.env, 't1')).map((v) => v.id)).toEqual(['v_old']);
    expect((await getVersion(db.env, 't1', 'v_old'))!.summary.name).toBe('Old');
    expect(await getVersion(db.env, 't1', 's_gone')).toBeNull();
    expect(await versionAtRev(db.env, 't1', 7)).toMatchObject({ id: 'v_old' });
    expect(await namedVersionCount(db.env, 't1')).toBe(1);
    expect(warn).toHaveBeenCalledWith(
      '[versions] refused',
      expect.objectContaining({ reason: 'store' }),
    );
    warn.mockRestore();
  });
});

describe('anonymising', () => {
  const p = (rewrite: (text: string) => string | null) => ({
    needles: JSON.stringify(['user_a']),
    mentionsSql: mentionsAnySql('c.data'),
    rewrite,
  });

  it('rewrites a body that mentions them, chunked or not', async () => {
    const db = setUp();
    db.sql
      .prepare("UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 't1'")
      .run(JSON.stringify({ elements: [], by: 'user_a' }));
    const small = await keep(db, 'Small');
    db.sql
      .prepare("UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 't1'")
      .run(JSON.stringify({ elements: [], pad: 'x'.repeat(SNAPSHOT_CHUNK_CHARS), by: 'user_a' }));
    const big = await keep(db, 'Big');
    write(db, 'clean', 2000);
    await keep(db, 'Clean');
    const changes = await anonymiseNamedVersions(
      db.env,
      p((text) => (text.includes('user_a') ? text.replaceAll('user_a', 'gone') : null)),
    );
    expect(changes).toBe(2);
    expect((await getNamedVersion(db.env, 't1', small!.id))!.data).not.toContain('user_a');
    expect((await getNamedVersion(db.env, 't1', big!.id))!.data).not.toContain('user_a');
  });

  it('skips an unreadable body', async () => {
    const db = setUp();
    await keep(db, 'Draft');
    db.sql.prepare("UPDATE snapshot_chunks SET data = 'user_a'").run();
    db.sql.prepare('UPDATE snapshots SET chunks = 2').run();
    const rewrite = vi.fn(() => 'x');
    expect(await anonymiseNamedVersions(db.env, p(rewrite))).toBe(0);
    expect(rewrite).not.toHaveBeenCalled();
  });
});
