// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newSessionTab, withCurrent, type SessionTabState } from '@liveplanner/project';
import { TIMEBOX_TICK_MS, useSessionTimebox } from './useSessionTimebox';
import { playSessionChime } from './session-chime';

// docs/specs/026-plan/session-tabs.md "The progress bar": the time left ticks from the card's start, a chime plays
// once when a card this screen watched runs out, and nothing ticks without a timebox.
const boxed = (startedAt: number) =>
  withCurrent(
    newSessionTab('refinement', { typeIds: [], statuses: [], timeboxMs: 60_000 }),
    'c1',
    startedAt,
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
});
afterEach(() => vi.useRealTimers());

describe('useSessionTimebox', () => {
  it('counts down and chimes once when the time is up', () => {
    const chime = vi.fn();
    const { result } = renderHook(() => useSessionTimebox(boxed(100_000), chime));
    expect(result.current).toEqual({ leftMs: 60_000, totalMs: 60_000, up: false });
    act(() => vi.advanceTimersByTime(30 * TIMEBOX_TICK_MS));
    expect(result.current?.leftMs).toBe(30_000);
    act(() => vi.advanceTimersByTime(31 * TIMEBOX_TICK_MS));
    expect(result.current).toMatchObject({ leftMs: 0, up: true });
    act(() => vi.advanceTimersByTime(5 * TIMEBOX_TICK_MS));
    expect(chime).toHaveBeenCalledTimes(1);
  });

  it('never chimes for a card already over when this screen opened it, and is off without a timebox', () => {
    const chime = vi.fn();
    const { result, rerender } = renderHook(
      ({ s }: { s: SessionTabState }) => useSessionTimebox(s, chime),
      { initialProps: { s: boxed(0) } },
    );
    expect(result.current?.up).toBe(true);
    act(() => vi.advanceTimersByTime(3 * TIMEBOX_TICK_MS));
    expect(chime).not.toHaveBeenCalled();
    rerender({ s: newSessionTab('refinement', { typeIds: [], statuses: [] }) });
    expect(result.current).toBeNull();
    // A card started a moment ahead of this screen's last tick still shows its whole box, never more.
    rerender({ s: boxed(Date.now() + 500) });
    expect(result.current?.leftMs).toBe(60_000);
  });
});

describe('playSessionChime', () => {
  it('plays two notes and closes, and is quiet where there is no audio', () => {
    const osc = {
      type: '',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const gain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(() => ({})),
    };
    osc.connect.mockReturnValue(gain);
    const close = vi.fn(async () => {});
    class FakeAudio {
      currentTime = 0;
      destination = {};
      createOscillator = () => osc;
      createGain = () => gain;
      close = close;
    }
    expect(playSessionChime(FakeAudio as unknown as new () => AudioContext)).toBe(true);
    expect(osc.start).toHaveBeenCalledTimes(2);
    vi.runAllTimers();
    expect(close).toHaveBeenCalled();
    expect(playSessionChime(undefined)).toBe(false);
    // A close the browser refuses is let go quietly.
    close.mockRejectedValueOnce(new Error('closed'));
    expect(playSessionChime(FakeAudio as unknown as new () => AudioContext)).toBe(true);
    vi.runAllTimers();
    class Refused {
      constructor() {
        throw new Error('not allowed');
      }
    }
    expect(playSessionChime(Refused as unknown as new () => AudioContext)).toBe(false);
  });
});
