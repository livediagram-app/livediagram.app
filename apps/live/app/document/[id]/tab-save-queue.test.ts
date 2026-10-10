import { describe, expect, it } from 'vitest';
import { createTabSaveQueue } from './tab-save-queue';

// docs/specs/012-collaboration/collab-race-hardening.md "Saves": one tab's writes land in the order made.
const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('createTabSaveQueue', () => {
  it("starts a tab's next write only once its previous one settled, failed or not", async () => {
    const q = createTabSaveQueue();
    const order: string[] = [];
    const slow = deferred();
    void q.run('t', async () => {
      order.push('old start');
      await slow.promise;
      order.push('old end');
    });
    const newer = q.run('t', async () => void order.push('new'));
    await tick();
    expect(order).toEqual(['old start']);
    slow.reject(new Error('net'));
    await newer;
    expect(order).toEqual(['old start', 'new']);
  });

  it('never makes another tab wait', async () => {
    const q = createTabSaveQueue();
    const slow = deferred();
    void q.run('a', () => slow.promise);
    let other = false;
    await q.run('b', async () => {
      other = true;
    });
    expect(other).toBe(true);
    slow.resolve();
  });
});
