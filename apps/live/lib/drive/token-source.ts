// Where the mirror's Google access tokens come from
// (docs/specs/022-drive-mirror/drive-mirror.md, "Tokens" and "Self-hosting").
//
//   - Broker: the api mints a one-hour token from the stored refresh token;
//     cached until shortly before it expires, so about once per active hour.
//   - Browser-only (client id, no secret): Google Identity Services' token
//     model, which cannot renew without a click, so a lapsed token asks the
//     user to **Resume sync** instead of syncing silently.

import type { DriveAccessToken } from '@livediagram/api-schema';
import { ApiError } from '../api/core';
import { DRIVE_TOKEN_RENEW_BEFORE_MS } from './cadence';

export type DriveTokenErrorKind =
  | 'needs_reconnect'
  | 'needs_resume'
  | 'not_connected'
  // The api's own token limiter (429 drive_token_rate_limited): backed off
  // like Google's rate limits.
  | 'rate_limited'
  | 'failed';

export class DriveTokenError extends Error {
  readonly kind: DriveTokenErrorKind;

  constructor(kind: DriveTokenErrorKind, detail: string = kind) {
    super(`drive token: ${detail}`);
    this.name = 'DriveTokenError';
    this.kind = kind;
  }
}

export interface TokenSource {
  get(opts?: { force?: boolean }): Promise<string>;
}

export function createBrokerTokenSource(deps: {
  fetchToken: () => Promise<DriveAccessToken>;
  now: () => number;
}): TokenSource & { clear(): void } {
  let cached: DriveAccessToken | null = null;
  let inFlight: Promise<DriveAccessToken> | null = null;
  return {
    clear() {
      cached = null;
    },
    async get(opts) {
      if (!opts?.force && cached && cached.expiresAt - DRIVE_TOKEN_RENEW_BEFORE_MS > deps.now()) {
        return cached.accessToken;
      }
      inFlight ??= deps.fetchToken().finally(() => {
        inFlight = null;
      });
      try {
        cached = await inFlight;
        return cached.accessToken;
      } catch (err) {
        cached = null;
        if (err instanceof ApiError) {
          if (err.status === 409 && err.code === 'drive_needs_reconnect') {
            throw new DriveTokenError('needs_reconnect');
          }
          if (err.status === 404) throw new DriveTokenError('not_connected');
          if (err.status === 429) throw new DriveTokenError('rate_limited');
        }
        throw new DriveTokenError('failed', err instanceof Error ? err.message : String(err));
      }
    },
  };
}

// Browser-only mode: whatever token the last user-gesture grant produced.
export function createBrowserTokenSource(deps: { now: () => number }): TokenSource & {
  set(token: DriveAccessToken): void;
  clear(): void;
} {
  let current: DriveAccessToken | null = null;
  return {
    set(token) {
      current = token;
    },
    clear() {
      current = null;
    },
    async get() {
      // No renewal without a click (research A3): ask for Resume sync a
      // little early, rather than failing a write half way through.
      if (!current || current.expiresAt - DRIVE_TOKEN_RENEW_BEFORE_MS <= deps.now()) {
        throw new DriveTokenError('needs_resume');
      }
      return current.accessToken;
    },
  };
}
