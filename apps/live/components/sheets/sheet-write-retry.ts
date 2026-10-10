// Sending a sheet write again (docs/specs/029-sheets/sheet-store.md "Changing a sheet"): which failures are worth
// another try, and how long the store client waits before it.
import { ApiError } from '@/lib/api/core';

// A write the server could not take for now (sheet-store.md "Changing a sheet") is sent again after
// SHEET_WRITE_RETRY_MS, doubling each time up to SHEET_WRITE_RETRY_MAX_MS, for as long as it stays pending.
export const SHEET_WRITE_RETRY_MS = 500;
export const SHEET_WRITE_RETRY_MAX_MS = 30_000;

export function sheetWriteRetryMs(attempt: number): number {
  return Math.min(SHEET_WRITE_RETRY_MS * 2 ** Math.min(attempt, 16), SHEET_WRITE_RETRY_MAX_MS);
}

export const errorStatus = (e: unknown): number => (e instanceof ApiError ? e.status : 0);

// Worth sending again: no answer at all (offline, a dropped connection), a timeout, a rate limit or a server error.
// Any other answer is the server refusing the write, which a second send would not change.
export function isTransientWriteError(e: unknown): boolean {
  if (!(e instanceof ApiError)) return true;
  return e.status === 0 || e.status === 408 || e.status === 429 || e.status >= 500;
}
