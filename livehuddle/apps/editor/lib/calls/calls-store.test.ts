// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  callHands,
  callLetByMe,
  HANDS_MAX,
  noteLetSpeak,
  onCallHands,
  onLetSpeak,
  receiveLetSpeak,
  useCallHands,
  callActions,
  callLevels,
  callMaximised,
  callMedia,
  callPeers,
  callSelf,
  forgetCallPeer,
  levelNow,
  onCallLevels,
  onCallMaximised,
  onCallsMode,
  onCallTracks,
  onStopShare,
  receiveStopShare,
  pruneCallPeers,
  receiveCallOp,
  receiveCallsMode,
  resetCallMedia,
  resetCallPeers,
  resetCallSelf,
  setCallActions,
  setCallLevels,
  setCallMaximised,
  setCallMedia,
  setCallSelf,
  useCallActions,
  useCallMaximised,
  useCallMedia,
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
  resetCallMedia();
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

  // video-and-screen-bubbles.md "Share roles" (#469).
  it('hands an addressed stop-share to the running call, ignoring anything malformed', () => {
    const heard = vi.fn();
    const off = onStopShare(heard);
    receiveStopShare('ed', { kind: 'call-stop-share', tabId: 't1', targetId: 'me' });
    receiveStopShare('ed', { kind: 'call-stop-share', tabId: 't1' });
    expect(heard.mock.calls).toEqual([['ed']]);
    off();
    receiveStopShare('ed', { kind: 'call-stop-share', tabId: 't1', targetId: 'me' });
    expect(heard).toHaveBeenCalledTimes(1);
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
    expect(
      levelNow({ tabId: 't1', level: 0, levelAt: 0, track: null, video: null, screen: null }),
    ).toBe(0);
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
    const actions = {
      join: vi.fn(),
      leave: vi.fn(),
      toggleMute: vi.fn(),
      toggleCamera: vi.fn(),
      toggleScreen: vi.fn(),
      raiseHand: vi.fn(),
      lowerHand: vi.fn(),
    };
    act(() => setCallActions(actions));
    setCallActions(actions);
    expect(result.current.actions).toBe(actions);
    expect(callActions()).toBe(actions);
    act(() => resetCallSelf());
    expect(result.current.self.available).toBe(false);
    expect(result.current.actions).toBeNull();
  });
});

// docs/specs/016-platform/blueprints/calls-kill-switch.md "Wired in (part 2)".
describe('calls store mode', () => {
  it('starts on, and takes the room’s push only from the room itself', () => {
    const heard = vi.fn();
    const off = onCallsMode(heard);
    expect(callSelf().mode).toBe('on');
    receiveCallsMode('p1', { kind: 'calls-mode', mode: 'off' });
    receiveCallsMode('system', { kind: 'calls-mode', mode: 'loud' });
    expect(callSelf().mode).toBe('on');
    expect(heard).not.toHaveBeenCalled();
    receiveCallsMode('system', { kind: 'calls-mode', mode: 'off' });
    expect(callSelf().mode).toBe('off');
    // The same mode again tells nobody.
    receiveCallsMode('system', { kind: 'calls-mode', mode: 'off' });
    expect(heard).toHaveBeenCalledTimes(1);
    off();
  });
});

// docs/specs/012-collaboration/blueprints/video-and-screen-bubbles.md "State".
describe('calls store bubbles', () => {
  const cam = { sessionId: 's1', trackName: 'cam', token: 't' };
  const screen = { sessionId: 's1', trackName: 'screen', token: 't' };
  const stream = (n: number) => ({ id: `stream-${n}` }) as unknown as MediaStream;

  it('keeps a peer’s camera and screen locators, reading an op without them as off', () => {
    receiveCallOp('p1', { kind: 'call-track', tabId: 't1', track: null, video: cam, screen });
    expect(callPeers().get('p1')).toMatchObject({ track: null, video: cam, screen });
    receiveCallOp('p1', { kind: 'call-track', tabId: 't1', track: locator });
    expect(callPeers().get('p1')).toMatchObject({ track: locator, video: null, screen: null });
  });

  it('holds each bubble’s streams, and forgets a person with none left', () => {
    const { result } = renderHook(() => useCallMedia());
    const a = stream(1);
    act(() => setCallMedia('p1', 'video', a));
    // The same stream again tells nobody.
    const before = callMedia();
    setCallMedia('p1', 'video', a);
    expect(callMedia()).toBe(before);
    act(() => setCallMedia('p1', 'screen', stream(2)));
    expect(result.current.get('p1')).toEqual({ video: a, screen: stream(2) });
    act(() => setCallMedia('p1', 'video', null));
    expect(result.current.get('p1')?.video).toBeUndefined();
    act(() => setCallMedia('p1', 'screen', null));
    expect(result.current.has('p1')).toBe(false);
  });

  it('maximises one bubble at a time, and restores it when its stream goes', () => {
    const { result } = renderHook(() => useCallMaximised());
    const told = vi.fn();
    const off = onCallMaximised(told);
    setCallMedia('p1', 'video', stream(1));
    act(() => setCallMaximised({ id: 'p1', media: 'video' }));
    setCallMaximised({ id: 'p1', media: 'video' });
    expect(told).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ id: 'p1', media: 'video' });
    // Another person's stream ending leaves it open.
    setCallMedia('p2', 'video', stream(2));
    setCallMedia('p2', 'video', null);
    expect(callMaximised()).not.toBeNull();
    act(() => setCallMedia('p1', 'video', null));
    expect(result.current).toBeNull();
    off();
  });

  it('empties every bubble and the maximised one when the call ends', () => {
    setCallMedia('p1', 'screen', stream(1));
    setCallMaximised({ id: 'p1', media: 'screen' });
    resetCallMedia();
    expect(callMedia().size).toBe(0);
    expect(callMaximised()).toBeNull();
    // Nothing to empty: still fine.
    resetCallMedia();
  });
});

// docs/specs/012-collaboration/meeting-rooms-and-stage.md "Share roles": whose level lets them speak from a stage.
describe('calls store levels', () => {
  it('keeps each peer’s stamped level, an unknown or missing one a Viewer’s, and tells only of a change', () => {
    const heard = vi.fn();
    const off = onCallLevels(heard);
    setCallLevels([
      { id: 'a', role: 'edit' },
      { id: 'b', role: 'participate' },
      { id: 'c', role: 'admin' },
      { id: 'd' },
    ]);
    expect([...callLevels()]).toEqual([
      ['a', 'edit'],
      ['b', 'participate'],
      ['c', 'view'],
      ['d', 'view'],
    ]);
    expect(heard).toHaveBeenCalledTimes(1);
    setCallLevels([
      { id: 'a', role: 'edit' },
      { id: 'b', role: 'participate' },
      { id: 'c' },
      { id: 'd', role: 'view' },
    ]);
    expect(heard).toHaveBeenCalledTimes(1);
    setCallLevels([{ id: 'a', role: 'participate' }]);
    expect(heard).toHaveBeenCalledTimes(2);
    // The room closing forgets them.
    resetCallPeers();
    expect(callLevels().size).toBe(0);
    expect(heard).toHaveBeenCalledTimes(3);
    off();
  });
});

// docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand"
describe('calls store hands', () => {
  afterEach(() => resetCallPeers());
  const hand = (raised: boolean, letSpeak?: string | null) => ({
    kind: 'avatar-hand',
    tabId: 't1',
    raised,
    ...(letSpeak === undefined ? {} : { letSpeak }),
  });

  it('keeps hands in the order they went up, with who let them speak, and lowers them', () => {
    const changed = vi.fn();
    const off = onCallHands(changed);
    const { result } = renderHook(() => useCallHands());
    act(() => receiveCallOp('a', hand(true)));
    vi.advanceTimersByTime(10);
    act(() => receiveCallOp('b', hand(true)));
    act(() => receiveCallOp('a', hand(true, 'ed')));
    // The same again changes nothing.
    receiveCallOp('a', hand(true, 'ed'));
    expect(changed).toHaveBeenCalledTimes(3);
    const a = callHands().get('a')!;
    expect(a.letSpeak).toBe('ed');
    expect(a.at).toBeLessThan(callHands().get('b')!.at);
    expect(result.current.hands.size).toBe(2);
    act(() => receiveCallOp('a', hand(false)));
    receiveCallOp('zz', hand(false));
    receiveCallOp('b', { kind: 'avatar-hand', tabId: 't1', raised: 'yes' });
    expect([...callHands().keys()]).toEqual(['b']);
    off();
  });

  it('holds at most one hand a connection', () => {
    for (let i = 0; i < HANDS_MAX + 5; i++) receiveCallOp(`p${i}`, hand(true));
    expect(callHands().size).toBe(HANDS_MAX);
    // A hand already up still changes.
    receiveCallOp('p0', hand(true, 'ed'));
    expect(callHands().get('p0')?.letSpeak).toBe('ed');
  });

  it('lowers a hand whose owner leaves the mode or the room, and every hand when the room closes', () => {
    for (const id of ['a', 'b', 'c']) receiveCallOp(id, hand(true));
    noteLetSpeak('a', true);
    forgetCallPeer('a');
    expect(callLetByMe().has('a')).toBe(false);
    pruneCallPeers(new Set(['c']));
    expect([...callHands().keys()]).toEqual(['c']);
    pruneCallPeers(new Set(['c']));
    resetCallPeers();
    expect(callHands().size).toBe(0);
  });

  it('remembers whom you let speak, until Done', () => {
    noteLetSpeak('a', true);
    noteLetSpeak('a', true);
    expect([...callLetByMe()]).toEqual(['a']);
    noteLetSpeak('a', false);
    noteLetSpeak('a', false);
    expect(callLetByMe().size).toBe(0);
  });

  it('hands an addressed let-speak to the running call, and ignores a malformed one', () => {
    const heard = vi.fn();
    const off = onLetSpeak(heard);
    receiveLetSpeak('ed', { kind: 'avatar-let-speak', tabId: 't1', targetId: 'me', on: true });
    receiveLetSpeak('ed', { kind: 'avatar-let-speak', tabId: 't1', targetId: 'me' });
    expect(heard.mock.calls).toEqual([['ed', true]]);
    off();
    receiveLetSpeak('ed', { kind: 'avatar-let-speak', tabId: 't1', targetId: 'me', on: false });
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
