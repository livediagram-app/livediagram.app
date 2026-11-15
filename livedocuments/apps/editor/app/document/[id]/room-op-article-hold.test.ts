import { afterEach, describe, expect, it } from 'vitest';
import type { RoomOp } from '@livedocuments/api-schema';
import type { PresenceCoalescer } from '@liveworkspace/workbench/lib/presence-coalescer';
import {
  articleHoldsOf,
  resetArticleHoldsForTests,
  setArticleHoldsTab,
  syncArticleHolders,
} from '@/lib/article/article-holds-store';
import { receiveRoomOp } from './room-op-receive';
import type { RoomConnectionOptions } from './useRoomConnection.types';

// A collaborator's paragraph hold arriving from the room (docs/specs/007-editor/article-pages.md "Holding a
// paragraph"): checked field by field, then kept for the writing to outline; a malformed one is dropped.

const receive = (op: unknown) =>
  receiveRoomOp(
    'ann',
    op as RoomOp,
    {} as PresenceCoalescer,
    { markSeen: () => {} } as unknown as RoomConnectionOptions,
    { current: new Map() },
  );

afterEach(() => resetArticleHoldsForTests());

describe('a received article-hold', () => {
  it('keeps a well-formed hold under its sender, and drops a malformed one', () => {
    setArticleHoldsTab('t');
    syncArticleHolders([{ id: 'ann', name: 'Ann', color: '#f00' }]);
    receive({ kind: 'article-hold', tabId: 't', flow: 'f', blockId: 'b', row: 'r' });
    expect(articleHoldsOf('f')).toEqual([]);
    receive({ kind: 'article-hold', tabId: 't', flow: 'f', blockId: 'b' });
    expect(articleHoldsOf('f')).toEqual([{ id: 'ann', name: 'Ann', color: '#f00', blockId: 'b' }]);
  });
});
