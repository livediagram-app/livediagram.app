import { describe, expect, it } from 'vitest';
import { DRIVE_LEASE_MS, type DriveItem } from '@livediagram/api-schema';
import { sqliteD1 } from '../test-sqlite-d1';
import {
  acquireDriveLease,
  createBrowserConnection,
  deleteDriveConnection,
  deleteDriveItem,
  DriveItemConflictError,
  getDriveConnection,
  getSealedRefreshToken,
  listDriveItems,
  putDriveItems,
  releaseDriveLease,
  setDriveConnectionStatus,
  updateDriveConnectionState,
  upsertBrokerConnection,
} from './drive';

// Every statement on drive_connections / drive_items
// (docs/specs/022-drive-mirror/blueprints/drive-mirror.md, "Data and persistence").

const T0 = 1_700_000_000_000;

function item(over: Partial<DriveItem> = {}): DriveItem {
  return {
    kind: 'document',
    ldId: 'd1',
    driveFileId: 'f1',
    name: 'One.livediagram',
    ldName: 'One',
    parentId: 'root',
    trashed: false,
    md5: 'm1',
    headRevisionId: 'r1',
    mirroredSavedAt: T0,
    notice: null,
    noticeParentId: null,
    ...over,
  };
}

describe('connections', () => {
  it('stores a broker connection and never returns the sealed token in the summary', async () => {
    const { env } = sqliteD1();
    await upsertBrokerConnection(env, 'user_a', 'v1.sealed', T0);
    const conn = await getDriveConnection(env, 'user_a');
    expect(conn).toEqual({
      status: 'connected',
      hasRefreshToken: true,
      rootFolderId: null,
      pageToken: null,
      pageTokenSavedAt: null,
      connectedAt: T0,
    });
    expect(JSON.stringify(conn)).not.toContain('sealed');
    expect(await getSealedRefreshToken(env, 'user_a')).toBe('v1.sealed');
  });

  it('a reconnect replaces the token, clears needs_reconnect and keeps the mirror state', async () => {
    const { env } = sqliteD1();
    await upsertBrokerConnection(env, 'user_a', 'v1.old', T0);
    await updateDriveConnectionState(
      env,
      'user_a',
      { rootFolderId: 'root', pageToken: 'p1' },
      T0 + 1,
    );
    await setDriveConnectionStatus(env, 'user_a', 'needs_reconnect');
    await upsertBrokerConnection(env, 'user_a', 'v1.new', T0 + 2);
    const conn = await getDriveConnection(env, 'user_a');
    expect(conn).toMatchObject({ status: 'connected', rootFolderId: 'root', pageToken: 'p1' });
    expect(await getSealedRefreshToken(env, 'user_a')).toBe('v1.new');
  });

  it('a browser connection has no refresh token and is created once', async () => {
    const { env } = sqliteD1();
    await createBrowserConnection(env, 'user_a', T0);
    await createBrowserConnection(env, 'user_a', T0 + 5);
    expect(await getDriveConnection(env, 'user_a')).toMatchObject({
      hasRefreshToken: false,
      connectedAt: T0,
    });
  });

  it('stamps pageTokenSavedAt only when the page token is written', async () => {
    const { env } = sqliteD1();
    await createBrowserConnection(env, 'user_a', T0);
    await updateDriveConnectionState(env, 'user_a', { rootFolderId: 'r' }, T0 + 1);
    expect((await getDriveConnection(env, 'user_a'))!.pageTokenSavedAt).toBeNull();
    await updateDriveConnectionState(env, 'user_a', { pageToken: 'p' }, T0 + 2);
    expect(await getDriveConnection(env, 'user_a')).toMatchObject({
      rootFolderId: 'r',
      pageToken: 'p',
      pageTokenSavedAt: T0 + 2,
    });
  });

  it('answers null for someone with no connection', async () => {
    const { env } = sqliteD1();
    expect(await getDriveConnection(env, 'user_x')).toBeNull();
    expect(await getSealedRefreshToken(env, 'user_x')).toBeNull();
  });

  it('delete removes the connection and every item of that owner only', async () => {
    const { env } = sqliteD1();
    await createBrowserConnection(env, 'user_a', T0);
    await createBrowserConnection(env, 'user_b', T0);
    await putDriveItems(env, 'user_a', [item()]);
    await putDriveItems(env, 'user_b', [item()]);
    await deleteDriveConnection(env, 'user_a');
    expect(await getDriveConnection(env, 'user_a')).toBeNull();
    expect(await listDriveItems(env, 'user_a')).toEqual([]);
    expect(await listDriveItems(env, 'user_b')).toHaveLength(1);
  });
});

describe('items', () => {
  it('upserts by (kind, ldId) and lists them back', async () => {
    const { env } = sqliteD1();
    await putDriveItems(env, 'user_a', [
      item(),
      item({
        kind: 'folder',
        ldId: 'fo1',
        driveFileId: 'ff1',
        name: 'F',
        ldName: 'F',
        md5: null,
        headRevisionId: null,
        mirroredSavedAt: null,
      }),
    ]);
    await putDriveItems(env, 'user_a', [
      item({
        name: 'Two.livediagram',
        ldName: 'Two',
        notice: 'unseen_folder',
        noticeParentId: 'x',
      }),
    ]);
    const items = await listDriveItems(env, 'user_a');
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.kind === 'document')).toEqual(
      item({
        name: 'Two.livediagram',
        ldName: 'Two',
        notice: 'unseen_folder',
        noticeParentId: 'x',
      }),
    );
  });

  it('refuses a Drive file id another item of the owner already holds', async () => {
    const { env } = sqliteD1();
    await putDriveItems(env, 'user_a', [item()]);
    await expect(putDriveItems(env, 'user_a', [item({ ldId: 'd2' })])).rejects.toBeInstanceOf(
      DriveItemConflictError,
    );
    // The batch lands whole or not at all.
    expect(await listDriveItems(env, 'user_a')).toHaveLength(1);
  });

  it('lets two owners hold the same Drive file id', async () => {
    const { env } = sqliteD1();
    await putDriveItems(env, 'user_a', [item()]);
    await putDriveItems(env, 'user_b', [item()]);
    expect(await listDriveItems(env, 'user_b')).toHaveLength(1);
  });

  it('deletes one item', async () => {
    const { env } = sqliteD1();
    await putDriveItems(env, 'user_a', [item(), item({ ldId: 'd2', driveFileId: 'f2' })]);
    await deleteDriveItem(env, 'user_a', 'document', 'd1');
    expect((await listDriveItems(env, 'user_a')).map((i) => i.ldId)).toEqual(['d2']);
  });
});

describe('lease', () => {
  it('is acquired when free, renewed by its holder, and refused to another until it expires', async () => {
    const { env } = sqliteD1();
    await createBrowserConnection(env, 'user_a', T0);
    expect(await acquireDriveLease(env, 'user_a', 'dev-1', T0)).toEqual({
      acquired: true,
      holder: 'dev-1',
      expiresAt: T0 + DRIVE_LEASE_MS,
    });
    expect(await acquireDriveLease(env, 'user_a', 'dev-2', T0 + 1)).toEqual({
      acquired: false,
      holder: 'dev-1',
      expiresAt: T0 + DRIVE_LEASE_MS,
    });
    expect((await acquireDriveLease(env, 'user_a', 'dev-1', T0 + 10))!.expiresAt).toBe(
      T0 + 10 + DRIVE_LEASE_MS,
    );
    expect(
      (await acquireDriveLease(env, 'user_a', 'dev-2', T0 + 10 + DRIVE_LEASE_MS))!.acquired,
    ).toBe(true);
  });

  it('is released only by its holder', async () => {
    const { env } = sqliteD1();
    await createBrowserConnection(env, 'user_a', T0);
    await acquireDriveLease(env, 'user_a', 'dev-1', T0);
    await releaseDriveLease(env, 'user_a', 'dev-2');
    expect((await acquireDriveLease(env, 'user_a', 'dev-2', T0 + 1))!.acquired).toBe(false);
    await releaseDriveLease(env, 'user_a', 'dev-1');
    expect((await acquireDriveLease(env, 'user_a', 'dev-2', T0 + 1))!.acquired).toBe(true);
  });

  it('answers null with no connection', async () => {
    const { env } = sqliteD1();
    expect(await acquireDriveLease(env, 'user_a', 'dev-1', T0)).toBeNull();
  });
});
