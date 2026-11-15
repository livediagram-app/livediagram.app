// @vitest-environment jsdom
// docs/specs/026-plan/calendar-feed.md "The My Work feed", "Where it lives": the Inbox header's calendar door is an
// account's alone, and opens Subscribe to Calendar on the person's My Work feed.
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  readCalendarFeed: vi.fn(),
  issueCalendarFeed: vi.fn(),
  changeCalendarFeed: vi.fn(),
  turnOffCalendarFeed: vi.fn(),
  readMyWorkCalendarFeed: vi.fn(async () => ({ feed: null })),
  issueMyWorkCalendarFeed: vi.fn(),
  turnOffMyWorkCalendarFeed: vi.fn(),
}));
vi.mock('./calendar-feed-client', () => client);
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { MY_WORK_CALENDAR_ACTION, useMyWorkCalendarFeed } from './my-work-calendar-feed';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useMyWorkCalendarFeed', () => {
  it('offers no door without an account', () => {
    const { result } = renderHook(() => useMyWorkCalendarFeed(null));
    expect(result.current.headerActions).toBeUndefined();
    expect(result.current.dialog).toBeNull();
  });

  it('offers the door to an account, and opens the dialog on their My Work feed', async () => {
    const { result, rerender } = renderHook(() => useMyWorkCalendarFeed('user_1'));
    const [door] = result.current.headerActions!;
    expect(door).toMatchObject({ id: MY_WORK_CALENDAR_ACTION, label: 'Subscribe to Calendar' });
    // Stable between renders, so the Explorer's host is not made again.
    rerender();
    expect(result.current.headerActions![0]).toBe(door);
    act(() => door!.onClick());
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'MyWorkCalendarFeed');
    render(<>{result.current.dialog}</>);
    expect(await screen.findByText('Your cards in your own calendar.')).toBeTruthy();
    expect(client.readMyWorkCalendarFeed).toHaveBeenCalledWith('user_1');
  });
});
