// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemStoreState, ItemWrite } from '@liveplanner/items';
import { forgetPlanQueues } from '@/lib/offline-queue/plan-queue';

// docs/specs/026-plan/plan-board.md "A big board's first draw": a change of BIG_ITEMS_CHANGE items or more (a plan's
// cards read as it opens, an import's cards and their answer, a collaborator's import) is drawn as a transition; a
// smaller one at once.

const api = vi.hoisted(() => ({ fetchItems: vi.fn(), writeItem: vi.fn() }));
vi.mock('@/lib/api/items', () => api);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const transitions = vi.hoisted(() => ({ count: 0 }));
vi.mock('react', async (orig) => {
  const react = (await orig()) as typeof import('react');
  return {
    ...react,
    startTransition: (fn: () => void) => {
      transitions.count++;
      react.startTransition(fn);
    },
  };
});

import { BIG_ITEMS_CHANGE, usePlanItems } from './usePlanItems';

const PERSON = { id: 'p', name: 'Me', color: '#2563eb' };
const card = (i: number): Item => ({
  id: `item-${i}`,
  type: 'task',
  key: i + 1,
  rank: `a${i.toString(36).padStart(4, '0')}`,
  fields: { title: `Card ${i}`, status: 'todo' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});
const cards = (from: number, n: number) => Array.from({ length: n }, (_, i) => card(from + i));
const store = (items: Item[], rev: number): ItemStoreState => ({
  items,
  rev,
  nextKey: items.length + 1,
});
const creates = (from: number, n: number): ItemWrite => ({
  kind: 'create',
  creates: cards(from, n).map((c) => ({ id: c.id, type: 'task', fields: c.fields })),
});

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
  transitions.count = 0;
});

describe('a big change of the items', () => {
  it('draws a plan of many cards read as it opens as a transition', async () => {
    api.fetchItems.mockResolvedValue(store(cards(0, BIG_ITEMS_CHANGE), 1));
    const { result } = mount();
    await waitFor(() => expect(result.current.items.size).toBe(BIG_ITEMS_CHANGE));
    expect(transitions.count).toBe(1);
  });

  it('draws an import’s cards, and their answer, as transitions; a few cards and a small read at once', async () => {
    api.fetchItems.mockResolvedValue(store(cards(0, 1), 1));
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(transitions.count).toBe(0);
    const big = cards(1, BIG_ITEMS_CHANGE);
    api.writeItem.mockResolvedValueOnce({ upserts: big, removed: [], rev: 2 });
    await act(async () => {
      await result.current.write(creates(1, BIG_ITEMS_CHANGE));
    });
    expect(result.current.items.size).toBe(BIG_ITEMS_CHANGE + 1);
    expect(transitions.count).toBe(2);
    api.writeItem.mockResolvedValueOnce({ upserts: cards(900, 1), removed: [], rev: 3 });
    await act(async () => {
      await result.current.write(creates(900, 1));
    });
    expect(transitions.count).toBe(2);
  });

  it('draws a collaborator’s big change as a transition, a small one at once', async () => {
    api.fetchItems.mockResolvedValue(store(cards(0, 1), 1));
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.receive({ kind: 'items', upserts: cards(1, 1), removed: [], rev: 2 }));
    expect(transitions.count).toBe(0);
    act(() =>
      result.current.receive({
        kind: 'items',
        upserts: cards(2, BIG_ITEMS_CHANGE),
        removed: [],
        rev: 3,
      }),
    );
    expect(result.current.items.size).toBe(BIG_ITEMS_CHANGE + 2);
    expect(transitions.count).toBe(1);
  });
});
