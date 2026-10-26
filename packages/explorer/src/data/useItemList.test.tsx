import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { createItemOverlay } from './overlay';
import { useItemList } from './useItemList';
import { createItemActions } from './useItemActions';
import { isLensSet, parseLens } from '../lens';
import { makeListLens, viewList } from './viewLists';
import type { ExplorerView } from '../views';

const many = (n: number) => Array.from({ length: n }, (_, i) => makeItem(i));

function useView(
  index: ReturnType<typeof createFakeIndex>,
  view: ExplorerView,
  overlay = createItemOverlay(),
) {
  // The lens a search carries, as the pane makes it.
  const q = view.kind === 'search' ? view.q : '';
  const parsed = parseLens(q, { view: 'aggregate', teams: [], templates: [] });
  const lens = isLensSet(parsed.lens) ? makeListLens(parsed.lens, 'aggregate', 'user_me', 0) : null;
  const list = viewList(index.client, view, 'liveplanner', 'app', undefined, lens)!;
  return useItemList({
    key: list.key,
    load: list.load,
    overlay,
    belongs: list.belongs,
    enabled: list.enabled,
  });
}

describe('useItemList', () => {
  it('loads one page of at most 200 and the next only when asked', async () => {
    const index = createFakeIndex({ items: many(450) });
    const { result } = renderHook(() => useView(index, { kind: 'all' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(200);
    expect(result.current.hasMore).toBe(true);
    expect(index.count('listItems')).toBe(1);
    expect(index.calls[0]!.args[0]).toMatchObject({
      limit: 200,
      app: 'liveplanner',
      view: 'unsorted',
      team: 'personal',
    });

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(400));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(450));
    expect(result.current.hasMore).toBe(false);
    expect(index.count('listItems')).toBe(3);
  });

  it('cancels a superseded search rather than letting it land late', async () => {
    const index = createFakeIndex({
      items: [makeItem(1, { title: 'Alpha' }), makeItem(2, { title: 'Beta' })],
    });
    index.hold.add('listItems');
    const { result, rerender } = renderHook(({ q }) => useView(index, { kind: 'search', q }), {
      initialProps: { q: 'al' },
    });
    rerender({ q: 'be' });
    index.release();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((i) => i.title)).toEqual(['Beta']);
    expect(index.count('listItems')).toBe(2);
  });

  it('does not ask the index for an empty search', () => {
    const index = createFakeIndex({ items: many(3) });
    renderHook(() => useView(index, { kind: 'search', q: '  ' }));
    expect(index.count('listItems')).toBe(0);
  });

  it('drops an item that leaves the view and brings it back when the change is undone', async () => {
    const index = createFakeIndex({
      items: [makeItem(1, { folderId: 'f1' }), makeItem(2, { folderId: 'f1' })],
    });
    const overlay = createItemOverlay();
    const { result } = renderHook(() => useView(index, { kind: 'folder', id: 'f1' }, overlay));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    const kept = result.current.items[1];
    let undo = () => {};
    act(() => {
      undo = overlay.patch('item-1', { folderId: 'f2' });
    });
    expect(result.current.items.map((i) => i.id)).toEqual(['item-2']);
    // The untouched row is the same object, so its memoised row does not re-render.
    expect(result.current.items[0]).toBe(kept);
    act(() => undo());
    expect(result.current.items.map((i) => i.id)).toEqual(['item-1', 'item-2']);
  });

  it('shows the list as loading again while Try again reads it', async () => {
    const index = createFakeIndex({ items: many(3) });
    index.fail.set('listItems', new IndexError(500, 'unknown'));
    const { result } = renderHook(() => useView(index, { kind: 'all' }));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);

    index.fail.delete('listItems');
    index.hold.add('listItems');
    act(() => result.current.retry());
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(false);

    index.release();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(3);
    expect(result.current.error).toBe(false);
  });

  it('shows Try again when the next page fails, and reads it once per press', async () => {
    const index = createFakeIndex({ items: many(450) });
    const { result } = renderHook(() => useView(index, { kind: 'all' }));
    await waitFor(() => expect(result.current.items).toHaveLength(200));

    index.fail.set('listItems', new IndexError(500, 'unknown'));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.moreFailed).toBe(true));
    // Not complete: the list still has more, and a scroll (loadMore) does not ask again.
    expect(result.current.hasMore).toBe(true);
    expect(result.current.items).toHaveLength(200);
    act(() => result.current.loadMore());
    act(() => result.current.loadMore());
    expect(index.count('listItems')).toBe(2);

    // A failing retry asks once and shows Try again again.
    act(() => result.current.retryMore());
    await waitFor(() => expect(result.current.loadingMore).toBe(false));
    expect(result.current.moreFailed).toBe(true);
    expect(index.count('listItems')).toBe(3);

    index.fail.delete('listItems');
    act(() => result.current.retryMore());
    await waitFor(() => expect(result.current.items).toHaveLength(400));
    expect(result.current.moreFailed).toBe(false);
    expect(index.count('listItems')).toBe(4);
  });
});

describe('useItemList with the overlay over time', () => {
  function useMyWork(
    index: ReturnType<typeof createFakeIndex>,
    overlay: ReturnType<typeof createItemOverlay>,
    epoch: number,
    view: ExplorerView = { kind: 'all' },
  ) {
    const list = viewList(index.client, view, 'liveplanner', 'app', undefined, null)!;
    return useItemList({
      key: list.key,
      load: list.load,
      overlay,
      belongs: list.belongs,
      enabled: list.enabled,
      epoch,
    });
  }

  it('shows an item again once its folder is deleted, without a refresh', async () => {
    const index = createFakeIndex({
      items: [makeItem(1)],
      folders: [
        {
          id: 'f1',
          name: 'Folder',
          parentId: null,
          teamId: null,
          ownerId: 'user_me',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const overlay = createItemOverlay();
    const toast = { show: vi.fn(), error: vi.fn() };
    const actions = createItemActions({
      client: index.client,
      overlay,
      toast,
      reloadLists: () => {},
    });
    const { result, rerender } = renderHook(({ epoch }) => useMyWork(index, overlay, epoch), {
      initialProps: { epoch: 0 },
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(() => actions.move(result.current.items[0]!, { folderId: 'f1', teamId: null }));
    expect(result.current.items).toHaveLength(0);

    // The folder goes; the index moves its item up to My Work, and the lists reload.
    await act(() => index.client.deleteFolder('f1'));
    rerender({ epoch: 1 });
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['item-1']));
    expect(overlay.apply(makeItem(1)).folderId).toBeNull();
  });

  it('lets a list holding an older copy show what a newer read said', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    const overlay = createItemOverlay();
    const actions = createItemActions({
      client: index.client,
      overlay,
      toast: { show: vi.fn(), error: vi.fn() },
      reloadLists: () => {},
    });
    const stale = renderHook(() => useMyWork(index, overlay, 0));
    await waitFor(() => expect(stale.result.current.items).toHaveLength(1));
    const old = stale.result.current.items[0]!;
    await act(() => actions.rename(old, 'Mine'));
    // Someone else renames it after; a fresh read brings their title.
    await act(() => index.client.updateItem('item-1', { title: 'Theirs' }));
    const fresh = renderHook(() => useMyWork(index, overlay, 0));
    await waitFor(() => expect(fresh.result.current.items[0]?.title).toBe('Theirs'));
    expect(stale.result.current.items[0]?.title).toBe('Theirs');
  });
});
