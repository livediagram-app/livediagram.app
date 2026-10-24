import { describe, expect, it } from 'vitest';
import type { Element } from '@liveplanner/project';
import type { RoomOp } from '@liveplanner/api-schema';
import { migrateRoomOp } from './room-op-migrate';

// Every op that carries elements runs the stored-element steps on receipt, before it is applied; an op with nothing
// to settle comes back as it was.

describe('migrateRoomOp', () => {
  it('returns every other op, and an op with nothing to migrate, as it came', () => {
    const remove: RoomOp = { kind: 'el', tabId: 't1', op: { kind: 'remove', id: 'f1' } };
    expect(migrateRoomOp(remove)).toBe(remove);
    const focus: RoomOp = { kind: 'tab-focus', tabId: 't1' };
    expect(migrateRoomOp(focus)).toBe(focus);
    const current: RoomOp = {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'update', element: { id: 's', type: 'text' } as Element },
    };
    expect(migrateRoomOp(current)).toBe(current);
  });
});
