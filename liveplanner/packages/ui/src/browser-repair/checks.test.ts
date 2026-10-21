import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatBrowserChecks, probeIndexedDb, type BrowserChecks } from './checks';

type FakeReq = {
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onblocked: (() => void) | null;
  result: { close: () => void };
};

function fakeIdb(behave: (req: FakeReq) => void): IDBFactory {
  return {
    open: () => {
      const req: FakeReq = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
        result: { close: () => {} },
      };
      queueMicrotask(() => behave(req));
      return req as unknown as IDBOpenDBRequest;
    },
    deleteDatabase: () => ({}) as IDBOpenDBRequest,
  } as unknown as IDBFactory;
}

afterEach(() => vi.useRealTimers());

describe('probeIndexedDb', () => {
  it('is unavailable without IndexedDB', async () => {
    expect(await probeIndexedDb(undefined)).toBe('unavailable');
  });

  it('answers ok, error and blocked from the open request', async () => {
    expect(await probeIndexedDb(fakeIdb((r) => r.onsuccess?.()))).toBe('ok');
    expect(await probeIndexedDb(fakeIdb((r) => r.onerror?.()))).toBe('error');
    expect(await probeIndexedDb(fakeIdb((r) => r.onblocked?.()))).toBe('blocked');
  });

  it('times out when open never settles', async () => {
    vi.useFakeTimers();
    const p = probeIndexedDb(
      fakeIdb(() => {}),
      4_000,
    );
    await vi.advanceTimersByTimeAsync(4_000);
    expect(await p).toBe('timeout');
  });

  it('reports a throwing open as an error', async () => {
    const idb = {
      open: () => {
        throw new Error('SecurityError');
      },
    } as unknown as IDBFactory;
    expect(await probeIndexedDb(idb)).toBe('error');
  });
});

describe('formatBrowserChecks', () => {
  const ok: BrowserChecks = {
    localStorage: true,
    sessionStorage: true,
    cookies: true,
    indexedDb: 'ok',
    randomUuid: true,
    online: true,
    userAgent: 'UA',
  };

  it('writes one line per check', () => {
    expect(formatBrowserChecks(ok)).toEqual([
      'Browser: UA',
      'Online: yes',
      'Local storage writable: yes',
      'Session storage writable: yes',
      'Cookies enabled: yes',
      'IndexedDB: ok',
      'crypto.randomUUID: yes',
    ]);
  });

  it('shouts failing checks', () => {
    const lines = formatBrowserChecks({
      ...ok,
      localStorage: false,
      indexedDb: 'timeout',
      randomUuid: false,
    });
    expect(lines).toContain('Local storage writable: NO');
    expect(lines).toContain('IndexedDB: TIMEOUT');
    expect(lines).toContain('crypto.randomUUID: NO (out-of-date browser)');
  });
});
