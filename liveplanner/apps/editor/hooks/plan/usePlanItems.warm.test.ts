// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemStoreState } from '@liveplanner/items';
import { forgetPlanQueues } from '@/lib/offline-queue/plan-queue';

// docs/specs/006-project/offline-mode.md "Warm open of a cloud project": the cards a warm open painted show at once,
// read-only, with nothing fetched or sent while no plan is known; the first load replaces them whole.

const api = vi.hoisted(() => ({ fetchItems: vi.fn(), writeItem: vi.fn() }));
vi.mock('@/lib/api/items', () => api);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { usePlanItems } from './usePlanItems';

const PERSON = { id: 'p', name: 'Me', color: '#2563eb' };
const card = (title: string, id: string, rev: number): Item => ({
  id,
  type: 'task',
  key: 1,
  rank: 'i',
  fields: { title, status: 'todo' },
  rev,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});
const store = (items: Item[], rev: number): ItemStoreState => ({ items, rev, nextKey: 9 });

type Props = { projectId: string | null; warm: ItemStoreState | null };
function mount(initial: Props) {
  return renderHook(
    ({ projectId, warm }: Props) =>
      usePlanItems({
        projectId,
        ready: projectId !== null,
        ownerId: 'owner-me',
        name: 'Me',
        color: '#2563eb',
        shareCode: null,
        tabScope: null,
        pushUndo: vi.fn(),
        onError: vi.fn(),
        level: 'edit',
        warm,
      }),
    { initialProps: initial },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  forgetPlanQueues();
});

describe('usePlanItems warm', () => {
  it('shows the kept cards at once with no plan known, fetching and writing nothing', async () => {
    const kept = store([card('Kept', 'c1', 5)], 5);
    const { result } = mount({ projectId: null, warm: kept });
    expect(result.current.status).toBe('ready');
    expect(result.current.store).toBe(kept);
    expect(result.current.items.get('c1')?.fields.title).toBe('Kept');
    expect(await result.current.write({ kind: 'delete', id: 'c1' })).toBe(false);
    expect(api.fetchItems).not.toHaveBeenCalled();
    expect(api.writeItem).not.toHaveBeenCalled();
  });

  // A card the copy kept at a higher revision than the server now holds (an optimistic write that never landed) must
  // not outrank the server's: the first load takes the server's store whole.
  it("replaces the kept cards whole with the first load's", async () => {
    const kept = store([card('Kept newer', 'c1', 9), card('Deleted since', 'c2', 9)], 9);
    api.fetchItems.mockResolvedValue(store([card('Fresh', 'c1', 3)], 3));
    const { result, rerender } = mount({ projectId: null, warm: kept });
    rerender({ projectId: 'plan-1', warm: kept });
    await waitFor(() => expect(result.current.store).not.toBe(kept));
    expect(result.current.store.items.map((i) => i.fields.title)).toEqual(['Fresh']);
    expect(api.fetchItems).toHaveBeenCalledOnce();
  });

  it('empties the board when the warm cards leave before a plan is known', () => {
    const kept = store([card('Kept', 'c1', 5)], 5);
    const { result, rerender } = mount({ projectId: null, warm: kept });
    rerender({ projectId: null, warm: null });
    expect(result.current.store.items).toEqual([]);
    expect(result.current.status).toBe('loading');
  });

  it('ignores warm cards once the plan is known', async () => {
    api.fetchItems.mockResolvedValue(store([card('Fresh', 'c1', 3)], 3));
    const { result } = mount({ projectId: 'plan-1', warm: store([card('Kept', 'c9', 1)], 1) });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items.has('c9')).toBe(false);
  });
});
