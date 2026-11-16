// The guest merge's edges (merge.ts), called directly: a method it does not take, the Drive mirror told when the
// account's tree grew, a result with no change counts, and the apps' notices failing to drain.
import { describe, expect, it, vi } from 'vitest';
import type { Env } from './env';
import { handleMerge } from './merge';
import { h, makeItem, person, useHarness } from './test-support';

const m = vi.hoisted(() => ({ drain: null as null | (() => Promise<unknown>) }));
vi.mock('./person-merges', async (original) => {
  const real = await original<typeof import('./person-merges')>();
  return {
    ...real,
    drainPersonMerges: (...args: Parameters<typeof real.drainPersonMerges>) =>
      m.drain ? m.drain() : real.drainPersonMerges(...args),
  };
});

useHarness({
  MERGE_KEY: 'merge-key',
  DRIVE: {
    fetch: async () => new Response(null, { status: 202 }),
  } as unknown as Fetcher,
});

const merge = (env: Env, waitUntil?: (p: Promise<unknown>) => void, method = 'POST') => {
  const request = new Request('https://liveworkspace.app/api/index/internal/merge', {
    method,
    headers: { Authorization: 'Bearer merge-key', 'Content-Type': 'application/json' },
    ...(method === 'POST'
      ? { body: JSON.stringify({ guestId: 'guest_g1', userId: 'user_u1' }) }
      : {}),
  });
  return waitUntil ? handleMerge(request, env, waitUntil) : handleMerge(request, env);
};

describe('the guest merge, edge by edge', () => {
  it('takes only a POST', async () => {
    expect((await merge(h.db.env, undefined, 'GET')).status).toBe(404);
  });

  it('runs with the default waitUntil, and signals the Drive mirror when the account’s tree grew', async () => {
    const guest = await person('guest_g1', { guest: true });
    await makeItem(guest.auth, { title: 'Mine' });
    const sent: Promise<unknown>[] = [];
    expect(await (await merge(h.db.env, (p) => sent.push(p))).json()).toEqual({ items: 1 });
    // The signal and the drain: two things handed to waitUntil.
    expect(sent).toHaveLength(2);
    await Promise.all(sent);
    // And again with nothing to move and the default waitUntil.
    expect(await (await merge(h.db.env)).json()).toEqual({ items: 0 });
  });

  it('reads a result with no change counts as nothing moved', async () => {
    const db = new Proxy(h.db.env.INDEX_DB, {
      get(target, prop) {
        if (prop === 'batch') return async () => Array.from({ length: 22 }, () => ({ meta: {} }));
        const value = Reflect.get(target, prop);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const sent: Promise<unknown>[] = [];
    const res = await merge({ ...h.db.env, INDEX_DB: db as never }, (p) => sent.push(p));
    expect(await res.json()).toEqual({ items: 0 });
    // Nothing moved: no Drive signal, only the drain.
    expect(sent).toHaveLength(1);
  });

  it('logs and goes on when the apps’ notices fail to drain', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    m.drain = () => Promise.reject(new Error('apps down'));
    try {
      const sent: Promise<unknown>[] = [];
      expect((await merge(h.db.env, (p) => sent.push(p))).status).toBe(200);
      await Promise.all(sent);
      expect(warn).toHaveBeenCalledWith('[index] person merges failed', {
        error: 'Error: apps down',
      });
    } finally {
      m.drain = null;
      warn.mockRestore();
    }
  });
});
