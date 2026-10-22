// Answering a pending Google account switch (docs/specs/022-drive-mirror/drive-mirror.md,
// "Reconnecting with another Google account"; blueprint "Account switch").
// POST /api/drive/account-switch confirms, DELETE cancels. Each revokes the
// grant it leaves behind, best effort; a pending account always differs from
// the recorded one, so the revoked grant is never the one in use.

import {
  clearPendingAccountSwitch,
  confirmPendingAccountSwitch,
  getSwitchTokens,
} from '../db/drive-account';
import type { Env } from '../types';
import { revokeSealedToken } from './revoke-sealed';

// Whether a live switch was confirmed. False: none, or it had expired (and is
// now dropped); nothing else changed.
export async function confirmAccountSwitch(
  env: Env,
  ownerId: string,
  now: number,
): Promise<boolean> {
  const { current } = await getSwitchTokens(env, ownerId);
  if (!(await confirmPendingAccountSwitch(env, ownerId, now))) return false;
  if (current) await revokeSealedToken(env, ownerId, current);
  return true;
}

// Whether there was a pending switch to drop.
export async function cancelAccountSwitch(env: Env, ownerId: string): Promise<boolean> {
  const { pending } = await getSwitchTokens(env, ownerId);
  if (!pending) return false;
  await clearPendingAccountSwitch(env, ownerId);
  await revokeSealedToken(env, ownerId, pending);
  return true;
}
