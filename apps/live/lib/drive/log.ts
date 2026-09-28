// The Drive mirror's console fingerprint (docs/specs/022-drive-mirror/drive-mirror.md,
// "Errors and edge cases"): every decision point logs `[drive-mirror] <event>`,
// so a failure is traceable from the browser console. Never a token.

export type DriveLogFields = Record<string, string | number | boolean | null | undefined>;

export function driveLog(event: string, fields: DriveLogFields = {}): void {
  console.info(`[drive-mirror] ${event}`, fields);
}

export function driveWarn(event: string, fields: DriveLogFields = {}): void {
  console.warn(`[drive-mirror] ${event}`, fields);
}
