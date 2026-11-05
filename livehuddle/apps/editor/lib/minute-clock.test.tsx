// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { armedMinuteTimers, minuteOf, useMinuteNow } from './minute-clock';

// docs/specs/009-elements/social-pieces.md "World Clock": one shared minute timer, nothing per frame.
function Clock({ onRender }: { onRender: (n: number) => void }) {
  const now = useMinuteNow();
  onRender(now);
  return null;
}

afterEach(() => vi.useRealTimers());

describe('the minute clock', () => {
  it('rounds down to the minute', () => {
    expect(minuteOf(125_000)).toBe(120_000);
    expect(minuteOf(120_000)).toBe(120_000);
  });

  it('arms one timer for any number of clocks, re-renders each once a minute, and stops with the last', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T09:00:30Z'));
    const renders: number[][] = [[], [], []];
    const views = renders.map((r) => render(<Clock onRender={(n) => r.push(n)} />));
    expect(armedMinuteTimers()).toBe(1);
    const before = renders.map((r) => r.length);
    act(() => {
      vi.advanceTimersByTime(30_100);
    });
    renders.forEach((r, i) => {
      expect(r.length).toBe(before[i]! + 1);
      expect(r.at(-1)).toBe(Date.parse('2026-11-05T09:01:00Z'));
    });
    // Nothing between minutes.
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    renders.forEach((r, i) => expect(r.length).toBe(before[i]! + 1));
    views.forEach((v) => v.unmount());
    expect(armedMinuteTimers()).toBe(0);
  });
});
