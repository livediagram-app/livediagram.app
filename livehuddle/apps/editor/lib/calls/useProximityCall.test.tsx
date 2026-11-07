// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  callActions,
  callMedia,
  callSelf,
  resetCallMedia,
  resetCallSelf,
  SELF_MEDIA_ID,
  setCallSelf,
} from './calls-store';
import type { LocalPreview } from './local-preview';
import { useProximityCall, type ProximityCallDeps } from './useProximityCall';

const caps = vi.hoisted(() => ({ apiGetCapabilities: vi.fn() }));
vi.mock('@/lib/api/capabilities', () => caps);
const telemetry = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => telemetry);
const calls = vi.hoisted(() => ({
  made: [] as {
    update: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    toggleMute: ReturnType<typeof vi.fn>;
    toggleCamera: ReturnType<typeof vi.fn>;
    toggleScreen: ReturnType<typeof vi.fn>;
    raiseHand: ReturnType<typeof vi.fn>;
    lowerHand: ReturnType<typeof vi.fn>;
    setDoNotDisturb: ReturnType<typeof vi.fn>;
    ended: boolean;
    input: { preview?: LocalPreview };
  }[],
  fail: false,
}));
vi.mock('./proximity-call', async () => {
  const store = await import('./calls-store');
  return {
    ProximityCall: class {
      update = vi.fn();
      start = vi.fn(async () => {});
      // As the real call: it ends, its phase back to off.
      stop = vi.fn(() => {
        this.ended = true;
        store.setCallSelf({ phase: 'off' });
      });
      toggleMute = vi.fn();
      toggleCamera = vi.fn(async () => {});
      toggleScreen = vi.fn(async () => {});
      raiseHand = vi.fn();
      lowerHand = vi.fn();
      setDoNotDisturb = vi.fn();
      ended = false;
      input: { preview?: LocalPreview };
      constructor(input: { preview?: LocalPreview }) {
        if (calls.fail) throw new Error('chunk');
        this.input = input;
        calls.made.push(this);
      }
    },
  };
});

// The AudioContexts made, and the state each starts in (a join without a press starts suspended).
const audio = vi.hoisted(() => ({
  made: [] as {
    state: string;
    resume: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }[],
  state: 'running',
  // The browser refuses every close and resume.
  refuse: false,
}));

const base: ProximityCallDeps = {
  inMode: true,
  caller: { ownerId: 'o', documentId: 'd', shareCode: null },
  canSpeak: true,
  send: vi.fn(),
  tabId: 't1',
  self: { x: 0, y: 0 },
  walkers: [],
};

beforeEach(() => {
  calls.made.length = 0;
  calls.fail = false;
  caps.apiGetCapabilities.mockResolvedValue({ emailEnabled: false, callsEnabled: true });
  audio.made.length = 0;
  audio.state = 'running';
  audio.refuse = false;
  vi.stubGlobal(
    'AudioContext',
    class {
      state = audio.state;
      close = vi.fn(async () => {
        if (audio.refuse) throw new Error('refused');
      });
      resume = vi.fn(async () => {
        if (audio.refuse) throw new Error('refused');
        this.state = 'running';
      });
      createAnalyser = () => ({ fftSize: 0, getFloatTimeDomainData: vi.fn() });
      createMediaStreamSource = () => ({ connect: vi.fn() });
      constructor() {
        audio.made.push(this);
      }
    },
  );
});
afterEach(() => {
  act(() => {
    resetCallSelf();
    resetCallMedia();
  });
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function micStream() {
  const track = { stop: vi.fn(), enabled: true };
  return { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
}

function mount(deps: Partial<ProximityCallDeps> = {}) {
  return renderHook((d: ProximityCallDeps) => useProximityCall(d), {
    initialProps: { ...base, ...deps },
  });
}

// docs/specs/012-collaboration/proximity-audio.md "Who is in a call" and "Turning calls on".
describe('useProximityCall', () => {
  it('offers calls only in the mode, with a room, when the api has them on', async () => {
    const off = mount({ send: undefined });
    await act(async () => {});
    expect(callSelf().available).toBe(false);
    expect(caps.apiGetCapabilities).not.toHaveBeenCalled();
    off.unmount();
    caps.apiGetCapabilities.mockResolvedValue({ emailEnabled: false });
    const closed = mount();
    await act(async () => {});
    expect(callSelf().available).toBe(false);
    closed.unmount();
    caps.apiGetCapabilities.mockResolvedValue({ emailEnabled: false, callsEnabled: true });
    mount({ canSpeak: false });
    await waitFor(() => expect(callSelf().available).toBe(true));
    expect(callSelf().canSpeak).toBe(false);
  });

  // Owner, 2026-11-07: "Joining audio and leaving audio ... is friction": walking where there is a call joins it.
  describe('joining by itself', () => {
    it('joins once calls are available, with no press, and not again while live', async () => {
      const hook = mount();
      await waitFor(() => expect(calls.made).toHaveLength(1));
      const call = calls.made[0]!;
      expect(call.start).toHaveBeenCalledTimes(1);
      expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'AudioJoin');
      act(() => setCallSelf({ phase: 'live' }));
      // A press, or a rerender, leaves a running call alone.
      act(() => callActions()!.join());
      hook.rerender({ ...base, walkers: [{ id: 'p1', at: { x: 5, y: 5 } }] });
      expect(calls.made).toHaveLength(1);
      expect(call.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ walkers: new Map([['p1', { x: 5, y: 5 }]]) }),
      );
      act(() => callActions()!.toggleMute());
      expect(call.toggleMute).toHaveBeenCalled();
      expect(telemetry.track).toHaveBeenCalledWith('UI', 'Changed', 'AudioMute');
      // Leaving the mode ends it.
      hook.rerender({ ...base, inMode: false });
      expect(call.stop).toHaveBeenCalled();
    });

    it('waits for the capabilities, and never joins with calls off', async () => {
      let answer: (v: unknown) => void = () => {};
      caps.apiGetCapabilities.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );
      const first = mount();
      await act(async () => {});
      expect(calls.made).toHaveLength(0);
      await act(async () => answer({ emailEnabled: false, callsEnabled: false }));
      expect(callSelf().available).toBe(false);
      expect(calls.made).toHaveLength(0);
      first.unmount();
      // Out of the mode: nothing either.
      caps.apiGetCapabilities.mockResolvedValue({ emailEnabled: false, callsEnabled: true });
      mount({ inMode: false });
      await act(async () => {});
      expect(calls.made).toHaveLength(0);
    });

    it('rejoins after a tab change ended the call, as a listener too', async () => {
      const hook = mount({ canSpeak: false });
      await waitFor(() => expect(calls.made).toHaveLength(1));
      expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'AudioListen');
      act(() => setCallSelf({ phase: 'live' }));
      hook.rerender({ ...base, canSpeak: false, tabId: 't2' });
      expect(calls.made[0]!.stop).toHaveBeenCalled();
      await waitFor(() => expect(calls.made).toHaveLength(2));
      hook.unmount();
      expect(calls.made[1]!.stop).toHaveBeenCalled();
      expect(callActions()).toBeNull();
    });

    it('does not join again by itself after a failure, but a press retries', async () => {
      calls.fail = true;
      const hook = mount();
      await waitFor(() => expect(callSelf().phase).toBe('error'));
      expect(audio.made[0]!.close).toHaveBeenCalled();
      calls.fail = false;
      // A tab change, with the failure standing, waits for the press.
      hook.rerender({ ...base, tabId: 't2' });
      await act(async () => {});
      expect(calls.made).toHaveLength(0);
      act(() => callActions()!.join());
      await waitFor(() => expect(calls.made).toHaveLength(1));
      // A failed call is replaced on the next press.
      act(() => setCallSelf({ phase: 'error' }));
      act(() => callActions()!.join());
      await waitFor(() => expect(calls.made).toHaveLength(2));
      expect(calls.made[0]!.stop).toHaveBeenCalled();
    });

    // Walking in joins at once, so leaving again before the call's code arrives is common: that call never starts.
    it('never starts a call whose code arrives after you left the mode or the tab', async () => {
      caps.apiGetCapabilities.mockResolvedValue({
        emailEnabled: false,
        callsEnabled: true,
        callsMode: 'off',
      });
      const view = mount();
      await waitFor(() => expect(callSelf().available).toBe(true));
      act(() => {
        callActions()!.join();
        view.rerender({ ...base, inMode: false });
      });
      await act(async () => {});
      expect(calls.made).toHaveLength(0);
      expect(audio.made[0]!.close).toHaveBeenCalled();
      expect(callSelf().phase).toBe('off');
      // A tab change while it loads, likewise.
      view.rerender({ ...base });
      await waitFor(() => expect(callSelf().available).toBe(true));
      act(() => {
        callActions()!.join();
        view.rerender({ ...base, tabId: 'other-tab' });
      });
      await act(async () => {});
      expect(calls.made).toHaveLength(0);
      expect(callSelf().phase).toBe('off');
    });

    it('does not join while a join is already on its way', async () => {
      mount();
      // A join under way (its code loading) before the capabilities answer.
      act(() => setCallSelf({ phase: 'joining' }));
      await waitFor(() => expect(callSelf().available).toBe(true));
      await act(async () => {});
      expect(calls.made).toHaveLength(0);
    });

    it('hands the call what it says to the room and who stopped its share, through the latest props', async () => {
      const send = vi.fn();
      const onShareStopped = vi.fn();
      const hook = mount({ send: vi.fn() });
      await waitFor(() => expect(calls.made).toHaveLength(1));
      hook.rerender({ ...base, send, onShareStopped });
      const input = calls.made[0]!.input as unknown as {
        send: (s: unknown) => void;
        onShareStopped: (by: string) => void;
      };
      input.send({ kind: 'calls-check' });
      input.onShareStopped('ed');
      expect(send).toHaveBeenCalledWith({ kind: 'calls-check' });
      expect(onShareStopped).toHaveBeenCalledWith('ed');
    });

    it('a resume or a close the browser refuses is let be', async () => {
      audio.state = 'suspended';
      audio.refuse = true;
      calls.fail = true;
      mount();
      await waitFor(() => expect(callSelf().phase).toBe('error'));
      expect(audio.made[0]!.close).toHaveBeenCalled();
      await act(async () => {
        window.dispatchEvent(new Event('pointerdown'));
      });
      expect(audio.made[0]!.resume).toHaveBeenCalled();
      expect(callSelf().phase).toBe('error');
    });

    // A join without a press (walking in): the browser keeps the sound until the page is touched.
    it('resumes a suspended AudioContext on the next press or key, once', async () => {
      audio.state = 'suspended';
      mount();
      await waitFor(() => expect(calls.made).toHaveLength(1));
      const context = audio.made[0]!;
      expect(context.resume).not.toHaveBeenCalled();
      act(() => {
        window.dispatchEvent(new Event('pointerdown'));
      });
      expect(context.resume).toHaveBeenCalledTimes(1);
      act(() => {
        window.dispatchEvent(new Event('keydown'));
        window.dispatchEvent(new Event('touchend'));
      });
      expect(context.resume).toHaveBeenCalledTimes(1);
    });

    it('leaves a running AudioContext alone, and one already resumed by the time of the press', async () => {
      mount();
      await waitFor(() => expect(calls.made).toHaveLength(1));
      act(() => {
        window.dispatchEvent(new Event('pointerdown'));
      });
      expect(audio.made[0]!.resume).not.toHaveBeenCalled();
      cleanup();
      act(() => resetCallSelf());
      audio.state = 'suspended';
      mount();
      await waitFor(() => expect(calls.made).toHaveLength(2));
      const context = audio.made.at(-1)!;
      context.state = 'running';
      act(() => {
        window.dispatchEvent(new Event('keydown'));
      });
      expect(context.resume).not.toHaveBeenCalled();
    });

    // A call on its way has no microphone to unmute yet; the local preview is not it either.
    it('a mute press while the call joins does nothing', async () => {
      const getUserMedia = vi.fn(async () => micStream());
      mount({ capture: { getUserMedia } });
      await waitFor(() => expect(calls.made).toHaveLength(1));
      act(() => callActions()!.toggleMute());
      expect(calls.made[0]!.toggleMute).not.toHaveBeenCalled();
      expect(getUserMedia).not.toHaveBeenCalled();
    });
  });

  // docs/specs/012-collaboration/proximity-audio.md "Local preview": the microphone with no call to send it on.
  describe('the local microphone', () => {
    it('opens on a press with no call, sends nothing, and closes on the next', async () => {
      const send = vi.fn();
      const stream = micStream();
      const getUserMedia = vi.fn(async () => stream);
      mount({ caller: null, send, capture: { getUserMedia } });
      await act(async () => {});
      expect(callSelf()).toMatchObject({
        available: false,
        canPreviewMic: true,
        previewMic: 'off',
      });
      await act(async () => callActions()!.toggleMute());
      expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: false }));
      expect(callSelf().previewMic).toBe('on');
      expect(telemetry.track).toHaveBeenCalledWith('UI', 'Changed', 'AudioMute');
      expect(send).not.toHaveBeenCalled();
      expect(calls.made).toHaveLength(0);
      act(() => callActions()!.toggleMute());
      expect(callSelf().previewMic).toBe('off');
      expect(stream.getTracks()[0]!.stop).toHaveBeenCalled();
    });

    it('a press while it starts stops it', async () => {
      let open: (s: MediaStream) => void = () => {};
      const getUserMedia = vi.fn(() => new Promise<MediaStream>((r) => (open = r)));
      mount({ caller: null, capture: { getUserMedia } });
      await act(async () => {});
      act(() => callActions()!.toggleMute());
      expect(callSelf().previewMic).toBe('starting');
      act(() => callActions()!.toggleMute());
      expect(callSelf().previewMic).toBe('off');
      const stream = micStream();
      await act(async () => open(stream));
      expect(stream.getTracks()[0]!.stop).toHaveBeenCalled();
      expect(callSelf().previewMic).toBe('off');
    });

    it('offers a Viewer none, nor a browser that cannot capture', async () => {
      const getUserMedia = vi.fn(async () => micStream());
      const viewer = mount({ caller: null, canSpeak: false, capture: { getUserMedia } });
      await act(async () => {});
      expect(callSelf().canPreviewMic).toBe(false);
      await act(async () => callActions()!.toggleMute());
      expect(getUserMedia).not.toHaveBeenCalled();
      viewer.unmount();
      mount({ caller: null });
      await act(async () => {});
      expect(callSelf().canPreviewMic).toBe(false);
      await act(async () => callActions()!.toggleMute());
      expect(callSelf().previewMic).toBe('off');
    });

    it('stops on leaving the mode, on a tab change, when a call joins, and when the canvas goes', async () => {
      const streams: MediaStream[] = [];
      const getUserMedia = vi.fn(async () => {
        const m = micStream();
        streams.push(m);
        return m;
      });
      const deps = { ...base, caller: null, capture: { getUserMedia } };
      const hook = mount(deps);
      const on = async () => {
        await act(async () => callActions()!.toggleMute());
        expect(callSelf().previewMic).toBe('on');
      };
      await on();
      hook.rerender({ ...deps, inMode: false });
      expect(streams[0]!.getTracks()[0]!.stop).toHaveBeenCalled();
      expect(callSelf().previewMic).toBe('off');
      hook.rerender(deps);
      await on();
      hook.rerender({ ...deps, tabId: 't2' });
      expect(streams[1]!.getTracks()[0]!.stop).toHaveBeenCalled();
      await on();
      // A call joining (the room arrives) takes the microphone over, muted.
      hook.rerender({ ...deps, caller: base.caller });
      await waitFor(() => expect(calls.made).toHaveLength(1));
      expect(streams[2]!.getTracks()[0]!.stop).toHaveBeenCalled();
      expect(callSelf().previewMic).toBe('off');
      act(() => setCallSelf({ phase: 'live' }));
      // Live: the press is the call's.
      act(() => callActions()!.toggleMute());
      expect(calls.made[0]!.toggleMute).toHaveBeenCalledTimes(1);
      expect(getUserMedia).toHaveBeenCalledTimes(3);
      hook.unmount();
    });

    it('turns back to the preview once a pause ended the call', async () => {
      const getUserMedia = vi.fn(async () => micStream());
      mount({ capture: { getUserMedia } });
      await waitFor(() => expect(calls.made).toHaveLength(1));
      // A pause ended it, as the real call's stop does.
      act(() => (calls.made[0]!.stop as () => void)());
      await act(async () => callActions()!.toggleMute());
      expect(calls.made[0]!.toggleMute).not.toHaveBeenCalled();
      expect(callSelf().previewMic).toBe('on');
    });
  });

  // The calls kill switch (docs/specs/016-platform/calls-kill-switch.md "Calls Paused").
  it('takes the switch from the capabilities, and joins afresh once a pause ended the call', async () => {
    caps.apiGetCapabilities.mockResolvedValue({ callsEnabled: true, callsMode: 'off' });
    mount();
    await waitFor(() => expect(callSelf()).toMatchObject({ available: true, mode: 'off' }));
    // Paused: walking in waits for the press.
    await act(async () => {});
    expect(calls.made).toHaveLength(0);
    act(() => callActions()!.join());
    await waitFor(() => expect(calls.made).toHaveLength(1));
    // A running call is left alone by a second press.
    act(() => callActions()!.join());
    expect(calls.made).toHaveLength(1);
    // The switch ended it (phase off, the call stopped): the press tries again.
    calls.made[0]!.ended = true;
    act(() => callActions()!.join());
    await waitFor(() => expect(calls.made).toHaveLength(2));
    expect(calls.made[0]!.stop).toHaveBeenCalled();
  });

  it('a press without a room does nothing', async () => {
    mount({ caller: null });
    await act(async () => {});
    act(() => callActions()!.join());
    expect(calls.made).toHaveLength(0);
  });

  // docs/specs/012-collaboration/video-and-screen-bubbles.md "Telemetry" and "Share roles".
  it('drives the camera and the share, counting each start, and says who may share', async () => {
    mount({ canShare: true, view: { x: 0, y: 0, width: 100, height: 100 } });
    await waitFor(() => expect(callSelf().available).toBe(true));
    expect(callSelf().canShare).toBe(true);
    await waitFor(() => expect(calls.made).toHaveLength(1));
    const call = calls.made[0]!;
    // Nothing to drive while the call joins (and no preview where the browser cannot capture).
    telemetry.track.mockClear();
    act(() => callActions()!.toggleCamera());
    act(() => callActions()!.toggleScreen());
    expect(telemetry.track).not.toHaveBeenCalled();
    expect(call.toggleCamera).not.toHaveBeenCalled();
    expect(call.update).toHaveBeenCalledWith(
      expect.objectContaining({ view: { x: 0, y: 0, width: 100, height: 100 } }),
    );
    act(() => setCallSelf({ phase: 'live' }));
    act(() => callActions()!.toggleCamera());
    act(() => callActions()!.toggleScreen());
    expect(call.toggleCamera).toHaveBeenCalledTimes(1);
    expect(call.toggleScreen).toHaveBeenCalledTimes(1);
    expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'CameraOn');
    expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'ScreenShare');
    // Turning them off is not counted.
    telemetry.track.mockClear();
    act(() => setCallSelf({ camera: 'on', screen: 'on' }));
    act(() => callActions()!.toggleCamera());
    act(() => callActions()!.toggleScreen());
    expect(telemetry.track).not.toHaveBeenCalled();
  });

  // docs/specs/012-collaboration/video-and-screen-bubbles.md "Local preview".
  describe('a local preview', () => {
    function fakeCapture() {
      const tracks: { stop: ReturnType<typeof vi.fn> }[] = [];
      const stream = () => {
        const track = { stop: vi.fn(), contentHint: '', addEventListener: vi.fn() };
        tracks.push(track);
        return {
          getVideoTracks: () => [track],
          getTracks: () => [track],
        } as unknown as MediaStream;
      };
      return {
        tracks,
        capture: {
          getUserMedia: vi.fn(async () => stream()),
          getDisplayMedia: vi.fn(async () => stream()),
        },
      };
    }

    it('offers the camera and screen with no room, captures on a press and sends nothing', async () => {
      const send = vi.fn();
      const { capture, tracks } = fakeCapture();
      mount({ caller: null, send, capture });
      await act(async () => {});
      expect(callSelf()).toMatchObject({
        available: false,
        canPreviewCamera: true,
        canPreviewScreen: true,
      });
      await act(async () => callActions()!.toggleCamera());
      await act(async () => callActions()!.toggleScreen());
      expect(capture.getUserMedia).toHaveBeenCalledTimes(1);
      expect(callSelf()).toMatchObject({ previewCamera: 'on', previewScreen: 'on' });
      expect(callMedia().get(SELF_MEDIA_ID)?.video).toBeTruthy();
      expect(calls.made).toHaveLength(0);
      expect(send).not.toHaveBeenCalled();
      expect(caps.apiGetCapabilities).not.toHaveBeenCalled();
      // Counted as any camera or share is.
      expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'CameraOn');
      expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'ScreenShare');
      telemetry.track.mockClear();
      act(() => callActions()!.toggleCamera());
      act(() => callActions()!.toggleScreen());
      expect(tracks.every((t) => t.stop.mock.calls.length > 0)).toBe(true);
      expect(callMedia().size).toBe(0);
      expect(telemetry.track).not.toHaveBeenCalled();
    });

    it('offers a Viewer none, and none where the browser cannot capture', async () => {
      const { capture } = fakeCapture();
      const viewer = mount({ canSpeak: false, send: undefined, capture });
      await act(async () => {});
      expect(callSelf()).toMatchObject({ canPreviewCamera: false, canPreviewScreen: false });
      await act(async () => callActions()!.toggleCamera());
      expect(capture.getUserMedia).not.toHaveBeenCalled();
      viewer.unmount();
      // jsdom has no camera API: nothing offered, a press does nothing.
      mount({ send: undefined });
      await act(async () => {});
      expect(callSelf()).toMatchObject({ canPreviewCamera: false, canPreviewScreen: false });
      await act(async () => callActions()!.toggleCamera());
      expect(callSelf().previewCamera).toBe('off');
    });

    it('stops on leaving the mode, on a tab change and when the canvas goes', async () => {
      const { capture, tracks } = fakeCapture();
      const hook = mount({ send: undefined, capture });
      const on = async () => {
        await act(async () => callActions()!.toggleCamera());
        expect(callSelf().previewCamera).toBe('on');
      };
      await on();
      hook.rerender({ ...base, send: undefined, capture, inMode: false });
      expect(tracks[0]!.stop).toHaveBeenCalled();
      expect(callMedia().size).toBe(0);
      hook.rerender({ ...base, send: undefined, capture });
      await on();
      hook.rerender({ ...base, send: undefined, capture, tabId: 't2' });
      expect(tracks[1]!.stop).toHaveBeenCalled();
      await on();
      hook.unmount();
      expect(tracks[2]!.stop).toHaveBeenCalled();
      expect(callMedia().size).toBe(0);
    });

    it('hands the preview to the call on join, and routes the buttons by who may send', async () => {
      const { capture } = fakeCapture();
      mount({ capture });
      await waitFor(() => expect(callSelf().available).toBe(true));
      // Before the call is live: the preview's.
      await act(async () => callActions()!.toggleCamera());
      expect(callSelf().previewCamera).toBe('on');
      await waitFor(() => expect(calls.made).toHaveLength(1));
      const call = calls.made[0]!;
      expect(call.input.preview?.stream('camera')).toBe(callMedia().get(SELF_MEDIA_ID)?.video);
      act(() => setCallSelf({ phase: 'live' }));
      // A preview that is on turns off, whatever the call.
      act(() => callActions()!.toggleCamera());
      expect(callSelf().previewCamera).toBe('off');
      expect(call.toggleCamera).not.toHaveBeenCalled();
      // Off, a live call drives the camera; a Participant's screen is a preview even in a call.
      act(() => callActions()!.toggleCamera());
      expect(call.toggleCamera).toHaveBeenCalledTimes(1);
      await act(async () => callActions()!.toggleScreen());
      expect(call.toggleScreen).not.toHaveBeenCalled();
      expect(callSelf().previewScreen).toBe('on');
    });

    it('a refusal from before the join is the live call’s to retry', async () => {
      const { capture } = fakeCapture();
      capture.getUserMedia.mockRejectedValueOnce(new Error('NotAllowed'));
      mount({ capture });
      await waitFor(() => expect(callSelf().available).toBe(true));
      await act(async () => callActions()!.toggleCamera());
      expect(callSelf().previewCamera).toBe('blocked');
      await waitFor(() => expect(calls.made).toHaveLength(1));
      act(() => setCallSelf({ phase: 'live' }));
      act(() => callActions()!.toggleCamera());
      expect(calls.made[0]!.toggleCamera).toHaveBeenCalledTimes(1);
      expect(callSelf().previewCamera).toBe('off');
    });
  });

  // docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand" and "Do Not Disturb".
  it('raises and lowers the hand, and tells the call of Do Not Disturb from the start and on a change', async () => {
    const hook = mount({ doNotDisturb: true });
    // Nothing to raise before the call is made.
    act(() => callActions()!.raiseHand());
    await waitFor(() => expect(calls.made).toHaveLength(1));
    const call = calls.made[0]!;
    expect(call.setDoNotDisturb).toHaveBeenCalledWith(true);
    act(() => callActions()!.raiseHand());
    act(() => callActions()!.lowerHand());
    expect(call.raiseHand).toHaveBeenCalledTimes(1);
    expect(call.lowerHand).toHaveBeenCalledTimes(1);
    hook.rerender({ ...base, doNotDisturb: false });
    expect(call.setDoNotDisturb).toHaveBeenLastCalledWith(false);
  });
});
