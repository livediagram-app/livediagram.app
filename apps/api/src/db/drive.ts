// Google Drive mirror rows (docs/specs/022-drive-mirror/drive-mirror.md, "Data";
// blueprint "Data and persistence"). Every statement is scoped to one owner,
// the verified Clerk user id the route resolved.

import {
  DRIVE_LEASE_MS,
  type DriveConnection,
  type DriveConnectionStatus,
  type DriveItem,
  type DriveItemKind,
  type DriveLease,
} from '@livediagram/api-schema';
import type { Env } from '../types';

type ConnectionRow = {
  owner_id: string;
  refresh_token_enc: string | null;
  root_folder_id: string | null;
  page_token: string | null;
  page_token_saved_at: number | null;
  status: DriveConnectionStatus;
  connected_at: number;
  lease_holder: string | null;
  lease_expires_at: number | null;
  google_account_id: string | null;
};

type ItemRow = {
  item_kind: DriveItemKind;
  ld_id: string;
  drive_file_id: string;
  name: string;
  ld_name: string;
  parent_id: string | null;
  trashed: number;
  md5: string | null;
  head_revision_id: string | null;
  mirrored_saved_at: number | null;
  notice: 'unseen_folder' | null;
  notice_parent_id: string | null;
};

// Raised when an item names a Drive file another item of the same owner
// already holds (UNIQUE (owner_id, drive_file_id)).
export class DriveItemConflictError extends Error {
  constructor() {
    super('drive_item_conflict');
    this.name = 'DriveItemConflictError';
  }
}

function toConnection(row: ConnectionRow): DriveConnection {
  return {
    status: row.status,
    hasRefreshToken: row.refresh_token_enc !== null,
    rootFolderId: row.root_folder_id,
    pageToken: row.page_token,
    pageTokenSavedAt: row.page_token_saved_at,
    connectedAt: row.connected_at,
  };
}

function toItem(row: ItemRow): DriveItem {
  return {
    kind: row.item_kind,
    ldId: row.ld_id,
    driveFileId: row.drive_file_id,
    name: row.name,
    ldName: row.ld_name,
    parentId: row.parent_id,
    trashed: row.trashed === 1,
    md5: row.md5,
    headRevisionId: row.head_revision_id,
    mirroredSavedAt: row.mirrored_saved_at,
    notice: row.notice,
    noticeParentId: row.notice_parent_id,
  };
}

async function connectionRow(env: Env, ownerId: string): Promise<ConnectionRow | null> {
  return env.DB.prepare('SELECT * FROM drive_connections WHERE owner_id = ?')
    .bind(ownerId)
    .first<ConnectionRow>();
}

export async function getDriveConnection(
  env: Env,
  ownerId: string,
): Promise<DriveConnection | null> {
  const row = await connectionRow(env, ownerId);
  return row ? toConnection(row) : null;
}

// The sealed refresh token, for the broker only. Never part of a response.
export async function getSealedRefreshToken(env: Env, ownerId: string): Promise<string | null> {
  return (await connectionRow(env, ownerId))?.refresh_token_enc ?? null;
}

// The Google account the connection was last consented by, or null (none
// recorded yet, or no connection).
export async function getDriveAccountId(env: Env, ownerId: string): Promise<string | null> {
  return (await connectionRow(env, ownerId))?.google_account_id ?? null;
}

// Record the Google account of a consent (docs/specs/022-drive-mirror/drive-mirror.md, "Reconnecting
// with another Google account"). When a different account was recorded, its
// root folder, page token and every mirrored item name that account's files,
// so they go in the same batch; an unrecorded account (a row from before the
// column existed) is adopted without clearing. Returns whether state was cleared.
export async function bindDriveAccount(
  env: Env,
  ownerId: string,
  accountId: string,
): Promise<boolean> {
  const changed = `EXISTS (SELECT 1 FROM drive_connections WHERE owner_id = ?1
                     AND google_account_id IS NOT NULL AND google_account_id <> ?2)`;
  const results = await env.DB.batch([
    env.DB.prepare(`DELETE FROM drive_items WHERE owner_id = ?1 AND ${changed}`).bind(
      ownerId,
      accountId,
    ),
    env.DB.prepare(
      `UPDATE drive_connections
          SET root_folder_id = NULL, page_token = NULL, page_token_saved_at = NULL
        WHERE owner_id = ?1 AND google_account_id IS NOT NULL AND google_account_id <> ?2`,
    ).bind(ownerId, accountId),
    env.DB.prepare('UPDATE drive_connections SET google_account_id = ?2 WHERE owner_id = ?1').bind(
      ownerId,
      accountId,
    ),
  ]);
  return (results[1]?.meta.changes ?? 0) > 0;
}

// A consent in broker mode: store the sealed token, mark the connection
// connected. A reconnect keeps the root folder and page token, which are
// still valid for the same Google account's files; bindDriveAccount clears
// them when the account changed.
export async function upsertBrokerConnection(
  env: Env,
  ownerId: string,
  sealedRefreshToken: string,
  now: number,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO drive_connections (owner_id, refresh_token_enc, status, connected_at)
     VALUES (?, ?, 'connected', ?)
     ON CONFLICT (owner_id) DO UPDATE
       SET refresh_token_enc = excluded.refresh_token_enc, status = 'connected'`,
  )
    .bind(ownerId, sealedRefreshToken, now)
    .run();
}

// Browser-only mode: the connection exists without a refresh token.
export async function createBrowserConnection(
  env: Env,
  ownerId: string,
  now: number,
): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO drive_connections (owner_id, status, connected_at) VALUES (?, 'connected', ?)`,
  )
    .bind(ownerId, now)
    .run();
}

export async function updateDriveConnectionState(
  env: Env,
  ownerId: string,
  patch: { rootFolderId?: string | null; pageToken?: string },
  now: number,
): Promise<void> {
  const sets: string[] = [];
  const binds: (string | number | null)[] = [];
  if (patch.rootFolderId !== undefined) {
    sets.push('root_folder_id = ?');
    binds.push(patch.rootFolderId);
  }
  if (patch.pageToken !== undefined) {
    sets.push('page_token = ?', 'page_token_saved_at = ?');
    binds.push(patch.pageToken, now);
  }
  if (sets.length === 0) return;
  await env.DB.prepare(`UPDATE drive_connections SET ${sets.join(', ')} WHERE owner_id = ?`)
    .bind(...binds, ownerId)
    .run();
}

export async function setDriveConnectionStatus(
  env: Env,
  ownerId: string,
  status: DriveConnectionStatus,
): Promise<void> {
  await env.DB.prepare('UPDATE drive_connections SET status = ? WHERE owner_id = ?')
    .bind(status, ownerId)
    .run();
}

// The connection and every mirrored item of the owner, in one batch. The
// Drive files themselves stay (docs/specs/022-drive-mirror/drive-mirror.md).
export function driveOwnerRemovalStatements(env: Env, ownerId: string): D1PreparedStatement[] {
  return [
    env.DB.prepare('DELETE FROM drive_items WHERE owner_id = ?').bind(ownerId),
    env.DB.prepare('DELETE FROM drive_connections WHERE owner_id = ?').bind(ownerId),
  ];
}

export async function deleteDriveConnection(env: Env, ownerId: string): Promise<void> {
  await env.DB.batch(driveOwnerRemovalStatements(env, ownerId));
}

export async function listDriveItems(env: Env, ownerId: string): Promise<DriveItem[]> {
  const res = await env.DB.prepare(
    'SELECT * FROM drive_items WHERE owner_id = ? ORDER BY item_kind, ld_id',
  )
    .bind(ownerId)
    .all<ItemRow>();
  return (res.results ?? []).map(toItem);
}

// Upsert on (owner, kind, ld id), all rows in one batch.
export async function putDriveItems(env: Env, ownerId: string, items: DriveItem[]): Promise<void> {
  const statements = items.map((i) =>
    env.DB.prepare(
      `INSERT INTO drive_items (owner_id, item_kind, ld_id, drive_file_id, name, ld_name, parent_id,
                                trashed, md5, head_revision_id, mirrored_saved_at, notice, notice_parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (owner_id, item_kind, ld_id) DO UPDATE SET
         drive_file_id = excluded.drive_file_id, name = excluded.name, ld_name = excluded.ld_name,
         parent_id = excluded.parent_id, trashed = excluded.trashed, md5 = excluded.md5,
         head_revision_id = excluded.head_revision_id, mirrored_saved_at = excluded.mirrored_saved_at,
         notice = excluded.notice, notice_parent_id = excluded.notice_parent_id`,
    ).bind(
      ownerId,
      i.kind,
      i.ldId,
      i.driveFileId,
      i.name,
      i.ldName,
      i.parentId,
      i.trashed ? 1 : 0,
      i.md5,
      i.headRevisionId,
      i.mirroredSavedAt,
      i.notice,
      i.noticeParentId,
    ),
  );
  try {
    await env.DB.batch(statements);
  } catch (err) {
    if (
      err instanceof Error &&
      /UNIQUE constraint failed: drive_items\.owner_id, drive_items\.drive_file_id/.test(
        err.message,
      )
    ) {
      throw new DriveItemConflictError();
    }
    throw err;
  }
}

export async function deleteDriveItem(
  env: Env,
  ownerId: string,
  kind: DriveItemKind,
  ldId: string,
): Promise<void> {
  await env.DB.prepare('DELETE FROM drive_items WHERE owner_id = ? AND item_kind = ? AND ld_id = ?')
    .bind(ownerId, kind, ldId)
    .run();
}

// Take or renew the cross-device lease: granted when it is free, already this
// holder's, or expired. Null when the owner has no connection.
export async function acquireDriveLease(
  env: Env,
  ownerId: string,
  holder: string,
  now: number,
): Promise<DriveLease | null> {
  const expiresAt = now + DRIVE_LEASE_MS;
  const res = await env.DB.prepare(
    `UPDATE drive_connections SET lease_holder = ?, lease_expires_at = ?
      WHERE owner_id = ?
        AND (lease_holder IS NULL OR lease_holder = ? OR lease_expires_at IS NULL OR lease_expires_at <= ?)`,
  )
    .bind(holder, expiresAt, ownerId, holder, now)
    .run();
  if (res.meta.changes === 1) return { acquired: true, holder, expiresAt };
  const row = await connectionRow(env, ownerId);
  if (!row) return null;
  return { acquired: false, holder: row.lease_holder, expiresAt: row.lease_expires_at };
}

export async function releaseDriveLease(env: Env, ownerId: string, holder: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE drive_connections SET lease_holder = NULL, lease_expires_at = NULL
      WHERE owner_id = ? AND lease_holder = ?`,
  )
    .bind(ownerId, holder)
    .run();
}
