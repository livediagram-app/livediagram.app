import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlowResponse } from '@liveplanner/api-schema';
import type { ItemsScope } from '@/lib/api/items';
import { FLOW_REFETCH_MS, createFlowStore, flowKey } from './plan-flow-store';

// docs/specs/026-plan/plan-views.md "Flow charts": one read per range shared by its charts, read again after a pause
// when the cards change, a failed refresh keeping the last answer.
const SCOPE: ItemsScope = { ownerId: 'o', projectId: 'p', shareCode: null, tabId: null };
const ANSWER: FlowResponse = { fromDay: 1, toDay: 30, counts: [], cards: [] };
const flush = () => new Promise<void>((r) => queueMicrotask(r));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('flow store', () => {
  it('keys a read by plan, tab, link and range', () => {
    expect(flowKey(SCOPE, 30)).toBe('p|||30');
    expect(flowKey({ ...SCOPE, tabId: 't', shareCode: 's' }, 90)).toBe('p|t|s|90');
  });

  it('reads once for every chart of a range, then once after a burst of changes', async () => {
    const read = vi.fn().mockResolvedValue(ANSWER);
    const store = createFlowStore(read);
    const key = flowKey(SCOPE, 30);
    const seen = vi.fn();
    const offA = store.subscribe(key, seen);
    const offB = store.subscribe(key, () => {});
    const v1 = new Map();
    store.want(key, SCOPE, 30, v1);
    store.want(key, SCOPE, 30, v1);
    expect(read).toHaveBeenCalledTimes(1);
    await flush();
    expect(store.get(key)).toEqual({ status: 'ready', data: ANSWER });
    expect(seen).toHaveBeenCalled();
    // Three changes in a burst read once, FLOW_REFETCH_MS after the last.
    store.want(key, SCOPE, 30, new Map());
    vi.advanceTimersByTime(FLOW_REFETCH_MS - 1);
    store.want(key, SCOPE, 30, new Map());
    vi.advanceTimersByTime(FLOW_REFETCH_MS - 1);
    expect(read).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(read).toHaveBeenCalledTimes(2);
    offA();
    expect(store.size()).toBe(1);
    offB();
    expect(store.size()).toBe(0);
  });

  it('drops a pending refresh with its last chart, and asks nothing for an entry no chart holds', () => {
    const read = vi.fn().mockResolvedValue(ANSWER);
    const store = createFlowStore(read);
    const key = flowKey(SCOPE, 14);
    store.want(key, SCOPE, 14, new Map());
    expect(read).not.toHaveBeenCalled();
    const off = store.subscribe(key, () => {});
    store.want(key, SCOPE, 14, new Map());
    store.want(key, SCOPE, 14, new Map());
    off();
    vi.advanceTimersByTime(FLOW_REFETCH_MS);
    expect(read).toHaveBeenCalledTimes(1);
    store.retry(key, SCOPE, 14);
    expect(read).toHaveBeenCalledTimes(1);
    expect(store.get(key).status).toBe('loading');
  });

  it('shows a failed first read, keeps the answer through a failed refresh, and tries again', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('down'));
    const store = createFlowStore(read);
    const key = flowKey(SCOPE, 30);
    store.subscribe(key, () => {});
    store.want(key, SCOPE, 30, new Map());
    await flush();
    await flush();
    expect(store.get(key).status).toBe('error');
    read.mockResolvedValueOnce(ANSWER);
    store.retry(key, SCOPE, 30);
    expect(store.get(key).status).toBe('loading');
    await flush();
    expect(store.get(key)).toEqual({ status: 'ready', data: ANSWER });
    read.mockRejectedValueOnce(new Error('down again'));
    store.want(key, SCOPE, 30, new Map());
    vi.advanceTimersByTime(FLOW_REFETCH_MS);
    await flush();
    await flush();
    expect(store.get(key)).toEqual({ status: 'ready', data: ANSWER });
  });

  it('says a This Browser plan has no flow, and drops an answer a newer read overtook', async () => {
    let resolveOld: (v: FlowResponse) => void = () => {};
    const read = vi
      .fn()
      .mockReturnValueOnce(new Promise<FlowResponse>((r) => (resolveOld = r)))
      .mockResolvedValueOnce('offline');
    const store = createFlowStore(read);
    const key = flowKey(SCOPE, 30);
    store.subscribe(key, () => {});
    store.want(key, SCOPE, 30, new Map());
    store.retry(key, SCOPE, 30);
    await flush();
    expect(store.get(key)).toEqual({ status: 'offline', data: null });
    resolveOld(ANSWER);
    await flush();
    expect(store.get(key).status).toBe('offline');
  });
});
