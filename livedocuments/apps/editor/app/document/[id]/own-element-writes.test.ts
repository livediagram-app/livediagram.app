import { describe, expect, it } from 'vitest';
import type { Element, RoomElementOp } from '@livedocuments/document';
import type { RoomOp } from '@livedocuments/api-schema';
import type { ArticleOp } from '@livedocuments/document';
import {
  createOwnElementWrites,
  holdOwnRoomWrites,
  isSupersededByOwnWrite,
  withoutSupersededArticleOps,
} from './own-element-writes';

// docs/specs/012-collaboration/realtime-conflict-resolution.md "Same-element edits converge".

const el = (id: string) =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 }) as Element;
const update = (id: string, tabId = 't1'): RoomOp => ({
  kind: 'el',
  tabId,
  op: { kind: 'update', element: el(id) },
});

const els = (tabId: string, ops: RoomElementOp[]): RoomOp[] =>
  ops.map((op) => ({ kind: 'el', tabId, op }));

describe('own element writes', () => {
  it('holds what our ops add or update, on their tab, until released', () => {
    const writes = createOwnElementWrites();
    const release = holdOwnRoomWrites(
      writes,
      els('t1', [
        { kind: 'update', element: el('a') },
        { kind: 'add', element: el('b'), at: 0 },
        { kind: 'remove', id: 'c' },
      ]),
    );
    expect(isSupersededByOwnWrite(writes, update('a'))).toBe(true);
    expect(isSupersededByOwnWrite(writes, update('b'))).toBe(true);
    expect(isSupersededByOwnWrite(writes, update('c'))).toBe(false);
    expect(isSupersededByOwnWrite(writes, update('a', 't2'))).toBe(false);
    release();
    expect(isSupersededByOwnWrite(writes, update('a'))).toBe(false);
  });

  it('holds back only a peer update or patch, never a remove, an add or another kind of op', () => {
    const writes = createOwnElementWrites();
    holdOwnRoomWrites(writes, els('t1', [{ kind: 'update', element: el('a') }]));
    expect(
      isSupersededByOwnWrite(writes, {
        kind: 'el',
        tabId: 't1',
        op: { kind: 'patch', id: 'a', set: { x: 3 } },
      }),
    ).toBe(true);
    expect(
      isSupersededByOwnWrite(writes, { kind: 'el', tabId: 't1', op: { kind: 'remove', id: 'a' } }),
    ).toBe(false);
    expect(
      isSupersededByOwnWrite(writes, {
        kind: 'el',
        tabId: 't1',
        op: { kind: 'add', element: el('a'), at: 0 },
      }),
    ).toBe(false);
    expect(isSupersededByOwnWrite(writes, { kind: 'tab-meta', tabId: 't1', patch: {} })).toBe(
      false,
    );
  });

  it('counts overlapping saves, and a release twice frees once', () => {
    const writes = createOwnElementWrites();
    const first = holdOwnRoomWrites(writes, els('t1', [{ kind: 'update', element: el('a') }]));
    const second = holdOwnRoomWrites(writes, els('t1', [{ kind: 'update', element: el('a') }]));
    first();
    first();
    expect(isSupersededByOwnWrite(writes, update('a'))).toBe(true);
    second();
    expect(isSupersededByOwnWrite(writes, update('a'))).toBe(false);
    expect(writes.held.size).toBe(0);
  });

  it('reads a malformed peer op as not ours', () => {
    const writes = createOwnElementWrites();
    holdOwnRoomWrites(writes, els('t1', [{ kind: 'update', element: el('a') }]));
    expect(
      isSupersededByOwnWrite(writes, {
        kind: 'el',
        tabId: 't1',
        op: { kind: 'update', element: null },
      } as unknown as RoomOp),
    ).toBe(false);
  });
});

// docs/specs/007-editor/article-pages.md "Collaboration": the same, block by block and cell by cell.
describe('own article writes', () => {
  const para = (id: string, text: string) => ({
    id,
    type: 'paragraph' as const,
    runs: [{ text }],
  });
  const writing = (ops: ArticleOp[], tabId = 't1', flow = 'f1'): RoomOp => ({
    kind: 'article',
    tabId,
    flow,
    ops,
  });
  const cell = (row: string, text: string): ArticleOp => ({
    kind: 'cell',
    block: 'tb',
    row,
    col: 'c1',
    runs: [{ text }],
  });

  it('leaves out a peer put, in place, of a block we are writing until the room confirms ours', () => {
    const writes = createOwnElementWrites();
    const release = holdOwnRoomWrites(writes, [
      writing([{ kind: 'put', block: para('p1', 'ours') }]),
    ]);
    const peer = writing([
      { kind: 'put', block: para('p1', 'theirs') },
      { kind: 'put', block: para('p2', 'other block') },
    ]);
    expect(withoutSupersededArticleOps(writes, peer)).toEqual(
      writing([{ kind: 'put', block: para('p2', 'other block') }]),
    );
    expect(
      withoutSupersededArticleOps(writes, writing([{ kind: 'put', block: para('p1', 'x') }])),
    ).toBeNull();
    // Another article, another tab: not ours.
    const elsewhere = writing([{ kind: 'put', block: para('p1', 'x') }], 't1', 'f2');
    expect(withoutSupersededArticleOps(writes, elsewhere)).toBe(elsewhere);
    release();
    expect(withoutSupersededArticleOps(writes, peer)).toBe(peer);
  });

  it('keeps a peer put that moves the block, a remove, the style and another kind of op', () => {
    const writes = createOwnElementWrites();
    holdOwnRoomWrites(writes, [writing([{ kind: 'put', block: para('p1', 'ours') }])]);
    const moved = writing([{ kind: 'put', block: para('p1', 'theirs'), after: null }]);
    expect(withoutSupersededArticleOps(writes, moved)).toBe(moved);
    const removed = writing([{ kind: 'remove', id: 'p1' }, { kind: 'style' }]);
    expect(withoutSupersededArticleOps(writes, removed)).toBe(removed);
    const meta: RoomOp = { kind: 'tab-meta', tabId: 't1', patch: {} };
    expect(withoutSupersededArticleOps(writes, meta)).toBe(meta);
    const gone: RoomOp = { kind: 'article', tabId: 't1', flow: 'f1', removed: true };
    expect(withoutSupersededArticleOps(writes, gone)).toBe(gone);
  });

  it('holds a table cell by cell', () => {
    const writes = createOwnElementWrites();
    holdOwnRoomWrites(writes, [writing([cell('r1', 'ours')])]);
    expect(withoutSupersededArticleOps(writes, writing([cell('r1', 'theirs')]))).toBeNull();
    const otherCell = writing([cell('r2', 'theirs')]);
    expect(withoutSupersededArticleOps(writes, otherCell)).toBe(otherCell);
  });

  it('reads a malformed peer op as not ours', () => {
    const writes = createOwnElementWrites();
    holdOwnRoomWrites(writes, [writing([{ kind: 'put', block: para('p1', 'ours') }])]);
    const junk = writing([null, { kind: 'put', block: null }] as unknown as ArticleOp[]);
    expect(withoutSupersededArticleOps(writes, junk)).toBe(junk);
  });
});
