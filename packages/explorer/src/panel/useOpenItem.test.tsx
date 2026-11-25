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

  it('asks again on an opening while the index had nothing for it', async () => {
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
  });

  // Work Tracker 1461, 1471: a rename on the Explorer page, or an edit that moves its version on, shows on the next
  // opening, never hidden behind the first read.
  it('asks again on every opening once it answered, keeping its copy while the read is on its way', async () => {
    const item = makeItem(1, { title: 'Copy of Plan', updatedAt: 10 });
    const index = createFakeIndex({ items: [item] });
    const getItem = vi.spyOn(index.client, 'getItem');
    const { result, rerender } = renderHook(
      ({ open }) => useOpenItem(index.client, item.id, null, undefined, { open }),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current?.title).toBe('Copy of Plan'));
    Object.assign(item, { title: 'Renamed elsewhere', updatedAt: 20 });
    rerender({ open: false });
    expect(getItem).toHaveBeenCalledTimes(1);
    rerender({ open: true });
    expect(result.current?.title).toBe('Copy of Plan');
    await waitFor(() => expect(result.current?.title).toBe('Renamed elsewhere'));
    expect(result.current?.updatedAt).toBe(20);
    expect(getItem).toHaveBeenCalledTimes(2);
  });

  it('asks again when the page comes back into view while it shows, and not while it is closed', async () => {
    const item = makeItem(1, { title: 'Before' });
    const index = createFakeIndex({ items: [item] });
    const getItem = vi.spyOn(index.client, 'getItem');
    const { result, rerender } = renderHook(
      ({ open }) => useOpenItem(index.client, item.id, null, undefined, { open }),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current?.title).toBe('Before'));
    item.title = 'Renamed in another tab';
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(getItem).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(result.current?.title).toBe('Renamed in another tab'));
    expect(getItem).toHaveBeenCalledTimes(2);
    // Closed, coming back to the page reads nothing.
    rerender({ open: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(getItem).toHaveBeenCalledTimes(2);
    visibility.mockRestore();
  });

  it("never watches the page's visibility for a host that names no opening (the footer's Tools)", async () => {
    const item = makeItem(1);
    const index = createFakeIndex({ items: [item] });
    const getItem = vi.spyOn(index.client, 'getItem');
    const { result } = renderHook(() => useOpenItem(index.client, item.id));
    await waitFor(() => expect(result.current?.id).toBe(item.id));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('keeps the copy it has when a later read fails', async () => {
    const item = makeItem(1, { title: 'Kept' });
    let fail = false;
    const client = {
      getItem: vi.fn(() =>
        fail ? Promise.reject(new Error('offline')) : Promise.resolve({ item: { ...item } }),
      ),
    } as unknown as IndexClient;
    const { result, rerender } = renderHook(
      ({ open }) => useOpenItem(client, item.id, null, undefined, { open }),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current?.title).toBe('Kept'));
    fail = true;
    rerender({ open: false });
    rerender({ open: true });
    await waitFor(() => expect(client.getItem).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(result.current?.title).toBe('Kept');
  });
});
