// @vitest-environment jsdom

// The first hook-BODY test in apps/live (spec/18). Everything else here tests
// the pure helpers beside a hook; this one renders the hook, because the bug
// it covers lives entirely in effect + ref lifecycle and no pure function can
// see it.
//
// Per-file environment rather than flipping the workspace: the other ~1,645
// tests are pure logic that runs fine (and faster) under `node`, so jsdom is
// opted into by the handful of files that need a document.

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimelineScopeRef } from '@livediagram/api-schema';
import type { TimelineEvent } from '@livediagram/ui';

const { apiListTimeline, apiDismissTimelineEvent } = vi.hoisted(() => ({
  apiListTimeline: vi.fn(),
  apiDismissTimelineEvent: vi.fn(),
}));
vi.mock('@/lib/api-client', () => ({ apiListTimeline, apiDismissTimelineEvent }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { notifyApiWrite, resetApiWriteListeners } from '@/lib/api/write-signal';
import { useTimelineFeed } from './useTimelineFeed';

const TEAM_A: TimelineScopeRef = { scopeType: 'team', scopeId: 'team-a' };
const TEAM_B: TimelineScopeRef = { scopeType: 'team', scopeId: 'team-b' };

// Which scope each call asked for, so a test can say "team B never got asked".
function callsFor(scopeId: string) {
  return apiListTimeline.mock.calls.filter(
    ([, opts]) => (opts as { scope?: TimelineScopeRef }).scope?.scopeId === scopeId,
  );
}

// Calls carrying an explicit range — the on-demand period fetch, as opposed to
// the first-page read.
function periodCallsFor(scopeId: string) {
  return callsFor(scopeId).filter(([, opts]) => (opts as { from?: number }).from !== undefined);
}

function event(id: string, occurredAt: number, over: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id,
    sourceType: 'diagram',
    sourceId: `d-${id}`,
    eventType: 'diagram_updated',
    title: id,
    occurredAt,
    ...over,
  } as TimelineEvent;
}

beforeEach(() => {
  resetApiWriteListeners();
  apiListTimeline.mockReset();
  apiListTimeline.mockResolvedValue({ events: [], nextCursor: undefined, lastSeenAt: undefined });
  apiDismissTimelineEvent.mockReset();
  apiDismissTimelineEvent.mockResolvedValue(undefined);
});

describe('useTimelineFeed', () => {
  it('reads the first page for the scope it was given', async () => {
    const { result } = renderHook(() => useTimelineFeed('me', true, TEAM_A));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(callsFor('team-a')).toHaveLength(1);
  });

  it('fetches nothing while disabled', async () => {
    renderHook(() => useTimelineFeed('me', false, TEAM_A));
    expect(apiListTimeline).not.toHaveBeenCalled();
  });

  it('re-fetches the visible period after the scope changes', async () => {
    // The regression, and the reason this file exists. The period cache is
    // keyed on the period alone. Switching teams replaces `events` wholesale
    // and re-runs the period effect (scopeKey is in its deps), but the cache
    // used to survive — so the effect found the month already marked fetched,
    // returned early, and left the grid empty, reporting that nothing
    // happened in team B that month.
    const { result, rerender } = renderHook(
      ({ scope }: { scope: TimelineScopeRef }) => useTimelineFeed('me', true, scope),
      { initialProps: { scope: TEAM_A } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Team A, in calendar mode, showing some month.
    act(() => result.current.controls.setMode('calendar'));
    await waitFor(() => expect(periodCallsFor('team-a').length).toBeGreaterThan(0));
    const aPeriods = periodCallsFor('team-a').length;

    // Switch teams. No further user action: the visible period has to be
    // fetched for the new scope on its own.
    rerender({ scope: TEAM_B });
    await waitFor(() => expect(periodCallsFor('team-b').length).toBeGreaterThan(0));
    // And team A wasn't asked again on B's behalf.
    expect(periodCallsFor('team-a')).toHaveLength(aPeriods);
  });

  it('still de-duplicates period fetches within one scope', async () => {
    // The clear must not turn the optimisation off: paging away and back
    // inside one feed should not re-request a month it already holds.
    const { result } = renderHook(() => useTimelineFeed('me', true, TEAM_A));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.controls.setMode('calendar'));
    await waitFor(() => expect(periodCallsFor('team-a').length).toBeGreaterThan(0));

    act(() => result.current.controls.setMonthKey('2026-06'));
    await waitFor(() => expect(periodCallsFor('team-a').length).toBe(2));
    act(() => result.current.controls.setMonthKey('2026-05'));
    await waitFor(() => expect(periodCallsFor('team-a').length).toBe(3));

    // Back to June: already loaded for this feed, so no fourth request.
    act(() => result.current.controls.setMonthKey('2026-06'));
    await new Promise((r) => setTimeout(r, 50));
    expect(periodCallsFor('team-a')).toHaveLength(3);
  });
});

// The bug this whole surface was reported for (spec/138 §2.4): a read
// that failed came back as an empty page, so the pane said "Nothing has
// happened yet" to somebody whose history was intact on the server, and
// only a browser refresh proved otherwise.
describe('useTimelineFeed failure handling', () => {
  it('reports a failed read as an error rather than an empty feed', async () => {
    apiListTimeline.mockResolvedValue(null);
    const { result } = renderHook(() => useTimelineFeed('me', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.events).toEqual([]);
  });

  it('does not leave the previous owner’s events up when their read fails', async () => {
    // A guest signing in mid-session re-reads under the Clerk id. If
    // that read fails there is nothing legitimate to show: the events
    // on screen belong to the feed we just left.
    apiListTimeline.mockResolvedValue({ events: [event('guest-era', 10)] });
    const { result, rerender } = renderHook(
      ({ owner }: { owner: string }) => useTimelineFeed(owner, true),
      { initialProps: { owner: 'guest-1' } },
    );
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    apiListTimeline.mockResolvedValue(null);
    rerender({ owner: 'user_clerk' });
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.events).toEqual([]);
  });

  it('recovers on Try again', async () => {
    apiListTimeline.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useTimelineFeed('me', true));
    await waitFor(() => expect(result.current.error).toBe(true));

    apiListTimeline.mockResolvedValue({ events: [event('a', 10)], nextCursor: '10:a' });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.error).toBe(false));
    expect(result.current.events.map((e) => e.id)).toEqual(['a']);
    expect(result.current.hasMore).toBe(true);
  });
});

// Returning to a tab that has been open since yesterday (spec/138 §2.4a).
describe('useTimelineFeed on return to the tab', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function comeBack() {
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  it('merges what happened since, without dropping loaded events', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiListTimeline.mockResolvedValue({ events: [event('old', 10)] });
    const { result } = renderHook(() => useTimelineFeed('me', true));
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    apiListTimeline.mockResolvedValue({ events: [event('new', 20), event('old', 10)] });
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    comeBack();

    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['new', 'old']));
  });

  it('keeps the loaded feed when the re-read fails', async () => {
    // A stale feed beats an alarm: the reader is looking at real
    // events, and the next return re-reads anyway.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiListTimeline.mockResolvedValue({ events: [event('old', 10)] });
    const { result } = renderHook(() => useTimelineFeed('me', true));
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    apiListTimeline.mockResolvedValue(null);
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    comeBack();

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.events.map((e) => e.id)).toEqual(['old']);
  });

  it('ignores a glance at another window', async () => {
    apiListTimeline.mockResolvedValue({ events: [event('old', 10)] });
    const { result } = renderHook(() => useTimelineFeed('me', true));
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    const reads = apiListTimeline.mock.calls.length;

    // Inside the throttle window: alt-tabbing is not a request for
    // fresh data, and unthrottled this fires on every focus change.
    comeBack();
    comeBack();
    expect(apiListTimeline.mock.calls).toHaveLength(reads);
  });
});

// The reader's own actions (spec/138 §2.4b). The bug this was reported
// for: delete a diagram from a card's menu and the feed sat unchanged —
// no tombstone, the deleted diagram's cards still up — until a browser
// refresh.
describe('useTimelineFeed after the readers own write', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-reads a beat after a write and shows what the worker recorded', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiListTimeline.mockResolvedValue({ events: [event('old', 10)] });
    const { result } = renderHook(() => useTimelineFeed('me', true));
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    const reads = apiListTimeline.mock.calls.length;

    // The rename's event is written off the response path, so the feed
    // must not ask before it could have landed.
    apiListTimeline.mockResolvedValue({ events: [event('renamed', 20), event('old', 10)] });
    act(() => notifyApiWrite());
    expect(apiListTimeline.mock.calls).toHaveLength(reads);
    await act(async () => {
      vi.advanceTimersByTime(1_100);
    });
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['renamed', 'old']));
  });

  it('drops a deleted entitys cards at once, then the re-read brings the tombstone', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiListTimeline.mockResolvedValue({
      events: [
        event('b-edit', 30, { sourceId: 'd-b' }),
        event('a', 20),
        event('b-made', 10, { sourceId: 'd-b' }),
      ],
    });
    const { result } = renderHook(() => useTimelineFeed('me', true));
    await waitFor(() => expect(result.current.events).toHaveLength(3));

    act(() => notifyApiWrite({ purge: { sourceType: 'diagram', sourceId: 'd-b' } }));
    expect(result.current.events.map((e) => e.id)).toEqual(['a']);

    apiListTimeline.mockResolvedValue({
      events: [event('b-gone', 40, { sourceId: 'd-b:deleted' }), event('a', 20)],
    });
    await act(async () => {
      vi.advanceTimersByTime(1_100);
    });
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['b-gone', 'a']));
  });

  it('lets the re-read drop a card the worker has since swept', async () => {
    // A cascade the client did not see coming (a teammate deleted it):
    // the page is authoritative for the stretch it covers.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiListTimeline.mockResolvedValue({ events: [event('a', 30), event('swept', 20)] });
    const { result } = renderHook(() => useTimelineFeed('me', true));
    await waitFor(() => expect(result.current.events).toHaveLength(2));

    apiListTimeline.mockResolvedValue({ events: [event('a', 30)] });
    act(() => notifyApiWrite());
    await act(async () => {
      vi.advanceTimersByTime(1_100);
    });
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['a']));
  });
});

// Per-card removal (spec/138 §2.9).
describe('useTimelineFeed dismiss', () => {
  it('takes the card off at once and tells the worker', async () => {
    apiListTimeline.mockResolvedValue({ events: [event('a', 30), event('b', 20)] });
    const { result } = renderHook(() => useTimelineFeed('me', true));
    await waitFor(() => expect(result.current.events).toHaveLength(2));

    act(() => result.current.dismiss('b'));
    expect(result.current.events.map((e) => e.id)).toEqual(['a']);
    expect(apiDismissTimelineEvent).toHaveBeenCalledWith('me', 'b');
  });

  it('puts the card back if the worker refused', async () => {
    apiListTimeline.mockResolvedValue({ events: [event('a', 30), event('b', 20)] });
    apiDismissTimelineEvent.mockRejectedValue(new Error('dismiss failed: 500'));
    const { result } = renderHook(() => useTimelineFeed('me', true));
    await waitFor(() => expect(result.current.events).toHaveLength(2));

    act(() => result.current.dismiss('b'));
    expect(result.current.events.map((e) => e.id)).toEqual(['a']);
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['a', 'b']));
  });
});
