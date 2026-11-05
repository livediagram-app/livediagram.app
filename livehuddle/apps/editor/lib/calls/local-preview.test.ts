// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callMedia,
  callSelf,
  resetCallMedia,
  resetCallSelf,
  SELF_MEDIA_ID,
  setCallSelf,
  type CallSelf,
} from './calls-store';
import {
  canCapture,
  LocalPreview,
  localOnly,
  selfCamera,
  selfScreen,
  useLocalOnly,
} from './local-preview';
import { CAMERA_CONSTRAINTS, SCREEN_CONSTRAINTS } from './media-constraints';

// Every track a fake capture hands out, so a test can prove none is left running.
const made: { stop: ReturnType<typeof vi.fn>; stopped: () => boolean }[] = [];

function fakeStream() {
  const listeners = new Map<string, () => void>();
  let stopped = false;
  const track = {
    stop: vi.fn(() => {
      stopped = true;
    }),
    contentHint: '',
    addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
    end: () => listeners.get('ended')?.(),
  };
  made.push({ stop: track.stop, stopped: () => stopped });
  return {
    track,
    stream: { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream,
  };
}

afterEach(() => {
  resetCallSelf();
  resetCallMedia();
  made.length = 0;
  vi.unstubAllGlobals();
});

// docs/specs/012-collaboration/video-and-screen-bubbles.md "Local preview".
describe('LocalPreview', () => {
  it('captures the camera at the call sizes, shows it as your own bubble, and releases it on stop', async () => {
    const cam = fakeStream();
    const getUserMedia = vi.fn(async () => cam.stream);
    const preview = new LocalPreview({ getUserMedia });
    const heard = vi.fn();
    preview.subscribe(heard);
    await preview.start('camera');
    expect(getUserMedia).toHaveBeenCalledWith(CAMERA_CONSTRAINTS);
    expect(callSelf().previewCamera).toBe('on');
    expect(callMedia().get(SELF_MEDIA_ID)?.video).toBe(cam.stream);
    expect(preview.stream('camera')).toBe(cam.stream);
    expect(heard).toHaveBeenCalledTimes(1);
    preview.stop('camera');
    expect(cam.track.stop).toHaveBeenCalled();
    expect(callSelf().previewCamera).toBe('off');
    expect(callMedia().has(SELF_MEDIA_ID)).toBe(false);
  });

  it('reads a refused camera as blocked and a cancelled picker as off, never an error', async () => {
    const preview = new LocalPreview({
      getUserMedia: () => Promise.reject(new Error('NotAllowed')),
      getDisplayMedia: () => Promise.reject(new Error('AbortError')),
    });
    await preview.start('camera');
    expect(callSelf().previewCamera).toBe('blocked');
    await preview.start('screen');
    expect(callSelf().previewScreen).toBe('off');
    expect(callMedia().size).toBe(0);
  });

  it('shares a screen at the screen caps, tuned for text, and stops on the browser’s own Stop', async () => {
    const display = fakeStream();
    const getDisplayMedia = vi.fn(async () => display.stream);
    const preview = new LocalPreview({ getDisplayMedia });
    await preview.start('screen');
    expect(getDisplayMedia).toHaveBeenCalledWith(SCREEN_CONSTRAINTS);
    expect(display.track.contentHint).toBe('detail');
    expect(callSelf().previewScreen).toBe('on');
    display.track.end();
    expect(display.track.stop).toHaveBeenCalled();
    expect(callSelf().previewScreen).toBe('off');
    expect(callMedia().size).toBe(0);
  });

  it('asks once while a capture is on its way, and a stop meanwhile releases what arrives', async () => {
    const cam = fakeStream();
    let resolve!: (s: MediaStream) => void;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((r) => (resolve = r)));
    const preview = new LocalPreview({ getUserMedia });
    const opening = preview.start('camera');
    void preview.start('camera');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(callSelf().previewCamera).toBe('starting');
    preview.stop('camera');
    resolve(cam.stream);
    await opening;
    expect(cam.track.stop).toHaveBeenCalled();
    expect(callSelf().previewCamera).toBe('off');
    expect(callMedia().size).toBe(0);
  });

  it('hands a stream over still running, and leaves no track running once everything stops', async () => {
    const preview = new LocalPreview({
      getUserMedia: async () => fakeStream().stream,
      getDisplayMedia: async () => fakeStream().stream,
    });
    await preview.start('camera');
    const taken = preview.take('camera');
    expect(taken).not.toBeNull();
    expect(made[0]!.stopped()).toBe(false);
    expect(callSelf().previewCamera).toBe('off');
    // The bubble stays: the taker now shows and owns it.
    expect(callMedia().get(SELF_MEDIA_ID)?.video).toBe(taken);
    expect(preview.take('camera')).toBeNull();
    for (const t of taken!.getTracks()) t.stop();
    // A run of presses, then everything stops: nothing captured is left running.
    await preview.start('camera');
    preview.stop('camera');
    await preview.start('camera');
    await preview.start('screen');
    preview.stopAll();
    expect(made.length).toBe(4);
    expect(made.every((t) => t.stopped())).toBe(true);
  });

  it('can capture only in a secure context with the API', () => {
    vi.stubGlobal('isSecureContext', false);
    expect(canCapture('camera')).toBe(false);
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', { mediaDevices: undefined });
    expect(canCapture('camera')).toBe(false);
    // A phone has a camera but no screen picker.
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => {} } });
    expect(canCapture('camera')).toBe(true);
    expect(canCapture('screen')).toBe(false);
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: () => {}, getDisplayMedia: () => {} },
    });
    expect(canCapture('screen')).toBe(true);
  });

  it('shows the call’s camera and screen first, else the preview’s, and says which are yours alone', () => {
    const at = (patch: Partial<CallSelf>) => ({ ...callSelf(), ...patch });
    expect(selfCamera(at({ previewCamera: 'on' }))).toBe('on');
    expect(selfCamera(at({ camera: 'starting', previewCamera: 'blocked' }))).toBe('starting');
    expect(selfScreen(at({ previewScreen: 'starting' }))).toBe('starting');
    expect(selfScreen(at({ screen: 'on' }))).toBe('on');
    expect(localOnly(at({ previewCamera: 'on' }), 'video')).toBe(true);
    expect(localOnly(at({ previewCamera: 'on', camera: 'on' }), 'video')).toBe(false);
    expect(localOnly(at({ previewScreen: 'on' }), 'screen')).toBe(true);
    expect(localOnly(at({ previewScreen: 'on', screen: 'on' }), 'screen')).toBe(false);
  });

  it('hands the bubble layer which own bubbles are previews, and nothing else of the call', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useLocalOnly();
    });
    expect(result.current).toEqual({ video: false, screen: false });
    act(() => setCallSelf({ previewCamera: 'on' }));
    expect(result.current).toEqual({ video: true, screen: false });
    act(() => setCallSelf({ previewScreen: 'on' }));
    expect(result.current).toEqual({ video: true, screen: true });
    const before = renders;
    // A level or a heard set changing re-renders nothing.
    act(() => setCallSelf({ level: 2, heard: new Set(['p1']) }));
    expect(renders).toBe(before);
  });
});
