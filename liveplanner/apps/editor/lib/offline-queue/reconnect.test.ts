// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/core';
import {
  RETRY_MAX_MS,
  isConnectionFailure,
  onReconnect,
  retryDelayMs,
  signalReconnect,
  waitOrReconnect,
} from './reconnect';

// docs/specs/007-editor/offline-changes.md "What waits", "Sending them".

describe('isConnectionFailure', () => {
  it('is a request that got no answer, or a gateway that did not reach the server', () => {
    expect(isConnectionFailure(new TypeError('Failed to fetch'))).toBe(true);
    for (const status of [0, 408, 429, 502, 503, 504])
      expect(isConnectionFailure(new ApiError('test', status, null)), String(status)).toBe(true);
  });

  it('is never a refusal or a server failing the write', () => {
    for (const status of [400, 401, 403, 404, 409, 413, 500])
      expect(isConnectionFailure(new ApiError('test', status, 'x')), String(status)).toBe(false);
    expect(isConnectionFailure(new Error('no session token'))).toBe(false);
    expect(isConnectionFailure(null)).toBe(false);
  });
});

describe('retryDelayMs', () => {
  it('doubles from 2 seconds up to a minute', () => {
    expect([0, 1, 2, 3, 4, 5].map(retryDelayMs)).toEqual([2000, 4000, 8000, 16000, 32000, 60000]);
    expect(retryDelayMs(99)).toBe(RETRY_MAX_MS);
  });
});

describe('onReconnect', () => {
  it('hears the browser come back online and the room rejoin, until unsubscribed', () => {
    const heard = vi.fn();
    const off = onReconnect(heard);
    window.dispatchEvent(new Event('online'));
    signalReconnect();
    expect(heard).toHaveBeenCalledTimes(2);
    off();
    signalReconnect();
    expect(heard).toHaveBeenCalledTimes(2);
  });
});

describe('waitOrReconnect', () => {
  it('ends on the wait', async () => {
    const wait = vi.fn(() => Promise.resolve());
    await waitOrReconnect(500, wait);
    expect(wait).toHaveBeenCalledWith(500);
    // Its reconnect listener is gone: a later signal reaches nothing of it.
    signalReconnect();
  });

  it('ends early when the connection may be back, and only once', async () => {
    let release: () => void = () => {};
    const wait = () => new Promise<void>((r) => (release = r));
    const done = vi.fn();
    void waitOrReconnect(30_000, wait).then(done);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    signalReconnect();
    await Promise.resolve();
    await Promise.resolve();
    expect(done).toHaveBeenCalledTimes(1);
    release();
    await Promise.resolve();
    expect(done).toHaveBeenCalledTimes(1);
  });
});
