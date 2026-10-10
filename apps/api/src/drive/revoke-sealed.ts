// Revoke a sealed refresh token at Google, best effort: an unreadable token
// (the key changed) or an unreachable Google is logged, never thrown. Shared by
// disconnect and the account switch (docs/specs/022-drive-mirror/drive-mirror.md).

import type { Env } from '../types';
import { importDriveKey, openRefreshToken } from './crypto';
import { revokeToken } from './google-oauth';

// Whether Google accepted the revoke.
export async function revokeSealedToken(
  env: Env,
  ownerId: string,
  sealed: string,
): Promise<boolean> {
  const key = await importDriveKey(env.DRIVE_TOKEN_KEY);
  const refreshToken = key ? await openRefreshToken(key, ownerId, sealed) : null;
  if (!refreshToken) {
    console.warn('drive: revoke_skipped token_unreadable');
    return false;
  }
  return revokeToken(env, refreshToken);
}
