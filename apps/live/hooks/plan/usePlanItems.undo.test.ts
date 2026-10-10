// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@livediagram/items';
import type { ItemUndoStep } from './item-undo-journal';

// docs/specs/026-plan/item-types.md "An item type": an undo or redo puts back a change already made, so it is sent
// marked `undo`, and the api never refuses it for a status the card's type leaves out.

const api = vi.hoisted(() => ({
  fetchItems: vi.fn(),
  writeItem: vi.fn(),
  writeItemComment: vi.fn(),
}));
vi.mock('@/lib/api/items', () => api);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { usePlanItems } from './usePlanItems';

const PERSON = { id: 'p', name: 'Me', color: '#2563eb' };
const card = (status: string): Item => ({
  id: 'item-one',
  type: 'task',
  key: 1,
  rank: 'i',
  fields: { title: 'A', status },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchItems.mockResolvedValue({ items: [card('done')], rev: 1, nextKey: 2 });
  api.writeItem.mockResolvedValue({ upserts: [], removed: [], rev: 2 });
});

describe('usePlanItems undo', () => {
  it('sends a move’s undo and redo marked as an undo, the move itself not', async () => {
    const steps: ItemUndoStep[] = [];
    const { result } = renderHook(() =>
      usePlanItems({
        documentId: 'doc',
        ready: true,
        ownerId: 'owner-me',
        name: 'Me',
        color: '#2563eb',
        shareCode: null,
        tabScope: null,
        pushUndo: (step) => steps.push(step),
        onError: vi.fn(),
        onMentioned: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.items.size).toBe(1));
    await act(async () => {
      await result.current.write({ kind: 'move', id: 'item-one', move: { status: 'todo' } });
    });
    expect(api.writeItem.mock.calls[0]![1]).not.toHaveProperty('undo');
    expect(steps).toHaveLength(1);
    await act(async () => steps[0]!.undo());
    const undone = api.writeItem.mock.calls[1]![1];
    expect(undone).toMatchObject({ kind: 'move', undo: true, move: { status: 'done' } });
    await act(async () => steps[0]!.redo());
    expect(api.writeItem.mock.calls[2]![1]).toMatchObject({
      kind: 'move',
      undo: true,
      move: { status: 'todo' },
    });
  });

  // A change of many cards refused after some of them landed: those stay changed, and are one undo step.
  it('keeps the part of a many-card change that landed, undoable on its own', async () => {
    const two = { ...card('done'), id: 'item-two', key: 2 };
    api.fetchItems.mockResolvedValue({ items: [card('done'), two], rev: 1, nextKey: 3 });
    const landed = { ...card('trash'), rev: 2 };
    api.writeItem.mockRejectedValueOnce(
      Object.assign(new Error('items change failed: 409'), {
        code: 'item_busy',
        landed: { upserts: [landed], removed: [], rev: 2 },
      }),
    );
    const steps: ItemUndoStep[] = [];
    const onError = vi.fn();
    const { result } = renderHook(() =>
      usePlanItems({
        documentId: 'doc',
        ready: true,
        ownerId: 'owner-me',
        name: 'Me',
        color: '#2563eb',
        shareCode: null,
        tabScope: null,
        pushUndo: (step) => steps.push(step),
        onError,
        onMentioned: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.items.size).toBe(2));
    let ok = true;
    await act(async () => {
      ok = await result.current.write({
        kind: 'patches',
        patches: [
          { id: 'item-one', patch: { set: { status: 'trash' } } },
          { id: 'item-two', patch: { set: { status: 'trash' } } },
        ],
      });
    });
    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalled();
    expect(steps).toHaveLength(1);
    await act(async () => steps[0]!.undo());
    expect(api.writeItem.mock.calls[1]![1]).toEqual({
      kind: 'patches',
      undo: true,
      patches: [{ id: 'item-one', patch: { set: { status: 'done' } } }],
    });
  });
});
