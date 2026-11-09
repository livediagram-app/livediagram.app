// @vitest-environment jsdom

// The ten seconds a knock reads Knocked (docs/specs/009-elements/screen-and-room-sign.md "Room Sign").
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KNOCK_THROTTLE_MS } from '@livehuddle/api-schema';
import { noteKnocked, resetMeetingLive } from '@/lib/office/meeting-live';
import { useKnockedRecently } from './room-sign-clock';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  act(() => resetMeetingLive());
  vi.useRealTimers();
});

describe('useKnockedRecently', () => {
  it('reads Knocked for the ten seconds after a knock, then not', () => {
    const { result } = renderHook(() => useKnockedRecently());
    expect(result.current).toBe(false);
    act(() => noteKnocked(Date.now()));
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(KNOCK_THROTTLE_MS);
    });
    expect(result.current).toBe(false);
  });

  // A Room Sign's reader opened a minute after a knock: its Knock button is ready from its very first frame.
  it('never reads Knocked on first render for a knock whose ten seconds are over', () => {
    act(() => noteKnocked(Date.now() - KNOCK_THROTTLE_MS - 1));
    const seen: boolean[] = [];
    renderHook(() => seen.push(useKnockedRecently()));
    expect(seen[0]).toBe(false);
  });
});
