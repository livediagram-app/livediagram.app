import { describe, expect, it } from 'vitest';
import { dedupeInFlight } from './dedupe';

// dedupeInFlight backs four list / load endpoints in api-client.ts
// (apiLoadTab, apiListDiagrams, apiListSharedWith, apiListFolders).
// Its contract is small but load-bearing: callers expect concurrent
// duplicates to collapse, distinct keys to stay isolated, and a
// settled promise to release the entry so the next call is fresh.
// The tests below pin each of those behaviours.

describe('dedupeInFlight', () => {
  it('returns the in-flight promise for a second concurrent call with the same key', async () => {
    let calls = 0;
    let resolveFirst!: (value: number) => void;
    const inner = (_id: string): Promise<number> => {
      calls += 1;
      return new Promise((resolve) => {
        resolveFirst = resolve;
      });
    };
    const wrapped = dedupeInFlight(inner, (id: string) => id);

    const a = wrapped('owner-1');
    const b = wrapped('owner-1');
    // Both calls landed on the same in-flight promise.
    expect(a).toBe(b);
    expect(calls).toBe(1);

    resolveFirst(42);
    await expect(a).resolves.toBe(42);
    await expect(b).resolves.toBe(42);
  });

  it('keeps distinct keys on separate in-flight entries', async () => {
    let calls = 0;
    const resolvers = new Map<string, (value: string) => void>();
    const inner = (id: string): Promise<string> => {
      calls += 1;
      return new Promise((resolve) => {
        resolvers.set(id, resolve);
      });
    };
    const wrapped = dedupeInFlight(inner, (id: string) => id);

    const owner1 = wrapped('owner-1');
    const owner2 = wrapped('owner-2');
    expect(owner1).not.toBe(owner2);
    expect(calls).toBe(2);

    resolvers.get('owner-1')!('first');
    resolvers.get('owner-2')!('second');
    await expect(owner1).resolves.toBe('first');
    await expect(owner2).resolves.toBe('second');
  });

  it('releases the in-flight entry once the promise resolves so the next call is fresh', async () => {
    let calls = 0;
    const inner = async (_id: string): Promise<number> => {
      calls += 1;
      return 7;
    };
    const wrapped = dedupeInFlight(inner, (id: string) => id);

    await expect(wrapped('owner-1')).resolves.toBe(7);
    expect(calls).toBe(1);

    // After settle, a fresh call should re-enter the wrapped fn.
    await expect(wrapped('owner-1')).resolves.toBe(7);
    expect(calls).toBe(2);
  });

  it('releases the in-flight entry on rejection too (the finally cleans up either way)', async () => {
    let calls = 0;
    let reject!: (reason: Error) => void;
    const inner = (_id: string): Promise<number> => {
      calls += 1;
      return new Promise((_resolve, rej) => {
        reject = rej;
      });
    };
    const wrapped = dedupeInFlight(inner, (id: string) => id);

    const first = wrapped('owner-1');
    reject(new Error('boom'));
    await expect(first).rejects.toThrow('boom');
    expect(calls).toBe(1);

    // The failure shouldn't poison the key. Next call enters fresh.
    let resolveSecond!: (value: number) => void;
    const inner2 = (_id: string): Promise<number> => {
      calls += 1;
      return new Promise((resolve) => {
        resolveSecond = resolve;
      });
    };
    const wrapped2 = dedupeInFlight(inner2, (id: string) => id);
    const second = wrapped2('owner-1');
    resolveSecond(9);
    await expect(second).resolves.toBe(9);
  });

  it('passes the original arguments through to the wrapped function', async () => {
    const seen: [string, number][] = [];
    const inner = async (id: string, count: number): Promise<number> => {
      seen.push([id, count]);
      return count * 2;
    };
    // Compound key so both args participate in identity.
    const wrapped = dedupeInFlight(inner, (id: string, count: number) => `${id}:${count}`);

    await expect(wrapped('owner-1', 3)).resolves.toBe(6);
    await expect(wrapped('owner-1', 4)).resolves.toBe(8);
    expect(seen).toEqual([
      ['owner-1', 3],
      ['owner-1', 4],
    ]);
  });
});
