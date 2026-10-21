import { describe, expect, it } from 'vitest';
import { isParticipationOp, isRoomOpRef } from './room-messages';

// docs/specs/012-collaboration/realtime-conflict-resolution.md: the `ref` a client puts on an op frame,
// which the room echoes on that op's cursor frame.
describe('isRoomOpRef', () => {
  it.each([1, 42, Number.MAX_SAFE_INTEGER])('accepts the positive safe integer %s', (ref) => {
    expect(isRoomOpRef(ref)).toBe(true);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 2, Number.NaN, Infinity, '3', null, undefined])(
    'refuses %s',
    (ref) => {
      expect(isRoomOpRef(ref)).toBe(false);
    },
  );
});

// The room's participation class (docs/specs/013-workspace/share-roles.md "Integrity").
describe('isParticipationOp', () => {
  it('admits a dot, a response and an idea', () => {
    expect(
      isParticipationOp({ kind: 'vote', tabId: 't', elementId: 'e', voter: 'k', delta: 1 }),
    ).toBe(true);
    for (const kind of ['response', 'idea']) {
      expect(
        isParticipationOp({ kind: 'el-delta', tabId: 't', elementId: 'e', delta: { kind } }),
      ).toBe(true);
    }
  });

  it('refuses every other mutation and anything malformed', () => {
    for (const kind of ['check', 'board', 'comment-add', 'comment-remove']) {
      expect(isParticipationOp({ kind: 'el-delta', delta: { kind } })).toBe(false);
    }
    for (const op of [{ kind: 'el' }, { kind: 'tab' }, { kind: 'el-delta' }, null, 'vote', 3]) {
      expect(isParticipationOp(op)).toBe(false);
    }
  });
});
