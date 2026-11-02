import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_QUEUE_KEY_PREFIX } from '@liveplanner/ui';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  PLAN_QUEUE_MAX_BYTES,
  PLAN_QUEUE_MAX_CHANGES,
  PlanQueue,
  forgetPlanQueues,
  nextSeq,
  planQueue,
  planQueueKey,
  readStoredChanges,
  subscribeWaitingChanges,
  waitingChangeCount,
  type QueuedChange,
} from './plan-queue';

// docs/specs/007-editor/offline-changes.md "Kept across a reload", "Bounds".

class MemoryStorage implements Storage {
  map = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new DOMException('full', 'QuotaExceededError');
    this.map.set(k, v);
  }
}

const item = (seq: number, title = 'x'): QueuedChange => ({
  id: `i${seq}`,
  seq,
  store: 'items',
  write: { kind: 'patch', id: 'card', patch: { set: { title } } },
});
const cell = (seq: number): QueuedChange => ({
  id: `w${seq}`,
  seq,
  store: 'sheets',
  op: 'write',
  sheetId: 's1',
  write: { kind: 'cells', cells: [] },
  flags: {},
});

afterEach(() => {
  forgetPlanQueues();
  vi.unstubAllGlobals();
});

describe('nextSeq', () => {
  it('only grows, within a millisecond and across a clock that steps back', () => {
    const a = nextSeq(1000);
    const b = nextSeq(1000);
    const c = nextSeq(999);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(nextSeq(2000)).toBe(2_000_000);
  });
});

describe('PlanQueue', () => {
  it('keys a queue by plan and person, under the prefix a repair keeps', () => {
    expect(planQueueKey('p1', 'guest_a')).toBe(`${OFFLINE_QUEUE_KEY_PREFIX}v1:p1:guest_a`);
    expect(planQueueKey('p1', 'guest_a')).not.toBe(planQueueKey('p1', 'guest_b'));
  });

  it('keeps changes in the order they were made, stored as each joins', () => {
    const storage = new MemoryStorage();
    const onChange = vi.fn();
    const q = new PlanQueue('k', storage, onChange);
    expect(q.add(item(3))).toBe('ok');
    expect(q.add(cell(5))).toBe('ok');
    // A write that failed after later ones joined goes back in its place.
    expect(q.add(item(1))).toBe('ok');
    expect(q.changes('items').map((c) => c.seq)).toEqual([1, 3]);
    expect([q.count(), q.count('items'), q.count('sheets')]).toEqual([3, 2, 1]);
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(readStoredChanges(storage, 'k').map((c) => c.seq)).toEqual([1, 3, 5]);
    // A second add of one already held changes nothing.
    expect(q.add(item(3))).toBe('ok');
    expect(q.count()).toBe(3);
    expect(q.has('i3')).toBe(true);
  });

  it('reads back what a reload kept, and removes its key once empty', () => {
    const storage = new MemoryStorage();
    const first = new PlanQueue('k', storage);
    first.add(item(1));
    first.add(cell(2));
    const again = new PlanQueue('k', storage);
    expect(again.count()).toBe(2);
    expect(again.size()).toBe(first.size());
    again.remove(['i1', 'nope']);
    expect(again.count('items')).toBe(0);
    again.remove(['w2']);
    expect(storage.getItem('k')).toBeNull();
    // Nothing held: nothing written.
    const set = vi.spyOn(storage, 'setItem');
    again.remove(['w2']);
    expect(set).not.toHaveBeenCalled();
  });

  it('ignores what it cannot read: missing, broken, another version or a malformed change', () => {
    const storage = new MemoryStorage();
    expect(readStoredChanges(storage, 'k')).toEqual([]);
    expect(readStoredChanges(null, 'k')).toEqual([]);
    storage.setItem('k', '{not json');
    expect(readStoredChanges(storage, 'k')).toEqual([]);
    storage.setItem('k', JSON.stringify({ v: 2, changes: [item(1)] }));
    expect(readStoredChanges(storage, 'k')).toEqual([]);
    storage.setItem('k', JSON.stringify({ v: 1, changes: 'no' }));
    expect(readStoredChanges(storage, 'k')).toEqual([]);
    const sheetCreate = {
      id: 'c1',
      seq: 4,
      store: 'sheets',
      op: 'create',
      sheetId: 's',
      create: { id: 's', tabId: 't', title: 'S' },
    };
    const sheetDelete = { id: 'd1', seq: 5, store: 'sheets', op: 'delete', sheetId: 's' };
    storage.setItem(
      'k',
      JSON.stringify({
        v: 1,
        changes: [
          null,
          { id: 1, seq: 1 },
          { id: 'a', seq: 1, store: 'items' },
          { id: 'b', seq: 1, store: 'sheets', op: 'write', sheetId: 's' },
          { id: 'c', seq: 1, store: 'sheets', op: 'create', sheetId: 's' },
          { id: 'd', seq: 1, store: 'sheets', op: 'other', sheetId: 's' },
          { id: 'e', seq: 1, store: 'sheets', op: 'delete' },
          { id: 'f', seq: 1, store: 'other' },
          sheetDelete,
          sheetCreate,
          item(2),
          cell(3),
        ],
      }),
    );
    expect(readStoredChanges(storage, 'k').map((c) => c.id)).toEqual(['i2', 'w3', 'c1', 'd1']);
  });

  it(`refuses a change past ${PLAN_QUEUE_MAX_CHANGES} changes, keeping every one already waiting`, () => {
    const q = new PlanQueue('k', null);
    for (let i = 1; i <= PLAN_QUEUE_MAX_CHANGES; i++) expect(q.add(item(i))).toBe('ok');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(q.add(item(PLAN_QUEUE_MAX_CHANGES + 1))).toBe('full');
    expect(q.count()).toBe(PLAN_QUEUE_MAX_CHANGES);
    expect(warn).toHaveBeenCalledWith('[offline-queue] queue.full', expect.anything());
  });

  it('refuses a change past the byte bound', () => {
    const q = new PlanQueue('k', null);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const big = item(1, 'x'.repeat(PLAN_QUEUE_MAX_BYTES - 200));
    expect(q.add(big)).toBe('ok');
    expect(q.add(item(2, 'y'.repeat(300)))).toBe('full');
    expect(q.count()).toBe(1);
  });

  it('refuses a change the browser cannot store, and keeps nothing of it', () => {
    const storage = new MemoryStorage();
    const q = new PlanQueue('k', storage);
    q.add(item(1));
    storage.failWrites = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const size = q.size();
    expect(q.add(item(2))).toBe('full');
    expect(q.count()).toBe(1);
    expect(q.size()).toBe(size);
  });

  // Blueprint "Performance and limits": one change joining a queue at its byte bound stays well inside a frame.
  it('adds to a full-size queue within a frame budget', () => {
    const storage = new MemoryStorage();
    const per = Math.floor(PLAN_QUEUE_MAX_BYTES / PLAN_QUEUE_MAX_CHANGES) - 150;
    const changes = Array.from({ length: PLAN_QUEUE_MAX_CHANGES - 1 }, (_, i) =>
      item(i + 1, 'z'.repeat(per)),
    );
    storage.setItem('k', JSON.stringify({ v: 1, changes }));
    const q = new PlanQueue('k', storage);
    expect(q.size()).toBeGreaterThan(PLAN_QUEUE_MAX_BYTES * 0.9);
    let added = '';
    const spent = cpuMsOf(() => {
      added = q.add(item(PLAN_QUEUE_MAX_CHANGES, 'z'.repeat(per)));
    });
    expect(added).toBe('ok');
    expect(spent).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('the page queues', () => {
  it('makes one queue per plan and person, and counts what waits in all of them', () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    const listener = vi.fn();
    const off = subscribeWaitingChanges(listener);
    const a = planQueue('p1', 'o');
    expect(planQueue('p1', 'o')).toBe(a);
    const b = planQueue('p2', 'o');
    a.add(item(1));
    b.add(cell(2));
    expect(waitingChangeCount()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);
    a.remove(['i1']);
    expect(waitingChangeCount()).toBe(1);
    off();
    b.remove(['w2']);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('works without storage (a browser that refuses it)', () => {
    vi.stubGlobal('localStorage', undefined);
    const q = planQueue('p1', 'o');
    expect(q.add(item(1))).toBe('ok');
    expect(waitingChangeCount()).toBe(1);
  });

  it('works when even reading localStorage throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    try {
      expect(planQueue('p3', 'o').add(item(1))).toBe('ok');
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});
