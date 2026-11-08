// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemStoreState, ItemWrite } from '@liveplanner/items';
import type { ItemWriteAnswer } from '@/lib/api/items';
import { forgetPlanQueues } from '@/lib/offline-queue/plan-queue';

// docs/specs/026-plan/blueprints/item-store.md "Optimistic": a read of the store that crosses a write never takes the
// written card away, whether the write is still on its way or was answered while the read was. A card added and
// opened at once (plan-board.md "Open an item") must not blink out, or its panel closes with its address.

const api = vi.hoisted(() => ({
  fetchItems: vi.fn(),
  writeItem: vi.fn(),
}));
vi.mock('@/lib/api/items', () => api);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { usePlanItems } from './usePlanItems';

const PERSON = { id: 'p', name: 'Me', color: '#2563eb' };
const card = (title: string, id: string, key: number): Item => ({
  id,
  type: 'task',
  key,
  rank: 'i',
  fields: { title, status: 'todo' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});
const FIRST = card('First', 'item-one', 1);
const NEW = card('New task', 'item-two', 2);
const ADD: ItemWrite = {
  kind: 'create',
  creates: [{ id: 'item-two', type: 'task', fields: { title: 'New task', status: 'todo' } }],
};
const store = (items: Item[], rev: number): ItemStoreState => ({ items, rev, nextKey: 3 });

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function mount() {
  return renderHook(() =>
    usePlanItems({
      projectId: 'doc',
      ready: true,
      ownerId: 'owner-me',
      name: 'Me',
      color: '#2563eb',
      shareCode: null,
      tabScope: null,
      pushUndo: vi.fn(),
      onError: vi.fn(),
      level: 'edit',
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  forgetPlanQueues();
  api.fetchItems.mockResolvedValue(store([FIRST], 1));
});

describe('a read of the store that crosses a write', () => {
  it('lays a write still on its way back over the copy it reads', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const answer = deferred<ItemWriteAnswer>();
    api.writeItem.mockReturnValueOnce(answer.promise);
    let written!: Promise<boolean>;
    act(() => {
      written = result.current.write(ADD);
    });
    expect(result.current.items.has('item-two')).toBe(true);
    // The room asks for a read; it comes back without the card, which the api has not stored yet.
    act(() => result.current.refetch());
    await waitFor(() => expect(api.fetchItems).toHaveBeenCalledTimes(2));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.items.get('item-two')?.fields.title).toBe('New task');
    await act(async () => {
      answer.resolve({ upserts: [NEW], removed: [], rev: 2 });
      await written;
    });
    expect(result.current.items.get('item-two')).toEqual(NEW);
  });

  it('reads again when the write was answered while an older copy was on its way', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const stale = deferred<ItemStoreState>();
    api.fetchItems.mockReturnValueOnce(stale.promise);
    act(() => result.current.refetch());
    await waitFor(() => expect(api.fetchItems).toHaveBeenCalledTimes(2));
    // The read is out; the card is added and answered before it comes back.
    api.writeItem.mockResolvedValueOnce({ upserts: [NEW], removed: [], rev: 2 });
    await act(async () => {
      await result.current.write(ADD);
    });
    api.fetchItems.mockResolvedValueOnce(store([FIRST, NEW], 2));
    await act(async () => {
      stale.resolve(store([FIRST], 1));
      await stale.promise;
    });
    expect(result.current.items.has('item-two')).toBe(true);
    await waitFor(() => expect(api.fetchItems).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.store.rev).toBe(2));
    expect(result.current.items.get('item-two')).toEqual(NEW);
  });
});
