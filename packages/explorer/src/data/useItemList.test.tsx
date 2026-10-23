import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { createItemOverlay } from './overlay';
import { useItemList } from './useItemList';
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
});
