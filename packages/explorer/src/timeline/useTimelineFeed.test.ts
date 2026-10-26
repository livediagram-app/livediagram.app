import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IndexClient, TimelineEvent, TimelinePage } from '@liveworkspace/index-client';
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

  it('fails the feed when its first page fails', async () => {
    const client = {
      timeline: vi.fn<IndexClient['timeline']>().mockRejectedValue(new Error('503')),
      markTimelineSeen: vi.fn(async () => {}),
    } as unknown as IndexClient;
    const { result } = renderHook(() => useTimelineFeed(client, 'liveplanner', 'all', 0));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
  });
});
