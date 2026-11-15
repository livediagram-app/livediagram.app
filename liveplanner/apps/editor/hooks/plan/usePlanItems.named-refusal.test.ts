// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { forgetPlanQueues } from '@/lib/offline-queue/plan-queue';

// docs/specs/026-plan/items.md "Limits": a value the api refused past a limit is told in a toast that names the field
// as the card shows it, from the card's type, and the limit it broke (Work Tracker 944).

const api = vi.hoisted(() => ({ fetchItems: vi.fn(), writeItem: vi.fn() }));
vi.mock('@/lib/api/items', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/items')>()),
  fetchItems: api.fetchItems,
  writeItem: api.writeItem,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { usePlanItems } from './usePlanItems';

const PERSON = { id: 'p', name: 'Me', color: '#2563eb' };
const PITCH: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'pitch',
  label: 'Pitch',
  custom: [{ id: 'f-solution', label: 'Solution', kind: 'longtext' }],
};
const CARD: Item = {
  id: 'item-one',
  type: 'pitch',
  key: 1,
  rank: 'i',
  fields: { title: 'Idea', status: 'todo' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
};
const refused = (body: object) => Object.assign(new Error('api 400'), body);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  forgetPlanQueues();
  api.fetchItems.mockResolvedValue({ items: [CARD], rev: 1, nextKey: 2 });
});

describe('a refused change’s toast', () => {
  it('names the refused field as its card shows it, and a full plan in plain words', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      usePlanItems({
        projectId: 'doc',
        ready: true,
        ownerId: 'owner-me',
        name: 'Me',
        color: '#2563eb',
        shareCode: null,
        tabScope: null,
        pushUndo: vi.fn(),
        onError,
        typesOf: () => [...ITEM_TYPES, PITCH],
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    api.writeItem.mockRejectedValueOnce(
      refused({
        code: 'field_value_invalid',
        field: 'f-solution',
        limit: { unit: 'characters', max: 10_000, given: 12_412 },
      }),
    );
    await act(async () => {
      await result.current.write({
        kind: 'patch',
        id: 'item-one',
        patch: { set: { 'f-solution': 's'.repeat(12_412) } },
      });
    });
    expect(onError).toHaveBeenLastCalledWith('Solution is 12,412 characters; the most is 10,000.');
    api.writeItem.mockRejectedValueOnce(refused({ code: 'plan_full' }));
    await act(async () => {
      await result.current.write({
        kind: 'create',
        creates: [{ type: 'pitch', fields: { title: 'More' } }],
      });
    });
    expect(onError).toHaveBeenLastCalledWith(expect.stringContaining("This plan's cards are full"));
  });
});
