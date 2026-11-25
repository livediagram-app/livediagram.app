// @vitest-environment jsdom
// The Connect list's Recent (useRecentFiles.ts, connected-tabs.md "Always the newest names", Work Tracker 1460): no
// copy from page load. Each opening reads afresh, a return to the page reads again with the rows kept, and a read
// again that fails keeps them.
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { Item } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { comeBackToPage, leaveReturnClock } from '@liveworkspace/explorer/return-to-tab-testing';
import { CONNECT_RECENT_LIMIT, useRecentFiles } from './useRecentFiles';

const item = (id: string, title: string) => ({ id, title }) as Item;
const page = (...items: Item[]) => ({ items, nextCursor: null });
const titles = (files: ReturnType<typeof useRecentFiles>) =>
  files.state === 'ready' ? files.items.map((i) => i.title) : files.state;

afterEach(() => {
  cleanup();
  leaveReturnClock();
});

describe('useRecentFiles', () => {
  it('reads Recent afresh on every opening, so a rename since the last one shows', async () => {
    const listItems = vi.fn().mockResolvedValue(page(item('host', 'Host'), item('a', 'Roadmap')));
    const first = renderHook(() => useRecentFiles({ listItems }, 'host'));
    await waitFor(() => expect(titles(first.result.current)).toEqual(['Roadmap']));
    first.unmount();
    // Renamed in another tab, then the list opened again.
    listItems.mockResolvedValue(page(item('a', 'Roadmap 2027')));
    const again = renderHook(() => useRecentFiles({ listItems }, 'host'));
    expect(again.result.current.state).toBe('loading');
    await waitFor(() => expect(titles(again.result.current)).toEqual(['Roadmap 2027']));
    expect(listItems).toHaveBeenCalledTimes(2);
    expect(listItems).toHaveBeenLastCalledWith(
      { view: 'recent', limit: CONNECT_RECENT_LIMIT },
      expect.anything(),
    );
  });

  it('reads again on a return to the page, keeping the rows on screen meanwhile', async () => {
    let answer!: (p: ReturnType<typeof page>) => void;
    const listItems = vi
      .fn()
      .mockResolvedValueOnce(page(item('a', 'Roadmap')))
      .mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const { result } = renderHook(() => useRecentFiles({ listItems }, 'host'));
    await waitFor(() => expect(titles(result.current)).toEqual(['Roadmap']));
    act(() => comeBackToPage());
    await waitFor(() => expect(listItems).toHaveBeenCalledTimes(2));
    expect(titles(result.current)).toEqual(['Roadmap']);
    await act(async () => answer(page(item('a', 'Roadmap 2027'))));
    expect(titles(result.current)).toEqual(['Roadmap 2027']);
  });

  it('keeps the rows when a read again fails, and says so only for a first read', async () => {
    const listItems = vi
      .fn()
      .mockResolvedValueOnce(page(item('a', 'Roadmap')))
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page(item('a', 'Roadmap')));
    const { result } = renderHook(() => useRecentFiles({ listItems }, 'host'));
    await waitFor(() => expect(titles(result.current)).toEqual(['Roadmap']));
    act(() => comeBackToPage());
    await waitFor(() => expect(listItems).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(titles(result.current)).toEqual(['Roadmap']);
    // Try Again is a read of its own: it shows loading, and its failure says so.
    act(() => result.current.retry());
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('failed'));
    act(() => result.current.retry());
    await waitFor(() => expect(titles(result.current)).toEqual(['Roadmap']));
  });
});
