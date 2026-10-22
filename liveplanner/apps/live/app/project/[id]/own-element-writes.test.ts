import { describe, expect, it } from 'vitest';
import type { Element } from '@liveplanner/project';
import type { RoomOp } from '@liveplanner/api-schema';
import {
  createOwnElementWrites,
  holdOwnWrites,
  isSupersededByOwnWrite,
} from './own-element-writes';

// docs/specs/012-collaboration/realtime-conflict-resolution.md "Same-element edits converge".

const el = (id: string) =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 }) as Element;
const update = (id: string, tabId = 't1'): RoomOp => ({
  kind: 'el',
  tabId,
  op: { kind: 'update', element: el(id) },
});

describe('own element writes', () => {
  it('holds what our ops add or update, on their tab, until released', () => {
    const writes = createOwnElementWrites();
    const release = holdOwnWrites(writes, 't1', [
      { kind: 'update', element: el('a') },
      { kind: 'add', element: el('b'), at: 0 },
      { kind: 'remove', id: 'c' },
    ]);
    expect(isSupersededByOwnWrite(writes, update('a'))).toBe(true);
    expect(isSupersededByOwnWrite(writes, update('b'))).toBe(true);
    expect(isSupersededByOwnWrite(writes, update('c'))).toBe(false);
    expect(isSupersededByOwnWrite(writes, update('a', 't2'))).toBe(false);
    release();
    expect(isSupersededByOwnWrite(writes, update('a'))).toBe(false);
  });

  it('holds back only a peer update or patch, never a remove, an add or another kind of op', () => {
    const writes = createOwnElementWrites();
    holdOwnWrites(writes, 't1', [{ kind: 'update', element: el('a') }]);
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
    const first = holdOwnWrites(writes, 't1', [{ kind: 'update', element: el('a') }]);
    const second = holdOwnWrites(writes, 't1', [{ kind: 'update', element: el('a') }]);
    first();
    first();
    expect(isSupersededByOwnWrite(writes, update('a'))).toBe(true);
    second();
    expect(isSupersededByOwnWrite(writes, update('a'))).toBe(false);
    expect(writes.held.size).toBe(0);
  });

  it('reads a malformed peer op as not ours', () => {
    const writes = createOwnElementWrites();
    holdOwnWrites(writes, 't1', [{ kind: 'update', element: el('a') }]);
    expect(
      isSupersededByOwnWrite(writes, {
        kind: 'el',
        tabId: 't1',
        op: { kind: 'update', element: null },
      } as unknown as RoomOp),
    ).toBe(false);
  });
});
