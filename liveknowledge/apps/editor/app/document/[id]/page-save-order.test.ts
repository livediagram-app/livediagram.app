// A new page's first save waits for its parent's (docs/specs/030-knowledgebase/blueprints/page-tree.md "The room's
// check").

import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectFirstSave, pendingFirstSaves, savePageAfterParent } from './page-save-order';

afterEach(() => vi.useRealTimers());

const deferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('savePageAfterParent', () => {
  it('holds a subpage until its parent is stored, whichever is asked first', async () => {
    const order: string[] = [];
    const parentPut = deferred();
    // Both are new in this save: prepared before either write starts.
    expectFirstSave('parent');
    expectFirstSave('child');
    const child = savePageAfterParent({ id: 'child', parent: 'parent' }, async () => {
      order.push('child');
    });
    const parent = savePageAfterParent({ id: 'parent' }, async () => {
      order.push('parent starts');
      await parentPut.promise;
      order.push('parent stored');
    });
    await Promise.resolve();
    expect(order).toEqual(['parent starts']);
    parentPut.resolve();
    await Promise.all([parent, child]);
    expect(order).toEqual(['parent starts', 'parent stored', 'child']);
    expect(pendingFirstSaves()).toBe(0);
  });

  it('saves at once a page whose parent is already stored, or that has none', async () => {
    const put = vi.fn(async () => 7);
    expect(await savePageAfterParent({ id: 'a', parent: 'stored-long-ago' }, put)).toBe(7);
    expect(await savePageAfterParent({ id: 'b' }, put)).toBe(7);
    expect(put).toHaveBeenCalledTimes(2);
  });

  it('releases the subpage when its parent is refused, and passes the refusal on', async () => {
    expectFirstSave('p');
    const parent = savePageAfterParent({ id: 'p' }, async () => Promise.reject(new Error('409')));
    const child = savePageAfterParent({ id: 'c', parent: 'p' }, async () => 'sent');
    await expect(parent).rejects.toThrow('409');
    expect(await child).toBe('sent');
    expect(pendingFirstSaves()).toBe(0);
  });

  it('lets a subpage go after the wait when its parent is never written', async () => {
    vi.useFakeTimers();
    expectFirstSave('never', 1000);
    const put = vi.fn(async () => 'sent');
    const child = savePageAfterParent({ id: 'c', parent: 'never' }, put);
    await vi.advanceTimersByTimeAsync(999);
    expect(put).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await child).toBe('sent');
    expect(pendingFirstSaves()).toBe(0);
  });
});
