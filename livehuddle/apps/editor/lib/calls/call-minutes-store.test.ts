// docs/specs/012-collaboration/call-minutes.md "The wire", "What people see": what this browser knows of the Space's
// owner's call minutes is only ever what the server said, and only the room's own op is taken off the wire.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callMinutes,
  clearCallMinutesLow,
  noteCallMinutesUsed,
  noteCallSessionMinutes,
  onCallMinutesResumed,
  onCallMinutesUsed,
  receiveCallMinutes,
  resetCallMinutes,
  setCallMinutesNotice,
} from './call-minutes-store';

const OWNER = 'p:user_owner';
const CALLER = { ownerId: 'o', documentId: 'd', shareCode: null };
const USED = { kind: 'call-minutes', state: 'used', owner: OWNER, used: 1000, limit: 1000 };

afterEach(() => resetCallMinutes());

describe('the call minutes store', () => {
  it('knows nothing until the server says, and nothing from a session that is not metered', () => {
    noteCallSessionMinutes(undefined, CALLER);
    expect(callMinutes()).toEqual({
      caller: null,
      metered: false,
      owner: null,
      guest: false,
      low: false,
      used: null,
      notice: false,
    });
    noteCallSessionMinutes({ owner: OWNER, low: true }, CALLER);
    expect(callMinutes()).toMatchObject({ caller: CALLER, owner: OWNER, low: true, used: null });
    clearCallMinutesLow();
    expect(callMinutes().low).toBe(false);
  });

  it('takes the room’s op only from the room, and only well formed', () => {
    receiveCallMinutes('peer-1', USED, true);
    receiveCallMinutes('system', { kind: 'call-minutes', state: 'gone' }, true);
    receiveCallMinutes('system', { kind: 'calls-mode', mode: 'off' }, true);
    expect(callMinutes().metered).toBe(false);
    // The op is the state alone: an owner or a number riding it is never read off it.
    receiveCallMinutes(
      'system',
      { kind: 'call-minutes', state: 'low', owner: OWNER, used: 5, limit: 5 },
      true,
    );
    expect(callMinutes()).toMatchObject({ metered: true, owner: null, low: true, used: null });
  });

  it('ends a running call once when the month is used, and opens the dialog for it', () => {
    const ended = vi.fn();
    const stop = onCallMinutesUsed(ended);
    noteCallSessionMinutes({ owner: OWNER, low: true }, CALLER);
    receiveCallMinutes('system', USED, true);
    receiveCallMinutes('system', USED, true);
    expect(ended).toHaveBeenCalledOnce();
    // Whose month it is came with the session; the op brings no numbers (the dialog reads them for the owner).
    expect(callMinutes()).toEqual({
      caller: CALLER,
      metered: true,
      owner: OWNER,
      guest: false,
      low: false,
      used: { used: null, limit: null },
      notice: true,
    });
    stop();
  });

  it('only pauses the dock for a join refused on arriving, until a press opens the dialog', () => {
    setCallMinutesNotice(true);
    expect(callMinutes().notice).toBe(false);
    noteCallMinutesUsed({ owner: OWNER, guest: false, used: 1000, limit: 1000 }, false, CALLER);
    expect(callMinutes()).toMatchObject({
      caller: CALLER,
      notice: false,
      used: { used: 1000, limit: 1000 },
    });
    // The room's word after it brings no numbers: the ones the refusal gave are kept.
    receiveCallMinutes('system', USED, false);
    expect(callMinutes().used).toEqual({ used: 1000, limit: 1000 });
    setCallMinutesNotice(true);
    expect(callMinutes().notice).toBe(true);
    setCallMinutesNotice(false);
    expect(callMinutes().notice).toBe(false);
    // A session minted later means the month is no longer used: the dialog closes with it.
    setCallMinutesNotice(true);
    noteCallSessionMinutes({ owner: OWNER, low: false }, CALLER);
    expect(callMinutes()).toMatchObject({ used: null, notice: false });
  });

  it('pauses for a signed-out visitor too, who is never told an owner or a number', () => {
    noteCallSessionMinutes({ low: false }, CALLER);
    receiveCallMinutes('system', { kind: 'call-minutes', state: 'used' }, true);
    expect(callMinutes()).toMatchObject({
      metered: true,
      owner: null,
      guest: false,
      used: { used: null, limit: null },
      notice: true,
    });
  });

  it('knows a guest’s Space, from a session or a refusal', () => {
    noteCallSessionMinutes({ guest: true, low: false }, CALLER);
    expect(callMinutes()).toMatchObject({ metered: true, owner: null, guest: true });
    resetCallMinutes();
    noteCallMinutesUsed({ owner: null, guest: true, used: null, limit: null }, false, CALLER);
    expect(callMinutes()).toMatchObject({ guest: true, used: { used: null, limit: null } });
  });

  it('says calls start again only when they were paused', () => {
    const resumed = vi.fn();
    const stop = onCallMinutesResumed(resumed);
    receiveCallMinutes('system', { kind: 'call-minutes', state: 'ok', owner: OWNER }, false);
    expect(resumed).not.toHaveBeenCalled();
    receiveCallMinutes('system', USED, true);
    receiveCallMinutes('system', { kind: 'call-minutes', state: 'ok' }, false);
    expect(resumed).toHaveBeenCalledOnce();
    expect(callMinutes()).toMatchObject({ used: null, notice: false, low: false });
    stop();
  });
});
