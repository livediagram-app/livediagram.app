// Disconnecting Google Drive (docs/specs/022-drive-mirror/drive-mirror.md,
// "Disconnecting and account deletion"): revoke the grant at Google, then
// delete the stored token and every mirror row. The Drive files stay; they are
// the user's. Shared by DELETE /api/drive/connection and account deletion.

import { getSwitchTokens } from '../db/drive-account';
import { deleteDriveConnection } from '../db/drive';
import type { Env } from '../types';
import { revokeSealedToken } from './revoke-sealed';

// Revoke is best effort: an unreachable Google, a key that no longer opens the
// row, or a browser-only connection (no refresh token) still deletes the rows.
// A pending account switch's grant goes too. Returns whether the connection's
// own revoke was accepted, for the log line.
export async function disconnectDrive(env: Env, ownerId: string): Promise<{ revoked: boolean }> {
  const { current, pending } = await getSwitchTokens(env, ownerId);
  const revoked = current ? await revokeSealedToken(env, ownerId, current) : false;
  if (pending) await revokeSealedToken(env, ownerId, pending);
  await deleteDriveConnection(env, ownerId);
  return { revoked };
}
