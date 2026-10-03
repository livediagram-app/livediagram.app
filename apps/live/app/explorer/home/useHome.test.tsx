// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeJumpBackInItem, HomeResponse } from '@livediagram/api-schema';

// Home's data (docs/specs/013-workspace/blueprints/explorer-home-view.md "useHome"): one read draws
// the page, a failure is not an empty Home, and the read clears the unread badge.

const { apiReadHome, offlineListOpens, track } = vi.hoisted(() => ({
  apiReadHome: vi.fn(),
  offlineListOpens: vi.fn(),
  track: vi.fn(),
}));
vi.mock('@/lib/api-client', () => ({ apiReadHome }));
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
const jump = (documentId: string, useDays: number) =>
  ({ ...place, documentId, useDays, lastUsedAt: 10 }) as HomeJumpBackInItem;
const home = (over: Partial<HomeResponse> = {}): HomeResponse => ({
  jumpBackIn: [jump('s1', 1)],
  whatHappened: [],
  lastSeenAt: null,
  ...over,
});

beforeEach(() => {
  apiReadHome.mockReset();
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
        opens: { days: [new Date().toISOString().slice(0, 10)], lastOpenedAt: 20 },
      },
    ]);
    const onSeen = vi.fn();
    const { result } = renderHook(() => useHome('owner', onSeen));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(apiReadHome).toHaveBeenCalledWith('owner', {
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    // One use day each; the local one is the more recent.
    expect(result.current.jumpBackIn.mostUsed.map((d) => [d.documentId, d.localOnly])).toEqual([
      ['l1', true],
      ['s1', false],
    ]);
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
    expect(result.current.jumpBackIn.mostUsed.map((d) => d.documentId)).toEqual(['s1']);
    expect(console.warn).toHaveBeenCalledWith('[home] local-opens-unavailable', expect.any(Error));
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
    expect(result.current.jumpBackIn.mostUsed.map((d) => d.documentId)).toEqual(['mine']);
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
