import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { FlowResponse } from '@liveplanner/api-schema';
import type { Item } from '@liveplanner/items';
import type { ItemsScope } from '@/lib/api/items';
import {
  FLOW_MIN_INTERVAL_MS,
  FLOW_REFETCH_MS,
  createFlowStore,
  flowKey,
  flowVersionOf,
} from './plan-flow-store';

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
    // Past the least interval, three changes in a burst read once, FLOW_REFETCH_MS after the last.
    vi.advanceTimersByTime(FLOW_MIN_INTERVAL_MS);
    store.want(key, SCOPE, 30, new Map());
    vi.advanceTimersByTime(FLOW_REFETCH_MS - 1);
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
    vi.advanceTimersByTime(FLOW_MIN_INTERVAL_MS);
    await flush();
    await flush();
    expect(store.get(key)).toEqual({ status: 'ready', data: ANSWER });
  });

  it('says an offline plan has no flow, and drops an answer a newer read overtook', async () => {
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

  it('reads a busy plan at most once per least interval, and a never-quiet one still reads', async () => {
    const read = vi.fn().mockResolvedValue(ANSWER);
    const store = createFlowStore(read);
    const key = flowKey(SCOPE, 30);
    store.subscribe(key, () => {});
    store.want(key, SCOPE, 30, 'v0');
    // Several people moving cards: a status change every second for five minutes, never a quiet 2 seconds.
    for (let s = 1; s <= 300; s++) {
      vi.advanceTimersByTime(1000);
      store.want(key, SCOPE, 30, `v${s}`);
    }
    await flush();
    // The first read, then one every FLOW_MIN_INTERVAL_MS (30 s, 60 s, ... 270 s): ten in five minutes, where the
    // changes alone would have read 300 times.
    expect(read).toHaveBeenCalledTimes(300_000 / FLOW_MIN_INTERVAL_MS);
    expect(read.mock.calls.length * FLOW_MIN_INTERVAL_MS).toBeLessThanOrEqual(5 * 60_000);
  });

  it('reads a burst on a quiet plan once, FLOW_REFETCH_MS after its last change', () => {
    const read = vi.fn().mockResolvedValue(ANSWER);
    const store = createFlowStore(read);
    const key = flowKey(SCOPE, 30);
    store.subscribe(key, () => {});
    store.want(key, SCOPE, 30, 'v0');
    vi.advanceTimersByTime(5 * 60_000);
    // Twenty changes 100 ms apart (a drag across columns, a run of moves).
    for (let s = 1; s <= 20; s++) {
      store.want(key, SCOPE, 30, `v${s}`);
      vi.advanceTimersByTime(100);
    }
    expect(read).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(FLOW_REFETCH_MS - 100);
    expect(read).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(FLOW_MIN_INTERVAL_MS);
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe('flowVersionOf', () => {
  const card = (id: string, status: string, title = 'A card', type = 'task'): Item =>
    ({ id, type, fields: { title, status }, rev: 1 }) as unknown as Item;
  const items = (...cards: Item[]) => new Map(cards.map((c) => [c.id, c]));

  it('changes with a status, a type or a card coming or going, never with a title or its order', () => {
    const base = flowVersionOf(items(card('a', 'todo'), card('b', 'doing')));
    expect(flowVersionOf(items(card('a', 'todo', 'Renamed'), card('b', 'doing')))).toBe(base);
    expect(flowVersionOf(items(card('b', 'doing'), card('a', 'todo')))).toBe(base);
    expect(flowVersionOf(items(card('a', 'done'), card('b', 'doing')))).not.toBe(base);
    expect(flowVersionOf(items(card('a', 'todo', 'A card', 'bug'), card('b', 'doing')))).not.toBe(
      base,
    );
    expect(flowVersionOf(items(card('a', 'todo')))).not.toBe(base);
    expect(flowVersionOf(undefined)).toBeUndefined();
    const noStatus = { id: 'c', type: 'task', fields: {} } as unknown as Item;
    expect(flowVersionOf(items(noStatus))).toMatch(/^1:/);
  });

  it('works a map out once, and a 2,000 card plan in well under a frame', () => {
    const many = items(
      ...Array.from({ length: 2000 }, (_, i) => card(`card-${i}`, i % 2 ? 'todo' : 'done')),
    );
    let first: string | undefined;
    expect(cpuMsOf(() => (first = flowVersionOf(many)))).toBeLessThan(cpuBudgetMs(16));
    expect(flowVersionOf(many)).toBe(first);
  });
});
