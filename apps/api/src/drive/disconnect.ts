// Disconnecting Google Drive (docs/specs/022-drive-mirror/drive-mirror.md,
// "Disconnecting and account deletion"): revoke the grant at Google, then
// delete the stored token and every mirror row. The Drive files stay; they are
// the user's. Shared by DELETE /api/drive/connection and account deletion.

import { deleteDriveConnection, getSealedRefreshToken } from '../db/drive';
import type { Env } from '../types';
import { importDriveKey, openRefreshToken } from './crypto';
import { revokeToken } from './google-oauth';

// Revoke is best effort: an unreachable Google, a key that no longer opens the
// row, or a browser-only connection (no refresh token) still deletes the rows.
// Returns whether a revoke was accepted, for the log line.
export async function disconnectDrive(env: Env, ownerId: string): Promise<{ revoked: boolean }> {
  let revoked = false;
  const sealed = await getSealedRefreshToken(env, ownerId);
  if (sealed) {
    const key = await importDriveKey(env.DRIVE_TOKEN_KEY);
    const refreshToken = key ? await openRefreshToken(key, ownerId, sealed) : null;
    if (refreshToken) revoked = await revokeToken(env, refreshToken);
    else console.warn('drive: revoke_skipped token_unreadable');
  }
  await deleteDriveConnection(env, ownerId);
  return { revoked };
}
