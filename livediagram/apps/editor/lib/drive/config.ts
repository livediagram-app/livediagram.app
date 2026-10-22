// Whether this deployment offers the Drive mirror, and how it gets tokens
// (docs/specs/022-drive-mirror/drive-mirror.md, "Self-hosting"; blueprint
// "Deployment mode"). NEXT_PUBLIC_* values are baked in at build time.

import type { DriveMode } from '@livediagram/api-schema';

export const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
// The Google Picker's browser key, for adopting a folder livediagram cannot
// see. Optional: without it the mirror works and adoption is not offered.
export const googlePickerApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? '';

// The mode the app runs: the worker's, but only when the build carries the
// same client id; a build without one never shows Drive.
export function driveUiMode(
  serverMode: DriveMode | undefined,
  clientId = googleClientId,
): DriveMode {
  if (!clientId || !serverMode) return 'off';
  return serverMode;
}

// A Google OAuth client id starts with the Cloud project number, which is the
// Picker's app id (what grants drive.file access to a picked item).
export function googleProjectNumber(clientId = googleClientId): string | null {
  return /^(\d+)-/.exec(clientId)?.[1] ?? null;
}
