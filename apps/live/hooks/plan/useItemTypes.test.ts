// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type ItemTypeCatalogue, type ItemTypeDef } from '@livediagram/items';
import type { SavedItemTypes } from '@/lib/api/item-types';
import type { ItemUndoStep } from './item-undo-journal';

// docs/specs/026-plan/item-types.md "Storage and sync": card type changes never overwrite each other. A change made
// to a catalogue another editor changed meanwhile is made again to theirs; a failed save drops only its own change;
// an undo takes back only its own change.

const api = vi.hoisted(() => ({ saveItemTypes: vi.fn() }));
vi.mock('@/lib/api/item-types', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/item-types')>()),
  saveItemTypes: api.saveItemTypes,
}));

import { ItemTypesStaleError } from '@/lib/api/item-types';
import { useItemTypes } from './useItemTypes';

const def = (id: string): ItemTypeDef => ({ ...ITEM_TYPES[1]!, id, label: id });
const cat = (...ids: string[]): ItemTypeCatalogue => ({ version: 1, types: ids.map(def) });
const ids = (c: ItemTypeCatalogue | null) => c?.types.map((t) => t.id);

function render(initial: SavedItemTypes) {
  const steps: ItemUndoStep[] = [];
  const onError = vi.fn();
  const hook = renderHook(() => {
    const [stored, setStored] = useState(initial);
    return {
      stored,
      slice: useItemTypes({
        documentId: 'doc',
        ownerId: 'me',
        shareCode: null,
        stored,
        setStored,
        pushUndo: (s) => steps.push(s),
        onError,
      }),
    };
  });
  return { hook, steps, onError };
}

// The answer the api gives a save: what was sent, at the next revision.
const answering = () =>
  api.saveItemTypes.mockImplementation(
    async (_scope: unknown, itemTypes: ItemTypeCatalogue | null, rev: number) => ({
      itemTypes,
      itemTypesRev: rev + 1,
    }),
  );
const sent = (call: number) => ({
  ids: ids(api.saveItemTypes.mock.calls[call]![1] as ItemTypeCatalogue),
  rev: api.saveItemTypes.mock.calls[call]![2] as number,
});

beforeEach(() => vi.clearAllMocks());

describe('useItemTypes', () => {
  it('shows a change at once and saves it naming the revision it changed', async () => {
    answering();
    const { hook } = render({ itemTypes: cat('task'), itemTypesRev: 3 });
    act(() => hook.result.current.slice.saveType(def('risk')));
    expect(ids(hook.result.current.slice.catalogue)).toEqual(['task', 'risk']);
    await waitFor(() => expect(hook.result.current.stored.itemTypesRev).toBe(4));
    expect(sent(0)).toEqual({ ids: ['task', 'risk'], rev: 3 });
  });

  it('makes its change again to the catalogue another editor saved meanwhile', async () => {
    api.saveItemTypes.mockRejectedValueOnce(
      new ItemTypesStaleError({ itemTypes: cat('task', 'spike'), itemTypesRev: 4 }),
    );
    answering();
    const { hook, onError } = render({ itemTypes: cat('task'), itemTypesRev: 3 });
    act(() => hook.result.current.slice.saveType(def('risk')));
    await waitFor(() => expect(hook.result.current.stored.itemTypesRev).toBe(5));
    expect(sent(1)).toEqual({ ids: ['task', 'risk', 'spike'], rev: 4 });
    expect(ids(hook.result.current.slice.catalogue)).toEqual(['task', 'risk', 'spike']);
    expect(onError).not.toHaveBeenCalled();
  });

  it('drops only a failed change, keeping one saved after it', async () => {
    api.saveItemTypes.mockRejectedValueOnce(new Error('item-types failed: 500'));
    answering();
    const { hook, onError } = render({ itemTypes: cat('task'), itemTypesRev: 1 });
    act(() => {
      hook.result.current.slice.saveType(def('risk'));
      hook.result.current.slice.saveType(def('spike'));
    });
    await waitFor(() => expect(api.saveItemTypes).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hook.result.current.stored.itemTypesRev).toBe(2));
    expect(onError).toHaveBeenCalledWith('Couldn’t save the card types');
    expect(sent(1)).toEqual({ ids: ['task', 'spike'], rev: 1 });
    expect(ids(hook.result.current.slice.catalogue)).toEqual(['task', 'spike']);
  });

  it('undoes one change without taking back a later one', async () => {
    answering();
    const { hook, steps } = render({ itemTypes: cat('task'), itemTypesRev: 0 });
    act(() => hook.result.current.slice.saveType(def('risk')));
    await waitFor(() => expect(hook.result.current.stored.itemTypesRev).toBe(1));
    act(() => hook.result.current.slice.saveType(def('spike')));
    await waitFor(() => expect(hook.result.current.stored.itemTypesRev).toBe(2));
    act(() => steps[0]!.undo());
    await waitFor(() => expect(hook.result.current.stored.itemTypesRev).toBe(3));
    expect(sent(2)).toEqual({ ids: ['task', 'spike'], rev: 2 });
    act(() => steps[0]!.redo());
    await waitFor(() => expect(hook.result.current.stored.itemTypesRev).toBe(4));
    expect(ids(hook.result.current.slice.catalogue)).toEqual(['task', 'risk', 'spike']);
    expect(steps).toHaveLength(2);
  });

  it('takes another editor’s save from the room, but never an older one', async () => {
    const { hook } = render({ itemTypes: cat('task'), itemTypesRev: 5 });
    act(() =>
      hook.result.current.slice.receive({
        kind: 'item-types',
        itemTypes: cat('a'),
        itemTypesRev: 6,
      }),
    );
    expect(ids(hook.result.current.slice.catalogue)).toEqual(['a']);
    act(() =>
      hook.result.current.slice.receive({
        kind: 'item-types',
        itemTypes: cat('b'),
        itemTypesRev: 4,
      }),
    );
    expect(ids(hook.result.current.slice.catalogue)).toEqual(['a']);
  });
});
