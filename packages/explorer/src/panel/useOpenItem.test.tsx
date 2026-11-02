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
});
