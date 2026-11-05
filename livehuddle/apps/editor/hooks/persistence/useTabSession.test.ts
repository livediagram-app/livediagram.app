// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livehuddle/document';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { track } from '@/lib/telemetry';
import { useTabSession } from './useTabSession';

// useTabSession holds no React state (every handler writes through commitTabs), so it runs over a tab array
// we own. It is driven through renderHook like any hook: each session() re-renders it against the tabs as
// they stand, then hands back its handlers.
function harness(
  initial: Partial<Tab> = {},
  opts: { editsBlocked?: boolean; sessionToolsBlocked?: boolean } = {},
) {
  let tabs: Tab[] = [{ id: 't1', name: 'Tab 1', elements: [], ...initial }];
  const hook = renderHook(() =>
    useTabSession({
      editsBlocked: opts.editsBlocked ?? false,
      sessionToolsBlocked: opts.sessionToolsBlocked ?? false,
      activeId: 't1',
      activeTab: tabs[0]!,
      commitTabs: (map) => {
        tabs = map(tabs);
      },
    }),
  );
  const session = () => {
    hook.rerender();
    return hook.result.current;
  };
  return { session, tab: () => tabs[0]! };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => {
  vi.useRealTimers();
  vi.mocked(track).mockClear();
});

describe('a timer run’s startedAt (docs/specs/012-collaboration/agenda.md)', () => {
  it('is minted at start, returned, and kept through pause, resume and extend', () => {
    const h = harness();
    expect(h.session().startTimer('countdown', 60_000)).toBe(1_000_000);
    expect(h.tab().timer?.startedAt).toBe(1_000_000);
    vi.setSystemTime(1_010_000);
    h.session().pauseTimer();
    h.session().resumeTimer();
    h.session().extendTimer(60_000);
    expect(h.tab().timer).toMatchObject({ running: true, startedAt: 1_000_000 });
  });

  it('is undefined when the start is refused', () => {
    const { session } = harness({}, { sessionToolsBlocked: true });
    expect(session().startTimer('countdown', 60_000)).toBeUndefined();
  });
});

describe('extendTimer', () => {
  it('pushes a running countdown’s end and length out together', () => {
    const h = harness({
      timer: { mode: 'countdown', running: true, durationMs: 300_000, anchorAt: 1_120_000 },
    });
    h.session().extendTimer(60_000);
    expect(h.tab().timer).toMatchObject({
      running: true,
      durationMs: 360_000,
      anchorAt: 1_180_000,
    });
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'TimerExtended');
  });

  it('grows a paused countdown’s frozen remainder', () => {
    const h = harness({
      timer: { mode: 'countdown', running: false, durationMs: 300_000, frozenMs: 90_000 },
    });
    h.session().extendTimer(30_000);
    expect(h.tab().timer).toMatchObject({ durationMs: 330_000, frozenMs: 120_000 });
  });

  it('restarts a finished countdown from now rather than a past end instant', () => {
    const h = harness({
      timer: { mode: 'countdown', running: true, durationMs: 60_000, anchorAt: 900_000 },
    });
    h.session().extendTimer(60_000);
    expect(h.tab().timer?.anchorAt).toBe(1_060_000);
  });

  it('leaves a stopwatch, a blocked editor, and a non-positive delta alone', () => {
    const stopwatch = harness({ timer: { mode: 'stopwatch', running: true, anchorAt: 1 } });
    stopwatch.session().extendTimer(60_000);
    expect(stopwatch.tab().timer).toEqual({ mode: 'stopwatch', running: true, anchorAt: 1 });

    const countdown = { mode: 'countdown', running: true, durationMs: 1, anchorAt: 2 } as const;
    const blocked = harness({ timer: countdown }, { editsBlocked: true });
    blocked.session().extendTimer(60_000);
    expect(blocked.tab().timer).toEqual(countdown);

    const zero = harness({ timer: countdown });
    zero.session().extendTimer(0);
    expect(zero.tab().timer).toEqual(countdown);
    expect(track).not.toHaveBeenCalled();
  });
});

describe('while somebody else is facilitating (docs/specs/012-collaboration/facilitator.md)', () => {
  it('refuses to start the timer', () => {
    const { session, tab } = harness({}, { sessionToolsBlocked: true });
    session().startTimer('countdown', 60_000);
    expect(tab().timer).toBeUndefined();
  });

  it('changes nothing when nobody is facilitating', () => {
    const { session, tab } = harness();
    session().startTimer('countdown', 60_000);
    expect(tab().timer?.running).toBe(true);
  });
});
