// @vitest-environment jsdom

// The one ticker (docs/specs/009-elements/timer-and-stopwatch.md "The one ticker"): one interval however many faces
// run, none for a paused face, stopped when the last face goes and while the tab is hidden, and a face re-rendered
// only when its readout changes.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { TimerView } from '@/components/canvas/collab/TimerView';
import { TICK_MS, runningTickers, useTickerValue } from './timer-ticker';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const T0 = Date.UTC(2026, 10, 5, 9, 0, 0);

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

let renders = 0;
function Seconds({ active }: { active: boolean }) {
  renders++;
  const s = useTickerValue(active, (now) => Math.floor((now - T0) / 1000));
  return <span>{s}</span>;
}

const running = (i: number, kind: 'timer' | 'stopwatch' = 'timer') =>
  ({
    ...createShape(kind, i * 200, 0),
    id: `t${i}`,
    pieceTimer: {
      running: true,
      startedAt: T0,
      accumulatedMs: 0,
      durationMs: kind === 'timer' ? 3_600_000 : 0,
    },
  }) as ShapeElement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  renders = 0;
});

afterEach(() => {
  act(() => setHidden(false));
  cleanup();
  vi.useRealTimers();
});

describe('the timer ticker', () => {
  it('runs one interval for many faces, and none once they go', () => {
    const { unmount } = render(
      <>
        {Array.from({ length: 20 }, (_, i) => (
          <Seconds key={i} active />
        ))}
      </>,
    );
    expect(runningTickers()).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(runningTickers()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps no interval for a paused face', () => {
    render(<Seconds active={false} />);
    expect(runningTickers()).toBe(0);
  });

  it('re-renders a face once a second, not on every tick', () => {
    const { container } = render(<Seconds active />);
    renders = 0;
    // Each tick on its own, as a browser runs them (one act would batch them into one render).
    for (let t = 0; t < 16; t++)
      act(() => {
        vi.advanceTimersByTime(TICK_MS);
      });
    expect(container.textContent).toBe('4');
    // Sixteen ticks, but the readout changed four times.
    expect(renders).toBe(4);
  });

  it('stops while the tab is hidden and catches up at once when shown', () => {
    const { container } = render(<Seconds active />);
    act(() => setHidden(true));
    expect(runningTickers()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(container.textContent).toBe('0');
    act(() => setHidden(false));
    expect(runningTickers()).toBe(1);
    expect(container.textContent).toBe('10');
  });

  // The cost the spec names: 20 running Timers and Stopwatches for a minute of ticks (240 ticks, 60 changes of each
  // readout, each tick its own React act). Measured at about 300 ms here (about 5 ms of CPU a second, jsdom and act
  // included), so the budget is twice that.
  const SECONDS = 60;
  const BUDGET_MS = 600;
  it(`ticks 20 running faces for ${SECONDS} s inside ${cpuBudgetMs(BUDGET_MS)} ms of CPU`, () => {
    render(
      <>
        {Array.from({ length: 20 }, (_, i) => (
          <TimerView key={i} element={running(i, i % 2 ? 'stopwatch' : 'timer')} live />
        ))}
      </>,
    );
    expect(runningTickers()).toBe(1);
    const ticks = SECONDS * (1000 / TICK_MS);
    // Each tick on its own act, as a browser runs them.
    const spent = cpuMsOf(() => {
      for (let t = 0; t < ticks; t++)
        act(() => {
          vi.advanceTimersByTime(TICK_MS);
        });
    });
    expect(spent).toBeLessThan(cpuBudgetMs(BUDGET_MS));
    expect(SECONDS * (1000 / TICK_MS)).toBe(240);
  });
});
