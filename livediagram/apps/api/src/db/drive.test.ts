import { describe, expect, it, vi } from 'vitest';
import { DRIVE_LEASE_MS, type DriveItem } from '@livediagram/api-schema';
import { setPendingAccountSwitch } from './drive-account';
import { IndexError } from '@liveworkspace/index-client';
import { sqliteD1, testDocument, testIndexFor } from '../test-sqlite-d1';
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

// The index the mirror asks which canvases and folders still exist (removedItems): the test harness's, unless a
// case swaps in its own.
const index = vi.hoisted(() => ({ override: null as null | ((...args: never[]) => unknown) }));
vi.mock('../index-service', async (original) => ({
  ...(await original<typeof import('../index-service')>()),
  indexFor: (env: never, caller: never) =>
    index.override ? index.override(env, caller) : testIndexFor(env, caller),
}));

// Every read and write of the Drive mirror, in each person's own store
// (docs/specs/022-drive-mirror/blueprints/drive-mirror.md, "Data and persistence").

const T0 = 1_700_000_000_000;

// A database holding the canvases and folder the items mirror: an item whose canvas or folder is gone is dropped
// when the list is read.
function seeded() {
  const db = sqliteD1();
  for (const id of ['d1', 'd2'])
    testDocument(db, id, 'user_a', { name: id, savedAt: T0, createdAt: T0 });
  db.sql
    .prepare(
      "INSERT INTO test_folders (id, owner_id, team_id, parent_id, name) VALUES ('fo1', 'user_a', NULL, NULL, 'F')",
    )
    .run();
  return db;
}

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
    const { env } = seeded();
    await upsertBrokerConnection(env, 'user_a', 'v1.sealed', T0);
    const conn = await getDriveConnection(env, 'user_a');
    expect(conn).toEqual({
      status: 'connected',
      hasRefreshToken: true,
      rootFolderId: null,
      pageToken: null,
      pageTokenSavedAt: null,
      connectedAt: T0,
      pendingAccountSwitch: null,
    });
    expect(JSON.stringify(conn)).not.toContain('sealed');
    expect(await getSealedRefreshToken(env, 'user_a')).toBe('v1.sealed');
  });

  it('shows a live pending account switch by its expiry only, never its token or account', async () => {
    const { env } = seeded();
    await upsertBrokerConnection(env, 'user_a', 'v1.sealed', T0);
    await setPendingAccountSwitch(env, 'user_a', 'v1.pending', 'google-2', T0 + 1000);
    const conn = await getDriveConnection(env, 'user_a', T0);
    expect(conn!.pendingAccountSwitch).toEqual({ expiresAt: T0 + 1000 });
    expect(JSON.stringify(conn)).not.toMatch(/pending"?:?.*v1|google-2/);
    expect((await getDriveConnection(env, 'user_a', T0 + 1000))!.pendingAccountSwitch).toBeNull();
  });

  it('a reconnect replaces the token, clears needs_reconnect and keeps the mirror state', async () => {
    const { env } = seeded();
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
    const { env } = seeded();
    await createBrowserConnection(env, 'user_a', T0);
    await createBrowserConnection(env, 'user_a', T0 + 5);
    expect(await getDriveConnection(env, 'user_a')).toMatchObject({
      hasRefreshToken: false,
      connectedAt: T0,
    });
  });

  it('stamps pageTokenSavedAt only when the page token is written', async () => {
    const { env } = seeded();
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
    const { env } = seeded();
    expect(await getDriveConnection(env, 'user_x')).toBeNull();
    expect(await getSealedRefreshToken(env, 'user_x')).toBeNull();
  });

  it('delete removes the connection and every item of that owner only', async () => {
    const db = seeded();
    const { env } = db;
    testDocument(db, 'd3', 'user_b');
    await createBrowserConnection(env, 'user_a', T0);
    await createBrowserConnection(env, 'user_b', T0);
    await putDriveItems(env, 'user_a', [item()]);
    await putDriveItems(env, 'user_b', [item({ ldId: 'd3' })]);
    await deleteDriveConnection(env, 'user_a');
    expect(await getDriveConnection(env, 'user_a')).toBeNull();
    expect(await listDriveItems(env, 'user_a')).toEqual([]);
    expect(await listDriveItems(env, 'user_b')).toHaveLength(1);
  });
});

describe('items', () => {
  it('upserts by (kind, ldId) and lists them back', async () => {
    const { env } = seeded();
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
    const { env } = seeded();
    await putDriveItems(env, 'user_a', [item()]);
    await expect(putDriveItems(env, 'user_a', [item({ ldId: 'd2' })])).rejects.toBeInstanceOf(
      DriveItemConflictError,
    );
    // The batch lands whole or not at all.
    expect(await listDriveItems(env, 'user_a')).toHaveLength(1);
  });

  it('lets two owners hold the same Drive file id', async () => {
    // Each mirrors a canvas of their own (a mirror item of a canvas its owner cannot reach is dropped).
    const db = seeded();
    const { env } = db;
    testDocument(db, 'd3', 'user_b');
    await putDriveItems(env, 'user_a', [item()]);
    await putDriveItems(env, 'user_b', [item({ ldId: 'd3' })]);
    expect(await listDriveItems(env, 'user_b')).toHaveLength(1);
  });

  it('drops, as the list is read, an item whose canvas or folder was removed for good', async () => {
    const db = seeded();
    await putDriveItems(db.env, 'user_a', [
      item(),
      item({ ldId: 'gone', driveFileId: 'f-gone' }),
      item({ kind: 'folder', ldId: 'fo-gone', driveFileId: 'ff-gone' }),
    ]);
    expect((await listDriveItems(db.env, 'user_a')).map((i) => i.ldId)).toEqual(['d1']);
    // Gone from the store too, not only from the answer.
    testDocument(db, 'gone', 'user_a');
    expect((await listDriveItems(db.env, 'user_a')).map((i) => i.ldId)).toEqual(['d1']);
  });

  // An index that cannot answer never unmirrors anything: only a 404 for a canvas counts as gone, and a folder lookup
  // that fails keeps its folders. A canvas in the Trash is still the index's (it answers it), so stays mirrored.
  it('keeps every item the index cannot answer for', async () => {
    const db = seeded();
    await putDriveItems(db.env, 'user_a', [
      item(),
      item({ ldId: 'd2', driveFileId: 'f2' }),
      item({ kind: 'folder', ldId: 'fo-gone', driveFileId: 'ff-gone' }),
    ]);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    index.override = () => ({
      getItem: async (id: string) => {
        if (id === 'd1') throw new IndexError(503, 'unavailable');
        return { item: { id, trashedAt: 1 } };
      },
      folderPreviews: async () => {
        throw new IndexError(500, 'boom');
      },
    });
    try {
      expect((await listDriveItems(db.env, 'user_a')).map((i) => i.ldId).sort()).toEqual([
        'd1',
        'd2',
        'fo-gone',
      ]);
      index.override = () => null;
      expect(await listDriveItems(db.env, 'user_a')).toHaveLength(3);
    } finally {
      index.override = null;
      vi.restoreAllMocks();
    }
  });

  // A large mirror reads in one store call and asks the index per canvas, DRIVE_LOOKUPS_IN_FLIGHT at a time.
  it('lists a mirror of 2,000 canvases, a tenth of them removed, within budget', async () => {
    const db = seeded();
    const ids = Array.from({ length: 2000 }, (_, i) => `doc-${i}`);
    for (const id of ids.slice(200)) testDocument(db, id, 'user_a', { name: 'n' });
    for (let i = 0; i < ids.length; i += 100) {
      await putDriveItems(
        db.env,
        'user_a',
        ids.slice(i, i + 100).map((id) => item({ ldId: id, driveFileId: `file-${id}` })),
      );
    }
    const started = performance.now();
    const first = await listDriveItems(db.env, 'user_a');
    const second = await listDriveItems(db.env, 'user_a');
    const elapsed = performance.now() - started;
    expect(first).toHaveLength(1800);
    expect(second).toHaveLength(1800);
    expect(elapsed).toBeLessThan(1000);
  });

  it('deletes one item', async () => {
    const { env } = seeded();
    await putDriveItems(env, 'user_a', [item(), item({ ldId: 'd2', driveFileId: 'f2' })]);
    await deleteDriveItem(env, 'user_a', 'document', 'd1');
    expect((await listDriveItems(env, 'user_a')).map((i) => i.ldId)).toEqual(['d2']);
  });
});

describe('lease', () => {
  it('is acquired when free, renewed by its holder, and refused to another until it expires', async () => {
    const { env } = seeded();
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
    const { env } = seeded();
    await createBrowserConnection(env, 'user_a', T0);
    await acquireDriveLease(env, 'user_a', 'dev-1', T0);
    await releaseDriveLease(env, 'user_a', 'dev-2');
    expect((await acquireDriveLease(env, 'user_a', 'dev-2', T0 + 1))!.acquired).toBe(false);
    await releaseDriveLease(env, 'user_a', 'dev-1');
    expect((await acquireDriveLease(env, 'user_a', 'dev-2', T0 + 1))!.acquired).toBe(true);
  });

  it('answers null with no connection', async () => {
    const { env } = seeded();
    expect(await acquireDriveLease(env, 'user_a', 'dev-1', T0)).toBeNull();
  });
});
