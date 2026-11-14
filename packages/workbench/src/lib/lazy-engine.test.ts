import { describe, expect, it, vi } from 'vitest';
import { createLazyEngine } from './lazy-engine';

describe('createLazyEngine', () => {
  it('loads once, then hands every caller the same engine', async () => {
    const importEngine = vi.fn(async () => ({ name: 'tidy' }));
    const lazy = createLazyEngine(importEngine);
    expect(lazy.current()).toBeNull();
    const [a, b] = await Promise.all([lazy.load(), lazy.load()]);
    expect(a).toBe(b);
    expect(lazy.current()).toBe(a);
    expect(importEngine).toHaveBeenCalledTimes(1);
  });

  it('runs at once when loaded, and once loaded otherwise', async () => {
    const lazy = createLazyEngine(async () => 7);
    const ran: number[] = [];
    lazy.withEngine((n) => ran.push(n));
    expect(ran).toEqual([]);
    await lazy.load();
    expect(ran).toEqual([7]);
    lazy.withEngine((n) => ran.push(n + 1));
    expect(ran).toEqual([7, 8]);
  });
});
