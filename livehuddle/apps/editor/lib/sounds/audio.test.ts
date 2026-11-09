// @vitest-environment jsdom

// The editor's one AudioContext (docs/specs/012-collaboration/join-and-leave-sounds.md "Unlocking sound").
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { audio, playTones, resetAudio, unlockAudioOnGesture } from './audio';

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
