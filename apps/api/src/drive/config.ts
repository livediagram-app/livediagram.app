// Which Drive mirror the deployment runs (docs/specs/022-drive-mirror/drive-mirror.md,
// "Self-hosting"; blueprint "Deployment mode").

import type { DriveMode } from '@livediagram/api-schema';
import type { Env } from '../types';
import { driveKeyBytes } from './crypto';

const GOOGLE_OAUTH_ORIGIN = 'https://oauth2.googleapis.com';
const GOOGLE_API_ORIGIN = 'https://www.googleapis.com';

let warnedKeyInvalid = false;

// `off` without a client id; `broker` with the client id, the secret and a
// usable key; `browser` otherwise. A key that is set but not 32 bytes of
// base64 is a misconfiguration, logged once per isolate, and the deployment
// falls back to browser-only tokens rather than sealing with a weak key.
export function driveMode(env: Env): DriveMode {
  if (!env.GOOGLE_CLIENT_ID) return 'off';
  if (!env.GOOGLE_CLIENT_SECRET || !env.DRIVE_TOKEN_KEY) return 'browser';
  if (!driveKeyBytes(env.DRIVE_TOKEN_KEY)) {
    if (!warnedKeyInvalid) {
      warnedKeyInvalid = true;
      console.warn('drive: key_invalid (DRIVE_TOKEN_KEY must be base64 of 32 bytes)');
    }
    return 'browser';
  }
  return 'broker';
}

// Google's REST APIs (Drive's `about`). The test override serves OAuth and
// Drive from one fake host, so it stands in for both.
export function googleApiBase(env: Env): string {
  return withoutTrailingSlashes(env.GOOGLE_OAUTH_BASE_URL || GOOGLE_API_ORIGIN);
}

export function googleOAuthBase(env: Env): string {
  return withoutTrailingSlashes(env.GOOGLE_OAUTH_BASE_URL || GOOGLE_OAUTH_ORIGIN);
}

// A loop, not /\/+$/: that pattern backtracks on every run of slashes, so a
// long value costs quadratic time.
function withoutTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 0x2f) end--;
  return value.slice(0, end);
}
