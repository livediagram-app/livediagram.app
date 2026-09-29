import { describe, expect, it } from 'vitest';
import { DRIVE_FILE_MIME } from '@livediagram/api-schema';
import { parseDiagramEnvelope } from '../export-diagram-text';
import { DRIVE_WRITE_IDLE_MS, DRIVE_WRITE_MIN_INTERVAL_MS } from './cadence';
import { fileOf, HOST, makeEngine, OWNER, world } from './test-support';

// Every row of the spec's Outbound table, end to end through the engine, the
// REST client and the fake Google (docs/specs/022-drive-mirror/drive-mirror.md,
// "Outbound: livediagram to Drive").

async function connected() {
  const w = world();
  const { engine, events, statuses } = makeEngine(w);
  return { ...w, engine, events, statuses };
}

describe('first mirror', () => {
  it('creates the livediagram root, the folder tree, then every diagram oldest first', async () => {
    const w = await connected();
    w.ld.createFolderAs('f1', 'Work');
    w.ld.createFolderAs('f2', 'Plans', 'f1');
    w.ld.createDiagram('old', 'Old one', 'f2');
    w.clock.tick(1000);
    w.ld.createDiagram('new', 'New one');
    await w.engine.start();

    const root = w.google.get(w.ld.connection!.rootFolderId!)!;
    expect(root).toMatchObject({ name: 'livediagram', appProperties: { ldRoot: HOST } });
    const f1 = fileOf(w.google, w.ld, 'folder', 'f1')!;
    const f2 = fileOf(w.google, w.ld, 'folder', 'f2')!;
    expect(f1.parents).toEqual([root.id]);
    expect(f2.parents).toEqual([f1.id]);
    expect(f2.appProperties).toEqual({ ldFolderId: 'f2', ldOrigin: HOST });
    const old = fileOf(w.google, w.ld, 'diagram', 'old')!;
    expect(old).toMatchObject({
      name: 'Old one.livediagram',
      mimeType: DRIVE_FILE_MIME,
      parents: [f2.id],
      appProperties: { ldDiagramId: 'old', ldOrigin: HOST },
    });
    expect(old.thumbnail).toMatchObject({ mimeType: 'image/png' });
    const parsed = parseDiagramEnvelope(old.content);
    expect(parsed.ok && parsed.envelope.diagram).toMatchObject({ id: 'old', name: 'Old one' });
    expect(fileOf(w.google, w.ld, 'diagram', 'new')!.parents).toEqual([root.id]);
    // Oldest first.
    const created = w.google.requests.filter(
      (r) => r.method === 'POST' && r.path.startsWith('/upload'),
    ).length;
    expect(created).toBe(2);
    expect(Number(fileOf(w.google, w.ld, 'diagram', 'old')!.id.slice(4))).toBeLessThan(
      Number(fileOf(w.google, w.ld, 'diagram', 'new')!.id.slice(4)),
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
    w.ld.createDiagram('d1', 'One');
    await w.engine.start();
    const writesBefore = w.ld.writes;
    await w.engine.syncNow();
    // Nothing applied from reading its own changes back (only the page token).
    expect(w.ld.diagram('d1')!.name).toBe('One');
    expect(w.ld.writes - writesBefore).toBeLessThanOrEqual(1);
  });

  it('resumes where it stopped: a closed tab continues on the next visit', async () => {
    const w = await connected();
    for (const id of ['a', 'b', 'c']) w.ld.createDiagram(id, id.toUpperCase());
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
    expect([...w.ld.items.keys()].sort()).toEqual(['diagram:a', 'diagram:b', 'diagram:c']);
  });
});

describe('outbound rows', () => {
  async function mirrored() {
    const w = await connected();
    w.ld.createFolderAs('f1', 'Work');
    w.ld.createFolderAs('f2', 'Other');
    w.ld.createDiagram('d1', 'Plan', 'f1');
    await w.engine.start();
    return w;
  }

  it('Diagram edited: contents and thumbnail rewritten once idle, at most every 5 minutes', async () => {
    const w = await mirrored();
    const before = fileOf(w.google, w.ld, 'diagram', 'd1')!.md5Checksum;
    w.clock.tick(DRIVE_WRITE_MIN_INTERVAL_MS);
    w.ld.edit('d1');
    w.engine.noteWrite();
    w.timers.advance(DRIVE_WRITE_IDLE_MS - 1000);
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'diagram', 'd1')!.md5Checksum).toBe(before);
    w.timers.advance(2000);
    await Promise.resolve();
    await w.engine.syncNow();
    const after = { ...fileOf(w.google, w.ld, 'diagram', 'd1')! };
    expect(after.md5Checksum).not.toBe(before);
    expect(after.thumbnail).not.toBeNull();
    // A second edit a minute later waits for the 5-minute interval.
    w.clock.tick(DRIVE_WRITE_IDLE_MS);
    w.ld.edit('d1');
    w.clock.tick(DRIVE_WRITE_IDLE_MS);
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'diagram', 'd1')!.md5Checksum).toBe(after.md5Checksum);
    w.clock.tick(DRIVE_WRITE_MIN_INTERVAL_MS);
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'diagram', 'd1')!.md5Checksum).not.toBe(after.md5Checksum);
  });

  it('flushes a pending edit when the tab hides, ignoring idle and interval', async () => {
    const w = await mirrored();
    const before = fileOf(w.google, w.ld, 'diagram', 'd1')!.md5Checksum;
    w.clock.tick(1000);
    w.ld.edit('d1');
    await w.engine.onHidden();
    expect(fileOf(w.google, w.ld, 'diagram', 'd1')!.md5Checksum).not.toBe(before);
  });

  it('Diagram renamed: file renamed', async () => {
    const w = await mirrored();
    await w.ld.port().renameDiagram('d1', 'Roadmap');
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'diagram', 'd1')!.name).toBe('Roadmap.livediagram');
  });

  it('Diagram moved to another folder: file moved', async () => {
    const w = await mirrored();
    await w.ld.port().moveDiagram('d1', 'f2');
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'diagram', 'd1')!.parents).toEqual([
      fileOf(w.google, w.ld, 'folder', 'f2')!.id,
    ]);
  });

  it('Diagram deleted to Trash: file to the bin; restored: file restored', async () => {
    const w = await mirrored();
    await w.ld.port().trashDiagram('d1');
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'diagram', 'd1')!.trashed).toBe(true);
    await w.ld.port().restoreDiagram('d1');
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'diagram', 'd1')!.trashed).toBe(false);
  });

  it('Diagram restored from Trash: re-created if the file is gone', async () => {
    const w = await mirrored();
    await w.ld.port().trashDiagram('d1');
    await w.engine.syncNow();
    const oldId = w.ld.item('diagram', 'd1')!.driveFileId;
    w.google.userDeleteForever(oldId);
    // Drive's delete is read as `removed` while livediagram still has it in
    // the Trash, which purges it; restore before the next read instead.
    await w.ld.port().restoreDiagram('d1');
    await w.engine.flush();
    const file = fileOf(w.google, w.ld, 'diagram', 'd1')!;
    expect(file.id).not.toBe(oldId);
    expect(file.trashed).toBe(false);
  });

  it('Diagram purged from Trash: file deleted for good if still in the bin', async () => {
    const w = await mirrored();
    await w.ld.port().trashDiagram('d1');
    await w.engine.syncNow();
    const fileId = w.ld.item('diagram', 'd1')!.driveFileId;
    await w.ld.port().purgeDiagram('d1');
    expect(w.ld.item('diagram', 'd1')).toBeUndefined();
    await w.engine.syncNow();
    expect(w.google.get(fileId)).toBeUndefined();
  });

  it('Diagram moved into a team: file to the bin; moved back out: restored', async () => {
    const w = await mirrored();
    w.ld.moveIntoTeam('d1');
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'diagram', 'd1')!.trashed).toBe(true);
    w.ld.moveOutOfTeam('d1');
    await w.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'diagram', 'd1')!.trashed).toBe(false);
  });

  it('Diagram taken offline: the file goes to the bin', async () => {
    const w = await mirrored();
    const fileId = w.ld.item('diagram', 'd1')!.driveFileId;
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
    expect(fileOf(w.google, w.ld, 'diagram', 'd1')!).toMatchObject({
      parents: [root],
      trashed: false,
    });
    expect(fileOf(w.google, w.ld, 'folder', 'sub')!).toMatchObject({
      parents: [root],
      trashed: false,
    });
    expect(w.google.get(folderFile)!.trashed).toBe(true);
  });

  it('re-creates a file deleted outside livediagram when it next writes (404)', async () => {
    const w = await mirrored();
    const oldId = w.ld.item('diagram', 'd1')!.driveFileId;
    w.google.loseAccess(OWNER, oldId);
    await w.ld.port().renameDiagram('d1', 'Again');
    await w.engine.flush();
    const file = fileOf(w.google, w.ld, 'diagram', 'd1')!;
    expect(file.id).not.toBe(oldId);
    expect(file.name).toBe('Again.livediagram');
  });
});
