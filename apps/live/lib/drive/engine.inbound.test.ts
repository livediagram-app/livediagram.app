import { describe, expect, it } from 'vitest';
import { FakeGoogle } from '@livediagram/fake-google';
import { DRIVE_FILE_MIME } from '@livediagram/api-schema';
import { DRIVE_WRITE_MIN_INTERVAL_MS } from './cadence';
import { fileOf, makeEngine, OWNER, world } from './test-support';

// Every row of the spec's Inbound table: the person changes things in
// Drive's own UI (the fake Google's `user*` calls), the next pass applies
// them to livediagram (docs/specs/022-drive-mirror/drive-mirror.md,
// "Inbound: Drive to livediagram").

async function mirrored(options: ConstructorParameters<typeof FakeGoogle>[0] = {}) {
  const w = world();
  if (options) Object.assign(w, { google: new FakeGoogle({ now: () => w.clock.now, ...options }) });
  const { engine, events, statuses } = makeEngine(w);
  w.ld.createFolderAs('f1', 'Work');
  w.ld.createFolderAs('f2', 'Other');
  w.ld.createDiagram('d1', 'Plan', 'f1');
  await engine.start();
  w.clock.tick(60_000);
  const file = () => fileOf(w.google, w.ld, 'diagram', 'd1')!;
  const folder = (id: string) => fileOf(w.google, w.ld, 'folder', id)!;
  return { ...w, engine, events, statuses, file, folder };
}

describe('inbound rows', () => {
  it('File renamed: diagram renamed, the extension dropped', async () => {
    const w = await mirrored();
    w.google.userRename(w.file().id, 'Roadmap.livedoc');
    await w.engine.syncNow();
    expect(w.ld.diagram('d1')!.name).toBe('Roadmap');
    expect(w.events).toContain('Applied:Rename');
  });

  it('File renamed to nothing: the old name stays, and Drive gets it back', async () => {
    const w = await mirrored();
    w.google.userRename(w.file().id, '.livedoc');
    await w.engine.syncNow();
    expect(w.ld.diagram('d1')!.name).toBe('Plan');
    expect(w.file().name).toBe('Plan.livedoc');
  });

  it('File moved to another mirrored folder: diagram moved', async () => {
    const w = await mirrored();
    w.google.userMove(w.file().id, w.folder('f2').id);
    await w.engine.syncNow();
    expect(w.ld.diagram('d1')!.folderId).toBe('f2');
    expect(w.events).toContain('Applied:Move');
  });

  it('File moved to the root folder: diagram to Unsorted', async () => {
    const w = await mirrored();
    w.google.userMove(w.file().id, w.ld.connection!.rootFolderId!);
    await w.engine.syncNow();
    expect(w.ld.diagram('d1')!.folderId).toBeNull();
  });

  it('File moved into a folder livediagram cannot see: Unsorted, a notice, and the file stays put', async () => {
    const w = await mirrored();
    const hidden = w.google.userCreateFolder(OWNER, 'Secret', w.ld.connection!.rootFolderId!);
    w.google.userMove(w.file().id, hidden);
    await w.engine.syncNow();
    expect(w.ld.diagram('d1')!.folderId).toBeNull();
    expect(w.ld.item('diagram', 'd1')).toMatchObject({
      notice: 'unseen_folder',
      noticeParentId: hidden,
    });
    expect(w.statuses.at(-1)!.notices).toEqual([
      { kind: 'diagram', ldId: 'd1', name: 'Plan', parentId: hidden },
    ]);
    expect(w.events).toContain('Applied:UnknownFolder');
    await w.engine.syncNow();
    expect(w.file().parents).toEqual([hidden]);
  });

  it('File moved outside the livediagram tree entirely: the same notice', async () => {
    const w = await mirrored();
    w.google.userMove(w.file().id, 'root');
    await w.engine.syncNow();
    expect(w.ld.diagram('d1')!.folderId).toBeNull();
    expect(w.ld.item('diagram', 'd1')!.notice).toBe('unseen_folder');
  });

  it('the notice clears when the diagram is moved again in livediagram, and the file follows', async () => {
    const w = await mirrored();
    const hidden = w.google.userCreateFolder(OWNER, 'Secret');
    w.google.userMove(w.file().id, hidden);
    await w.engine.syncNow();
    await w.ld.port().moveDiagram('d1', 'f2');
    await w.engine.syncNow();
    expect(w.ld.item('diagram', 'd1')!.notice).toBeNull();
    expect(w.file().parents).toEqual([w.folder('f2').id]);
  });

  it('File moved to the bin: diagram to Trash; restored: diagram restored', async () => {
    const w = await mirrored();
    w.google.userTrash(w.file().id);
    await w.engine.syncNow();
    expect(w.ld.diagram('d1')!.trashedAt).not.toBeNull();
    expect(w.events).toContain('Applied:Trash');
    w.google.userRestore(w.file().id);
    await w.engine.syncNow();
    expect(w.ld.diagram('d1')).toMatchObject({ trashedAt: null, folderId: 'f1' });
    expect(w.events).toContain('Applied:Restore');
  });

  it('File deleted for good (bin emptied): diagram purged from Trash', async () => {
    const w = await mirrored();
    w.google.userTrash(w.file().id);
    await w.engine.syncNow();
    w.google.userEmptyTrash(OWNER);
    await w.engine.syncNow();
    expect(w.ld.diagram('d1')).toBeUndefined();
    expect(w.ld.item('diagram', 'd1')).toBeUndefined();
    expect(w.events).toContain('Applied:Purge');
  });

  it('File contents edited in Drive: rewritten from livediagram', async () => {
    const w = await mirrored();
    w.google.userEditContent(w.file().id, '{"hacked":true}');
    await w.engine.syncNow();
    // Rewritten at the write cadence, like any other content write.
    w.clock.tick(DRIVE_WRITE_MIN_INTERVAL_MS);
    await w.engine.syncNow();
    expect(w.file().content).toContain('livediagram.diagram');
    expect(w.ld.diagram('d1')!.name).toBe('Plan');
  });

  it('Folder renamed and moved between mirrored folders: folder renamed and moved', async () => {
    const w = await mirrored();
    w.google.userRename(w.folder('f2').id, 'Archive');
    w.google.userMove(w.folder('f2').id, w.folder('f1').id);
    await w.engine.syncNow();
    expect(w.ld.folders.get('f2')).toMatchObject({ name: 'Archive', parentId: 'f1' });
  });

  for (const emitDescendantChanges of [true, false]) {
    it(`Folder to the bin: its diagrams to Trash and the folder removed; restoring it restores both (descendant changes: ${emitDescendantChanges})`, async () => {
      const w = await mirrored({ emitDescendantChanges });
      const folderFile = w.folder('f1').id;
      w.google.userTrash(folderFile);
      await w.engine.syncNow();
      expect(w.ld.folders.has('f1')).toBe(false);
      expect(w.ld.diagram('d1')!.trashedAt).not.toBeNull();
      expect(w.file().trashed).toBe(true);
      // Nothing re-mirrors the folder or explicitly bins the diagram meanwhile.
      await w.engine.syncNow();
      expect(w.google.get(folderFile)!.explicitlyTrashed).toBe(true);
      expect(w.file().explicitlyTrashed).toBe(false);

      w.google.userRestore(folderFile);
      await w.engine.syncNow();
      expect(w.ld.folders.get('f1')).toMatchObject({ name: 'Work', parentId: null });
      expect(w.ld.diagram('d1')).toMatchObject({ trashedAt: null, folderId: 'f1' });
      expect(w.ld.item('folder', 'f1')!.driveFileId).toBe(folderFile);
    });
  }
});

describe('echo suppression', () => {
  it('reads its own writes back without applying anything', async () => {
    const w = await mirrored();
    await w.ld.port().renameDiagram('d1', 'Mine');
    await w.ld.port().moveDiagram('d1', 'f2');
    await w.engine.syncNow();
    const writes = w.ld.writes;
    const renames = w.events.length;
    await w.engine.syncNow();
    expect(w.events.length).toBe(renames);
    // At most the page token and the item batch; never a diagram write.
    expect(w.ld.diagram('d1')).toMatchObject({ name: 'Mine', folderId: 'f2' });
    expect(w.ld.writes - writes).toBeLessThanOrEqual(1);
  });
});

describe('conflicts', () => {
  it('both sides renamed: the later change wins', async () => {
    const w = await mirrored();
    // Drive first, livediagram later: livediagram wins and Drive follows.
    w.google.userRename(w.file().id, 'Drive name.livedoc');
    w.clock.tick(1000);
    await w.ld.port().renameDiagram('d1', 'Local name');
    await w.engine.syncNow();
    expect(w.ld.diagram('d1')!.name).toBe('Local name');
    expect(w.file().name).toBe('Local name.livedoc');
  });

  it('both sides renamed, Drive later: Drive wins', async () => {
    const w = await mirrored();
    await w.ld.port().renameDiagram('d1', 'Local name');
    w.clock.tick(1000);
    w.google.userRename(w.file().id, 'Drive name.livedoc');
    await w.engine.syncNow();
    expect(w.ld.diagram('d1')!.name).toBe('Drive name');
    expect(w.file().name).toBe('Drive name.livedoc');
  });

  it('a rename made in Drive while away is applied before any outbound write', async () => {
    const w = await mirrored();
    w.engine.stop();
    w.google.userRename(w.file().id, 'Renamed while away.livedoc');
    w.clock.tick(3_600_000);
    const next = makeEngine(w);
    await next.engine.start();
    expect(w.ld.diagram('d1')!.name).toBe('Renamed while away');
    expect(w.file().name).toBe('Renamed while away.livedoc');
  });
});

describe('Open with files and foreign files', () => {
  it('ignores a livediagram file from another deployment in the change log', async () => {
    const w = await mirrored();
    const foreign = w.google.otherUserFile({
      owner: 'someone',
      name: 'Theirs.livedoc',
      mimeType: DRIVE_FILE_MIME,
      content: '{}',
      appProperties: { ldDiagramId: 'x', ldOrigin: 'other.host' },
      shareWith: OWNER,
    });
    w.google.grantAccess(OWNER, foreign);
    await w.engine.syncNow();
    expect(w.ld.diagrams.size).toBe(1);
  });
});
