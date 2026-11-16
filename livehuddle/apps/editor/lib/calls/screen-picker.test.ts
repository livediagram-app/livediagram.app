// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CallVideo, type CallVideoHost } from './call-video';
import { callSelf, resetCallMedia, resetCallSelf } from './calls-store';
import { LocalPreview } from './local-preview';
import { SCREEN_CONSTRAINTS } from './media-constraints';
import { captureControllerClass, pickScreen, type FocusController } from './screen-picker';
import type { SfuSession } from './sfu-session';

// docs/specs/012-collaboration/video-and-screen-bubbles.md "The screen share" (the picker hints, #953).

type Settings = { displaySurface?: string; width?: number; height?: number };

// A shared surface as each browser hands it back: Chrome and Edge say which surface it is, Firefox may not, and an
// old Safari track has no getSettings at all.
function displayStream(settings: Settings | null) {
  const listeners = new Map<string, () => void>();
  let current = settings;
  const track = {
    stop: vi.fn(),
    contentHint: '',
    addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
    end: () => listeners.get('ended')?.(),
    ...(settings ? { getSettings: () => current } : {}),
    // Share this tab instead: the browser swaps the source under the same track; nothing ends.
    switchTo: (next: Settings) => {
      current = next;
    },
  };
  return {
    track,
    stream: { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream,
  };
}

// A Chromium CaptureController: records each focus decision; `late` makes it throw as a call after the window does.
function fakeController(late = false) {
  const made: { setFocusBehavior: ReturnType<typeof vi.fn> }[] = [];
  class Controller implements FocusController {
    setFocusBehavior = vi.fn(() => {
      if (late) throw new DOMException('Too late', 'InvalidStateError');
    });
    constructor() {
      made.push(this);
    }
  }
  return { Controller, made };
}

afterEach(() => {
  resetCallSelf();
  resetCallMedia();
  vi.unstubAllGlobals();
});

describe('SCREEN_CONSTRAINTS', () => {
  it('keeps the caps and adds the picker hints', () => {
    expect(SCREEN_CONSTRAINTS).toEqual({
      audio: false,
      video: { width: { max: 1920 }, height: { max: 1080 }, frameRate: { ideal: 15, max: 15 } },
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include',
    });
  });
});

describe('captureControllerClass', () => {
  it('finds Chromium’s CaptureController and nothing in Firefox or Safari', () => {
    expect(captureControllerClass()).toBeUndefined();
    const { Controller } = fakeController();
    vi.stubGlobal('CaptureController', Controller);
    expect(captureControllerClass()).toBe(Controller);
    vi.stubGlobal('CaptureController', {});
    expect(captureControllerClass()).toBeUndefined();
  });
});

describe('pickScreen', () => {
  it.each(['browser', 'window'])(
    'Chrome: keeps the focus on livehuddle after a %s share, in the same microtask',
    async (surface) => {
      const { Controller, made } = fakeController();
      const display = displayStream({ displaySurface: surface });
      let resolved = false;
      const getDisplayMedia = vi.fn(async () => {
        resolved = true;
        return display.stream;
      });
      const stream = await pickScreen(getDisplayMedia, Controller);
      expect(resolved).toBe(true);
      expect(stream).toBe(display.stream);
      expect(made).toHaveLength(1);
      expect(getDisplayMedia).toHaveBeenCalledWith({ ...SCREEN_CONSTRAINTS, controller: made[0] });
      expect(made[0]!.setFocusBehavior).toHaveBeenCalledExactlyOnceWith('no-focus-change');
    },
  );

  it('Chrome: a whole screen has no focus to keep, so none is asked', async () => {
    const { Controller, made } = fakeController();
    await pickScreen(async () => displayStream({ displaySurface: 'monitor' }).stream, Controller);
    expect(made[0]!.setFocusBehavior).not.toHaveBeenCalled();
  });

  it('a refused or late focus call never fails the share', async () => {
    const { Controller, made } = fakeController(true);
    const display = displayStream({ displaySurface: 'browser' });
    await expect(pickScreen(async () => display.stream, Controller)).resolves.toBe(display.stream);
    expect(made[0]!.setFocusBehavior).toHaveBeenCalled();
  });

  it('asks for the focus when the browser does not say which surface it is', async () => {
    const { Controller, made } = fakeController();
    await pickScreen(async () => displayStream({}).stream, Controller);
    await pickScreen(async () => displayStream(null).stream, Controller);
    expect(made[0]!.setFocusBehavior).toHaveBeenCalledWith('no-focus-change');
    expect(made[1]!.setFocusBehavior).toHaveBeenCalledWith('no-focus-change');
  });

  it('a fresh controller for every picker, as the spec requires', async () => {
    const { Controller, made } = fakeController();
    await pickScreen(async () => displayStream({ displaySurface: 'browser' }).stream, Controller);
    await pickScreen(async () => displayStream({ displaySurface: 'browser' }).stream, Controller);
    expect(made).toHaveLength(2);
    expect(made[0]).not.toBe(made[1]);
  });

  it('Firefox: no CaptureController, the plain options and no error', async () => {
    const display = displayStream({});
    const getDisplayMedia = vi.fn(async (_options: DisplayMediaStreamOptions) => display.stream);
    await expect(pickScreen(getDisplayMedia)).resolves.toBe(display.stream);
    expect(getDisplayMedia).toHaveBeenCalledWith(SCREEN_CONSTRAINTS);
    expect(getDisplayMedia.mock.calls[0]![0]).not.toHaveProperty('controller');
  });

  it('Safari: no CaptureController and no getSettings, the plain options and no error', async () => {
    const display = displayStream(null);
    const getDisplayMedia = vi.fn(async () => display.stream);
    await expect(pickScreen(getDisplayMedia, undefined)).resolves.toBe(display.stream);
    expect(getDisplayMedia).toHaveBeenCalledWith(SCREEN_CONSTRAINTS);
  });

  it('a cancelled picker still rejects, and asks for no focus', async () => {
    const { Controller, made } = fakeController();
    await expect(
      pickScreen(
        () => Promise.reject(new DOMException('cancelled', 'NotAllowedError')),
        Controller,
      ),
    ).rejects.toThrow('cancelled');
    expect(made[0]!.setFocusBehavior).not.toHaveBeenCalled();
  });
});

// The call's picker (call-video.ts) and the local preview's (local-preview.ts) must ask alike.
describe('both pickers', () => {
  function callVideo(getDisplayMedia: (o: DisplayMediaStreamOptions) => Promise<MediaStream>) {
    const sfu = {
      publish: vi.fn(async () => {}),
      replaceTrack: vi.fn(async () => {}),
    } as unknown as SfuSession;
    const host: CallVideoHost = {
      input: { canShare: true, getDisplayMedia } as unknown as CallVideoHost['input'],
      sfu: () => sfu,
      trackToken: () => 'token',
      stopped: () => false,
      renewing: () => false,
      announce: vi.fn(),
    };
    return { video: new CallVideo(host), sfu };
  }

  it.each([
    ['Chrome', true],
    ['Firefox or Safari', false],
  ])('%s: pass the same options and keep the same focus', async (_browser, chromium) => {
    const { Controller, made } = fakeController();
    if (chromium) vi.stubGlobal('CaptureController', Controller);
    const fromCall = vi.fn(async () => displayStream({ displaySurface: 'browser' }).stream);
    const fromPreview = vi.fn(async () => displayStream({ displaySurface: 'browser' }).stream);
    await callVideo(fromCall).video.toggleScreen();
    await new LocalPreview({ getDisplayMedia: fromPreview }).start('screen');
    const [callOptions] = fromCall.mock.calls[0]! as unknown as [{ controller?: object }];
    const [previewOptions] = fromPreview.mock.calls[0]! as unknown as [{ controller?: object }];
    // Each picker has its own controller (one per call), the rest is the same.
    const { controller: callController, ...callRest } = callOptions;
    const { controller: previewController, ...previewRest } = previewOptions;
    expect(callRest).toEqual(SCREEN_CONSTRAINTS);
    expect(previewRest).toEqual(SCREEN_CONSTRAINTS);
    expect(callController).toBe(chromium ? made[0] : undefined);
    expect(previewController).toBe(chromium ? made[1] : undefined);
    expect(made).toHaveLength(chromium ? 2 : 0);
    for (const c of made) expect(c.setFocusBehavior).toHaveBeenCalledWith('no-focus-change');
  });

  it('Share this tab instead keeps the track: no drop, no republish, the cap and text tuning stay', async () => {
    const display = displayStream({ displaySurface: 'browser', width: 1920, height: 1080 });
    const { video, sfu } = callVideo(async () => display.stream);
    await video.toggleScreen();
    expect(callSelf().screen).toBe('on');
    display.track.switchTo({ displaySurface: 'browser', width: 1280, height: 800 });
    expect(callSelf().screen).toBe('on');
    expect(video.screen).toBe(display.stream);
    expect(display.track.contentHint).toBe('detail');
    expect(display.track.stop).not.toHaveBeenCalled();
    expect(sfu.publish).toHaveBeenCalledTimes(1);
    expect(sfu.replaceTrack).not.toHaveBeenCalled();
  });
});
