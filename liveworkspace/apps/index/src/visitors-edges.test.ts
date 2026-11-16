// A link visitor's open and copy in the owner's History (visitors.ts), called directly: the memory of today's
// opens is bounded and forgets the oldest first, and a write that fails is logged and tried again next time.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Person } from './auth';
import type { Env } from './env';
import { recordVisitorCopy, recordVisitorOpen } from './visitors';
import type { Access, ItemRow } from './rows';
import { h, useHarness } from './test-support';

vi.mock('./config', async (original) => ({
  ...(await original<typeof import('./config')>()),
  OPEN_MEMORY_MAX: 2,
}));

useHarness();
afterEach(() => vi.restoreAllMocks());

const ROW = { id: 'item1' } as ItemRow;
const link = (code: string): Access => ({ level: 'view', tabId: null, via: 'link', code });
const eve = (id: string): Person => ({ id, kind: 'account', teams: [] });

// A database that answers every write with `outcome`.
function envWriting(outcome: () => Promise<unknown>): { env: Env; batches: () => number } {
  let n = 0;
  const db = new Proxy(h.db.env.INDEX_DB, {
    get(target, prop) {
      if (prop === 'batch')
        return () => {
          n++;
          return outcome();
        };
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { env: { ...h.db.env, INDEX_DB: db as never }, batches: () => n };
}

const open = (env: Env, person: Person | null, code: string, sent: Promise<unknown>[] = []) =>
  recordVisitorOpen(env, (p) => sent.push(p), ROW, person, link(code), 1_000);

describe('visitor opens, edge by edge', () => {
  it('writes an open once a day, forgets the oldest past its bound, and writes that one again', () => {
    const { env, batches } = envWriting(async () => []);
    open(env, eve('u1'), 'c');
    open(env, eve('u1'), 'c');
    expect(batches()).toBe(1);
    open(env, eve('u2'), 'c');
    // A third pushes u1 out of the two the memory holds.
    open(env, eve('u3'), 'c');
    expect(batches()).toBe(3);
    open(env, eve('u1'), 'c');
    expect(batches()).toBe(4);
  });

  it('copes with a memory that gives nothing back when full', () => {
    const { env, batches } = envWriting(async () => []);
    open(env, eve('u1'), 'c');
    open(env, eve('u2'), 'c');
    vi.spyOn(Set.prototype, 'values').mockReturnValueOnce([][Symbol.iterator]());
    open(env, eve('u3'), 'c');
    expect(batches()).toBe(3);
  });

  it('knows a visitor with no identity by the link, and logs a failed write so the next try writes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = envWriting(() => Promise.reject(new Error('d1 down')));
    const sent: Promise<unknown>[] = [];
    open(failing.env, null, 'abc', sent);
    await Promise.all(sent);
    expect(warn).toHaveBeenCalledWith('[index] visitor open not recorded', {
      error: 'Error: d1 down',
    });
    open(failing.env, null, 'abc', sent);
    expect(failing.batches()).toBe(2);
  });
});

describe('visitor copies, edge by edge', () => {
  it('logs a copy that could not be recorded, and ignores one made without a link', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = envWriting(() => Promise.reject(new Error('d1 down')));
    const sent: Promise<unknown>[] = [];
    const person = eve('u1');
    recordVisitorCopy(failing.env, (p) => sent.push(p), ROW, person, link('c'), 5);
    await Promise.all(sent);
    expect(warn).toHaveBeenCalledWith('[index] visitor copy not recorded', {
      error: 'Error: d1 down',
    });
    const owner: Access = { level: 'edit', tabId: null, via: 'owner', code: null };
    recordVisitorCopy(failing.env, (p) => sent.push(p), ROW, person, owner, 5);
    expect(failing.batches()).toBe(1);
  });
});
