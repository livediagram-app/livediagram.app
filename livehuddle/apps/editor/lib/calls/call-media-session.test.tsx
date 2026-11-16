// @vitest-environment jsdom
// The browser's own call controls (docs/specs/012-collaboration/proximity-audio.md "Outside the tab"; blueprint:
// proximity-audio.md "Outside the tab", Work Tracker 992).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CallStripGroup } from '@/components/calls/CallStripGroup';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  callSessionState,
  mediaSessionOf,
  watchCallMediaSession,
  type CallMediaSession,
} from './call-media-session';
import {
  callSelf,
  resetCallSelf,
  setCallActions,
  setCallSelf,
  type CallActions,
  type CallSelf,
} from './calls-store';

type Action = 'togglemicrophone' | 'togglecamera';

function fakeSession() {
  const handlers = new Map<Action, (() => void) | null>();
  const session = {
    setActionHandler: vi.fn((action: Action, handler: (() => void) | null) => {
      handlers.set(action, handler);
    }),
    setMicrophoneActive: vi.fn(),
    setCameraActive: vi.fn(),
  };
  return { session, handlers, fire: (action: Action) => handlers.get(action)?.() };
}

// The call's actions as the running call gives them: each flips the store's state, as the real call does.
function storeActions(): CallActions {
  return {
    join: vi.fn(),
    toggleMute: vi.fn(() => setCallSelf({ muted: !callSelf().muted })),
    toggleCamera: vi.fn(() => setCallSelf({ camera: callSelf().camera === 'on' ? 'off' : 'on' })),
    toggleScreen: vi.fn(),
    raiseHand: vi.fn(),
    lowerHand: vi.fn(),
  };
}

const LIVE: Partial<CallSelf> = {
  available: true,
  canSpeak: true,
  phase: 'live',
  mic: 'open',
  muted: true,
};

function goLive(patch: Partial<CallSelf> = {}, actions = storeActions()) {
  act(() => {
    setCallActions(actions);
    setCallSelf({ ...LIVE, ...patch });
  });
  return actions;
}

afterEach(() => {
  cleanup();
  act(() => resetCallSelf());
  vi.restoreAllMocks();
});

describe('watchCallMediaSession', () => {
  it('registers nothing until the call is live, then the microphone and camera, reporting their state', () => {
    const { session, handlers } = fakeSession();
    const stop = watchCallMediaSession(session);
    act(() => {
      setCallActions(storeActions());
      setCallSelf({ available: true, canSpeak: true, phase: 'joining' });
    });
    expect(session.setActionHandler).not.toHaveBeenCalled();
    act(() => setCallSelf({ phase: 'live', mic: 'open', muted: true }));
    expect(handlers.get('togglemicrophone')).toBeTypeOf('function');
    expect(handlers.get('togglecamera')).toBeTypeOf('function');
    expect(session.setMicrophoneActive).toHaveBeenLastCalledWith(false);
    expect(session.setCameraActive).toHaveBeenLastCalledWith(false);
    // Hang up stays unregistered: leaving a call is walking away.
    expect(session.setActionHandler.mock.calls.map(([action]) => action)).not.toContain('hangup');
    stop();
  });

  it('togglemicrophone mutes and unmutes as the dock button does, and the dock shows it', () => {
    const { session, fire } = fakeSession();
    const stop = watchCallMediaSession(session);
    const actions = goLive();
    render(<CallStripGroup />);
    expect(screen.getByRole('button', { name: 'Unmute' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    act(() => fire('togglemicrophone'));
    expect(actions.toggleMute).toHaveBeenCalledTimes(1);
    expect(callSelf().muted).toBe(false);
    expect(screen.getByRole('button', { name: 'Mute' }).getAttribute('aria-pressed')).toBe('false');
    expect(session.setMicrophoneActive).toHaveBeenLastCalledWith(true);
    // A mute made on the dock is reported back to the browser.
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(actions.toggleMute).toHaveBeenCalledTimes(2);
    expect(callSelf().muted).toBe(true);
    expect(session.setMicrophoneActive).toHaveBeenLastCalledWith(false);
    stop();
  });

  it('togglecamera turns the camera on and off as the dock button does', () => {
    const { session, fire } = fakeSession();
    const stop = watchCallMediaSession(session);
    const actions = goLive();
    render(<CallStripGroup />);
    act(() => fire('togglecamera'));
    expect(actions.toggleCamera).toHaveBeenCalledTimes(1);
    expect(callSelf().camera).toBe('on');
    expect(session.setCameraActive).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Turn Off Camera' }));
    expect(callSelf().camera).toBe('off');
    expect(session.setCameraActive).toHaveBeenLastCalledWith(false);
    stop();
  });

  it('reports the microphone as inactive while it is still opening or blocked', () => {
    const { session } = fakeSession();
    const stop = watchCallMediaSession(session);
    goLive({ muted: false, mic: 'open' });
    expect(session.setMicrophoneActive).toHaveBeenLastCalledWith(true);
    act(() => setCallSelf({ mic: 'blocked' }));
    expect(session.setMicrophoneActive).toHaveBeenLastCalledWith(false);
    stop();
  });

  it('applies only a change: a level tick tells the browser nothing', () => {
    const { session } = fakeSession();
    const stop = watchCallMediaSession(session);
    goLive({ muted: false });
    const calls = [
      session.setActionHandler.mock.calls.length,
      session.setMicrophoneActive.mock.calls.length,
      session.setCameraActive.mock.calls.length,
    ];
    for (const level of [1, 2, 3, 4, 0] as const) act(() => setCallSelf({ level }));
    expect([
      session.setActionHandler.mock.calls.length,
      session.setMicrophoneActive.mock.calls.length,
      session.setCameraActive.mock.calls.length,
    ]).toEqual(calls);
    stop();
  });

  it('keeps a level tick cheap: 10,000 ticks within a CPU budget', () => {
    const { session } = fakeSession();
    const stop = watchCallMediaSession(session);
    goLive({ muted: false });
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 10_000; i += 1) setCallSelf({ level: (i % 5) as 0 | 1 | 2 | 3 | 4 });
    });
    expect(ms).toBeLessThan(cpuBudgetMs(500));
    stop();
  });

  it('registers no camera action while video is paused, and brings it back with video', () => {
    const { session, handlers } = fakeSession();
    const stop = watchCallMediaSession(session);
    goLive({ mode: 'audio-only' });
    expect(handlers.get('togglemicrophone')).toBeTypeOf('function');
    expect(handlers.has('togglecamera')).toBe(false);
    act(() => setCallSelf({ mode: 'on' }));
    expect(handlers.get('togglecamera')).toBeTypeOf('function');
    act(() => setCallSelf({ mode: 'audio-only' }));
    expect(handlers.get('togglecamera')).toBeNull();
    stop();
  });

  it('clears both handlers when the call ends, reporting the microphone off', () => {
    const { session, handlers } = fakeSession();
    const stop = watchCallMediaSession(session);
    goLive({ muted: false, camera: 'on' });
    act(() => setCallSelf({ phase: 'off' }));
    expect(handlers.get('togglemicrophone')).toBeNull();
    expect(handlers.get('togglecamera')).toBeNull();
    expect(session.setMicrophoneActive).toHaveBeenLastCalledWith(false);
    expect(session.setCameraActive).toHaveBeenLastCalledWith(false);
    stop();
  });

  it('clears both handlers when the actions go (the call hook unmounting)', () => {
    const { session, handlers } = fakeSession();
    const stop = watchCallMediaSession(session);
    goLive();
    act(() => resetCallSelf());
    expect(handlers.get('togglemicrophone')).toBeNull();
    expect(handlers.get('togglecamera')).toBeNull();
    stop();
  });

  it('registers nothing for a listener or a local preview with no call', () => {
    const { session } = fakeSession();
    const stop = watchCallMediaSession(session);
    goLive({ canSpeak: false });
    act(() => setCallSelf({ canSpeak: true, available: false, canPreviewMic: true }));
    expect(session.setActionHandler).not.toHaveBeenCalled();
    stop();
  });

  it('stop clears the handlers and stops listening', () => {
    const { session, handlers } = fakeSession();
    const stop = watchCallMediaSession(session);
    goLive();
    stop();
    expect(handlers.get('togglemicrophone')).toBeNull();
    expect(handlers.get('togglecamera')).toBeNull();
    const count = session.setActionHandler.mock.calls.length;
    act(() => setCallSelf({ phase: 'joining' }));
    act(() => setCallSelf({ phase: 'live' }));
    expect(session.setActionHandler).toHaveBeenCalledTimes(count);
  });

  it('a handler fired once the actions are gone does nothing', () => {
    const { session, handlers } = fakeSession();
    const stop = watchCallMediaSession(session);
    goLive();
    const mic = handlers.get('togglemicrophone')!;
    const camera = handlers.get('togglecamera')!;
    act(() => setCallActions(null));
    expect(() => {
      mic();
      camera();
    }).not.toThrow();
    stop();
  });

  it('does nothing where the browser has no Media Session', () => {
    const stop = watchCallMediaSession(null);
    expect(() => goLive()).not.toThrow();
    stop();
  });

  it('leaves alone a browser that refuses the actions or lacks the setters', () => {
    const refusing: CallMediaSession = {
      setActionHandler: vi.fn(() => {
        throw new TypeError('unknown action');
      }),
    };
    const stop = watchCallMediaSession(refusing);
    expect(() => goLive({ muted: false })).not.toThrow();
    expect(refusing.setActionHandler).toHaveBeenCalledTimes(2);
    expect(() => stop()).not.toThrow();
  });

  it('swallows a setter that rejects', async () => {
    const rejecting: CallMediaSession = {
      setActionHandler: vi.fn(),
      setMicrophoneActive: vi.fn(() => Promise.reject(new Error('not allowed'))),
      setCameraActive: vi.fn(() => Promise.reject(new Error('not allowed'))),
    };
    const stop = watchCallMediaSession(rejecting);
    goLive();
    await act(async () => {});
    expect(rejecting.setMicrophoneActive).toHaveBeenCalledWith(false);
    stop();
  });
});

describe('mediaSessionOf', () => {
  it('finds navigator.mediaSession, and null without it', () => {
    const session = { setActionHandler: vi.fn() };
    expect(mediaSessionOf({ mediaSession: session })).toBe(session);
    expect(mediaSessionOf({})).toBeNull();
    expect(mediaSessionOf({ mediaSession: {} })).toBeNull();
    expect(mediaSessionOf(undefined)).toBeNull();
  });

  it('reads the global navigator by default', () => {
    const session = { setActionHandler: vi.fn() };
    vi.stubGlobal('navigator', { mediaSession: session });
    expect(mediaSessionOf()).toBe(session);
    vi.unstubAllGlobals();
  });
});

describe('callSessionState', () => {
  const self: CallSelf = { ...callSelf(), ...LIVE };
  it('asks for the actions only while live, able to speak, with actions', () => {
    expect(callSessionState(self, true)).toEqual({
      mic: true,
      cameraAction: true,
      active: false,
      camera: false,
    });
    expect(callSessionState(self, false).mic).toBe(false);
    expect(callSessionState({ ...self, phase: 'error' }, true).mic).toBe(false);
    expect(callSessionState({ ...self, available: false }, true).mic).toBe(false);
  });
});
