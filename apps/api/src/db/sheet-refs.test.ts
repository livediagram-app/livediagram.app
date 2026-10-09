import { beforeEach, describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { copyDocument } from './documents';
import { sheetRefIds } from './sheet-refs';
import { deleteTabRow, upsertTab } from './tabs';

// The sheet reference index (docs/specs/029-sheets/sheet-store.md "Deleting a sheet"): every tab write keeps it, a
// copy not yet made keeps its source, references count only within their document, and the document's sheets
// settle on every write.

let sql: SqliteD1;

const sheetEl = (id: string, sheetId: string, copyOf?: string) =>
  ({
    id,
    type: 'shape',
    shape: 'plan-sheet',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    planSheet: { sheetId, ...(copyOf ? { copyOf } : {}) },
  }) as unknown as Element;

const tab = (id: string, elements: Element[]): Tab => ({ id, name: id, elements }) as Tab;

const sheetRow = (doc: string, id: string, tabId: string, extra = '') =>
  sql.sql.exec(
    `INSERT INTO sheets (document_id, id, tab_id, title, layout, rev, created_at, updated_at, updated_by${extra ? ', delete_when_unreferenced' : ''})
     VALUES ('${doc}', '${id}', '${tabId}', '${id}', '{"rows":[],"cols":[]}', 0, 1, 1, '{}'${extra ? `, ${extra}` : ''})`,
  );

const state = (doc: string, id: string) =>
  sql.sql
    .prepare(
      'SELECT unreferenced_since AS since, delete_when_unreferenced AS del FROM sheets WHERE document_id = ? AND id = ?',
    )
    .get(doc, id) as { since: number | null; del: number | null } | undefined;

const refs = (tabId: string) =>
  (
    sql.sql
      .prepare('SELECT sheet_id FROM sheet_refs WHERE tab_id = ? ORDER BY sheet_id')
      .all(tabId) as { sheet_id: string }[]
  ).map((r) => r.sheet_id);

beforeEach(() => {
  sql = sqliteD1();
  sql.sql.exec(`
    INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d1', 'o', 'D', 0, 1, 1);
    INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d2', 'o', 'E', 0, 1, 1);
  `);
});

describe('sheetRefIds', () => {
  it('takes every Sheet’s sheet and every copy’s source, once', () => {
    const els = [
      sheetEl('e1', 'sheetA00'),
      sheetEl('e2', 'sheetB00', 'sheetA00'),
      sheetEl('e3', 'sheetA00'),
      { id: 'x', type: 'shape', shape: 'rect' } as unknown as Element,
      { id: 'y', type: 'shape', shape: 'plan-sheet' } as unknown as Element,
    ];
    expect(sheetRefIds(els).sort()).toEqual(['sheetA00', 'sheetB00']);
  });
});

describe('the reference index on tab writes', () => {
  it('notes a sheet the moment it is unreferenced, and clears it when referenced again', async () => {
    sheetRow('d1', 'sheetA00', 't1');
    sheetRow('d1', 'sheetC00', 't1');
    await upsertTab(sql.env, 'd1', tab('t1', [sheetEl('e1', 'sheetA00')]), 0);
    expect(refs('t1')).toEqual(['sheetA00']);
    expect(state('d1', 'sheetA00')!.since).toBeNull();
    // A write whose references leave C alone settles nothing about it (its create noted it).
    expect(state('d1', 'sheetC00')!.since).toBeNull();
    await upsertTab(sql.env, 'd1', tab('t1', []), 0);
    expect(refs('t1')).toEqual([]);
    const noted = state('d1', 'sheetA00')!.since;
    expect(noted).toEqual(expect.any(Number));
    // A later write keeps the first moment.
    await upsertTab(sql.env, 'd1', tab('t1', []), 0);
    expect(state('d1', 'sheetA00')!.since).toBe(noted);
    await upsertTab(sql.env, 'd1', tab('t1', [sheetEl('e1', 'sheetA00')]), 0);
    expect(state('d1', 'sheetA00')!.since).toBeNull();
  });

  it('keeps a sheet a copy not yet made on another tab still needs (a duplicated tab)', async () => {
    sheetRow('d1', 'sheetA00', 't1');
    await upsertTab(sql.env, 'd1', tab('t1', [sheetEl('e1', 'sheetA00')]), 0);
    await upsertTab(sql.env, 'd1', tab('t2', [sheetEl('e2', 'sheetB00', 'sheetA00')]), 1);
    await upsertTab(sql.env, 'd1', tab('t1', []), 0);
    expect(state('d1', 'sheetA00')!.since).toBeNull();
    // The copy is made: its mark drops, and the original is now unreferenced.
    await upsertTab(sql.env, 'd1', tab('t2', [sheetEl('e2', 'sheetB00')]), 1);
    expect(state('d1', 'sheetA00')!.since).toEqual(expect.any(Number));
  });

  it('deletes a sheet deleted with its element once its last reference goes, and only then', async () => {
    sheetRow('d1', 'sheetA00', 't1', '1');
    sql.sql.exec(
      `INSERT INTO sheet_cells (document_id, sheet_id, row_id, col_id, input) VALUES ('d1', 'sheetA00', 'r', 'c', '1')`,
    );
    await upsertTab(sql.env, 'd1', tab('t1', [sheetEl('e1', 'sheetA00')]), 0);
    await upsertTab(sql.env, 'd1', tab('t2', [sheetEl('e2', 'sheetA00')]), 1);
    await upsertTab(sql.env, 'd1', tab('t1', []), 0);
    expect(state('d1', 'sheetA00')).toBeDefined();
    await upsertTab(sql.env, 'd1', tab('t2', []), 1);
    expect(state('d1', 'sheetA00')).toBeUndefined();
    expect(sql.sql.prepare('SELECT COUNT(*) AS n FROM sheet_cells').get()).toEqual({ n: 0 });
  });

  it('counts references only within the sheet’s own document', async () => {
    sheetRow('d1', 'sheetA00', 't1');
    sheetRow('d2', 'sheetA00', 'u1');
    await upsertTab(sql.env, 'd1', tab('t1', [sheetEl('e1', 'sheetA00')]), 0);
    await upsertTab(sql.env, 'd2', tab('u1', [sheetEl('e1', 'sheetA00')]), 0);
    await upsertTab(sql.env, 'd1', tab('t1', []), 0);
    expect(state('d1', 'sheetA00')!.since).toEqual(expect.any(Number));
    expect(state('d2', 'sheetA00')!.since).toBeNull();
  });

  it('notes a removed tab’s sheets', async () => {
    sheetRow('d1', 'sheetA00', 't1');
    await upsertTab(sql.env, 'd1', tab('t1', [sheetEl('e1', 'sheetA00')]), 0);
    await deleteTabRow(sql.env, 'd1', 't1');
    expect(refs('t1')).toEqual([]);
    expect(state('d1', 'sheetA00')!.since).toEqual(expect.any(Number));
  });

  it('carries the references to a copied document’s tabs', async () => {
    sheetRow('d1', 'sheetA00', 't1');
    await upsertTab(sql.env, 'd1', tab('t1', [sheetEl('e1', 'sheetA00')]), 0);
    await copyDocument(sql.env, 'd1', 'd3', 'o', 'Copy');
    const copied = sql.sql
      .prepare(`SELECT tab_id FROM document_tabs WHERE document_id = 'd3'`)
      .get() as { tab_id: string };
    expect(refs(copied.tab_id)).toEqual(['sheetA00']);
    expect(state('d3', 'sheetA00')!.since).toBeNull();
  });
});
