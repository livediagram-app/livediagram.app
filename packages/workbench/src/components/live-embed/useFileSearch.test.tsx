// @vitest-environment jsdom
// Embed File's Find a File (useFileSearch.ts, live-embeds.md "Newest names", Work Tracker 1460): a return to the page
// asks the same query again, the answers held kept meanwhile and when that read fails.
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { Item } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { comeBackToPage, leaveReturnClock } from '@liveworkspace/explorer/return-to-tab-testing';
import { useFileSearch } from './useFileSearch';

const item = (id: string, title: string) => ({ id, title, app: 'livediagram' }) as Item;
const titles = (search: ReturnType<typeof useFileSearch>) =>
  search.state === 'ready' ? search.items.map((i) => i.title) : search.state;

afterEach(() => {
  cleanup();
  leaveReturnClock();
});

describe('useFileSearch, back on the page', () => {
  it('searches again, showing a rename, and keeps the answers when that read fails', async () => {
    const listItems = vi
      .fn()
      .mockResolvedValueOnce({ items: [item('a', 'Roadmap')], nextCursor: null })
      .mockResolvedValueOnce({ items: [item('a', 'Roadmap 2027')], nextCursor: null })
      .mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useFileSearch({ listItems }, 'road', 'host'));
    await waitFor(() => expect(titles(result.current)).toEqual(['Roadmap']));
    act(() => comeBackToPage());
    expect(titles(result.current)).toEqual(['Roadmap']);
    await waitFor(() => expect(titles(result.current)).toEqual(['Roadmap 2027']));
    act(() => comeBackToPage());
    await waitFor(() => expect(listItems).toHaveBeenCalledTimes(3));
    await act(async () => {});
    expect(titles(result.current)).toEqual(['Roadmap 2027']);
  });

  it('drops an answer or a failure that lands after it was left', async () => {
    type Page = { items: Item[]; nextCursor: null };
    const settle: { ok: (page: Page) => void; no: (error: Error) => void }[] = [];
    const listItems = vi.fn(() => new Promise<Page>((ok, no) => settle.push({ ok, no })));
    const lands = [
      () => settle[0]!.ok({ items: [item('a', 'Late')], nextCursor: null }),
      () => settle[1]!.no(new Error('late')),
    ];
    for (const [n, land] of lands.entries()) {
      const { result, unmount } = renderHook(() => useFileSearch({ listItems }, 'road', 'host'));
      await waitFor(() => expect(settle).toHaveLength(n + 1));
      unmount();
      await act(async () => land());
      expect(result.current.state).toBe('loading');
    }
  });

  it('asks nothing under two characters', () => {
    const listItems = vi.fn();
    const { result } = renderHook(() => useFileSearch({ listItems }, ' r ', 'host'));
    act(() => comeBackToPage());
    expect(result.current.state).toBe('idle');
    expect(listItems).not.toHaveBeenCalled();
  });

  it('says a first search failed', async () => {
    const listItems = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useFileSearch({ listItems }, 'road', 'host'));
    await waitFor(() => expect(result.current.state).toBe('failed'));
  });
});
