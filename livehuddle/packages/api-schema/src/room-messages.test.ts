import { describe, expect, it } from 'vitest';
import {
  isMutationOpKind,
  isParticipationOp,
  isPresenceOpKind,
  isRetiredOpKind,
  isRoomOpRef,
} from './room-messages';

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
  it('admits a comment reaction', () => {
    expect(
      isParticipationOp({
        kind: 'el-delta',
        tabId: 't',
        elementId: 'e',
        delta: { kind: 'comment-react' },
      }),
    ).toBe(true);
  });

  it('refuses every other mutation and anything malformed', () => {
    // A retired per-participant response and idea box answer included (Work Tracker #423, part 4).
    for (const kind of ['check', 'board', 'comment-add', 'comment-remove', 'response', 'idea']) {
      expect(isParticipationOp({ kind: 'el-delta', delta: { kind } })).toBe(false);
    }
    for (const op of [{ kind: 'el' }, { kind: 'tab' }, { kind: 'el-delta' }, null, 'vote', 3]) {
      expect(isParticipationOp(op)).toBe(false);
    }
    // The retired Vote's dot (docs/specs/002-project-scope/not-in-livehuddle.md "The Vote").
    expect(
      isParticipationOp({ kind: 'vote', tabId: 't', elementId: 'e', voter: 'k', delta: 1 }),
    ).toBe(false);
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The Vote": an old client's dot is a retired kind, not a mutation.
describe('retired op kinds', () => {
  it('names the vote op, and nothing the room still takes', () => {
    expect(isRetiredOpKind('vote')).toBe(true);
    expect(isMutationOpKind('vote')).toBe(false);
    expect(isPresenceOpKind('vote')).toBe(false);
    for (const kind of ['tab', 'el', 'el-delta', 'cursor', null, 3]) {
      expect(isRetiredOpKind(kind)).toBe(false);
    }
  });
});

// The avatar-say op's shape and parser are @liveworkspace/api-schema's (its avatar-say tests); its class is this
// product's (docs/specs/008-canvas/blueprints/avatar-speech.md).
describe('avatar-say', () => {
  it('is a presence op: never ordered, logged or replayed', () => {
    expect(isPresenceOpKind('avatar-say')).toBe(true);
  });
});
