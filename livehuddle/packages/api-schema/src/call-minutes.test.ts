// docs/specs/012-collaboration/call-minutes.md "The wire": the room's `call-minutes` op, field by field, and the
// `left` a metered call's `call-session` may carry.
import { describe, expect, it } from 'vitest';
import { parseCallSession } from './call-control';
import { CALL_MINUTES_LOW, parseCallMinutesOp } from './call-minutes';
import { SYSTEM_OP_KINDS } from './room-op-kinds';

const OWNER = 'p:user_owner';

describe('the call-minutes op', () => {
  it('is the room’s own: a system op, never a client’s', () => {
    expect(SYSTEM_OP_KINDS).toContain('call-minutes');
    expect(CALL_MINUTES_LOW).toBe(80);
  });

  it('reads each state, and the state alone: an owner or a number that rides it is dropped', () => {
    for (const state of ['low', 'used', 'ok'] as const) {
      expect(parseCallMinutesOp({ kind: 'call-minutes', state })).toEqual({
        kind: 'call-minutes',
        state,
      });
    }
    // The op goes to every connection, a signed-out visitor's included: nothing of the owner's is read off it.
    expect(
      parseCallMinutesOp({ kind: 'call-minutes', state: 'used', owner: OWNER, used: 5, limit: 5 }),
    ).toEqual({ kind: 'call-minutes', state: 'used' });
    expect(parseCallMinutesOp({ kind: 'call-minutes', state: 'ok', extra: 1 })).toEqual({
      kind: 'call-minutes',
      state: 'ok',
    });
  });

  it('drops what is malformed: another kind, an unknown state', () => {
    for (const op of [
      null,
      'call-minutes',
      { kind: 'calls-mode', state: 'low' },
      { kind: 'call-minutes', state: 'gone' },
      { kind: 'call-minutes' },
    ]) {
      expect(parseCallMinutesOp(op)).toBeNull();
    }
  });
});

describe('a metered call’s call-session', () => {
  const op = { kind: 'call-session', tabId: 't1', sessionId: 's1', sessionToken: 'k1' };
  it('carries `left` only when it is exactly true', () => {
    expect(parseCallSession({ ...op, left: true })).toEqual({ ...op, left: true });
    expect(parseCallSession({ ...op, left: 'yes' })).toEqual(op);
    expect(parseCallSession(op)).toEqual(op);
  });
});
