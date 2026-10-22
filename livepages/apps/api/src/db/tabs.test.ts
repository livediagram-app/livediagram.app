import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { copyDocument } from './documents';
import {
  getTab,
  isTabRevStale,
  normalizeReorderEntry,
  renameTab,
  seedTabs,
  swapTabData,
  upsertTab,
  upsertTabAtRev,
} from './tabs';
import { tabStatsOfData } from './tab-stats';

// normalizeReorderEntry is the pure decision the reorder batch leans
// on (docs/specs/006-document/tab-folders.md): it decides what folder value lands on each
// document_tabs row. The D1 batch itself needs a live binding to test,
// but this normalisation — legacy-string vs object, and the
// empty-name-to-NULL guard — is where the folder correctness lives.

describe('normalizeReorderEntry', () => {
  it('treats a legacy plain-string entry as loose (folder null)', () => {
    expect(normalizeReorderEntry('tab-1')).toEqual({ id: 'tab-1', folder: null });
  });

  it('keeps a real folder name', () => {
    expect(normalizeReorderEntry({ id: 'tab-1', folder: 'Org' })).toEqual({
      id: 'tab-1',
      folder: 'Org',
    });
  });

  it('trims surrounding whitespace from the folder name', () => {
    expect(normalizeReorderEntry({ id: 'tab-1', folder: '  Org ' }).folder).toBe('Org');
  });

  it('collapses empty / whitespace / null / undefined folder to null (no blank folders persist)', () => {
    expect(normalizeReorderEntry({ id: 'tab-1', folder: '' }).folder).toBeNull();
    expect(normalizeReorderEntry({ id: 'tab-1', folder: '   ' }).folder).toBeNull();
    expect(normalizeReorderEntry({ id: 'tab-1', folder: null }).folder).toBeNull();
    expect(normalizeReorderEntry({ id: 'tab-1' }).folder).toBeNull();
  });
});

// Every write of a tab advances its revision (docs/specs/024-agents/agent-changesets.md "The tab
// revision"), and the trigger refuses a data write that does not (CS3). Real SQLite, every migration.
describe('tab revisions', () => {
  const tab = (id: string, label = 'x'): Tab => ({
    id,
    name: 'Board',
    elements: [
      { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, label },
    ],
  });

  function documentWith(): SqliteD1 {
    const db = sqliteD1();
    db.sql.exec(`INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
                 VALUES ('D', 'o', 'Doc', 0, 1, 1)`);
    return db;
  }
  const revOf = (db: SqliteD1, id: string) =>
    db.sql.prepare('SELECT rev FROM tabs WHERE id = ?').get(id)!.rev as number;

  it('seeds at 1, and a retried seed advances', async () => {
    const db = documentWith();
    await seedTabs(db.env, 'D', [tab('t1')]);
    expect(revOf(db, 't1')).toBe(1);
    await seedTabs(db.env, 'D', [tab('t1', 'y')]);
    expect(revOf(db, 't1')).toBe(2);
  });

  it('upserts at 1 and advances on every save, answering the new revision', async () => {
    const db = documentWith();
    expect(await upsertTab(db.env, 'D', tab('t1'), 0)).toBe(1);
    expect(await upsertTab(db.env, 'D', tab('t1', 'y'), 0)).toBe(2);
    expect(revOf(db, 't1')).toBe(2);
  });

  it('writes at an expected revision and refuses a stale one, writing nothing', async () => {
    const db = documentWith();
    expect(await upsertTabAtRev(db.env, 'D', tab('t1'), 0, 0)).toBe(1);
    expect(await upsertTabAtRev(db.env, 'D', tab('t1', 'y'), 0, 1)).toBe(2);
    await expect(upsertTabAtRev(db.env, 'D', tab('t1', 'z'), 0, 1)).rejects.toThrow(
      'tab_rev_stale',
    );
    expect(revOf(db, 't1')).toBe(2);
    expect(
      JSON.parse(db.sql.prepare("SELECT data FROM tabs WHERE id = 't1'").get()!.data as string),
    ).toMatchObject({ elements: [{ label: 'y' }] });
    expect(isTabRevStale(new Error('D1_ERROR: tab_rev_stale: SQLITE_CONSTRAINT'))).toBe(true);
  });

  it('advances on a rename, a board swap and a copy starts at 1', async () => {
    const db = documentWith();
    await upsertTab(db.env, 'D', tab('t1'), 0);
    await renameTab(db.env, 't1', 'Renamed');
    expect(revOf(db, 't1')).toBe(2);
    const data = db.sql.prepare("SELECT data FROM tabs WHERE id = 't1'").get()!.data as string;
    expect(
      await swapTabData(
        db.env,
        'D',
        't1',
        data,
        '{"elements":[]}',
        tabStatsOfData('{"elements":[]}').stats,
      ),
    ).toBe(true);
    expect(revOf(db, 't1')).toBe(3);
    await copyDocument(db.env, 'D', 'D2', 'o', 'Copy');
    const copied = db.sql
      .prepare(
        "SELECT t.rev FROM tabs t JOIN document_tabs dt ON dt.tab_id = t.id WHERE dt.document_id = 'D2'",
      )
      .get()!;
    expect(copied.rev).toBe(1);
  });

  it('reads the revision with the tab', async () => {
    const db = documentWith();
    await upsertTab(db.env, 'D', tab('t1'), 0);
    await upsertTab(db.env, 'D', tab('t1', 'y'), 0);
    expect((await getTab(db.env, 'D', 't1'))?.rev).toBe(2);
  });

  it('aborts a data write that does not advance the revision', async () => {
    const db = documentWith();
    await upsertTab(db.env, 'D', tab('t1'), 0);
    expect(() => db.sql.exec("UPDATE tabs SET data = '{}' WHERE id = 't1'")).toThrow(
      'tab_rev_stale',
    );
  });
});
