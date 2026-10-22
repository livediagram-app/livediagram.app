import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/core';
import {
  SHEET_WRITE_RETRY_MAX_MS,
  isTransientWriteError,
  sheetWriteRetryMs,
} from './sheet-write-retry';

describe('sheet write retries', () => {
  it('sends again after no answer, a timeout, a rate limit or a server error', () => {
    expect(isTransientWriteError(new TypeError('Failed to fetch'))).toBe(true);
    for (const status of [0, 408, 429, 500, 503])
      expect(isTransientWriteError(new ApiError('sheet write', status, null))).toBe(true);
  });

  it('never sends a refused write again', () => {
    for (const status of [400, 403, 404, 409, 413])
      expect(isTransientWriteError(new ApiError('sheet write', status, 'x'))).toBe(false);
  });

  it('doubles the wait up to its ceiling', () => {
    expect([0, 1, 2].map(sheetWriteRetryMs)).toEqual([500, 1000, 2000]);
    expect(sheetWriteRetryMs(10)).toBe(SHEET_WRITE_RETRY_MAX_MS);
    expect(sheetWriteRetryMs(10_000)).toBe(SHEET_WRITE_RETRY_MAX_MS);
  });
});
