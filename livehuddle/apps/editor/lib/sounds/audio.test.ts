// @vitest-environment jsdom

// The editor's one AudioContext (docs/specs/012-collaboration/join-and-leave-sounds.md "Unlocking sound").
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audio, playTones, resetAudio, unlockAudioOnGesture, whenAudible } from './audio';

class FakeAudio {
  static made = 0;
  static resumed = 0;
  static started = 0;
  state: 'suspended' | 'running' = 'suspended';
  currentTime = 0;
  destination = {};
  constructor() {
    FakeAudio.made++;
  }
  resume = () => {
    FakeAudio.resumed++;
    this.state = 'running';
    return Promise.resolve();
  };
  createOscillator() {
    return {
      type: '',
      frequency: { value: 0 },
      connect: (n: unknown) => n,
      start: () => {
        FakeAudio.started++;
      },
      stop: () => {},
    };
  }
  createGain() {
    const ramp = () => {};
    return {
      gain: {
        setValueAtTime: ramp,
        linearRampToValueAtTime: ramp,
        exponentialRampToValueAtTime: ramp,
      },
      connect: (n: unknown) => n,
    };
  }
}

const win = window as unknown as { AudioContext?: unknown };

beforeEach(() => {
  resetAudio();
  FakeAudio.made = 0;
  FakeAudio.resumed = 0;
  FakeAudio.started = 0;
  win.AudioContext = FakeAudio;
});
afterEach(() => {
  delete win.AudioContext;
});

describe('audio', () => {
  it('makes one context, lazily, and reuses it', () => {
    expect(FakeAudio.made).toBe(0);
    const a = audio();
    expect(audio()).toBe(a);
    expect(FakeAudio.made).toBe(1);
  });

  it('is null without Web Audio, and when the constructor throws', () => {
    delete win.AudioContext;
    expect(audio()).toBeNull();
    win.AudioContext = function Broken() {
      throw new Error('no');
    };
    expect(audio()).toBeNull();
    playTones([{ hz: 440, at: 0 }], 0.5, 0.1);
  });

  it('plays each note on an oscillator, resuming a suspended context', () => {
    playTones(
      [
        { hz: 440, at: 0 },
        { hz: 660, at: 0.1 },
      ],
      0.5,
      0.1,
    );
    expect(FakeAudio.started).toBe(2);
    expect(FakeAudio.resumed).toBe(1);
  });
});

describe('unlockAudioOnGesture', () => {
  it('makes and resumes the context on the first press, then stops listening', () => {
    unlockAudioOnGesture();
    expect(FakeAudio.made).toBe(0);
    window.dispatchEvent(new Event('pointerdown'));
    expect(FakeAudio.made).toBe(1);
    expect(FakeAudio.resumed).toBe(1);
    window.dispatchEvent(new Event('keydown'));
    expect(FakeAudio.resumed).toBe(1);
  });

  it('stops waiting when asked, and waits for nothing once running', () => {
    const stop = unlockAudioOnGesture();
    stop();
    window.dispatchEvent(new Event('pointerdown'));
    expect(FakeAudio.made).toBe(0);
    void audio()!.resume();
    const nothing = unlockAudioOnGesture();
    nothing();
    window.dispatchEvent(new Event('keydown'));
    expect(FakeAudio.resumed).toBe(1);
  });

  it('stays quiet when the browser will not resume, on a press or a play', async () => {
    unlockAudioOnGesture();
    const ctx = audio() as unknown as FakeAudio;
    ctx.resume = () => Promise.reject(new Error('not allowed'));
    window.dispatchEvent(new Event('pointerdown'));
    playTones([{ hz: 440, at: 0 }], 0.5, 0.1);
    await Promise.resolve();
    expect(ctx.state).toBe('suspended');
    expect(FakeAudio.started).toBe(1);
  });
});

describe('whenAudible', () => {
  afterEach(() => vi.useRealTimers());

  it('plays at once when the context is running', () => {
    void audio()!.resume();
    const play = vi.fn();
    whenAudible(3_000, play);
    expect(play).toHaveBeenCalledOnce();
  });

  it('plays when the context resumes in time', async () => {
    const play = vi.fn();
    whenAudible(3_000, play);
    await Promise.resolve();
    await Promise.resolve();
    expect(play).toHaveBeenCalledOnce();
  });

  it('never plays when the resume comes too late, is refused, or waiting stops', async () => {
    vi.useFakeTimers();
    const ctx = audio() as unknown as FakeAudio;
    let resolveLate!: () => void;
    ctx.resume = () =>
      new Promise<void>((resolve) => {
        resolveLate = () => {
          ctx.state = 'running';
          resolve();
        };
      });
    const late = vi.fn();
    whenAudible(3_000, late);
    vi.advanceTimersByTime(3_001);
    resolveLate();
    await Promise.resolve();
    await Promise.resolve();
    expect(late).not.toHaveBeenCalled();

    ctx.state = 'suspended';
    ctx.resume = () => Promise.reject(new Error('not allowed'));
    const refused = vi.fn();
    whenAudible(3_000, refused);
    await Promise.resolve();
    await Promise.resolve();
    expect(refused).not.toHaveBeenCalled();

    ctx.resume = () => {
      ctx.state = 'running';
      return Promise.resolve();
    };
    const stopped = vi.fn();
    whenAudible(3_000, stopped)();
    await Promise.resolve();
    await Promise.resolve();
    expect(stopped).not.toHaveBeenCalled();
  });

  it('does nothing without Web Audio', () => {
    resetAudio();
    delete win.AudioContext;
    const play = vi.fn();
    whenAudible(3_000, play)();
    expect(play).not.toHaveBeenCalled();
  });
});
