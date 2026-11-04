// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  callActions,
  callPeers,
  callSelf,
  forgetCallPeer,
  levelNow,
  onCallTracks,
  pruneCallPeers,
  receiveCallOp,
  resetCallPeers,
  resetCallSelf,
  setCallActions,
  setCallSelf,
  useCallActions,
  useCallPeers,
  useCallSelf,
  VOICE_STALE_MS,
} from './calls-store';

const locator = { sessionId: 's1', trackName: 'mic', token: 't' };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  resetCallPeers();
  resetCallSelf();
  vi.useRealTimers();
});

// docs/specs/012-collaboration/blueprints/proximity-audio.md "Receiving".
describe('calls store peers', () => {
  it('keeps a level and a locator per peer, ignoring anything malformed', () => {
    const tracks = vi.fn();
    const off = onCallTracks(tracks);
    receiveCallOp('p1', { kind: 'avatar-voice', tabId: 't1', level: 3 });
    receiveCallOp('p1', { kind: 'call-track', tabId: 't1', track: locator });
    receiveCallOp('p2', { kind: 'avatar-voice', tabId: 't1', level: 9 });
    receiveCallOp('p2', { kind: 'cursor' });
    const p1 = callPeers().get('p1');
    expect(p1).toMatchObject({ tabId: 't1', level: 3, track: locator });
    expect(callPeers().has('p2')).toBe(false);
    expect(tracks).toHaveBeenCalledTimes(1);
    off();
  });

  it('coalesces level notifications and tells a locator at once', () => {
    const { result } = renderHook(() => useCallPeers());
    act(() => receiveCallOp('p1', { kind: 'avatar-voice', tabId: 't1', level: 2 }));
    expect(result.current.has('p1')).toBe(false);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.get('p1')?.level).toBe(2);
    act(() => receiveCallOp('p2', { kind: 'call-track', tabId: 't1', track: null }));
    expect(result.current.get('p2')?.track).toBeNull();
  });

  it('reads a level as stopped once it is stale, and 0 for nobody', () => {
    receiveCallOp('p1', { kind: 'avatar-voice', tabId: 't1', level: 4 });
    const peer = callPeers().get('p1');
    expect(levelNow(peer, peer!.levelAt + 10)).toBe(4);
    expect(levelNow(peer, peer!.levelAt + VOICE_STALE_MS + 1)).toBe(0);
    expect(levelNow(undefined)).toBe(0);
    expect(levelNow({ tabId: 't1', level: 0, levelAt: 0, track: null })).toBe(0);
  });

  it('forgets a peer leaving the mode or the room', () => {
    receiveCallOp('p1', { kind: 'call-track', tabId: 't1', track: locator });
    receiveCallOp('p2', { kind: 'call-track', tabId: 't1', track: locator });
    forgetCallPeer('p1');
    forgetCallPeer('nobody');
    expect([...callPeers().keys()]).toEqual(['p2']);
    pruneCallPeers(new Set(['p2']));
    expect([...callPeers().keys()]).toEqual(['p2']);
    pruneCallPeers(new Set());
    expect(callPeers().size).toBe(0);
  });

  it('empties when the room closes, cancelling a pending notification', () => {
    receiveCallOp('p1', { kind: 'avatar-voice', tabId: 't1', level: 1 });
    resetCallPeers();
    vi.runAllTimers();
    expect(callPeers().size).toBe(0);
  });
});

describe('calls store self', () => {
  it('notifies only on a real change, and hands out the actions', () => {
    const { result } = renderHook(() => ({ self: useCallSelf(), actions: useCallActions() }));
    const before = callSelf();
    setCallSelf({ phase: 'off' });
    expect(callSelf()).toBe(before);
    act(() => setCallSelf({ available: true, canSpeak: true }));
    expect(result.current.self).toMatchObject({ available: true, canSpeak: true });
    const actions = { join: vi.fn(), leave: vi.fn(), toggleMute: vi.fn() };
    act(() => setCallActions(actions));
    setCallActions(actions);
    expect(result.current.actions).toBe(actions);
    expect(callActions()).toBe(actions);
    act(() => resetCallSelf());
    expect(result.current.self.available).toBe(false);
    expect(result.current.actions).toBeNull();
  });
});
