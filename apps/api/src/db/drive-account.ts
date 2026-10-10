// Which Google account a Drive connection syncs with, and a pending switch to
// another one (docs/specs/022-drive-mirror/drive-mirror.md, "Reconnecting with
// another Google account"; blueprint "Account switch"). Every statement is
// scoped to one owner.

import type { Env } from '../types';

// The Google account the connection syncs with, or null (none recorded yet,
// or no connection).
export async function getDriveAccountId(env: Env, ownerId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT google_account_id FROM drive_connections WHERE owner_id = ?',
  )
    .bind(ownerId)
    .first<{ google_account_id: string | null }>();
  return row?.google_account_id ?? null;
}

// A consent by the recorded account (or the first after accounts began to be
// recorded): record it, and drop any pending switch, which that consent answers.
export async function recordDriveAccount(
  env: Env,
  ownerId: string,
  accountId: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE drive_connections
        SET google_account_id = ?, pending_refresh_token_enc = NULL,
            pending_google_account_id = NULL, pending_expires_at = NULL
      WHERE owner_id = ?`,
  )
    .bind(accountId, ownerId)
    .run();
}

// A consent by another account: park its sealed token beside the live
// connection, replacing any earlier pending switch, and touch nothing else.
export async function setPendingAccountSwitch(
  env: Env,
  ownerId: string,
  sealedRefreshToken: string,
  accountId: string,
  expiresAt: number,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE drive_connections
        SET pending_refresh_token_enc = ?, pending_google_account_id = ?, pending_expires_at = ?
      WHERE owner_id = ?`,
  )
    .bind(sealedRefreshToken, accountId, expiresAt, ownerId)
    .run();
}

// The live and pending sealed tokens, for revoking after a confirm or cancel.
export async function getSwitchTokens(
  env: Env,
  ownerId: string,
): Promise<{ current: string | null; pending: string | null }> {
  const row = await env.DB.prepare(
    'SELECT refresh_token_enc, pending_refresh_token_enc FROM drive_connections WHERE owner_id = ?',
  )
    .bind(ownerId)
    .first<{ refresh_token_enc: string | null; pending_refresh_token_enc: string | null }>();
  return {
    current: row?.refresh_token_enc ?? null,
    pending: row?.pending_refresh_token_enc ?? null,
  };
}

const LIVE_PENDING = `pending_refresh_token_enc IS NOT NULL AND pending_expires_at > ?2`;

// Confirm: in one batch, only while the switch is pending and unexpired, drop
// every mirrored item (they name the old account's files) and move the pending
// token and account into place with the root folder and page token cleared.
// Returns false (and drops an expired switch) when there was none to confirm.
export async function confirmPendingAccountSwitch(
  env: Env,
  ownerId: string,
  now: number,
): Promise<boolean> {
  const results = await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM drive_items WHERE owner_id = ?1 AND EXISTS (
         SELECT 1 FROM drive_connections WHERE owner_id = ?1 AND ${LIVE_PENDING})`,
    ).bind(ownerId, now),
    env.DB.prepare(
      `UPDATE drive_connections
          SET refresh_token_enc = pending_refresh_token_enc,
              google_account_id = pending_google_account_id,
              root_folder_id = NULL, page_token = NULL, page_token_saved_at = NULL,
              status = 'connected',
              pending_refresh_token_enc = NULL, pending_google_account_id = NULL,
              pending_expires_at = NULL
        WHERE owner_id = ?1 AND ${LIVE_PENDING}`,
    ).bind(ownerId, now),
  ]);
  if ((results[1]?.meta.changes ?? 0) > 0) return true;
  await clearPendingAccountSwitch(env, ownerId);
  return false;
}

export async function clearPendingAccountSwitch(env: Env, ownerId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE drive_connections
        SET pending_refresh_token_enc = NULL, pending_google_account_id = NULL,
            pending_expires_at = NULL
      WHERE owner_id = ?`,
  )
    .bind(ownerId)
    .run();
}
