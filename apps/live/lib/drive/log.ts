// The Drive mirror's console fingerprint (docs/specs/022-drive-mirror/drive-mirror.md,
// "Errors and edge cases"): every decision point logs `[drive-mirror] <event>`,
// so a failure is traceable from the browser console. Never a token.

import { debugLog } from '@/lib/debug-log';

export type DriveLogFields = Record<string, string | number | boolean | null | undefined>;

export function driveLog(event: string, fields: DriveLogFields = {}): void {
  debugLog(`[drive-mirror] ${event}`, fields);
}

export function driveWarn(event: string, fields: DriveLogFields = {}): void {
  console.warn(`[drive-mirror] ${event}`, fields);
}

// A visible tab whose last check is too old: a bug to find, never a state to
// show quietly (docs/specs/022-drive-mirror/drive-mirror.md, "Synced means the last successful
// check").
export function driveStale(fields: DriveLogFields): void {
  console.warn('drive: stale', fields);
}
