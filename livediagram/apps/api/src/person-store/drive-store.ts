// The Google Drive mirror's rows in a person's own store (docs/specs/022-drive-mirror/drive-mirror.md, "Data";
// blueprint "Data and persistence"): their one connection and the items it mirrors. The store is the person's, so no
// row names an owner. Every function runs inside the PersonStore's single-threaded RPC, and the ones that change
// more than one row run in its transaction (person-store.ts).

import {
  DRIVE_LEASE_MS,
  type DriveConnection,
  type DriveConnectionStatus,
  type DriveItem,
  type DriveItemKind,
  type DriveLease,
} from '@livediagram/api-schema';
import type { DocumentSql } from '../document-room/document-db';

type ConnectionRow = {
  refresh_token_enc: string | null;
  root_folder_id: string | null;
  page_token: string | null;
  page_token_saved_at: number | null;
  status: DriveConnectionStatus;
  connected_at: number;
  lease_holder: string | null;
  lease_expires_at: number | null;
  google_account_id: string | null;
  pending_refresh_token_enc: string | null;
  pending_google_account_id: string | null;
  pending_expires_at: number | null;
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

function toConnection(row: ConnectionRow, now: number): DriveConnection {
  const pendingLive =
    row.pending_refresh_token_enc !== null &&
    row.pending_expires_at !== null &&
    row.pending_expires_at > now;
  return {
    status: row.status,
    hasRefreshToken: row.refresh_token_enc !== null,
    rootFolderId: row.root_folder_id,
    pageToken: row.page_token,
    pageTokenSavedAt: row.page_token_saved_at,
    connectedAt: row.connected_at,
    pendingAccountSwitch: pendingLive ? { expiresAt: row.pending_expires_at! } : null,
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

function connectionRow(sql: DocumentSql): ConnectionRow | null {
  return (
    (sql.exec('SELECT * FROM drive_connections').toArray()[0] as ConnectionRow | undefined) ?? null
  );
}

export function readDriveConnection(sql: DocumentSql, now: number): DriveConnection | null {
  const row = connectionRow(sql);
  return row ? toConnection(row, now) : null;
}

// The sealed refresh token, for the broker only. Never part of a response.
export function readSealedRefreshToken(sql: DocumentSql): string | null {
  return connectionRow(sql)?.refresh_token_enc ?? null;
}

// A consent in broker mode: store the sealed token, mark the connection connected. A reconnect keeps the root folder
// and page token, which are still valid for the same Google account's files.
export function upsertBrokerConnection(
  sql: DocumentSql,
  sealedRefreshToken: string,
  now: number,
): void {
  sql.exec(
    `INSERT INTO drive_connections (id, refresh_token_enc, status, connected_at) VALUES (1, ?, 'connected', ?)
     ON CONFLICT (id) DO UPDATE SET refresh_token_enc = excluded.refresh_token_enc, status = 'connected'`,
    sealedRefreshToken,
    now,
  );
}

// Browser-only mode: the connection exists without a refresh token.
export function createBrowserConnection(sql: DocumentSql, now: number): void {
  sql.exec(
    `INSERT OR IGNORE INTO drive_connections (id, status, connected_at) VALUES (1, 'connected', ?)`,
    now,
  );
}

export function updateDriveConnectionState(
  sql: DocumentSql,
  patch: { rootFolderId?: string | null; pageToken?: string },
  now: number,
): void {
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
  sql.exec(`UPDATE drive_connections SET ${sets.join(', ')}`, ...binds);
}

export function setDriveConnectionStatus(sql: DocumentSql, status: DriveConnectionStatus): void {
  sql.exec('UPDATE drive_connections SET status = ?', status);
}

// The connection and every mirrored item. The Drive files themselves stay.
export function deleteDriveConnection(sql: DocumentSql): void {
  sql.exec('DELETE FROM drive_items');
  sql.exec('DELETE FROM drive_connections');
}

export function listDriveItems(sql: DocumentSql): DriveItem[] {
  return (
    sql.exec('SELECT * FROM drive_items ORDER BY item_kind, ld_id').toArray() as ItemRow[]
  ).map(toItem);
}

// Upsert on (kind, ld id). 'conflict' when an item names a Drive file another item already holds (UNIQUE
// drive_file_id); the caller runs this in a transaction, so a conflict writes none of them.
export function putDriveItems(sql: DocumentSql, items: readonly DriveItem[]): 'ok' | 'conflict' {
  for (const i of items) {
    const holder = sql
      .exec(
        'SELECT 1 AS taken FROM drive_items WHERE drive_file_id = ? AND NOT (item_kind = ? AND ld_id = ?)',
        i.driveFileId,
        i.kind,
        i.ldId,
      )
      .toArray();
    if (holder.length > 0) return 'conflict';
    sql.exec(
      `INSERT INTO drive_items (item_kind, ld_id, drive_file_id, name, ld_name, parent_id, trashed, md5,
                                head_revision_id, mirrored_saved_at, notice, notice_parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (item_kind, ld_id) DO UPDATE SET
         drive_file_id = excluded.drive_file_id, name = excluded.name, ld_name = excluded.ld_name,
         parent_id = excluded.parent_id, trashed = excluded.trashed, md5 = excluded.md5,
         head_revision_id = excluded.head_revision_id, mirrored_saved_at = excluded.mirrored_saved_at,
         notice = excluded.notice, notice_parent_id = excluded.notice_parent_id`,
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
    );
  }
  return 'ok';
}

export function deleteDriveItems(
  sql: DocumentSql,
  items: readonly { kind: DriveItemKind; ldId: string }[],
): void {
  for (const i of items) {
    sql.exec('DELETE FROM drive_items WHERE item_kind = ? AND ld_id = ?', i.kind, i.ldId);
  }
}

// Take or renew the cross-device lease: granted when it is free, already this holder's, or expired. Null when there
// is no connection.
export function acquireDriveLease(
  sql: DocumentSql,
  holder: string,
  now: number,
): DriveLease | null {
  const row = connectionRow(sql);
  if (!row) return null;
  const free =
    row.lease_holder === null ||
    row.lease_holder === holder ||
    row.lease_expires_at === null ||
    row.lease_expires_at <= now;
  if (!free) return { acquired: false, holder: row.lease_holder, expiresAt: row.lease_expires_at };
  const expiresAt = now + DRIVE_LEASE_MS;
  sql.exec(
    'UPDATE drive_connections SET lease_holder = ?, lease_expires_at = ?',
    holder,
    expiresAt,
  );
  return { acquired: true, holder, expiresAt };
}

export function releaseDriveLease(sql: DocumentSql, holder: string): void {
  sql.exec(
    'UPDATE drive_connections SET lease_holder = NULL, lease_expires_at = NULL WHERE lease_holder = ?',
    holder,
  );
}

// ---- Which Google account the connection syncs with, and a pending switch to another one ("Reconnecting with
// another Google account"; blueprint "Account switch").

export function readDriveAccountId(sql: DocumentSql): string | null {
  return connectionRow(sql)?.google_account_id ?? null;
}

// A consent by the recorded account (or the first after accounts began to be recorded): record it, and drop any
// pending switch, which that consent answers.
export function recordDriveAccount(sql: DocumentSql, accountId: string): void {
  sql.exec(
    `UPDATE drive_connections
        SET google_account_id = ?, pending_refresh_token_enc = NULL,
            pending_google_account_id = NULL, pending_expires_at = NULL`,
    accountId,
  );
}

// A consent by another account: park its sealed token beside the live connection, replacing any earlier pending
// switch, and touch nothing else.
export function setPendingAccountSwitch(
  sql: DocumentSql,
  sealedRefreshToken: string,
  accountId: string,
  expiresAt: number,
): void {
  sql.exec(
    `UPDATE drive_connections
        SET pending_refresh_token_enc = ?, pending_google_account_id = ?, pending_expires_at = ?`,
    sealedRefreshToken,
    accountId,
    expiresAt,
  );
}

// The live and pending sealed tokens, for revoking after a confirm or cancel.
export function readSwitchTokens(sql: DocumentSql): {
  current: string | null;
  pending: string | null;
} {
  const row = connectionRow(sql);
  return {
    current: row?.refresh_token_enc ?? null,
    pending: row?.pending_refresh_token_enc ?? null,
  };
}

// Confirm, only while the switch is pending and unexpired: drop every mirrored item (they name the old account's
// files) and move the pending token and account into place with the root folder and page token cleared. False (and
// an expired switch dropped) when there was none to confirm. The caller runs it in a transaction.
export function confirmPendingAccountSwitch(sql: DocumentSql, now: number): boolean {
  const row = connectionRow(sql);
  const live =
    row !== null &&
    row.pending_refresh_token_enc !== null &&
    row.pending_expires_at !== null &&
    row.pending_expires_at > now;
  if (!live) {
    clearPendingAccountSwitch(sql);
    return false;
  }
  sql.exec('DELETE FROM drive_items');
  sql.exec(
    `UPDATE drive_connections
        SET refresh_token_enc = pending_refresh_token_enc,
            google_account_id = pending_google_account_id,
            root_folder_id = NULL, page_token = NULL, page_token_saved_at = NULL,
            status = 'connected',
            pending_refresh_token_enc = NULL, pending_google_account_id = NULL,
            pending_expires_at = NULL`,
  );
  return true;
}

export function clearPendingAccountSwitch(sql: DocumentSql): void {
  sql.exec(
    `UPDATE drive_connections
        SET pending_refresh_token_enc = NULL, pending_google_account_id = NULL, pending_expires_at = NULL`,
  );
}
