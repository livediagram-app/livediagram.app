// @vitest-environment jsdom

// The chime and the controls bridge (docs/specs/009-elements/timer-and-stopwatch.md "The chime", "Share roles").

import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PieceTimer } from '@livehuddle/document';
import { chimeDueIn, playChime, useTimerChime } from './timer-chime';
import {
  pressTimerPiece,
  setTimerPieceControls,
  useTimerPieceControls,
  useTimerTakePart,
} from './timer-piece-controls';

const hears = vi.hoisted(() => ({ value: true }));
vi.mock('@/lib/office/timer-earshot', () => ({ hearsTimer: () => hears.value }));

const T0 = Date.UTC(2026, 10, 5, 9, 0, 0);
const run = (over: Partial<PieceTimer> = {}): PieceTimer => ({
  running: true,
  startedAt: T0,
  accumulatedMs: 0,
  durationMs: 60_000,
  ...over,
});

class FakeAudio {
  static made = 0;
  static oscillators = 0;
  state = 'running';
  currentTime = 0;
  destination = {};
  constructor() {
    FakeAudio.made++;
  }
  resume = () => Promise.resolve();
  createOscillator() {
    FakeAudio.oscillators++;
    const node = {
      type: '',
      frequency: { value: 0 },
      connect: (n: unknown) => n,
      start: () => {},
      stop: () => {},
    };
    return node;
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  hears.value = true;
  FakeAudio.oscillators = 0;
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudio;
});

afterEach(() => {
  cleanup();
  act(() => setTimerPieceControls(null));
  vi.useRealTimers();
});

describe('chimeDueIn', () => {
  it('is due at the end of a running Timer only', () => {
    expect(chimeDueIn('timer', run(), T0 + 10_000)).toBe(50_000);
    expect(chimeDueIn('timer', run({ running: false }), T0)).toBeNull();
    expect(chimeDueIn('stopwatch', run(), T0)).toBeNull();
  });

  it('never plays late: a Timer already out is silent', () => {
    expect(chimeDueIn('timer', run(), T0 + 60_000)).toBeNull();
  });
});

describe('useTimerChime', () => {
  it('chimes once at zero, two notes, for a screen in earshot', () => {
    renderHook(() => useTimerChime('t', 'timer', run()));
    vi.advanceTimersByTime(59_999);
    expect(FakeAudio.oscillators).toBe(0);
    vi.advanceTimersByTime(1);
    expect(FakeAudio.oscillators).toBe(2);
    vi.advanceTimersByTime(120_000);
    expect(FakeAudio.oscillators).toBe(2);
  });

  it('stays silent out of earshot, and when paused first', () => {
    hears.value = false;
    renderHook(() => useTimerChime('t', 'timer', run()));
    vi.advanceTimersByTime(60_000);
    expect(FakeAudio.oscillators).toBe(0);
    hears.value = true;
    const { rerender } = renderHook(({ s }) => useTimerChime('u', 'timer', s), {
      initialProps: { s: run({ startedAt: T0 + 60_000 }) },
    });
    rerender({ s: run({ running: false, startedAt: 0, accumulatedMs: 1_000 }) });
    vi.advanceTimersByTime(200_000);
    expect(FakeAudio.oscillators).toBe(0);
  });

  it('never throws from the sound path', () => {
    expect(() => playChime()).not.toThrow();
  });
});

describe('the Timer controls bridge', () => {
  it('sends a press only for a session that may take part', () => {
    const send = vi.fn();
    act(() => setTimerPieceControls({ takePart: false, send }));
    pressTimerPiece('p', run());
    expect(send).not.toHaveBeenCalled();
    act(() => setTimerPieceControls({ takePart: true, send }));
    pressTimerPiece('p', run());
    expect(send).toHaveBeenCalledWith('p', { kind: 'piece-timer', state: run() });
  });

  it('is written by the editor host and cleared when it goes', () => {
    const send = vi.fn();
    function Face() {
      return <span>{useTimerTakePart() ? 'yes' : 'no'}</span>;
    }
    const face = render(<Face />);
    expect(face.container.textContent).toBe('no');
    const host = renderHook(({ ok }) => useTimerPieceControls(ok, send), {
      initialProps: { ok: true },
    });
    expect(face.container.textContent).toBe('yes');
    host.rerender({ ok: false });
    expect(face.container.textContent).toBe('no');
    host.rerender({ ok: true });
    host.unmount();
    expect(face.container.textContent).toBe('no');
    pressTimerPiece('p', run());
    expect(send).not.toHaveBeenCalled();
  });
});
