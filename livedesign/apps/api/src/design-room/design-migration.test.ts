// The migration door into a design's room (design-migration.ts): a first write with the design's own columns, an
// unchanged re-run replaced, a new-side edit kept.
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nodeDurableState } from '@liveworkspace/index-app/testing';
import type { MigrationRoomPayload } from '@liveworkspace/migration';
import type { Env } from '../types';
import { DesignRoom } from './design-room';

function open(name = 'G') {
  const { state, db, counter } = nodeDurableState(name);
  const env = { INDEX_ORIGIN: 'https://index.test' } as unknown as Env;
  return { room: new DesignRoom(state as unknown as DurableObjectState, env), db, counter };
}

const data = (label: string) =>
  JSON.stringify({
    opensIn: 'pages',
    pages: [{ id: 'p1', kind: 'logo', size: 'logo' }],
    elements: [{ id: 'e', type: 'text', x: 0, y: 0, width: 10, height: 10, text: label }],
  });

function payload(over: Partial<MigrationRoomPayload> = {}): MigrationRoomPayload {
  return {
    v: 1,
    app: 'livedesign',
    id: 'G',
    name: 'Logo',
    ownerId: 'user_ali',
    teamId: null,
    createdAt: 100,
    savedAt: 300,
    source: null,
    presentation: '{"slides":[]}',
    opensIn: 'pages',
    tabKind: 'logo',
    tabs: [
      {
        id: 't1',
        name: 'Logo',
        orderIndex: 0,
        folder: null,
        addedAt: 100,
        updatedAt: 200,
        data: data('v1'),
        elementCount: 1,
      },
    ],
    changesets: [],
    imageGrants: [],
    imageOwners: [],
    plan: null,
    ...over,
  };
}

const one = (db: DatabaseSync, sql: string) => ({ ...db.prepare(sql).get() });

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('importMigrated (the migration door into a design)', () => {
  it('writes the design row with its opens-in and kind, and its tab, in one transaction, leaving any deck behind', async () => {
    const r = open();
    const before = r.counter.transactions;
    expect(await r.room.importMigrated('G', payload())).toEqual({
      written: ['t1'],
      edited: [],
      meta: true,
    });
    expect(r.counter.transactions - before).toBe(1);
    expect(
      one(r.db, 'SELECT name, presentation, opens_in, tab_kind, created_at, saved_at FROM design'),
    ).toEqual({
      name: 'Logo',
      presentation: null,
      opens_in: 'pages',
      tab_kind: 'logo',
      created_at: 100,
      saved_at: 300,
    });
    expect(one(r.db, 'SELECT rev FROM tabs').rev).toBe(1);
  });

  it('replaces an unchanged re-run and leaves a tab edited on the new side', async () => {
    const r = open();
    await r.room.importMigrated('G', payload());
    const again = payload({ tabs: [{ ...payload().tabs[0]!, data: data('v2') }] });
    expect((await r.room.importMigrated('G', again)).written).toEqual(['t1']);
    expect(one(r.db, 'SELECT rev FROM tabs').rev).toBe(2);
    r.db.exec(`UPDATE tabs SET data = '{"elements":[]}', rev = rev + 1`);
    const third = payload({ tabs: [{ ...payload().tabs[0]!, data: data('v3') }] });
    expect(await r.room.importMigrated('G', third)).toMatchObject({ written: [], edited: ['t1'] });
    expect(one(r.db, 'SELECT data FROM tabs').data).toBe('{"elements":[]}');
  });
});
