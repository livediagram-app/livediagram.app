// @vitest-environment jsdom
// The microphone with no call to send it on (docs/specs/012-collaboration/proximity-audio.md "Local preview"): opened on
// a press, sampled for your own equaliser, sent to nobody, and closed on the next.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callSelf, resetCallSelf } from './calls-store';
import { LocalMic } from './local-mic';
import { MIC_CONSTRAINTS } from './media-constraints';
import { VOICE_SAMPLE_MS } from './voice-detector';

// The analyser's samples: loud (a talker) or silent.
const audio = vi.hoisted(() => ({
  loudness: 0,
  contexts: [] as { close: ReturnType<typeof vi.fn>; connected: unknown[] }[],
}));

beforeEach(() => {
  vi.useFakeTimers();
  audio.loudness = 0;
  audio.contexts.length = 0;
  vi.stubGlobal(
    'AudioContext',
    class {
      close = vi.fn(async () => {});
      connected: unknown[] = [];
      constructor() {
        audio.contexts.push(this);
      }
      createAnalyser() {
        return {
          fftSize: 0,
          getFloatTimeDomainData: (out: Float32Array) => out.fill(audio.loudness),
        };
      }
      createMediaStreamSource(stream: MediaStream) {
        return { connect: (to: unknown) => this.connected.push([stream, to]) };
      }
    },
  );
});
afterEach(() => {
  resetCallSelf();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function micStream() {
  const track = { stop: vi.fn() };
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream };
}

describe('LocalMic', () => {
  it('reads Starting while the browser asks, then On, from the microphone alone', async () => {
    const { stream } = micStream();
    const getUserMedia = vi.fn(async () => stream);
    const mic = new LocalMic(getUserMedia);
    expect(mic.on).toBe(false);
    const started = mic.start();
    expect(callSelf().previewMic).toBe('starting');
    await started;
    expect(getUserMedia).toHaveBeenCalledWith(MIC_CONSTRAINTS);
    expect(callSelf().previewMic).toBe('on');
    expect(mic.on).toBe(true);
    expect(audio.contexts).toHaveLength(1);
    expect(audio.contexts[0]!.connected).toHaveLength(1);
    // Already on: a second start asks for nothing.
    await mic.start();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    mic.stop();
  });

  it('a refusal reads Blocked and opens nothing', async () => {
    const mic = new LocalMic(() => Promise.reject(new Error('NotAllowed')));
    await mic.start();
    expect(callSelf().previewMic).toBe('blocked');
    expect(mic.on).toBe(false);
    expect(audio.contexts).toHaveLength(0);
  });

  it('a refusal after a stop changes nothing', async () => {
    let refuse: (e: Error) => void = () => {};
    const mic = new LocalMic(() => new Promise((_, reject) => (refuse = reject)));
    const started = mic.start();
    mic.stop();
    refuse(new Error('NotAllowed'));
    await started;
    expect(callSelf().previewMic).toBe('off');
  });

  it('a stop while the browser asks releases the stream when it lands, never showing it', async () => {
    const { stream, track } = micStream();
    let open: (s: MediaStream) => void = () => {};
    const mic = new LocalMic(() => new Promise((resolve) => (open = resolve)));
    const started = mic.start();
    mic.stop();
    expect(callSelf().previewMic).toBe('off');
    open(stream);
    await started;
    expect(track.stop).toHaveBeenCalled();
    expect(mic.on).toBe(false);
    expect(callSelf().previewMic).toBe('off');
    expect(audio.contexts).toHaveLength(0);
  });

  it('samples your voice into your own level, and silence brings it back down', async () => {
    const { stream } = micStream();
    const mic = new LocalMic(async () => stream);
    await mic.start();
    expect(callSelf().level).toBe(0);
    audio.loudness = 0.1;
    vi.advanceTimersByTime(VOICE_SAMPLE_MS);
    expect(callSelf().level).toBeGreaterThan(0);
    mic.stop();
    expect(callSelf().level).toBe(0);
  });

  it('a stop silences the level, releases the microphone and closes its AudioContext', async () => {
    const { stream, track } = micStream();
    const mic = new LocalMic(async () => stream);
    await mic.start();
    audio.loudness = 0.1;
    vi.advanceTimersByTime(VOICE_SAMPLE_MS);
    mic.stop();
    expect(track.stop).toHaveBeenCalled();
    expect(audio.contexts[0]!.close).toHaveBeenCalled();
    expect(callSelf()).toMatchObject({ previewMic: 'off', level: 0 });
    expect(mic.on).toBe(false);
    // Sampling has stopped: a loud room changes nothing now.
    vi.advanceTimersByTime(VOICE_SAMPLE_MS * 10);
    expect(callSelf().level).toBe(0);
    // A second stop is harmless.
    mic.stop();
  });

  it('a failed close of its AudioContext is let be', async () => {
    const { stream } = micStream();
    const mic = new LocalMic(async () => stream);
    await mic.start();
    audio.contexts[0]!.close.mockRejectedValueOnce(new Error('closed'));
    mic.stop();
    await Promise.resolve();
    expect(callSelf().previewMic).toBe('off');
  });

  it('asks the browser’s own getUserMedia when none is given', async () => {
    const { stream } = micStream();
    const getUserMedia = vi.fn(async () => stream);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const mic = new LocalMic();
    await mic.start();
    expect(getUserMedia).toHaveBeenCalledWith(MIC_CONSTRAINTS);
    mic.stop();
  });
});
