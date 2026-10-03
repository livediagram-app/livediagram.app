// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  HomeJumpBackInItem,
  HomeResponse,
  HomeTimelineEntry,
  HomeTimelinePage,
} from '@livediagram/api-schema';

// Home's data (docs/specs/013-workspace/blueprints/explorer-home-view.md "useHome"): one read draws
// the page, a failure is not an empty Home, pages append, and the read clears the unread badge.

const { apiReadHome, apiReadHomeTimeline, offlineListOpens, track } = vi.hoisted(() => ({
  apiReadHome: vi.fn(),
  apiReadHomeTimeline: vi.fn(),
  offlineListOpens: vi.fn(),
  track: vi.fn(),
}));
vi.mock('@/lib/api-client', () => ({ apiReadHome, apiReadHomeTimeline }));
vi.mock('@/lib/offline/offline-opens', () => ({ offlineListOpens }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { useHome } from './useHome';

const place = {
  name: 'Doc',
  via: 'own' as const,
  shareCode: null,
  tabId: null,
  teamId: null,
  teamName: null,
  folderId: null,
  folderName: null,
  ownerName: null,
  savedAt: 1,
  empty: false,
};
const jump = (documentId: string, frecencyKey: number) =>
  ({ ...place, documentId, lastOpenedAt: 1, openDays: 1, frecencyKey }) as HomeJumpBackInItem;
const entry = (id: string, occurredAt: number): HomeTimelineEntry => ({
  ...place,
  id,
  documentId: `d-${id}`,
  kind: 'opened',
  occurredAt,
});
const home = (over: Partial<HomeResponse> = {}): HomeResponse => ({
  jumpBackIn: [jump('s1', 10)],
  timeline: { items: [entry('e2', 2000)], nextCursor: '2000:e2' },
  whatHappened: [],
  lastSeenAt: null,
  ...over,
});

beforeEach(() => {
  apiReadHome.mockReset();
  apiReadHomeTimeline.mockReset();
  offlineListOpens.mockReset().mockResolvedValue([]);
  track.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('useHome', () => {
  it('reads Home in the browser’s time zone, merges local documents and clears the badge', async () => {
    apiReadHome.mockResolvedValue(home());
    offlineListOpens.mockResolvedValue([
      {
        document: { id: 'l1', name: 'Local', savedAt: 3, empty: false },
        opens: { frecencyKey: 20 },
      },
    ]);
    const onSeen = vi.fn();
    const { result } = renderHook(() => useHome('owner', onSeen));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(apiReadHome).toHaveBeenCalledWith('owner', {
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    expect(result.current.jumpBackIn.map((d) => [d.documentId, d.localOnly])).toEqual([
      ['l1', true],
      ['s1', false],
    ]);
    expect(result.current.hasMore).toBe(true);
    expect(onSeen).toHaveBeenCalledTimes(1);
  });

  it('says the read failed rather than showing an empty Home, and retries', async () => {
    apiReadHome.mockResolvedValueOnce(null).mockResolvedValueOnce(home());
    const onSeen = vi.fn();
    const { result } = renderHook(() => useHome('owner', onSeen));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(onSeen).not.toHaveBeenCalled();
    act(() => result.current.retry());
    expect(track).toHaveBeenCalledWith('Home', 'Loaded', 'Retry');
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('still draws Home when this browser cannot list its documents', async () => {
    apiReadHome.mockResolvedValue(home());
    offlineListOpens.mockRejectedValue(new Error('no IndexedDB'));
    const { result } = renderHook(() => useHome('owner', vi.fn()));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.jumpBackIn.map((d) => d.documentId)).toEqual(['s1']);
    expect(console.warn).toHaveBeenCalledWith('[home] local-opens-unavailable', expect.any(Error));
  });

  it('appends the next page once, without repeating an event', async () => {
    apiReadHome.mockResolvedValue(home());
    let resolvePage: (p: HomeTimelinePage) => void = () => {};
    apiReadHomeTimeline.mockReturnValue(new Promise((r) => (resolvePage = r)));
    const { result } = renderHook(() => useHome('owner', vi.fn()));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(apiReadHomeTimeline).toHaveBeenCalledTimes(1);
    expect(apiReadHomeTimeline).toHaveBeenCalledWith('owner', { cursor: '2000:e2' });
    expect(result.current.paging).toBe('loading');
    await act(async () =>
      resolvePage({ items: [entry('e2', 2000), entry('e1', 1000)], nextCursor: null }),
    );
    expect(result.current.timeline.map((e) => e.id)).toEqual(['e2', 'e1']);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.paging).toBe('idle');
    expect(track).toHaveBeenCalledWith('Home', 'Loaded', 'More');
  });

  it('offers a retry when a further page fails', async () => {
    apiReadHome.mockResolvedValue(home());
    apiReadHomeTimeline.mockResolvedValueOnce(null).mockResolvedValueOnce({
      items: [entry('e1', 1000)],
      nextCursor: null,
    });
    const { result } = renderHook(() => useHome('owner', vi.fn()));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => result.current.loadMore());
    expect(result.current.paging).toBe('error');
    expect(console.warn).toHaveBeenCalledWith('[home] page failed');
    await act(async () => result.current.retryMore());
    expect(track).toHaveBeenCalledWith('Home', 'Loaded', 'Retry');
    expect(result.current.timeline.map((e) => e.id)).toEqual(['e2', 'e1']);
  });

  it('drops a stale answer when the owner changes mid-read', async () => {
    let first: (h: HomeResponse) => void = () => {};
    apiReadHome
      .mockReturnValueOnce(new Promise((r) => (first = r)))
      .mockResolvedValueOnce(home({ jumpBackIn: [jump('mine', 1)] }));
    const { result, rerender } = renderHook(({ owner }) => useHome(owner, vi.fn()), {
      initialProps: { owner: 'guest' },
    });
    rerender({ owner: 'user_1' });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => first(home({ jumpBackIn: [jump('stale', 1)] })));
    expect(result.current.jumpBackIn.map((d) => d.documentId)).toEqual(['mine']);
  });

  it('keeps the first read’s mark, so a retry never clears what is new', async () => {
    apiReadHome
      .mockResolvedValueOnce(home({ lastSeenAt: 500 }))
      .mockResolvedValueOnce(home({ lastSeenAt: 900 }));
    const { result } = renderHook(() => useHome('owner', vi.fn()));
    await waitFor(() => expect(result.current.lastSeenAt).toBe(500));
    act(() => result.current.retry());
    await waitFor(() => expect(apiReadHome).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.lastSeenAt).toBe(500);
  });

  it('has no mark for someone who never looked', async () => {
    apiReadHome.mockResolvedValue(home({ lastSeenAt: null }));
    const { result } = renderHook(() => useHome('owner', vi.fn()));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.lastSeenAt).toBeUndefined();
  });

  it('waits for an owner', () => {
    const { result } = renderHook(() => useHome(null, vi.fn()));
    expect(result.current.status).toBe('loading');
    expect(apiReadHome).not.toHaveBeenCalled();
  });
});
