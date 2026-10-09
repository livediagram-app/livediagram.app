import { itemPersonId } from '@livediagram/items';
import { describe, expect, it } from 'vitest';
import type { Runtime } from '../types';
import { cardsFromRows, readerPersonIds, type CardRow } from './plan-board-index';

// The edges of the Activity page's card read (docs/specs/013-workspace/activity-page.md §2.4) that the
// real-SQLite tests in activity-cards.test.ts cannot reach: a D1 answer without results, and a row whose
// fields hold no title or status.

const row = (over: Partial<CardRow> = {}): CardRow => ({
  document_id: 'd1',
  id: 'it1',
  item_key: 7,
  type: 'task',
  updated_at: 5,
  title: 'Ship it',
  status: 'todo',
  document_name: 'Roadmap',
  document_team_id: null,
  via: 'shared',
  share_code: 'c1',
  board: null,
  ...over,
});

describe('cardsFromRows', () => {
  it('maps a row to the wire shape, parsing its board', () => {
    const board = { tabId: 't1', tabName: 'Plan', elementId: 'b1', title: 'Sprint' };
    expect(cardsFromRows([row({ board: JSON.stringify(board) })])).toEqual([
      {
        documentId: 'd1',
        documentName: 'Roadmap',
        teamId: null,
        via: 'shared',
        shareCode: 'c1',
        board,
        id: 'it1',
        key: 7,
        type: 'task',
        title: 'Ship it',
        status: 'todo',
        updatedAt: 5,
      },
    ]);
  });

  it('reads a missing title as empty and a missing status as none, and keeps a share code off other rows', () => {
    const [card] = cardsFromRows([row({ title: null, status: null, via: 'own', share_code: 'x' })]);
    expect(card).toMatchObject({ title: '', status: null, shareCode: null, board: null });
  });
});

describe('readerPersonIds', () => {
  const env = (results: { alias_id: string }[] | undefined) =>
    ({
      db: { prepare: () => ({ bind: () => ({ all: async () => ({ results }) }) }) },
    }) as unknown as Runtime;

  it('hashes the reader and every identity they used to be', async () => {
    expect(await readerPersonIds(env([{ alias_id: 'guest-1' }]), 'user-1')).toEqual([
      await itemPersonId('user-1'),
      await itemPersonId('guest-1'),
    ]);
  });

  it('is the reader alone when D1 answers without results', async () => {
    expect(await readerPersonIds(env(undefined), 'user-1')).toEqual([await itemPersonId('user-1')]);
  });
});
