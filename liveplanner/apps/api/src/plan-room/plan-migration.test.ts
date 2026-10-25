// The migration door into a plan's room (plan-migration.ts): its Plan rows beside the kit's tab rule. Sheets go in
// before the `sheet_refs` that name them, cards keep their keys and the next key only moves up, and a re-run leaves
// what the new side changed.
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nodeDurableState } from '@liveworkspace/index-app/testing';
import type { MigrationPlanData, MigrationRoomPayload } from '@liveworkspace/migration';
import type { Env } from '../types';
import { PlanRoom } from './plan-room';

function open(name = 'P') {
  const { state, db, counter } = nodeDurableState(name);
  const env = { INDEX_ORIGIN: 'https://index.test' } as unknown as Env;
  return { room: new PlanRoom(state as unknown as DurableObjectState, env), db, counter };
}

const sheetTab = (sheetId: string) =>
  JSON.stringify({
    kind: 'sheet',
    elements: [
      {
        id: 'sh-el',
        type: 'shape',
        shape: 'plan-sheet',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        planSheet: { sheetId },
      },
    ],
  });

function planOf(over: Partial<MigrationPlanData> = {}): MigrationPlanData {
  return {
    itemTypes: '{"task":{"name":"Task"}}',
    itemTypesRev: 2,
    itemsRev: 5,
    itemsNextKey: 3,
    items: [1, 2].map((key) => ({
      id: `i${key}`,
      type: 'task',
      itemKey: key,
      rank: `a${key}`,
      fields: '{"title":"Card"}',
      rev: 1,
      createdAt: 100,
      updatedAt: 200,
      createdBy: 'p-ali',
      updatedBy: null,
    })),
    sheets: [
      {
        id: 'sheet1',
        tabId: 'tab-sheet',
        title: 'Budget',
        layout: '{}',
        rev: 3,
        createdAt: 100,
        updatedAt: 200,
        updatedBy: null,
      },
    ],
    cells: [
      { sheetId: 'sheet1', rowId: 'r1', colId: 'c1', input: '42', format: null },
      { sheetId: 'sheet1', rowId: 'r1', colId: 'c2', input: '=c1*2', format: null },
    ],
    formLinks: [
      {
        code: 'form-code',
        tabId: 'tab-sheet',
        open: 1,
        createdAt: 100,
        responses: 4,
        lastResponseAt: 150,
      },
    ] as MigrationPlanData['formLinks'],
    ...over,
  };
}

function payload(over: Partial<MigrationRoomPayload> = {}): MigrationRoomPayload {
  return {
    v: 1,
    app: 'liveplanner',
    id: 'P',
    name: 'Old plan',
    ownerId: 'user_ali',
    teamId: null,
    createdAt: 100,
    savedAt: 300,
    source: null,
    presentation: null,
    opensIn: 'plan',
    tabKind: 'sheet',
    tabs: [
      {
        id: 'tab-sheet',
        name: 'Sheet',
        orderIndex: 0,
        folder: null,
        addedAt: 100,
        updatedAt: 200,
        data: sheetTab('sheet1'),
        elementCount: 1,
      },
    ],
    changesets: [],
    imageGrants: [{ imageId: 'img', createdAt: 1 }],
    imageOwners: [{ imageId: 'img', owner: 'user_ali' }],
    plan: planOf(),
    ...over,
  };
}

const rows = (db: DatabaseSync, sql: string) => db.prepare(sql).all().map((r) => ({ ...r }));
const one = (db: DatabaseSync, sql: string) => ({ ...db.prepare(sql).get() });

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('importMigrated (the migration door into a plan)', () => {
  it('writes the plan, its cards, its sheet before the sheet’s reference, cells and form links, in one transaction', async () => {
    const r = open();
    const before = r.counter.transactions;
    const answer = await r.room.importMigrated('P', payload());
    expect(answer).toEqual({ written: ['tab-sheet'], edited: [], meta: true });
    expect(r.counter.transactions - before).toBe(1);
    expect(
      one(
        r.db,
        'SELECT name, opens_in, tab_kind, item_types_rev, items_rev, items_next_key, created_at, saved_at FROM plan',
      ),
    ).toEqual({
      name: 'Old plan',
      opens_in: 'plan',
      tab_kind: 'sheet',
      item_types_rev: 2,
      items_rev: 5,
      items_next_key: 3,
      created_at: 100,
      saved_at: 300,
    });
    expect(rows(r.db, 'SELECT id, item_key, created_by, updated_by FROM items ORDER BY id')).toEqual([
      { id: 'i1', item_key: 1, created_by: 'p-ali', updated_by: '' },
      { id: 'i2', item_key: 2, created_by: 'p-ali', updated_by: '' },
    ]);
    // The reference found its sheet: the sheet is referenced, its counts settled.
    expect(
      one(r.db, "SELECT title, rev, cell_count, unreferenced_since FROM sheets WHERE id = 'sheet1'"),
    ).toEqual({ title: 'Budget', rev: 3, cell_count: 2, unreferenced_since: null });
    expect(rows(r.db, 'SELECT tab_id, sheet_id FROM sheet_refs')).toEqual([
      { tab_id: 'tab-sheet', sheet_id: 'sheet1' },
    ]);
    expect(one(r.db, 'SELECT code, responses FROM form_links')).toEqual({
      code: 'form-code',
      responses: 4,
    });
    expect(rows(r.db, 'SELECT kind FROM outbox ORDER BY kind').map((o) => o.kind)).toEqual(
      expect.arrayContaining(['summary', 'tab']),
    );
  });

  it('takes a cards-only part with no tabs', async () => {
    const r = open();
    const answer = await r.room.importMigrated(
      'P',
      payload({ tabs: [], plan: planOf({ sheets: [], cells: [], formLinks: [] }) }),
    );
    expect(answer).toEqual({ written: [], edited: [], meta: true });
    expect(one(r.db, 'SELECT COUNT(*) AS n FROM items').n).toBe(2);
  });

  it('replaces an unchanged re-run and keeps what the new side changed', async () => {
    const r = open();
    await r.room.importMigrated('P', payload());
    // On the new side: card i2 edited, a card made with the next key, a cell changed.
    r.db.exec(`UPDATE items SET fields = '{"title":"Mine"}', rev = rev + 1 WHERE id = 'i2'`);
    r.db.exec(
      `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
       VALUES ('P', 'new', 'task', 3, 'b', '{}', 1, 1, 1, '', '')`,
    );
    const next = planOf({
      itemsNextKey: 3,
      items: planOf().items.map((i) => ({ ...i, fields: '{"title":"Old side"}' })),
      cells: [{ sheetId: 'sheet1', rowId: 'r1', colId: 'c1', input: '43', format: null }],
    });
    const answer = await r.room.importMigrated('P', payload({ plan: next }));
    expect(answer.written).toEqual(['tab-sheet']);
    expect(rows(r.db, 'SELECT id, fields, rev FROM items ORDER BY id')).toEqual([
      { id: 'i1', fields: '{"title":"Old side"}', rev: 2 },
      { id: 'i2', fields: '{"title":"Mine"}', rev: 2 },
      { id: 'new', fields: '{}', rev: 1 },
    ]);
    // The next key moved past every card the plan holds.
    expect(one(r.db, 'SELECT items_next_key FROM plan').items_next_key).toBe(4);
    expect(one(r.db, `SELECT input FROM sheet_cells WHERE col_id = 'c1'`).input).toBe('43');
    // A cell the old side no longer sends stays: nothing is removed.
    expect(one(r.db, 'SELECT COUNT(*) AS n FROM sheet_cells').n).toBe(2);
    expect(one(r.db, 'SELECT COUNT(*) AS n FROM form_links').n).toBe(1);
  });
});
