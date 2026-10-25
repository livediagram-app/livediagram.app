// The migration door into a document's room (document-migration.ts): a first write with the document's own columns, an
// unchanged re-run replaced, a new-side edit kept.
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nodeDurableState } from '@liveworkspace/index-app/testing';
import type { MigrationRoomPayload } from '@liveworkspace/migration';
import type { Env } from '../types';
import { DocumentRoom } from './document-room';

function open(name = 'D') {
  const { state, db, counter } = nodeDurableState(name);
  const env = { INDEX_ORIGIN: 'https://index.test' } as unknown as Env;
  return { room: new DocumentRoom(state as unknown as DurableObjectState, env), db, counter };
}

const data = (label: string) =>
  JSON.stringify({
    opensIn: 'pages',
    pages: [{ id: 'p1', kind: 'article', size: 'a4' }],
    elements: [{ id: 'e', type: 'text', x: 0, y: 0, width: 10, height: 10, text: label }],
  });

function payload(over: Partial<MigrationRoomPayload> = {}): MigrationRoomPayload {
  return {
    v: 1,
    app: 'livedocuments',
    id: 'D',
    name: 'Article',
    ownerId: 'user_ali',
    teamId: null,
    createdAt: 100,
    savedAt: 300,
    source: null,
    presentation: '{"slides":[]}',
    opensIn: null,
    tabKind: null,
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

describe('importMigrated (the migration door into a document)', () => {
  it('writes the document row with its deck, and its tab, in one transaction', async () => {
    const r = open();
    const before = r.counter.transactions;
    expect(await r.room.importMigrated('D', payload())).toEqual({
      written: ['t1'],
      edited: [],
      meta: true,
    });
    expect(r.counter.transactions - before).toBe(1);
    expect(
      one(r.db, 'SELECT name, presentation, created_at, saved_at FROM document'),
    ).toEqual({
      name: 'Article',
      presentation: '{"slides":[]}',
      created_at: 100,
      saved_at: 300,
    });
    expect(one(r.db, 'SELECT rev FROM tabs').rev).toBe(1);
  });

  it('replaces an unchanged re-run and leaves a tab edited on the new side', async () => {
    const r = open();
    await r.room.importMigrated('D', payload());
    const again = payload({ tabs: [{ ...payload().tabs[0]!, data: data('v2') }] });
    expect((await r.room.importMigrated('D', again)).written).toEqual(['t1']);
    expect(one(r.db, 'SELECT rev FROM tabs').rev).toBe(2);
    r.db.exec(`UPDATE tabs SET data = '{"elements":[]}', rev = rev + 1`);
    const third = payload({ tabs: [{ ...payload().tabs[0]!, data: data('v3') }] });
    expect(await r.room.importMigrated('D', third)).toMatchObject({ written: [], edited: ['t1'] });
    expect(one(r.db, 'SELECT data FROM tabs').data).toBe('{"elements":[]}');
  });
});
