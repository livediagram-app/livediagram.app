// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
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
vi.mock('./proximity-call', () => ({
  ProximityCall: class {
    update = vi.fn();
    start = vi.fn(async () => {});
    stop = vi.fn();
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
  vi.stubGlobal(
    'AudioContext',
    class {
      close = vi.fn(async () => {});
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

  // docs/specs/012-collaboration/proximity-audio.md "No call here": why walking offers no call, for Join Audio to say.
  describe('why there is no call', () => {
    it('is unsynced in a Space with no shared room, without asking the server', async () => {
      mount({ send: undefined });
      await act(async () => {});
      expect(callSelf().unavailableReason).toBe('unsynced');
      expect(caps.apiGetCapabilities).not.toHaveBeenCalled();
    });

    it('is unsynced with no caller either', async () => {
      mount({ caller: null });
      await act(async () => {});
      expect(callSelf().unavailableReason).toBe('unsynced');
    });

    it('is off once the capabilities say calls are off', async () => {
      caps.apiGetCapabilities.mockResolvedValue({ emailEnabled: false, callsEnabled: false });
      mount();
      await waitFor(() => expect(callSelf().unavailableReason).toBe('off'));
      expect(callSelf().available).toBe(false);
    });

    it('is none while the capabilities load, so a synced Space never flashes a reason', async () => {
      let answer: (v: unknown) => void = () => {};
      caps.apiGetCapabilities.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );
      mount();
      await act(async () => {});
      expect(callSelf().unavailableReason).toBeNull();
      await act(async () => answer({ emailEnabled: false, callsEnabled: true }));
      await waitFor(() => expect(callSelf().available).toBe(true));
      expect(callSelf().unavailableReason).toBeNull();
    });

    it('is none when calls are on', async () => {
      mount();
      await waitFor(() => expect(callSelf().available).toBe(true));
      expect(callSelf().unavailableReason).toBeNull();
    });

    it('is none out of the mode, room or not', async () => {
      const noRoom = mount({ inMode: false, send: undefined });
      await act(async () => {});
      expect(callSelf().unavailableReason).toBeNull();
      noRoom.unmount();
      caps.apiGetCapabilities.mockResolvedValue({ emailEnabled: false, callsEnabled: false });
      mount({ inMode: false });
      await act(async () => {});
      expect(callSelf().unavailableReason).toBeNull();
    });
  });

  it('joins on the press, feeds the call positions, and leaves with the mode', async () => {
    const hook = mount();
    await waitFor(() => expect(callSelf().available).toBe(true));
    act(() => callActions()!.join());
    await waitFor(() => expect(calls.made).toHaveLength(1));
    const call = calls.made[0]!;
    expect(call.start).toHaveBeenCalled();
    expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'AudioJoin');
    act(() => callActions()!.join());
    expect(calls.made).toHaveLength(1);
    hook.rerender({ ...base, walkers: [{ id: 'p1', at: { x: 5, y: 5 } }] });
    expect(call.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ walkers: new Map([['p1', { x: 5, y: 5 }]]) }),
    );
    act(() => callActions()!.toggleMute());
    expect(call.toggleMute).toHaveBeenCalled();
    expect(telemetry.track).toHaveBeenCalledWith('UI', 'Changed', 'AudioMute');
    hook.rerender({ ...base, inMode: false });
    expect(call.stop).toHaveBeenCalled();
  });

  it('ends the call on a tab change and on leaving, and rejoins after a failure', async () => {
    const hook = mount({ canSpeak: false });
    await waitFor(() => expect(callSelf().available).toBe(true));
    act(() => callActions()!.join());
    await waitFor(() => expect(calls.made).toHaveLength(1));
    expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'AudioListen');
    hook.rerender({ ...base, canSpeak: false, tabId: 't2' });
    expect(calls.made[0]!.stop).toHaveBeenCalled();
    act(() => callActions()!.join());
    await waitFor(() => expect(calls.made).toHaveLength(2));
    act(() => callActions()!.leave());
    expect(calls.made[1]!.stop).toHaveBeenCalled();
    calls.fail = true;
    act(() => callActions()!.join());
    await waitFor(() => expect(callSelf().phase).toBe('error'));
    calls.fail = false;
    act(() => callActions()!.join());
    await waitFor(() => expect(calls.made).toHaveLength(3));
    hook.unmount();
    expect(calls.made[2]!.stop).toHaveBeenCalled();
    expect(callActions()).toBeNull();
  });

  // The calls kill switch (docs/specs/016-platform/calls-kill-switch.md "Calls Paused").
  it('takes the switch from the capabilities, and joins afresh once a pause ended the call', async () => {
    caps.apiGetCapabilities.mockResolvedValue({ callsEnabled: true, callsMode: 'off' });
    mount();
    await waitFor(() => expect(callSelf()).toMatchObject({ available: true, mode: 'off' }));
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
    // Nothing to drive before joining.
    act(() => callActions()!.toggleCamera());
    act(() => callActions()!.toggleScreen());
    expect(telemetry.track).not.toHaveBeenCalled();
    act(() => callActions()!.join());
    await waitFor(() => expect(calls.made).toHaveLength(1));
    const call = calls.made[0]!;
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
      // Before joining: the preview's.
      await act(async () => callActions()!.toggleCamera());
      expect(callSelf().previewCamera).toBe('on');
      act(() => callActions()!.join());
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
      act(() => callActions()!.join());
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
    await waitFor(() => expect(callSelf().available).toBe(true));
    // Nothing to raise before joining.
    act(() => callActions()!.raiseHand());
    act(() => callActions()!.join());
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
