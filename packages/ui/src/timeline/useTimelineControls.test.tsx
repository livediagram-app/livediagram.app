// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTimelineControls } from './useTimelineControls';
import type { TimelineEvent } from './types';

const ME = 'me';

function event(over: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'e1',
    sourceType: 'diagram',
    sourceId: 'd1',
    eventType: 'diagram_created',
    title: 'Diagram Created',
    occurredAt: 1_700_000_000_000,
    actorId: ME,
    ...over,
  } as TimelineEvent;
}

describe('useTimelineControls', () => {
  it('clears the actor filter, not just the chips', () => {
    // The dead end this fixes. A solo user has only their own events, so
    // picking "Other people" empties the feed and Timeline shows "No events
    // match these filters" with a Clear filters button. That button called a
    // reset that only touched the category chips, so clicking it changed
    // nothing — and the popover hid its own Reset in the same state.
    const { result } = renderHook(() => useTimelineControls([event()], { viewerId: ME }));
    act(() => result.current.setActorFilter('others'));
    expect(result.current.visibleEvents).toHaveLength(0);

    act(() => result.current.resetFilters());
    expect(result.current.actorFilter).toBe('all');
    expect(result.current.visibleEvents).toHaveLength(1);
  });

  it('clears both narrowing controls at once', () => {
    const { result } = renderHook(() => useTimelineControls([event()], { viewerId: ME }));
    act(() => result.current.toggleCategory('new'));
    act(() => result.current.setActorFilter('others'));
    expect(result.current.excluded.size).toBe(1);

    act(() => result.current.resetFilters());
    expect(result.current.excluded.size).toBe(0);
    expect(result.current.actorFilter).toBe('all');
  });

  it('tells the host about both changes, so telemetry and chips stay honest', () => {
    // Both callbacks fire on reset. Without the actor one the "you are
    // filtered" dot and the analytics would disagree with the actual state.
    const onFilterChange = vi.fn();
    const onActorFilterChange = vi.fn();
    const { result } = renderHook(() =>
      useTimelineControls([event()], { viewerId: ME, onFilterChange, onActorFilterChange }),
    );
    act(() => result.current.setActorFilter('others'));
    onActorFilterChange.mockClear();

    act(() => result.current.resetFilters());
    expect(onFilterChange).toHaveBeenLastCalledWith([]);
    expect(onActorFilterChange).toHaveBeenLastCalledWith('all');
  });

  describe('pickDate', () => {
    // The mini-calendar sits in the filter popover, which is reachable from the
    // header in every mode — but the scroll target and the pulse it drove are
    // rendered by the day groups, and only LIST mode renders those. So picking
    // a date in calendar or week mode silently did nothing.
    it('moves the calendar grid to the picked day’s month', () => {
      const { result } = renderHook(() => useTimelineControls([event()], { viewerId: ME }));
      act(() => result.current.setMode('calendar'));
      act(() => result.current.pickDate('2026-03-14'));
      expect(result.current.monthKey).toBe('2026-03');
    });

    it('moves the week grid to the week containing the picked day', () => {
      const { result } = renderHook(() => useTimelineControls([event()], { viewerId: ME }));
      act(() => result.current.setMode('week'));
      // A Saturday: the grid is Monday-first, so this resolves back to the 9th.
      act(() => result.current.pickDate('2026-03-14'));
      expect(result.current.weekKey).toBe('2026-03-09');
    });

    it('pulses the day group in list mode, and moves no grid', () => {
      const { result } = renderHook(() => useTimelineControls([event()], { viewerId: ME }));
      const monthBefore = result.current.monthKey;
      act(() => result.current.pickDate('2026-03-14'));
      expect(result.current.pulseDay).toBe('2026-03-14');
      expect(result.current.monthKey).toBe(monthBefore);
    });

    it('does not pulse in calendar mode, where nothing would show it', () => {
      const { result } = renderHook(() => useTimelineControls([event()], { viewerId: ME }));
      act(() => result.current.setMode('calendar'));
      act(() => result.current.pickDate('2026-03-14'));
      expect(result.current.pulseDay).toBeNull();
    });
  });

  it('leaves someone else’s events visible under "Other people"', () => {
    // The filter itself still has to work — the fix must not neuter it.
    const { result } = renderHook(() =>
      useTimelineControls([event(), event({ id: 'e2', actorId: 'someone-else' })], {
        viewerId: ME,
      }),
    );
    act(() => result.current.setActorFilter('others'));
    expect(result.current.visibleEvents.map((e) => e.id)).toEqual(['e2']);
  });
});
