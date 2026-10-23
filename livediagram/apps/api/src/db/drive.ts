// Google Drive mirror rows (docs/specs/022-drive-mirror/drive-mirror.md, "Data"; blueprint "Data and persistence"):
// the person's connection and the items it mirrors, in their own store (person-store/drive-store.ts). Every call is
// scoped to one owner, the verified account id the route resolved, by reaching that owner's store.

import type {
  DriveConnection,
  DriveConnectionStatus,
  DriveItem,
  DriveItemKind,
  DriveLease,
} from '@livediagram/api-schema';
import { personStore } from '../person-client';
import type { Env } from '../types';

// Raised when an item names a Drive file another item of the same owner already holds.
export class DriveItemConflictError extends Error {
  constructor() {
    super('drive_item_conflict');
    this.name = 'DriveItemConflictError';
  }
}

export async function getDriveConnection(
  env: Env,
  ownerId: string,
  now: number = Date.now(),
): Promise<DriveConnection | null> {
  return personStore(env, ownerId).driveConnection(now);
}

// The sealed refresh token, for the broker only. Never part of a response.
export async function getSealedRefreshToken(env: Env, ownerId: string): Promise<string | null> {
  return personStore(env, ownerId).driveSealedRefreshToken();
}

// A consent in broker mode: store the sealed token, mark the connection connected. A reconnect keeps the root folder
// and page token, which are still valid for the same Google account's files. A consent by another account never
// reaches here: it waits as a pending switch (db/drive-account.ts).
export async function upsertBrokerConnection(
  env: Env,
  ownerId: string,
  sealedRefreshToken: string,
  now: number,
): Promise<void> {
  await personStore(env, ownerId).driveUpsertBroker(sealedRefreshToken, now);
}

// Browser-only mode: the connection exists without a refresh token.
export async function createBrowserConnection(
  env: Env,
  ownerId: string,
  now: number,
): Promise<void> {
  await personStore(env, ownerId).driveCreateBrowser(now);
}

export async function updateDriveConnectionState(
  env: Env,
  ownerId: string,
  patch: { rootFolderId?: string | null; pageToken?: string },
  now: number,
): Promise<void> {
  if (patch.rootFolderId === undefined && patch.pageToken === undefined) return;
  await personStore(env, ownerId).driveUpdateState(patch, now);
}

export async function setDriveConnectionStatus(
  env: Env,
  ownerId: string,
  status: DriveConnectionStatus,
): Promise<void> {
  await personStore(env, ownerId).driveSetStatus(status);
}

// The connection and every mirrored item of the owner, at once. The Drive files themselves stay
// (docs/specs/022-drive-mirror/drive-mirror.md).
export async function deleteDriveConnection(env: Env, ownerId: string): Promise<void> {
  await personStore(env, ownerId).driveDisconnect();
}

// The owner's mirrored items. An item whose canvas or folder was removed for good is no longer mirrored: it is
// dropped here, the first time the list is read after the removal, and the browser finishes the Drive side from its
// own memory of the rows it saw. One indexed read per kind present, of ids the mirror already holds.
export async function listDriveItems(env: Env, ownerId: string): Promise<DriveItem[]> {
  const store = personStore(env, ownerId);
  const items = await store.driveItems();
  if (items.length === 0) return items;
  const gone = await removedItems(env, items);
  if (gone.length === 0) return items;
  await store.driveDeleteItems(gone);
  const dropped = new Set(gone.map((g) => `${g.kind}:${g.ldId}`));
  return items.filter((i) => !dropped.has(`${i.kind}:${i.ldId}`));
}

// Which of these items name a canvas or folder that no longer exists (the Trash keeps a canvas, so a trashed one is
// still mirrored).
async function removedItems(
  env: Env,
  items: readonly DriveItem[],
): Promise<{ kind: DriveItemKind; ldId: string }[]> {
  const gone: { kind: DriveItemKind; ldId: string }[] = [];
  for (const [kind, table] of [
    ['document', 'documents'],
    ['folder', 'folders'],
  ] as const) {
    const ids = items.filter((i) => i.kind === kind).map((i) => i.ldId);
    if (ids.length === 0) continue;
    const found = await env.DB.prepare(
      `SELECT id FROM ${table} WHERE id IN (SELECT value FROM json_each(?))`,
    )
      .bind(JSON.stringify(ids))
      .all<{ id: string }>();
    const live = new Set((found.results ?? []).map((r) => r.id));
    for (const ldId of ids) if (!live.has(ldId)) gone.push({ kind, ldId });
  }
  return gone;
}

// Upsert on (owner, kind, ld id), all rows at once: a conflict writes none of them.
export async function putDriveItems(env: Env, ownerId: string, items: DriveItem[]): Promise<void> {
  if ((await personStore(env, ownerId).drivePutItems(items)) === 'conflict') {
    throw new DriveItemConflictError();
  }
}

export async function deleteDriveItem(
  env: Env,
  ownerId: string,
  kind: DriveItemKind,
  ldId: string,
): Promise<void> {
  await personStore(env, ownerId).driveDeleteItems([{ kind, ldId }]);
}

// Take or renew the cross-device lease: granted when it is free, already this holder's, or expired. Null when the
// owner has no connection.
export async function acquireDriveLease(
  env: Env,
  ownerId: string,
  holder: string,
  now: number,
): Promise<DriveLease | null> {
  return personStore(env, ownerId).driveAcquireLease(holder, now);
}

export async function releaseDriveLease(env: Env, ownerId: string, holder: string): Promise<void> {
  await personStore(env, ownerId).driveReleaseLease(holder);
}
