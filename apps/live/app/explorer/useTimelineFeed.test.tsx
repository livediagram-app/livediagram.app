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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimelineScopeRef } from '@livediagram/api-schema';

const apiListTimeline = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({ apiListTimeline }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

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

beforeEach(() => {
  apiListTimeline.mockReset();
  apiListTimeline.mockResolvedValue({ events: [], nextCursor: undefined, lastSeenAt: undefined });
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
