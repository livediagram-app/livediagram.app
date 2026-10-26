// The service's Google access tokens (liveworkspace/docs/specs/005-drive/drive.md "Tokens"): minted from the sealed refresh token,
// kept in the object's memory (never stored), refreshed a minute before they lapse. A refused grant (`invalid_grant`)
// or a sealed token the key no longer opens turns the connection Needs reconnecting; nothing is deleted.

import { DRIVE_TOKEN_RENEW_BEFORE_MS } from '@liveworkspace/drive';
import {
  GoogleOAuthError,
  importDriveKey,
  openRefreshToken,
  refreshAccessToken,
  revokeToken,
} from '@liveworkspace/drive/server';
import { driveLog, driveWarn } from '../log';
import type { MirrorDeps } from './context';

/** The connection needs a new consent. */
export class NeedsReconnect extends Error {
  constructor() {
    super('drive: needs reconnect');
    this.name = 'NeedsReconnect';
  }
}

/** There is no connection. */
export class NotConnected extends Error {
  constructor() {
    super('drive: not connected');
    this.name = 'NotConnected';
  }
}

export class TokenSource {
  private readonly deps: MirrorDeps;
  private cached: { token: string; expiresAt: number } | null = null;

  constructor(deps: MirrorDeps) {
    this.deps = deps;
  }

  /** A token straight from a consent: the first pass needn't mint another. */
  prime(token: string, expiresAt: number): void {
    this.cached = { token, expiresAt };
  }

  reset(): void {
    this.cached = null;
  }

  async get(opts: { force?: boolean } = {}): Promise<string> {
    const now = this.deps.now();
    if (!opts.force && this.cached && this.cached.expiresAt - now > DRIVE_TOKEN_RENEW_BEFORE_MS) {
      return this.cached.token;
    }
    const minted = await this.mint();
    this.cached = { token: minted.accessToken, expiresAt: minted.expiresAt };
    return minted.accessToken;
  }

  /** A fresh hour-long token, not cached: the Picker's. */
  async mint(): Promise<{ accessToken: string; expiresAt: number }> {
    const { store } = this.deps;
    const connection = store.connection();
    if (!connection) throw new NotConnected();
    if (connection.status === 'needs_reconnect') throw new NeedsReconnect();
    const refresh = await this.open(connection.personId, connection.sealedRefresh);
    if (!refresh) {
      // The key changed since the token was sealed: only a new consent helps.
      driveWarn('token unreadable', { person: connection.personId });
      this.needsReconnect();
    }
    try {
      return await refreshAccessToken(this.deps.google, refresh!, this.deps.now());
    } catch (err) {
      if (err instanceof GoogleOAuthError && err.kind === 'invalid_grant') {
        driveWarn('token invalid_grant', { person: connection.personId });
        this.needsReconnect();
      }
      throw err;
    }
  }

  private needsReconnect(): never {
    this.cached = null;
    this.deps.store.updateConnection({ status: 'needs_reconnect', syncing: false, progress: null });
    throw new NeedsReconnect();
  }

  private async open(personId: string, sealed: string): Promise<string | null> {
    const key = await importDriveKey(this.deps.tokenKey);
    return key ? openRefreshToken(key, personId, sealed) : null;
  }

  /** Revoke a sealed grant at Google, best effort: an unreadable token or an unreachable Google is logged. */
  async revokeSealed(personId: string, sealed: string): Promise<boolean> {
    const token = await this.open(personId, sealed);
    if (!token) {
      driveWarn('revoke-skipped token_unreadable', { person: personId });
      return false;
    }
    const revoked = await revokeToken(this.deps.google, token);
    driveLog('revoke', { person: personId, revoked });
    return revoked;
  }
}
