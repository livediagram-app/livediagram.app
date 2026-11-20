// @vitest-environment jsdom
// The audio a press starts (primeAudio) and the recorder's steady sound (steadyAudio): Brave holds a context no press
// started suspended, and some USB microphones read straight record slow; both are worked round here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Each test starts with nothing primed: the module keeps the primed context.
const load = async () => {
  vi.resetModules();
  return {
    level: await import('./level'),
    steady: await import('./steady-audio'),
  };
};

type Ctx = {
  state: string;
  resume: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  createAnalyser: () => { fftSize: number; getFloatTimeDomainData: () => void };
  createMediaStreamSource: ReturnType<typeof vi.fn>;
  createMediaStreamDestination: () => { stream: { getAudioTracks: () => string[] } };
  source: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
};
const context = (state = 'running', resumeFails = false): Ctx => {
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const ctx: Ctx = {
    state,
    resume: vi.fn(() => {
      if (resumeFails) return Promise.reject(new Error('no press'));
      ctx.state = 'running';
      return Promise.resolve();
    }),
    close: vi.fn(() => Promise.resolve()),
    createAnalyser: () => ({ fftSize: 0, getFloatTimeDomainData: () => undefined }),
    createMediaStreamSource: vi.fn(() => source),
    createMediaStreamDestination: () => ({ stream: { getAudioTracks: () => ['steady-audio'] } }),
    source,
  };
  return ctx;
};

class FakeMediaStream {
  readonly tracks: unknown[];
  constructor(tracks: unknown[]) {
    this.tracks = tracks;
  }
}
const mic = (audio: string[] = ['mic'], video: string[] = []) =>
  ({ getAudioTracks: () => audio, getVideoTracks: () => video }) as unknown as MediaStream;

beforeEach(() => vi.stubGlobal('MediaStream', FakeMediaStream));
afterEach(() => vi.unstubAllGlobals());

describe('primeAudio', () => {
  it('starts one context inside the press, resumes it on the next, and shares it with the meter', async () => {
    const { level } = await load();
    expect(level.primedAudio()).toBeNull();
    const ctx = context('suspended');
    level.primeAudio(() => ctx as never);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(level.primedAudio()).toBe(ctx);
    // A second press resumes the same one rather than making another.
    const other = vi.fn();
    level.primeAudio(other);
    expect(other).not.toHaveBeenCalled();
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    // The meter reads through it, and closing the meter keeps it for the next one.
    const meter = level.levelMeter(mic());
    meter.close();
    expect(ctx.source.disconnect).toHaveBeenCalled();
    expect(ctx.close).not.toHaveBeenCalled();
  });

  it('starts again once the primed one has closed, and stays unprimed with no Web Audio', async () => {
    const { level } = await load();
    const first = context();
    level.primeAudio(() => first as never);
    first.state = 'closed';
    expect(level.primedAudio()).toBeNull();
    const second = context('running', true);
    level.primeAudio(() => second as never);
    expect(level.primedAudio()).toBe(second);
    const { level: fresh } = await load();
    fresh.primeAudio(() => {
      throw new Error('no AudioContext');
    });
    expect(fresh.primedAudio()).toBeNull();
  });

  it('makes its own context when nothing is primed (the browser default)', async () => {
    const { level } = await load();
    const ctx = context();
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function AudioContext() {
        return ctx;
      }),
    );
    level.primeAudio();
    expect(level.primedAudio()).toBe(ctx);
  });

  it('wakes a suspended meter on the next press or key, then stops listening', async () => {
    const { level } = await load();
    const ctx = context('suspended', true);
    const meter = level.levelMeter(mic(), () => ctx as never);
    window.dispatchEvent(new Event('pointerdown'));
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    // It woke this time: the listeners go.
    ctx.resume.mockImplementation(() => {
      ctx.state = 'running';
      return Promise.resolve();
    });
    window.dispatchEvent(new KeyboardEvent('keydown'));
    expect(ctx.resume).toHaveBeenCalledTimes(3);
    window.dispatchEvent(new Event('pointerdown'));
    expect(ctx.resume).toHaveBeenCalledTimes(3);
    meter.close();
  });
});

describe('steadyAudio', () => {
  it('passes the microphone through Web Audio, keeping the video, and closes a context of its own', async () => {
    const { steady } = await load();
    const ctx = context('suspended');
    const out = steady.steadyAudio(mic(['mic'], ['camera']), () => ({
      context: ctx as never,
      shared: false,
    }));
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.source.connect).toHaveBeenCalled();
    expect((out.stream as unknown as FakeMediaStream).tracks).toEqual(['camera', 'steady-audio']);
    out.close();
    expect(ctx.source.disconnect).toHaveBeenCalled();
    expect(ctx.close).toHaveBeenCalled();
  });

  it('keeps a primed context open, and uses it before making one', async () => {
    const { level, steady } = await load();
    const primed = context();
    level.primeAudio(() => primed as never);
    const out = steady.steadyAudio(mic());
    expect(primed.createMediaStreamSource).toHaveBeenCalled();
    out.close();
    expect(primed.close).not.toHaveBeenCalled();
  });

  it('makes a context of its own when nothing is primed', async () => {
    const { steady } = await load();
    const ctx = context();
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function AudioContext() {
        return ctx;
      }),
    );
    steady.steadyAudio(mic()).close();
    expect(ctx.close).toHaveBeenCalled();
  });

  it('hands the stream back as it is with no sound, no MediaStream or no Web Audio', async () => {
    const { steady } = await load();
    const silent = mic([]);
    const asIs = steady.steadyAudio(silent);
    asIs.close();
    expect(asIs.stream).toBe(silent);
    const noAudio = steady.steadyAudio(mic(), () => {
      throw new Error('no AudioContext');
    });
    noAudio.close();
    expect(noAudio.stream).toBeDefined();
    vi.stubGlobal('MediaStream', undefined);
    const plain = mic();
    expect(steady.steadyAudio(plain).stream).toBe(plain);
    steady.steadyAudio(plain).close();
  });
});

describe('a context that will not resume or close', () => {
  it('is let go quietly, by the meter, the prime and the steady sound', async () => {
    const { level, steady } = await load();
    const stuck = () => {
      const ctx = context('suspended', true);
      ctx.close.mockImplementation(() => Promise.reject(new Error('closing')));
      return ctx;
    };
    const primed = stuck();
    level.primeAudio(() => primed as never);
    level.primeAudio();
    const own = stuck();
    steady.steadyAudio(mic(), () => ({ context: own as never, shared: false })).close();
    level.levelMeter(mic(), () => stuck() as never).close();
    // A closed primed context is not shared: the meter makes its own.
    primed.state = 'closed';
    const fresh = context();
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function AudioContext() {
        return fresh;
      }),
    );
    level.levelMeter(mic()).close();
    expect(fresh.close).toHaveBeenCalled();
    // Off the page (a worker, a server render) nothing waits for a press.
    vi.stubGlobal('window', undefined);
    level.levelMeter(mic(), () => stuck() as never).close();
    await Promise.resolve();
  });
});

describe('recordingContext', () => {
  const PINNED = { sampleRate: 48000, sinkId: { type: 'none' } };
  // A stand-in AudioContext that refuses the options a browser might not take, and keeps what it was asked.
  const contextClass = (refuses: (options?: AudioContextOptions) => boolean) => {
    const asked: (AudioContextOptions | undefined)[] = [];
    const Class = vi.fn(function AudioContext(options?: AudioContextOptions) {
      asked.push(options);
      if (refuses(options)) throw new DOMException('refused', 'NotSupportedError');
      return { options };
    });
    return { Class: Class as unknown as new (o?: AudioContextOptions) => AudioContext, asked };
  };
  const optionsOf = (ctx: AudioContext) => (ctx as unknown as { options?: unknown }).options;

  it('asks for no speaker at 48 kHz, so a recording runs on wall time at the Opus rate', async () => {
    const { level } = await load();
    const { Class, asked } = contextClass(() => false);
    expect(optionsOf(level.recordingContext(Class))).toEqual(PINNED);
    expect(asked).toHaveLength(1);
  });

  it('drops the rate for a browser that refuses it, keeping no speaker', async () => {
    const { level } = await load();
    const { Class, asked } = contextClass((o) => o?.sampleRate !== undefined);
    expect(optionsOf(level.recordingContext(Class))).toEqual({ sinkId: { type: 'none' } });
    expect(asked).toHaveLength(2);
  });

  it('falls back to the default context for a browser that refuses both, so it still records', async () => {
    const { level } = await load();
    const { Class, asked } = contextClass((o) => o !== undefined);
    expect(optionsOf(level.recordingContext(Class))).toBeUndefined();
    expect(asked).toEqual([PINNED, { sinkId: { type: 'none' } }, undefined]);
  });

  it('is what the Record press primes, the meter shares and the recorder falls back to', async () => {
    const { level, steady } = await load();
    const asked: unknown[] = [];
    const made: Ctx[] = [];
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function AudioContext(options?: AudioContextOptions) {
        asked.push(options);
        const ctx = context();
        made.push(ctx);
        return ctx;
      }),
    );
    level.primeAudio();
    expect(asked).toEqual([PINNED]);
    // The meter keeps reading the primed context rather than making one.
    level.levelMeter(mic()).close();
    expect(made).toHaveLength(1);
    expect(made[0]!.createMediaStreamSource).toHaveBeenCalled();
    // Once it is closed, the recorder makes its own the same way.
    made[0]!.state = 'closed';
    steady.steadyAudio(mic()).close();
    expect(asked).toEqual([PINNED, PINNED]);
  });
});
