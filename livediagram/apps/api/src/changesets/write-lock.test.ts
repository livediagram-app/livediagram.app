import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, ShapeElement } from '@livediagram/document';
import { collabKeyFor } from '@liveworkspace/api-kit/collab-key';
import { seedTabs } from '../db/tabs';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { readStoredTab } from './stored-tab';
import { writeChangeset } from './write';

// A changeset writes the tab whole, so it is locked like a save (docs/specs/013-workspace/share-roles.md "The collab
// key"): a token changes nobody's answers, a person's own revert only theirs. The room here never answers the lock's
// read, so the stored entries stand (the lock fails closed).

const card = (responses: { participantId: string; value: string; at: number }[]): Element => ({
  id: 'card',
  type: 'shape',
  shape: 'estimate',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  responses,
});
const answer = (participantId: string, value = '3') => ({ participantId, value, at: 1 });

const room = {
  idFromName: (name: string) => name,
  get: () => ({
    fetch: async (url: string) =>
      url.includes('/ledger-entries')
        ? new Response('gone', { status: 503 })
        : new Response(null, { status: 204 }),
  }),
};

async function setUp(): Promise<SqliteD1> {
  const db = sqliteD1({ DOCUMENT_ROOM: room } as unknown as Partial<Env>);
  db.sql.exec(`INSERT INTO test_documents (id, owner_id, name, saved_at, created_at)
               VALUES ('D', 'user_o', 'Doc', 1, 1)`);
  await seedTabs(db.env, 'D', [{ id: 't1', name: 'T', elements: [card([answer('bo')])] }]);
  return db;
}

async function write(db: SqliteD1, responses: ReturnType<typeof answer>[], tokenId: string | null) {
  const stored = (await readStoredTab(db.env, 'D', 't1'))!;
  const outcome = await writeChangeset(db.env, {
    documentId: 'D',
    tabId: 't1',
    stored,
    next: { ...stored.tab, elements: [{ ...card(responses), label: 'moved' }] },
    orderIndex: stored.orderIndex,
    author: { id: 'user_o', name: 'O', color: '#000' },
    tokenId,
    summary: null,
    baseRev: stored.rev,
    rebasedOver: 0,
    prevRev: null,
    results: [],
    textFor: () => '',
    revertOf: null,
  });
  expect(outcome.kind).toBe('written');
  return ((await readStoredTab(db.env, 'D', 't1'))!.tab.elements[0] as ShapeElement).responses;
}

afterEach(() => vi.restoreAllMocks());

describe('writeChangeset: the whole-tab lock', () => {
  it("lets a token change nobody's answer, and keeps the stored ones when the room can't answer", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await setUp();
    const mine = await collabKeyFor('user_o');
    expect(await write(db, [answer(mine), answer('bo', '8'), answer('forged')], 'tok_1')).toEqual([
      answer('bo'),
    ]);
    expect(warn).toHaveBeenCalledWith(
      '[whole-tab-lock] ledger-unavailable',
      expect.objectContaining({ documentId: 'D', tabId: 't1', write: 'changeset' }),
    );
  });

  it("lets a person's own changeset change their answer only", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await setUp();
    const mine = await collabKeyFor('user_o');
    expect(await write(db, [answer(mine, '5')], null)).toEqual([answer(mine, '5'), answer('bo')]);
  });
});
