import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IndexClient, TimelineEvent, TimelinePage } from '@liveworkspace/index-client';
import { mergeHead } from './merge';
import { useTimelineFeed } from './useTimelineFeed';

const event = (id: string): TimelineEvent => ({
  id,
  app: 'liveplanner',
  type: 'edited',
  actorId: 'user_me',
  actorName: null,
  itemId: `item-${id}`,
  title: `Item ${id}`,
  detail: null,
  occurredAt: 1_700_000_000_000,
  item: null,
});

describe('useTimelineFeed', () => {
  it('keeps what it shows when a later page fails, and Show More can ask again', async () => {
    const first: TimelinePage = {
      events: [event('a'), event('b')],
      nextCursor: 'c1',
      seenAt: null,
    };
    const timeline = vi
      .fn<IndexClient['timeline']>()
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce({ events: [event('c')], nextCursor: null, seenAt: null });
    const client = {
      timeline,
      markTimelineSeen: vi.fn(async () => {}),
    } as unknown as IndexClient;
    const { result } = renderHook(() => useTimelineFeed(client, 'liveplanner', 'all', 0));
    await waitFor(() => expect(result.current.events).toHaveLength(2));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadingMore).toBe(false));
    expect(result.current.error).toBe(false);
    expect(result.current.events.map((e) => e.id)).toEqual(['a', 'b']);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.events).toHaveLength(3));
    expect(timeline.mock.calls.map(([q]) => q?.cursor)).toEqual([undefined, 'c1', 'c1']);
    expect(result.current.hasMore).toBe(false);
  });

  it('fails the feed when its first page fails, and reads it again whole on a return to the tab', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const timeline = vi
      .fn<IndexClient['timeline']>()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce({ events: [event('a')], nextCursor: 'c1', seenAt: null });
    const client = { timeline, markTimelineSeen: vi.fn(async () => {}) } as unknown as IndexClient;
    const { result } = renderHook(() => useTimelineFeed(client, 'liveplanner', 'all', 0));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
    now.mockReturnValue(1_100_000);
    act(() => void window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(result.current.error).toBe(false);
    expect(result.current.hasMore).toBe(true);
    now.mockRestore();
  });

  it('reads one team’s activity, never marking the Timeline seen', async () => {
    const timeline = vi
      .fn<IndexClient['timeline']>()
      .mockResolvedValue({ events: [event('a')], nextCursor: null, seenAt: 5 });
    const markTimelineSeen = vi.fn(async () => {});
    const client = { timeline, markTimelineSeen } as unknown as IndexClient;
    const { result } = renderHook(() =>
      useTimelineFeed(client, 'liveplanner', 'all', 0, undefined, 'team_1'),
    );
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(timeline.mock.calls[0]![0]).toEqual({ team: 'team_1', limit: expect.any(Number) });
    expect(result.current.lastSeenAt).toBeNull();
    expect(markTimelineSeen).not.toHaveBeenCalled();
  });

  it('reads the first page again on returning to the tab, merging it in and keeping its place', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const at = (id: string, occurredAt: number) => ({ ...event(id), occurredAt });
    const timeline = vi
      .fn<IndexClient['timeline']>()
      .mockResolvedValueOnce({ events: [at('b', 20), at('a', 10)], nextCursor: 'c1', seenAt: 15 })
      .mockResolvedValueOnce({ events: [at('z', 5)], nextCursor: null, seenAt: 15 })
      .mockResolvedValueOnce({ events: [at('c', 30), at('b', 25)], nextCursor: 'c1', seenAt: 30 })
      .mockRejectedValueOnce(new Error('503'));
    const client = { timeline, markTimelineSeen: vi.fn(async () => {}) } as unknown as IndexClient;
    const { result } = renderHook(() => useTimelineFeed(client, 'liveplanner', 'all', 0));
    await waitFor(() => expect(result.current.events).toHaveLength(2));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.events).toHaveLength(3));
    expect(result.current.hasMore).toBe(false);

    // Inside the 30 seconds: no read.
    act(() => void window.dispatchEvent(new Event('focus')));
    expect(timeline).toHaveBeenCalledTimes(2);

    now.mockReturnValue(1_100_000);
    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(result.current.events).toHaveLength(4));
    expect(timeline).toHaveBeenCalledTimes(3);
    // The fresh copy of `b` moved up; the loaded page stays; New still counts from the visit's look.
    expect(result.current.events.map((e) => [e.id, e.occurredAt])).toEqual([
      ['c', 30],
      ['b', 25],
      ['a', 10],
      ['z', 5],
    ]);
    expect(result.current.lastSeenAt).toBe(15);
    expect(result.current.hasMore).toBe(false);

    // A failed read keeps what is shown.
    now.mockReturnValue(1_200_000);
    act(() => void window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(timeline).toHaveBeenCalledTimes(4));
    expect(result.current.events).toHaveLength(4);
    expect(result.current.error).toBe(false);
    now.mockRestore();
  });
});

describe('mergeHead', () => {
  it('keeps the same list when nothing changed, so nothing re-renders', () => {
    const shown = [event('a'), event('b')];
    expect(mergeHead(shown, [])).toBe(shown);
    expect(mergeHead(shown, [event('a')])).toBe(shown);
    const renamed = mergeHead(shown, [{ ...event('a'), title: 'Renamed' }]);
    expect(renamed.find((e) => e.id === 'a')!.title).toBe('Renamed');
    expect(renamed).toHaveLength(2);
  });

  it('merges a full page into a long feed well inside a frame', () => {
    const shown = Array.from({ length: 5_000 }, (_, i) => ({
      ...event(`e${i}`),
      occurredAt: 10_000_000 - i,
    }));
    const fresh = Array.from({ length: 100 }, (_, i) => ({
      ...event(i % 2 ? `e${i}` : `n${i}`),
      occurredAt: 20_000_000 - i,
    }));
    const started = performance.now();
    const merged = mergeHead(shown, fresh);
    const ms = performance.now() - started;
    console.info(`mergeHead, 100 into 5,000: ${ms.toFixed(1)} ms`);
    expect(merged).toHaveLength(5_050);
    expect(merged[0]!.id).toBe('n0');
    expect(ms).toBeLessThan(50);
  });
});
