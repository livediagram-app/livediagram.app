// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveplanner/items';
import type { ItemUndoStep } from './item-undo-journal';

// docs/specs/026-plan/plan-tour.md "Practice cards": made in this screen's store alone; no write touching one is
// sent or undoable; a fresh read keeps them; Keep sends them as real cards in one undo step, Clear takes them away.

const api = vi.hoisted(() => ({
  fetchItems: vi.fn(),
  writeItem: vi.fn(),
}));
vi.mock('@/lib/api/items', () => api);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { PRACTICE_KEY } from './practice-items';
import { usePlanItems } from './usePlanItems';

const PERSON = { id: 'p', name: 'Me', color: '#2563eb' };
const real: Item = {
  id: 'real-1',
  type: 'task',
  key: 1,
  rank: 'i',
  fields: { title: 'Real', status: 'todo' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
};
const DEAL = [
  { id: 'pr-1', type: 'task', fields: { title: 'Draft the plan' }, place: { status: 'todo' } },
  { id: 'pr-2', type: 'task', fields: { title: 'Book a room' }, place: { status: 'todo' } },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchItems.mockResolvedValue({ items: [real], rev: 1, nextKey: 2 });
  api.writeItem.mockResolvedValue({ upserts: [], removed: [], rev: 2 });
});

async function mount() {
  const steps: ItemUndoStep[] = [];
  const hook = renderHook(() =>
    usePlanItems({
      projectId: 'doc',
      ready: true,
      ownerId: 'owner-me',
      name: 'Me',
      color: '#2563eb',
      shareCode: null,
      tabScope: null,
      pushUndo: (step) => steps.push(step),
      onError: vi.fn(),
    }),
  );
  await waitFor(() => expect(hook.result.current.items.size).toBe(1));
  return { ...hook, steps };
}

describe('usePlanItems practice cards', () => {
  it('deals them here alone, keyless, leaving the next key and sending nothing', async () => {
    const { result, steps } = await mount();
    let ok = false;
    act(() => {
      ok = result.current.practise(DEAL);
    });
    expect(ok).toBe(true);
    expect([...result.current.practiceIds]).toEqual(['pr-1', 'pr-2']);
    expect(result.current.items.get('pr-1')?.key).toBe(PRACTICE_KEY);
    expect(api.writeItem).not.toHaveBeenCalled();
    expect(steps).toHaveLength(0);
  });

  it('applies a move of one here alone, with no undo step', async () => {
    const { result, steps } = await mount();
    act(() => void result.current.practise(DEAL));
    await act(async () => {
      await result.current.write({ kind: 'move', id: 'pr-1', move: { status: 'doing' } });
    });
    expect(result.current.items.get('pr-1')?.fields.status).toBe('doing');
    expect(api.writeItem).not.toHaveBeenCalled();
    expect(steps).toHaveLength(0);
  });

  it('sends only the real part of a write that touches both', async () => {
    const { result } = await mount();
    act(() => void result.current.practise(DEAL));
    await act(async () => {
      await result.current.write({
        kind: 'patches',
        patches: [
          { id: 'pr-1', patch: { set: { due: '2026-11-09' } } },
          { id: 'real-1', patch: { set: { due: '2026-11-09' } } },
        ],
      });
    });
    expect(result.current.items.get('pr-1')?.fields.due).toBe('2026-11-09');
    expect(api.writeItem).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(api.writeItem.mock.calls[0]![1])).not.toContain('pr-1');
  });

  it('keeps them over a fresh read', async () => {
    const { result } = await mount();
    act(() => void result.current.practise(DEAL));
    await act(async () => {
      result.current.refetch();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.items.has('pr-1')).toBe(true);
    expect(result.current.items.has('real-1')).toBe(true);
  });

  it('Clear takes them away and sends nothing', async () => {
    const { result } = await mount();
    act(() => void result.current.practise(DEAL));
    await act(async () => result.current.endPractice(false));
    expect(result.current.items.has('pr-1')).toBe(false);
    expect(result.current.practiceIds.size).toBe(0);
    expect(api.writeItem).not.toHaveBeenCalled();
  });

  it('Keep sends them as real cards where they were, in one undo step', async () => {
    const { result, steps } = await mount();
    act(() => void result.current.practise(DEAL));
    await act(async () => {
      await result.current.write({ kind: 'move', id: 'pr-2', move: { status: 'done' } });
    });
    await act(async () => result.current.endPractice(true));
    expect(api.writeItem).toHaveBeenCalledTimes(1);
    const sent = api.writeItem.mock.calls[0]![1] as {
      kind: string;
      creates: { id: string; fields: Record<string, unknown>; place?: { status: string } }[];
    };
    expect(sent.kind).toBe('create');
    expect(sent.creates.map((c) => [c.id, c.place?.status])).toEqual(
      expect.arrayContaining([
        ['pr-1', 'todo'],
        ['pr-2', 'done'],
      ]),
    );
    expect(sent.creates.every((c) => !('status' in c.fields))).toBe(true);
    expect(steps).toHaveLength(1);
    expect(result.current.practiceIds.size).toBe(0);
  });

  it('ending with none dealt does nothing', async () => {
    const { result } = await mount();
    await act(async () => result.current.endPractice(true));
    expect(api.writeItem).not.toHaveBeenCalled();
  });
});
