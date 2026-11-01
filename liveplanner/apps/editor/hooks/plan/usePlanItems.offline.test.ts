// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessLevel } from '@liveplanner/api-schema';
import type { Item, ItemWrite } from '@liveplanner/items';
import { ApiError } from '@/lib/api/core';
import {
  PLAN_QUEUE_FULL_MESSAGE,
  PLAN_QUEUE_MAX_CHANGES,
  forgetPlanQueues,
  planQueue,
  planQueueKey,
  waitingChangeCount,
} from '@/lib/offline-queue/plan-queue';
import { signalReconnect } from '@/lib/offline-queue/reconnect';

// docs/specs/007-editor/offline-changes.md: card changes made without a connection wait in the plan's queue, shown,
// kept across a reload, and are sent (and refused) when it comes back.

const api = vi.hoisted(() => ({
  fetchItems: vi.fn(),
  writeItem: vi.fn(),
}));
vi.mock('@/lib/api/items', () => api);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const offlineProject = vi.hoisted(() => ({ is: false }));
vi.mock('@/lib/offline/offline-store', async (original) => ({
  ...(await original<typeof import('@/lib/offline/offline-store')>()),
  isOfflineIdSync: () => offlineProject.is,
}));

import { usePlanItems } from './usePlanItems';

const PERSON = { id: 'p', name: 'Me', color: '#2563eb' };
const card = (title = 'A', id = 'item-one', key = 1): Item => ({
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
const retitle = (title: string, id = 'item-one'): ItemWrite => ({
  kind: 'patch',
  id,
  patch: { set: { title } },
});

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

function mount(level: AccessLevel | null = 'edit', onError = vi.fn()) {
  const hook = renderHook(() =>
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
      ...(level ? { level } : {}),
    }),
  );
  return { ...hook, onError };
}

const title = (r: { current: { items: ReadonlyMap<string, Item> } }, id = 'item-one') =>
  r.current.items.get(id)?.fields.title;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  forgetPlanQueues();
  offlineProject.is = false;
  api.fetchItems.mockResolvedValue({ items: [card()], rev: 1, nextKey: 2 });
  api.writeItem.mockResolvedValue({ upserts: [], removed: [], rev: 2 });
});

afterEach(() => {
  setOnline(true);
  vi.useRealTimers();
});

describe('usePlanItems offline', () => {
  it('keeps an Editor’s change made offline, shows it, and sends it when the connection is back', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    setOnline(false);
    let ok = false;
    await act(async () => {
      ok = await result.current.write(retitle('Offline'));
    });
    expect(ok).toBe(true);
    expect(api.writeItem).not.toHaveBeenCalled();
    expect(title(result)).toBe('Offline');
    expect(waitingChangeCount()).toBe(1);
    expect(localStorage.getItem(planQueueKey('doc', 'owner-me'))).toContain('Offline');
    // A second change waits behind it; online, the two field changes go as one request.
    await act(async () => {
      await result.current.write(retitle('Offline again'));
    });
    api.fetchItems.mockResolvedValue({ items: [card('Offline again')], rev: 3, nextKey: 2 });
    await act(async () => setOnline(true));
    await waitFor(() => expect(waitingChangeCount()).toBe(0));
    expect(api.writeItem).toHaveBeenCalledTimes(1);
    expect(api.writeItem.mock.calls[0]![1]).toMatchObject({ kind: 'patches' });
    // Then the board is read again.
    await waitFor(() => expect(api.fetchItems).toHaveBeenCalledTimes(2));
    expect(title(result)).toBe('Offline again');
    expect(localStorage.getItem(planQueueKey('doc', 'owner-me'))).toBeNull();
  });

  it('keeps a change whose request got no answer, and sends it on the next try', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result, onError } = mount();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    // The write and the replay its joining starts both get no answer; the doubling wait brings the next tries.
    api.writeItem
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    let ok = false;
    await act(async () => {
      ok = await result.current.write(retitle('Outage'));
    });
    expect(ok).toBe(true);
    expect(onError).not.toHaveBeenCalled();
    expect(waitingChangeCount()).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_100);
    });
    await waitFor(() => expect(waitingChangeCount()).toBe(0));
    expect(title(result)).toBe('Outage');
  });

  it('tells a refused replay and takes back that one change, sending the rest', async () => {
    const { result, onError } = mount();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    setOnline(false);
    await act(async () => {
      await result.current.write({ kind: 'delete', id: 'item-one' });
      await result.current.write({ kind: 'move', id: 'gone', move: { status: 'done' } });
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.writeItem.mockImplementation(async (_s: unknown, w: ItemWrite) => {
      if (w.kind === 'delete') throw new ApiError('item delete', 403, 'forbidden');
      return { upserts: [], removed: [], rev: 2 };
    });
    await act(async () => setOnline(true));
    await waitFor(() => expect(waitingChangeCount()).toBe(0));
    expect(onError).toHaveBeenCalledWith("Couldn't save that change");
    expect(warn).toHaveBeenCalledWith('[offline-queue] items.replay-refused', expect.anything());
    await waitFor(() => expect(title(result)).toBe('A'));
  });

  it('shows and sends what a reload kept, once the board has loaded', async () => {
    planQueue('doc', 'owner-me').add({ id: 'i1', seq: 1, store: 'items', write: retitle('Kept') });
    let resolveWrite: () => void = () => {};
    api.writeItem.mockImplementation(
      () =>
        new Promise((r) => {
          resolveWrite = () => r({ upserts: [], removed: [], rev: 2 });
        }),
    );
    const { result } = mount();
    await waitFor(() => expect(title(result)).toBe('Kept'));
    await waitFor(() => expect(api.writeItem).toHaveBeenCalledTimes(1));
    await act(async () => resolveWrite());
    await waitFor(() => expect(waitingChangeCount()).toBe(0));
  });

  it('refuses a change that would pass the queue’s bound, applying nothing', async () => {
    const queue = planQueue('doc', 'owner-me');
    for (let i = 1; i <= PLAN_QUEUE_MAX_CHANGES; i++)
      queue.add({ id: `i${i}`, seq: i, store: 'items', write: retitle(`t${i}`, 'other') });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.writeItem.mockImplementation(() => new Promise(() => {}));
    const { result, onError } = mount();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    setOnline(false);
    let ok = true;
    await act(async () => {
      ok = await result.current.write(retitle('One too many'));
    });
    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledWith(PLAN_QUEUE_FULL_MESSAGE);
    expect(title(result)).toBe('A');
    // Quietly, it says nothing.
    onError.mockClear();
    await act(async () => {
      await result.current.writeQuiet(retitle('Quiet'), { silent: true });
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('reads the board again on reconnect when nothing waits', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => signalReconnect());
    await waitFor(() => expect(api.fetchItems).toHaveBeenCalledTimes(2));
  });

  it('never keeps a change of an Offline Mode project, which needs no connection', async () => {
    offlineProject.is = true;
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    setOnline(false);
    await act(async () => {
      await result.current.write(retitle('Local'));
    });
    expect(api.writeItem).toHaveBeenCalledTimes(1);
    expect(waitingChangeCount()).toBe(0);
  });
});

describe('usePlanItems offline, by role', () => {
  it('Viewer: nothing waits; the write fails as online', async () => {
    api.writeItem.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result, onError } = mount('view');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    setOnline(false);
    let ok = true;
    await act(async () => {
      ok = await result.current.write(retitle('Nope'));
    });
    expect(ok).toBe(false);
    expect(waitingChangeCount()).toBe(0);
    expect(onError).toHaveBeenCalledWith("Couldn't save that change");
  });

  it('no role given: nothing waits', async () => {
    api.writeItem.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = mount(null);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    setOnline(false);
    await act(async () => {
      await result.current.write(retitle('Nope'));
    });
    expect(waitingChangeCount()).toBe(0);
  });

  it('Participant: an edit waits, a delete never', async () => {
    api.writeItem.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result, onError } = mount('participate');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    setOnline(false);
    await act(async () => {
      await result.current.write(retitle('Mine'));
    });
    expect(waitingChangeCount()).toBe(1);
    await act(async () => {
      await result.current.write({ kind: 'delete', id: 'item-one' });
    });
    expect(waitingChangeCount()).toBe(1);
    // The delete was sent, as a Participant's online one is, and its failure told.
    expect(api.writeItem).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalled();
  });
});
