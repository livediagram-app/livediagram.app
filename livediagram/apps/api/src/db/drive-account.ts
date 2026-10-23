// Which Google account a Drive connection syncs with, and a pending switch to another one
// (docs/specs/022-drive-mirror/drive-mirror.md, "Reconnecting with another Google account"; blueprint "Account
// switch"). Each call reaches the one owner's own store (person-store/drive-store.ts).

import { personStore } from '../person-client';
import type { Env } from '../types';

// The Google account the connection syncs with, or null (none recorded yet, or no connection).
export async function getDriveAccountId(env: Env, ownerId: string): Promise<string | null> {
  return personStore(env, ownerId).driveAccountId();
}

// A consent by the recorded account (or the first after accounts began to be recorded): record it, and drop any
// pending switch, which that consent answers.
export async function recordDriveAccount(
  env: Env,
  ownerId: string,
  accountId: string,
): Promise<void> {
  await personStore(env, ownerId).driveRecordAccount(accountId);
}

// A consent by another account: park its sealed token beside the live connection, replacing any earlier pending
// switch, and touch nothing else.
export async function setPendingAccountSwitch(
  env: Env,
  ownerId: string,
  sealedRefreshToken: string,
  accountId: string,
  expiresAt: number,
): Promise<void> {
  await personStore(env, ownerId).driveSetPendingSwitch(sealedRefreshToken, accountId, expiresAt);
}

// The live and pending sealed tokens, for revoking after a confirm or cancel.
export async function getSwitchTokens(
  env: Env,
  ownerId: string,
): Promise<{ current: string | null; pending: string | null }> {
  return personStore(env, ownerId).driveSwitchTokens();
}

// Confirm, in one transaction, only while the switch is pending and unexpired: drop every mirrored item (they name
// the old account's files) and move the pending token and account into place with the root folder and page token
// cleared. Returns false (and drops an expired switch) when there was none to confirm.
export async function confirmPendingAccountSwitch(
  env: Env,
  ownerId: string,
  now: number,
): Promise<boolean> {
  return personStore(env, ownerId).driveConfirmSwitch(now);
}

export async function clearPendingAccountSwitch(env: Env, ownerId: string): Promise<void> {
  await personStore(env, ownerId).driveClearSwitch();
}
