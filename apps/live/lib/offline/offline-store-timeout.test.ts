import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setOfflineBackend,
  isOfflineId,
  OFFLINE_STORE_OPEN_TIMEOUT_MS,
  offlineListDocuments,
} from './offline-store';
import { setApiWarningReporter } from '../api/error-report';

// docs/specs/007-editor/load-recovery.md "The load always ends": a browser whose IndexedDB never
// answers `open` must not hold the document load (which asks isOfflineId first) open forever.

type Req = {
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onblocked: (() => void) | null;
  onupgradeneeded: (() => void) | null;
  result: { close: () => void };
};

let requests: Req[] = [];
const close = vi.fn();
const warnings: string[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  requests = [];
  close.mockClear();
  warnings.length = 0;
  setApiWarningReporter((t) => warnings.push(t));
  vi.stubGlobal('indexedDB', {
    open: () => {
      const req: Req = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
        onupgradeneeded: null,
        result: { close },
      };
      requests.push(req);
      return req;
    },
  });
  __setOfflineBackend(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setApiWarningReporter(null);
  __setOfflineBackend(null);
});

describe('offline store open limit', () => {
  it('answers "not offline" once the open times out, and stops asking for the page load', async () => {
    const first = isOfflineId('doc-1');
    await vi.advanceTimersByTimeAsync(OFFLINE_STORE_OPEN_TIMEOUT_MS);
    expect(await first).toBe(false);
    expect(warnings).toEqual(['OfflineStore.Unavailable']);

    // The second check (the first-tab load) does not wait out the limit again.
    expect(await isOfflineId('doc-1')).toBe(false);
    expect(requests).toHaveLength(1);
  });

  it('gives up at once when the open is blocked', async () => {
    const check = isOfflineId('doc-1');
    await vi.advanceTimersByTimeAsync(0);
    requests[0]!.onblocked?.();
    expect(await check).toBe(false);
    expect(warnings).toEqual(['OfflineStore.Unavailable']);
  });

  it('closes an open that lands after it gave up', async () => {
    const check = isOfflineId('doc-1');
    await vi.advanceTimersByTimeAsync(OFFLINE_STORE_OPEN_TIMEOUT_MS);
    await check;
    requests[0]!.onsuccess?.();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects other operations rather than hanging', async () => {
    const list = offlineListDocuments().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(OFFLINE_STORE_OPEN_TIMEOUT_MS);
    expect(await list).toMatchObject({ name: 'OfflineStoreUnavailableError' });
  });
});
