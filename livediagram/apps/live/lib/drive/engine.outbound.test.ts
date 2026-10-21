import { parseDocumentEnvelope } from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import { DRIVE_FILE_MIME } from '@livediagram/api-schema';
import { DRIVE_WRITE_IDLE_MS, DRIVE_WRITE_MIN_INTERVAL_MS } from './cadence';
import { fileOf, HOST, makeEngine, OWNER, world } from './test-support';
import { DriveTokenError } from './token-source';

// Every row of the spec's Outbound table, end to end through the engine, the
// REST client and the fake Google (docs/specs/022-drive-mirror/drive-mirror.md,
// "Outbound: livediagram to Drive").

async function connected() {
  const w = world();
  const { engine, events, statuses } = makeEngine(w);
  return { ...w, engine, events, statuses };
}

describe('first mirror', () => {
  it('creates the livediagram root, the folder tree, then every document oldest first', async () => {
    const w = await connected();
    w.ld.createFolderAs('f1', 'Work');
    w.ld.createFolderAs('f2', 'Plans', 'f1');
    w.ld.createDocument('old', 'Old one', 'f2');
    w.clock.tick(1000);
    w.ld.createDocument('new', 'New one');
    await w.engine.start();

    const root = w.google.get(w.ld.connection!.rootFolderId!)!;
    // The test host is neither livediagram.app nor staging nor loopback.
    expect(root).toMatchObject({
      name: 'livediagram (self-hosted)',
      appProperties: { ldRoot: HOST },
    });
    const f1 = fileOf(w.google, w.ld, 'folder', 'f1')!;
    const f2 = fileOf(w.google, w.ld, 'folder', 'f2')!;
    expect(f1.parents).toEqual([root.id]);
    expect(f2.parents).toEqual([f1.id]);
    expect(f2.appProperties).toEqual({ ldFolderId: 'f2', ldOrigin: HOST });
    const old = fileOf(w.google, w.ld, 'document', 'old')!;
    expect(old).toMatchObject({
      name: 'Old one.livediagram',
      mimeType: DRIVE_FILE_MIME,
      parents: [f2.id],
      appProperties: { ldDocumentId: 'old', ldOrigin: HOST },
    });
    expect(old.thumbnail).toMatchObject({ mimeType: 'image/png' });
    const parsed = parseDocumentEnvelope(old.content);
    expect(parsed.ok && parsed.envelope.document).toMatchObject({ id: 'old', name: 'Old one' });
    expect(fileOf(w.google, w.ld, 'document', 'new')!.parents).toEqual([root.id]);
    // Oldest first.
    const created = w.google.requests.filter(
      (r) => r.method === 'POST' && r.path.startsWith('/upload'),
    ).length;
    expect(created).toBe(2);
    expect(Number(fileOf(w.google, w.ld, 'document', 'old')!.id.slice(4))).toBeLessThan(
      Number(fileOf(w.google, w.ld, 'document', 'new')!.id.slice(4)),
    );
    expect(w.events).toContain('FirstMirrorFinished');
    expect(w.statuses.some((s) => s.progress?.total === 2)).toBe(true);
    expect(w.statuses.at(-1)).toMatchObject({
      state: 'idle',
      error: null,
      lastSyncedAt: w.clock.now,
    });
  });

  it('takes the page token before its first write, so its own writes read back as echoes', async () => {
    const w = await connected();
    w.ld.createDocument('d1', 'One');
    await w.engine.start();
    const writesBefore = w.ld.writes;
    await w.engine.syncNow();
    // Nothing applied from reading its own changes back (only the page token).
    expect(w.ld.document('d1')!.name).toBe('One');
    expect(w.ld.writes - writesBefore).toBeLessThanOrEqual(1);
  });

  it('resumes where it stopped: a closed tab continues on the next visit', async () => {
    const w = await connected();
    for (const id of ['a', 'b', 'c']) w.ld.createDocument(id, id.toUpperCase());
    // Google rate-limits the second upload: the pass stops there.
    let uploads = 0;
    w.google.fail({
      status: 429,
      reason: 'rateLimitExceeded',
      match: (r) => r.path.startsWith('/upload') && ++uploads === 2,
    });
    await w.engine.start();
    expect(w.ld.items.size).toBe(1);
    const next = makeEngine(w);
    await next.engine.start();
    expect([...w.ld.items.keys()].sort()).toEqual(['document:a', 'document:b', 'document:c']);
  });
});

describe('outbound rows', () => {
  async function mirrored() {
    const w = await connected();
    w.ld.createFolderAs('f1', 'Work');
    w.ld.createFolderAs('f2', 'Other');
    w.ld.createDocument('d1', 'Plan', 'f1');
    await w.engine.start();
    return w;
  }

  it('Document edited: contents and thumbnail rewritten once idle, at most every 5 minutes', async () => {
    const w = await mirrored();
    const before = fileOf(w.google, w.ld, 'document', 'd1')!.md5Checksum;
    w.clock.tick(DRIVE_WRITE_MIN_INTERVAL_MS);
    w.ld.edit('d1');
    w.engine.noteWrite();
    w.timers.advance(DRIVE_WRITE_IDLE_MS - 1000);
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'document', 'd1')!.md5Checksum).toBe(before);
    w.timers.advance(2000);
    await Promise.resolve();
    await w.engine.syncNow();
    const after = { ...fileOf(w.google, w.ld, 'document', 'd1')! };
    expect(after.md5Checksum).not.toBe(before);
    expect(after.thumbnail).not.toBeNull();
    // A second edit a minute later waits for the 5-minute interval.
    w.clock.tick(DRIVE_WRITE_IDLE_MS);
    w.ld.edit('d1');
    w.clock.tick(DRIVE_WRITE_IDLE_MS);
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'document', 'd1')!.md5Checksum).toBe(after.md5Checksum);
    w.clock.tick(DRIVE_WRITE_MIN_INTERVAL_MS);
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'document', 'd1')!.md5Checksum).not.toBe(after.md5Checksum);
  });

  it('flushes a pending edit when the tab hides, ignoring idle and interval', async () => {
    const w = await mirrored();
    const before = fileOf(w.google, w.ld, 'document', 'd1')!.md5Checksum;
    w.clock.tick(1000);
    w.ld.edit('d1');
    await w.engine.onHidden();
    expect(fileOf(w.google, w.ld, 'document', 'd1')!.md5Checksum).not.toBe(before);
  });

  it('Document renamed: file renamed', async () => {
    const w = await mirrored();
    await w.ld.port().renameDocument('d1', 'Roadmap');
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'document', 'd1')!.name).toBe('Roadmap.livediagram');
  });

  it('Document moved to another folder: file moved', async () => {
    const w = await mirrored();
    await w.ld.port().moveDocument('d1', 'f2');
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'document', 'd1')!.parents).toEqual([
      fileOf(w.google, w.ld, 'folder', 'f2')!.id,
    ]);
  });

  it('Document deleted to Trash: file to the bin; restored: file restored', async () => {
    const w = await mirrored();
    await w.ld.port().trashDocument('d1');
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'document', 'd1')!.trashed).toBe(true);
    await w.ld.port().restoreDocument('d1');
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'document', 'd1')!.trashed).toBe(false);
  });

  it('Document restored from Trash: re-created if the file is gone', async () => {
    const w = await mirrored();
    await w.ld.port().trashDocument('d1');
    await w.engine.syncNow();
    const oldId = w.ld.item('document', 'd1')!.driveFileId;
    w.google.userDeleteForever(oldId);
    // Drive's delete is read as `removed` while livediagram still has it in
    // the Trash, which purges it; restore before the next read instead.
    await w.ld.port().restoreDocument('d1');
    await w.engine.flush();
    const file = fileOf(w.google, w.ld, 'document', 'd1')!;
    expect(file.id).not.toBe(oldId);
    expect(file.trashed).toBe(false);
  });

  it('Document purged from Trash: file deleted for good if still in the bin', async () => {
    const w = await mirrored();
    await w.ld.port().trashDocument('d1');
    await w.engine.syncNow();
    const fileId = w.ld.item('document', 'd1')!.driveFileId;
    await w.ld.port().purgeDocument('d1');
    expect(w.ld.item('document', 'd1')).toBeUndefined();
    await w.engine.syncNow();
    expect(w.google.get(fileId)).toBeUndefined();
  });

  it('Document moved into a team: file to the bin; moved back out: restored', async () => {
    const w = await mirrored();
    w.ld.moveIntoTeam('d1');
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'document', 'd1')!.trashed).toBe(true);
    w.ld.moveOutOfTeam('d1');
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'document', 'd1')!.trashed).toBe(false);
  });

  it('Document taken offline: the file goes to the bin', async () => {
    const w = await mirrored();
    const fileId = w.ld.item('document', 'd1')!.driveFileId;
    w.ld.takeOffline('d1');
    await w.engine.syncNow();
    expect(w.google.get(fileId)!.trashed).toBe(true);
  });

  it('Folder created, renamed and moved: the Drive folder follows', async () => {
    const w = await mirrored();
    const p = w.ld.port();
    await p.createFolder('f3', 'New', null);
    await w.engine.syncNow();
    const f3 = fileOf(w.google, w.ld, 'folder', 'f3')!;
    expect(f3.parents).toEqual([w.ld.connection!.rootFolderId]);
    await p.renameFolder('f3', 'Renamed');
    await p.moveFolder('f3', 'f1');
    await w.engine.syncNow();
    expect(w.google.get(f3.id)).toMatchObject({
      name: 'Renamed',
      parents: [fileOf(w.google, w.ld, 'folder', 'f1')!.id],
    });
  });

  it('Folder deleted: its contents move up, then the empty Drive folder goes to the bin', async () => {
    const w = await mirrored();
    await w.ld.port().createFolder('sub', 'Sub', 'f1');
    await w.engine.syncNow();
    const folderFile = fileOf(w.google, w.ld, 'folder', 'f1')!.id;
    await w.ld.port().deleteFolder('f1');
    await w.engine.syncNow();
    const root = w.ld.connection!.rootFolderId;
    expect(fileOf(w.google, w.ld, 'document', 'd1')!).toMatchObject({
      parents: [root],
      trashed: false,
    });
    expect(fileOf(w.google, w.ld, 'folder', 'sub')!).toMatchObject({
      parents: [root],
      trashed: false,
    });
    expect(w.google.get(folderFile)!.trashed).toBe(true);
  });

  it('Nested folder deleted: its contents move to its parent folder in Drive too', async () => {
    const w = await mirrored();
    const p = w.ld.port();
    await p.createFolder('mid', 'Mid', 'f1');
    await p.createFolder('leaf', 'Leaf', 'mid');
    await p.moveDocument('d1', 'mid');
    await w.engine.syncNow();
    const midFile = fileOf(w.google, w.ld, 'folder', 'mid')!.id;
    await p.deleteFolder('mid');
    await w.engine.syncNow();
    const parent = fileOf(w.google, w.ld, 'folder', 'f1')!.id;
    expect(fileOf(w.google, w.ld, 'document', 'd1')!).toMatchObject({
      parents: [parent],
      trashed: false,
    });
    expect(fileOf(w.google, w.ld, 'folder', 'leaf')!).toMatchObject({
      parents: [parent],
      trashed: false,
    });
    expect(w.google.get(midFile)!.trashed).toBe(true);
  });

  it('Folder deleted before its creation is read back: never brought back', async () => {
    const w = await mirrored();
    const p = w.ld.port();
    await p.createFolder('brief', 'Brief', null);
    await w.engine.syncNow();
    const file = fileOf(w.google, w.ld, 'folder', 'brief')!.id;
    // Deleted in livediagram before any pass read the Drive change its own create made.
    await p.deleteFolder('brief');
    await w.engine.syncNow();
    await w.engine.syncNow();
    expect(w.ld.folders.has('brief')).toBe(false);
    expect(w.google.get(file)!.trashed).toBe(true);
  });

  it('re-creates a file deleted outside livediagram when it next writes (404)', async () => {
    const w = await mirrored();
    const oldId = w.ld.item('document', 'd1')!.driveFileId;
    w.google.loseAccess(OWNER, oldId);
    await w.ld.port().renameDocument('d1', 'Again');
    await w.engine.flush();
    const file = fileOf(w.google, w.ld, 'document', 'd1')!;
    expect(file.id).not.toBe(oldId);
    expect(file.name).toBe('Again.livediagram');
  });
});

// The Explorer's per-document marks (docs/specs/022-drive-mirror/drive-mirror.md,
// "The Explorer shows each document's sync").
describe('the Drive folder for Open folder', () => {
  it('publishes the root folder id from our own server before any call to Google', async () => {
    const w = await connected();
    w.ld.createDocument('d1', 'Plan');
    await w.engine.start();
    const rootId = w.ld.connection!.rootFolderId;
    expect(rootId).toBeTruthy();
    expect(w.statuses.at(-1)!.rootFolderId).toBe(rootId);
    const next = makeEngine({ ...w, deviceId: 'device-b' });
    await next.engine.start();
    expect(next.statuses[0]!.rootFolderId).toBe(rootId);
  });
});

describe('what the Explorer is told per document', () => {
  it("reads each document's last upload from drive_items before any call to Google", async () => {
    const w = await connected();
    w.ld.createDocument('d1', 'Plan');
    await w.engine.start();
    // A new engine, as on the next page load.
    const next = makeEngine({ ...w, deviceId: 'device-b' });
    await next.engine.start();
    // Its very first status already carries what drive_items says, published
    // before Syncing (which follows the Google token).
    expect(next.statuses[0]!.mirrored).toMatchObject({ d1: expect.any(Number) });
    expect(next.statuses[0]!.state).toBe('starting');
  });

  it('still says what it knows while syncing is paused', async () => {
    const w = await connected();
    w.ld.createDocument('d1', 'Plan');
    await w.engine.start();
    const paused = makeEngine({
      ...w,
      deviceId: 'device-b',
      tokens: {
        get: async () => {
          throw new DriveTokenError('needs_reconnect');
        },
      },
    });
    await paused.engine.start();
    const last = paused.statuses.at(-1)!;
    expect(last.state).toBe('needs_reconnect');
    expect(last.mirrored).toMatchObject({ d1: expect.any(Number) });
  });

  it('marks exactly the document whose upload failed, and clears it when a retry succeeds', async () => {
    const w = await connected();
    w.ld.createDocument('ok', 'Fine');
    await w.engine.start();
    w.clock.tick(1000);
    w.ld.createDocument('bad', 'Broken');
    // Not run-fatal (not a rate limit, auth or network failure): one op fails.
    w.google.fail({
      status: 400,
      reason: 'badRequest',
      match: ({ method, path }) => method === 'POST' && path.startsWith('/upload/'),
    });
    await w.engine.flush();
    expect(w.statuses.at(-1)!.failed).toEqual(['bad']);
    expect(w.statuses.at(-1)!.mirrored).not.toHaveProperty('bad');
    await w.engine.flush();
    expect(w.statuses.at(-1)!.failed).toEqual([]);
    expect(w.statuses.at(-1)!.mirrored).toHaveProperty('bad');
  });

  it('forgets a failure once the document leaves the mirror (moved into a team)', async () => {
    const w = await connected();
    await w.engine.start();
    w.ld.createDocument('bad', 'Broken');
    w.google.fail({
      status: 400,
      reason: 'badRequest',
      match: ({ method, path }) => method === 'POST' && path.startsWith('/upload/'),
    });
    await w.engine.flush();
    expect(w.statuses.at(-1)!.failed).toEqual(['bad']);
    w.ld.moveIntoTeam('bad');
    await w.engine.flush();
    expect(w.statuses.at(-1)!.failed).toEqual([]);
  });
});
