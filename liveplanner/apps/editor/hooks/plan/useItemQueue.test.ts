// @vitest-environment jsdom
// docs/specs/007-editor/offline-changes.md "Sending them": a replay with no answer while the browser says it is offline
// waits for the `online` event, not a timer; a replay the editor itself fails on leaves the queue for the next try.
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ItemWrite } from '@liveplanner/items';
import { PlanQueue } from '@/lib/offline-queue/plan-queue';
import { useItemQueue, withWaitingItems } from './useItemQueue';

const online = vi.hoisted(() => ({ is: true }));
vi.mock('@liveworkspace/workbench/lib/online-status', () => ({ getOnline: () => online.is }));

const write: ItemWrite = { kind: 'patch', id: 'a', patch: { set: { title: 'x' } } };

function queued(): PlanQueue {
  const q = new PlanQueue('k', null);
  q.add({ id: 'i1', seq: 1, store: 'items', write });
  return q;
}

function mount(queue: PlanQueue, send: () => Promise<never> | Promise<object>, landed = vi.fn()) {
  const load = vi.fn(async () => {});
  renderHook(() =>
    useItemQueue({
      queueOf: () => queue,
      send: send as never,
      landed,
      refused: vi.fn(),
      load,
      refetch: vi.fn(),
      loaded: true,
    }),
  );
  return { load };
}

afterEach(() => {
  online.is = true;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useItemQueue', () => {
  it('offline, a replay with no answer sets no retry timer', async () => {
    online.is = false;
    const timer = vi.spyOn(globalThis, 'setTimeout');
    const send = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    const queue = queued();
    mount(queue, send);
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(timer.mock.calls.filter(([, ms]) => (ms ?? 0) >= 2_000)).toHaveLength(0);
    expect(queue.count('items')).toBe(1);
  });

  it('a replay that fails in the editor keeps the change and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const landed = vi.fn(() => {
      throw new Error('fold failed');
    });
    const queue = queued();
    const { load } = mount(
      queue,
      () => Promise.resolve({ upserts: [], removed: [], rev: 2 }),
      landed,
    );
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith('[offline-queue] items.replay-failed', {
        error: 'Error: fold failed',
      }),
    );
    expect(queue.count('items')).toBe(1);
    expect(load).not.toHaveBeenCalled();
  });

  it('lays nothing over a store when no queue or nothing waits', () => {
    const state = { items: new Map() } as never;
    const by = { id: 'p', name: 'Me', color: '#000' };
    expect(withWaitingItems(state, null, by)).toBe(state);
    expect(withWaitingItems(state, new PlanQueue('k', null), by)).toBe(state);
  });
});
