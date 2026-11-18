import { describe, expect, it } from 'vitest';
import { pooled } from './pooled';

describe('pooled', () => {
  it('keeps at most `limit` tasks running at once, and answers in order', async () => {
    let inFlight = 0;
    let most = 0;
    const tasks = Array.from({ length: 27 }, (_, i) => async () => {
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return i;
    });
    expect(await pooled(tasks, 6)).toEqual(tasks.map((_, i) => i));
    expect(most).toBe(6);
  });

  it('answers nothing for no tasks, and runs one at a time for a limit under one', async () => {
    expect(await pooled([], 3)).toEqual([]);
    const order: number[] = [];
    const tasks = [1, 2, 3].map((n) => async () => void order.push(n));
    await pooled(tasks, 0);
    expect(order).toEqual([1, 2, 3]);
  });
});
