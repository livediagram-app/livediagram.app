// The calls' control wire (docs/specs/012-collaboration/proximity-audio.md "The wire"; video-and-screen-bubbles.md
// "Share roles"): each op's parser keeps exactly its fields and refuses anything malformed.
import { describe, expect, it } from 'vitest';
import { CALL_NOT_HEARD, parseCallSession, parseCallStopShare } from './call-control';

describe('parseCallSession', () => {
  const op = { kind: 'call-session', tabId: 't', sessionId: 's1', sessionToken: 'l.abc', extra: 1 };
  it('keeps the session and its proof, nothing else', () => {
    expect(parseCallSession(op)).toEqual({
      kind: 'call-session',
      tabId: 't',
      sessionId: 's1',
      sessionToken: 'l.abc',
    });
  });
  it('refuses a missing or oversized field, and anything else', () => {
    for (const bad of [
      null,
      { ...op, kind: 'call-track' },
      { ...op, tabId: '' },
      { ...op, sessionId: 'x'.repeat(129) },
      { ...op, sessionToken: 3 },
    ])
      expect(parseCallSession(bad)).toBeNull();
  });
});

describe('parseCallStopShare', () => {
  const op = { kind: 'call-stop-share', tabId: 't', targetId: 'p2' };
  it('keeps who is asked to stop', () => {
    expect(parseCallStopShare({ ...op, on: true })).toEqual(op);
    expect(CALL_NOT_HEARD).toBe('not_heard');
  });
  it('refuses a missing target, a long one, or another kind', () => {
    for (const bad of [
      null,
      { ...op, kind: 'avatar-push' },
      { ...op, tabId: 7 },
      { ...op, targetId: '' },
      { ...op, targetId: 'x'.repeat(65) },
    ])
      expect(parseCallStopShare(bad)).toBeNull();
  });
});
