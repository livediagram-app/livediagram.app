import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IndexClient } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { useOpenItem } from './useOpenItem';

describe('useOpenItem', () => {
  it("reads the open item from the index, as the share link's guest when there is one", async () => {
    const item = makeItem(1);
    const index = createFakeIndex({ items: [item] });
    const getItem = vi.spyOn(index.client, 'getItem');
    const { result } = renderHook(() => useOpenItem(index.client, item.id, 'CODE', () => 'pw'));
    await waitFor(() => expect(result.current?.id).toBe(item.id));
    expect(getItem).toHaveBeenCalledWith(item.id, { code: 'CODE', password: 'pw' });
  });

  it('answers null when the index has none for it (an item kept only in this browser)', async () => {
    const client = {
      getItem: vi.fn(() => Promise.reject(new Error('not found'))),
    } as unknown as IndexClient;
    const { result } = renderHook(() => useOpenItem(client, 'local-1'));
    await waitFor(() => expect(client.getItem).toHaveBeenCalledWith('local-1', null));
    expect(result.current).toBeNull();
  });

  it('never answers with the item open before, and asks nothing with none open', async () => {
    const a = makeItem(1);
    const b = makeItem(2);
    const index = createFakeIndex({ items: [a, b] });
    const { result, rerender } = renderHook(({ id }) => useOpenItem(index.client, id), {
      initialProps: { id: a.id as string | null },
    });
    await waitFor(() => expect(result.current?.id).toBe(a.id));
    rerender({ id: b.id });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current?.id).toBe(b.id));
    rerender({ id: null });
    expect(result.current).toBeNull();
  });

  it('asks nothing for an item kept only in this browser, and drops a copy read before it went local', async () => {
    const item = makeItem(1);
    const index = createFakeIndex({ items: [item] });
    const getItem = vi.spyOn(index.client, 'getItem');
    const { result, rerender } = renderHook(
      ({ offline }) => useOpenItem(index.client, item.id, null, undefined, { offline }),
      { initialProps: { offline: true } },
    );
    expect(result.current).toBeNull();
    expect(getItem).not.toHaveBeenCalled();
    // A Sync in place: it is the index's now, so it is asked.
    rerender({ offline: false });
    await waitFor(() => expect(result.current?.id).toBe(item.id));
    expect(getItem).toHaveBeenCalledTimes(1);
    // Taken offline again while the panel stays mounted: the index's copy is no longer given.
    rerender({ offline: true });
    expect(result.current).toBeNull();
    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('asks again on an opening while the index had nothing for it, and never once it answered', async () => {
    const item = makeItem(1);
    const index = createFakeIndex({ items: [] });
    const getItem = vi.spyOn(index.client, 'getItem');
    const { result, rerender } = renderHook(
      ({ open }) => useOpenItem(index.client, item.id, null, undefined, { open }),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(getItem).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current).toBeNull());
    // A fresh item the index registers after the first read.
    index.items.push(item);
    rerender({ open: false });
    expect(getItem).toHaveBeenCalledTimes(1);
    rerender({ open: true });
    await waitFor(() => expect(result.current?.id).toBe(item.id));
    expect(getItem).toHaveBeenCalledTimes(2);
    // Found: closing and opening again reads nothing more.
    rerender({ open: false });
    rerender({ open: true });
    expect(getItem).toHaveBeenCalledTimes(2);
  });
});
