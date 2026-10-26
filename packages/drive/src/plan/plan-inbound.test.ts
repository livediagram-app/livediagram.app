import { describe, expect, it } from 'vitest';
import { DRIVE_FOLDER_MIME } from '../constants';
import type { DriveChange, DriveFile } from '../server/drive-client';
import { LOCAL_NAME_MAX, orderChanges, planAdoption, planInbound } from './plan-inbound';
import { buildSnapshot } from './snapshot';
import type { DriveRow, MirrorFolder, MirrorItem, MirrorTrashed } from './types';

// Each row of the spec's Inbound table as a pure decision (liveworkspace/docs/specs/005-drive/drive.md "Inbound: Drive to
// liveworkspace").

const ORIGIN = 'https://liveworkspace.test';
const T = Date.parse('2026-09-28T12:00:00Z');

function itemRow(over: Partial<DriveRow> = {}): DriveRow {
  return {
    kind: 'item',
    id: 'i1',
    app: 'livediagram',
    driveFileId: 'file-i1',
    name: 'Plan.livediagram',
    localName: 'Plan',
    parentId: 'root',
    trashed: false,
    md5: 'm1',
    headRevisionId: 'r1',
    mirroredUpdatedAt: T - 1000,
    contentWrittenAt: T - 1000,
    notice: null,
    noticeParentId: null,
    ...over,
  };
}

function folderRow(over: Partial<DriveRow> = {}): DriveRow {
  return itemRow({
    kind: 'folder',
    id: 'f1',
    app: null,
    driveFileId: 'file-f1',
    name: 'Work',
    localName: 'Work',
    md5: null,
    headRevisionId: null,
    mirroredUpdatedAt: null,
    contentWrittenAt: null,
    ...over,
  });
}

function file(over: Partial<DriveFile> = {}): DriveFile {
  return {
    id: 'file-i1',
    name: 'Plan.livediagram',
    mimeType: 'application/vnd.livediagram+json',
    parents: ['root'],
    trashed: false,
    appProperties: { lwItemId: 'i1', lwApp: 'livediagram', lwOrigin: ORIGIN },
    md5Checksum: 'm1',
    headRevisionId: 'r1',
    ownedByMe: true,
    ...over,
  };
}

function folderFile(over: Partial<DriveFile> = {}): DriveFile {
  return file({
    id: 'file-f1',
    name: 'Work',
    mimeType: DRIVE_FOLDER_MIME,
    appProperties: { lwFolderId: 'f1', lwOrigin: ORIGIN },
    md5Checksum: null,
    headRevisionId: null,
    ...over,
  });
}

function change(f: DriveFile | null, over: Partial<DriveChange> = {}): DriveChange {
  return {
    fileId: f?.id ?? 'file-i1',
    removed: f === null,
    time: new Date(T).toISOString(),
    file: f,
    ...over,
  };
}

const liveItem = (over: Partial<MirrorItem> = {}): MirrorItem => ({
  id: 'i1',
  app: 'livediagram',
  name: 'Plan',
  folderId: null,
  updatedAt: T - 60_000,
  createdAt: 0,
  ...over,
});

const WORK: MirrorFolder = { id: 'f1', name: 'Work', parentId: null, updatedAt: T - 60_000 };

function snap(
  opts: {
    items?: MirrorItem[];
    trash?: MirrorTrashed[];
    folders?: MirrorFolder[];
    rows?: DriveRow[];
  } = {},
) {
  return buildSnapshot({
    origin: ORIGIN,
    rootFolderId: 'root',
    items: opts.items ?? [liveItem()],
    folders: opts.folders ?? [WORK],
    trash: opts.trash ?? [],
    rows: opts.rows ?? [itemRow(), folderRow()],
  });
}

const empty = () => snap({ items: [], folders: [], rows: [] });
const inTrash = (): MirrorTrashed => ({
  id: 'i1',
  app: 'livediagram',
  name: 'Plan',
  trashedAt: T - 5000,
});

describe('planInbound: items', () => {
  it('treats a change matching the recorded state as an echo', () => {
    expect(planInbound(change(file()), snap())).toEqual({ kind: 'echo' });
  });

  it('treats a change carrying only state outside the row (another app property) as an echo', () => {
    const f = file({
      appProperties: { lwItemId: 'i1', lwOrigin: ORIGIN, other: 'x' },
      ownedByMe: false,
    });
    expect(planInbound(change(f), snap())).toEqual({ kind: 'echo' });
  });

  it('renames the item, dropping the extension', () => {
    const d = planInbound(change(file({ name: 'Roadmap.livediagram' })), snap());
    expect(d).toMatchObject({
      kind: 'apply',
      effects: [{ kind: 'rename-item', id: 'i1', name: 'Roadmap' }],
      types: ['Rename'],
      record: { name: 'Roadmap.livediagram', localName: 'Roadmap' },
    });
  });

  it('drops any app’s extension, and none at all', () => {
    expect(planInbound(change(file({ name: 'Roadmap.liveplanner' })), snap())).toMatchObject({
      effects: [{ kind: 'rename-item', name: 'Roadmap' }],
    });
    expect(planInbound(change(file({ name: 'Roadmap' })), snap())).toMatchObject({
      effects: [{ kind: 'rename-item', name: 'Roadmap' }],
    });
  });

  it('cuts a long Drive name to the index’s ceiling', () => {
    const d = planInbound(change(file({ name: `${'x'.repeat(500)}.livediagram` })), snap());
    expect(d).toMatchObject({
      effects: [{ kind: 'rename-item', name: 'x'.repeat(LOCAL_NAME_MAX) }],
    });
  });

  it('keeps the old name when the Drive name is empty once stripped', () => {
    const d = planInbound(change(file({ name: '.livediagram' })), snap());
    expect(d).toMatchObject({
      kind: 'apply',
      effects: [],
      types: [],
      record: { name: '.livediagram', localName: 'Plan' },
    });
  });

  it('lets the later side win when both renamed', () => {
    // Renamed to "Local" here after Drive's change: liveworkspace wins, and Drive's name is recorded so outbound
    // renames it back.
    const localLater = planInbound(
      change(file({ name: 'Drive.livediagram' })),
      snap({ items: [liveItem({ name: 'Local', updatedAt: T + 1000 })] }),
    );
    expect(localLater).toMatchObject({
      kind: 'apply',
      effects: [],
      record: { localName: 'Drive' },
    });
    // Drive's rename is the later one: Drive wins.
    const driveLater = planInbound(
      change(file({ name: 'Drive.livediagram' })),
      snap({ items: [liveItem({ name: 'Local', updatedAt: T - 1000 })] }),
    );
    expect(driveLater).toMatchObject({ effects: [{ kind: 'rename-item', name: 'Drive' }] });
  });

  it('moves into a mirrored folder, or to the top level for the root', () => {
    expect(planInbound(change(file({ parents: ['file-f1'] })), snap())).toMatchObject({
      effects: [{ kind: 'move-item', id: 'i1', folderId: 'f1' }],
      types: ['Move'],
      record: { parentId: 'file-f1', notice: null },
    });
    const fromFolder = snap({
      items: [liveItem({ folderId: 'f1' })],
      rows: [itemRow({ parentId: 'file-f1' }), folderRow()],
    });
    expect(planInbound(change(file({ parents: ['root'] })), fromFolder)).toMatchObject({
      effects: [{ kind: 'move-item', folderId: null }],
      types: ['Move'],
    });
  });

  it('lets the later side win when both moved', () => {
    const OTHER: MirrorFolder = { id: 'f2', name: 'Other', parentId: null, updatedAt: T - 60_000 };
    const rows = [
      itemRow(),
      folderRow(),
      folderRow({ id: 'f2', driveFileId: 'file-f2', name: 'Other', localName: 'Other' }),
    ];
    // Moved into f2 here after Drive moved it into f1: liveworkspace wins.
    const localLater = planInbound(
      change(file({ parents: ['file-f1'] })),
      snap({
        folders: [WORK, OTHER],
        rows,
        items: [liveItem({ folderId: 'f2', updatedAt: T + 1000 })],
      }),
    );
    expect(localLater).toMatchObject({
      kind: 'apply',
      effects: [],
      record: { parentId: 'file-f1' },
    });
    const driveLater = planInbound(
      change(file({ parents: ['file-f1'] })),
      snap({
        folders: [WORK, OTHER],
        rows,
        items: [liveItem({ folderId: 'f2', updatedAt: T - 1000 })],
      }),
    );
    expect(driveLater).toMatchObject({
      effects: [{ kind: 'move-item', folderId: 'f1' }],
      types: ['Move'],
    });
  });

  it('moves to the top level with a notice for a folder liveworkspace cannot see, or none', () => {
    const d = planInbound(
      change(file({ parents: ['hidden'] })),
      snap({
        items: [liveItem({ folderId: 'f1' })],
        rows: [itemRow({ parentId: 'file-f1' }), folderRow()],
      }),
    );
    expect(d).toMatchObject({
      effects: [{ kind: 'move-item', folderId: null }],
      types: ['UnknownFolder'],
      record: { notice: 'unseen_folder', noticeParentId: 'hidden', parentId: 'hidden' },
    });
    const outside = planInbound(change(file({ parents: [] })), snap());
    expect(outside).toMatchObject({
      types: ['UnknownFolder'],
      record: { parentId: null, noticeParentId: null },
    });
  });

  it('clears the notice when the file moves from an unseen folder into a mirrored one', () => {
    const noticed = snap({
      rows: [
        itemRow({ parentId: 'hidden', notice: 'unseen_folder', noticeParentId: 'hidden' }),
        folderRow(),
      ],
    });
    expect(planInbound(change(file({ parents: ['file-f1'] })), noticed)).toMatchObject({
      effects: [{ kind: 'move-item', folderId: 'f1' }],
      types: ['Move'],
      record: { parentId: 'file-f1', notice: null, noticeParentId: null },
    });
  });

  it('takes a folder whose row outlives it (deleted here) as unseen', () => {
    const d = planInbound(
      change(file({ parents: ['file-f1'] })),
      snap({ folders: [], rows: [itemRow(), folderRow()] }),
    );
    expect(d).toMatchObject({ types: ['UnknownFolder'], record: { notice: 'unseen_folder' } });
  });

  it('trashes a live item binned in Drive, and nothing more', () => {
    expect(
      planInbound(change(file({ trashed: true, name: 'Other.livediagram' })), snap()),
    ).toMatchObject({
      effects: [{ kind: 'trash-item', id: 'i1' }],
      types: ['Trash'],
      record: { trashed: true, name: 'Other.livediagram' },
    });
  });

  it('records a bin of a file whose item is already in the Trash, applying nothing', () => {
    const d = planInbound(
      change(file({ trashed: true })),
      snap({ items: [], trash: [inTrash()], rows: [itemRow(), folderRow()] }),
    );
    expect(d).toMatchObject({ kind: 'apply', effects: [], types: [], record: { trashed: true } });
  });

  it('restores a trashed item and places it where its file sits', () => {
    const d = planInbound(
      change(file({ trashed: false, parents: ['file-f1'] })),
      snap({ items: [], trash: [inTrash()], rows: [itemRow({ trashed: true }), folderRow()] }),
    );
    expect(d).toMatchObject({
      effects: [
        { kind: 'restore-item', id: 'i1' },
        { kind: 'move-item', folderId: 'f1' },
      ],
      types: ['Restore'],
    });
  });

  it('restores to the top level when the file sits in the root, or with a notice in an unseen folder', () => {
    const trashed = () =>
      snap({ items: [], trash: [inTrash()], rows: [itemRow({ trashed: true }), folderRow()] });
    expect(planInbound(change(file()), trashed())).toMatchObject({
      effects: [{ kind: 'restore-item' }, { kind: 'move-item', folderId: null }],
      types: ['Restore'],
    });
    expect(planInbound(change(file({ parents: ['hidden'] })), trashed())).toMatchObject({
      effects: [{ kind: 'restore-item' }, { kind: 'move-item', folderId: null }],
      types: ['Restore', 'UnknownFolder'],
      record: { notice: 'unseen_folder', noticeParentId: 'hidden' },
    });
  });

  it('restores and renames together when the file came back under a new name', () => {
    const d = planInbound(
      change(file({ name: 'Back.livediagram' })),
      snap({ items: [], trash: [inTrash()], rows: [itemRow({ trashed: true }), folderRow()] }),
    );
    expect(d).toMatchObject({
      effects: [
        { kind: 'restore-item' },
        { kind: 'rename-item', name: 'Back' },
        { kind: 'move-item' },
      ],
      types: ['Restore', 'Rename'],
    });
  });

  it('records an un-bin of a file whose item left the person’s work (purged or in a team), applying nothing', () => {
    const d = planInbound(
      change(file()),
      snap({ items: [], rows: [itemRow({ trashed: true }), folderRow()] }),
    );
    expect(d).toEqual({
      kind: 'apply',
      effects: [],
      types: [],
      record: expect.objectContaining({ trashed: false }),
    });
  });

  it('purges a trashed item whose file was deleted for good', () => {
    const d = planInbound(
      change(null),
      snap({ items: [], trash: [inTrash()], rows: [itemRow({ trashed: true }), folderRow()] }),
    );
    expect(d).toMatchObject({ effects: [{ kind: 'purge-item', id: 'i1' }], types: ['Purge'] });
  });

  it('never deletes a live item whose file was removed; it forgets the file', () => {
    expect(planInbound(change(null), snap())).toMatchObject({
      kind: 'forget',
      reason: 'removed',
      row: { id: 'i1' },
    });
    // `removed` with the file still attached reads the same.
    expect(planInbound(change(file(), { removed: true }), snap())).toMatchObject({
      kind: 'forget',
    });
  });

  it('forgets the row of an item gone from both lists once Drive empties its bin', () => {
    expect(
      planInbound(change(null), snap({ items: [], rows: [itemRow({ trashed: true })] })),
    ).toMatchObject({
      kind: 'forget',
    });
  });

  it('schedules a rewrite when the contents were edited in Drive', () => {
    const d = planInbound(change(file({ md5Checksum: 'other', headRevisionId: 'r9' })), snap());
    expect(d).toMatchObject({
      kind: 'apply',
      effects: [],
      types: [],
      record: { md5: 'other', headRevisionId: 'r9', mirroredUpdatedAt: 0 },
    });
  });

  it('takes a new revision alone as a content edit', () => {
    expect(planInbound(change(file({ headRevisionId: 'r2' })), snap())).toMatchObject({
      record: { mirroredUpdatedAt: 0 },
    });
  });

  it('records contents seen before the row knew any, without scheduling a rewrite', () => {
    const d = planInbound(
      change(file()),
      snap({ rows: [itemRow({ md5: null, headRevisionId: null }), folderRow()] }),
    );
    expect(d).toMatchObject({
      kind: 'apply',
      effects: [],
      record: { md5: 'm1', mirroredUpdatedAt: T - 1000 },
    });
  });

  it('records a change whose value liveworkspace already holds without applying it', () => {
    const d = planInbound(
      change(file({ name: 'Plan2.livediagram' })),
      snap({ items: [liveItem({ name: 'Plan2' })] }),
    );
    expect(d).toMatchObject({
      kind: 'apply',
      effects: [],
      record: { name: 'Plan2.livediagram', localName: 'Plan2' },
    });
    const sameFolder = planInbound(
      change(file({ parents: ['file-f1'] })),
      snap({ items: [liveItem({ folderId: 'f1' })] }),
    );
    expect(sameFolder).toMatchObject({
      kind: 'apply',
      effects: [],
      types: [],
      record: { parentId: 'file-f1' },
    });
  });

  it('never changes the row it was given', () => {
    const row = itemRow();
    const s = snap({ rows: [row, folderRow()] });
    planInbound(
      change(file({ name: 'New.livediagram', md5Checksum: 'x', parents: ['hidden'] })),
      s,
    );
    expect(row).toEqual(itemRow());
  });
});

describe('planInbound: folders', () => {
  it('treats a matching change as an echo', () => {
    expect(planInbound(change(folderFile()), snap())).toEqual({ kind: 'echo' });
  });

  it('renames and bins a mirrored folder', () => {
    expect(planInbound(change(folderFile({ name: 'Jobs' })), snap())).toMatchObject({
      effects: [{ kind: 'rename-folder', id: 'f1', name: 'Jobs' }],
      types: ['Rename'],
      record: { name: 'Jobs', localName: 'Jobs', md5: null, headRevisionId: null },
    });
    expect(planInbound(change(folderFile({ trashed: true })), snap())).toMatchObject({
      effects: [{ kind: 'bin-folder', id: 'f1' }],
      types: ['Trash'],
    });
  });

  it('lets the later side win when both renamed a folder', () => {
    const local = (updatedAt: number) => snap({ folders: [{ ...WORK, name: 'Local', updatedAt }] });
    expect(planInbound(change(folderFile({ name: 'Drive' })), local(T + 1000))).toMatchObject({
      effects: [],
    });
    expect(planInbound(change(folderFile({ name: 'Drive' })), local(T - 1000))).toMatchObject({
      effects: [{ kind: 'rename-folder', name: 'Drive' }],
    });
  });

  it('moves a folder between mirrored folders, and back to the top level', () => {
    const OTHER: MirrorFolder = { id: 'f2', name: 'Other', parentId: null, updatedAt: T - 60_000 };
    const rows = [
      itemRow(),
      folderRow(),
      folderRow({ id: 'f2', driveFileId: 'file-f2', name: 'Other', localName: 'Other' }),
    ];
    expect(
      planInbound(
        change(folderFile({ parents: ['file-f2'] })),
        snap({ folders: [WORK, OTHER], rows }),
      ),
    ).toMatchObject({
      effects: [{ kind: 'move-folder', id: 'f1', parentId: 'f2' }],
      types: ['Move'],
    });
    const nested = snap({
      folders: [{ ...WORK, parentId: 'f2' }, OTHER],
      rows: [itemRow(), folderRow({ parentId: 'file-f2' }), rows[2]!],
    });
    expect(planInbound(change(folderFile({ parents: ['root'] })), nested)).toMatchObject({
      effects: [{ kind: 'move-folder', id: 'f1', parentId: null }],
      types: ['Move'],
    });
  });

  it('moves a folder put in an unseen folder to the top level with a notice', () => {
    const OTHER: MirrorFolder = { id: 'f2', name: 'Other', parentId: null, updatedAt: T - 60_000 };
    const nested = snap({
      folders: [{ ...WORK, parentId: 'f2' }, OTHER],
      rows: [folderRow({ parentId: 'file-f2' }), folderRow({ id: 'f2', driveFileId: 'file-f2' })],
    });
    expect(planInbound(change(folderFile({ parents: ['hidden'] })), nested)).toMatchObject({
      effects: [{ kind: 'move-folder', id: 'f1', parentId: null }],
      types: ['UnknownFolder'],
      record: { notice: 'unseen_folder', noticeParentId: 'hidden' },
    });
    // Already at the top level: only the notice.
    expect(planInbound(change(folderFile({ parents: ['hidden'] })), snap())).toMatchObject({
      effects: [],
      types: ['UnknownFolder'],
      record: { notice: 'unseen_folder' },
    });
  });

  it('never moves a folder into itself', () => {
    expect(planInbound(change(folderFile({ parents: ['file-f1'] })), snap())).toMatchObject({
      effects: [],
      types: [],
    });
  });

  it('re-creates a folder deleted here and restored in Drive, under its Drive parent', () => {
    const d = planInbound(change(folderFile({ name: 'Work' })), empty());
    expect(d).toEqual({
      kind: 'apply',
      effects: [
        { kind: 'recreate-folder', id: 'f1', name: 'Work', parentId: null, fileId: 'file-f1' },
      ],
      record: expect.objectContaining({
        kind: 'folder',
        id: 'f1',
        app: null,
        driveFileId: 'file-f1',
        localName: 'Work',
      }),
      types: ['Restore'],
    });
    const under = planInbound(
      change(folderFile({ parents: ['file-f2'], name: '' })),
      snap({
        items: [],
        folders: [{ ...WORK, id: 'f2' }],
        rows: [folderRow({ id: 'f2', driveFileId: 'file-f2' })],
      }),
    );
    expect(under).toMatchObject({
      effects: [{ kind: 'recreate-folder', parentId: 'f2', name: 'Folder' }],
    });
  });

  it('never re-creates a folder deleted here whose row is still pending', () => {
    const pending = snap({ items: [], folders: [], rows: [folderRow()] });
    expect(planInbound(change(folderFile({ name: 'Work' })), pending)).toEqual({
      kind: 'ignore',
      reason: 'deleted-here',
    });
    expect(planInbound(change(null, { fileId: 'file-f1' }), pending)).toEqual({
      kind: 'ignore',
      reason: 'deleted-here',
    });
  });

  it('ignores a binned folder it holds no row for', () => {
    expect(planInbound(change(folderFile({ trashed: true })), empty())).toEqual({
      kind: 'ignore',
      reason: 'binned-folder',
    });
  });

  it('adopts the file of a known folder it holds no row for, as Drive has it', () => {
    const d = planInbound(change(folderFile({ name: 'Jobs' })), snap({ rows: [] }));
    expect(d).toMatchObject({
      kind: 'adopt',
      row: {
        kind: 'folder',
        id: 'f1',
        driveFileId: 'file-f1',
        name: 'Jobs',
        localName: 'Jobs',
        mirroredUpdatedAt: null,
      },
    });
    // A name emptied in Drive adopts under the folder's own name.
    expect(planInbound(change(folderFile({ name: ' ' })), snap({ rows: [] }))).toMatchObject({
      row: { localName: 'Work' },
    });
  });

  it('ignores a second Drive folder claiming a mirrored folder', () => {
    const d = planInbound(
      change(folderFile({ id: 'file-f1-copy' }), { fileId: 'file-f1-copy' }),
      snap(),
    );
    expect(d).toEqual({ kind: 'ignore', reason: 'duplicate' });
  });
});

describe('planInbound: unrecorded files', () => {
  it('ignores files from other environments, or with no appProperties', () => {
    expect(
      planInbound(
        change(file({ appProperties: { lwItemId: 'i1', lwOrigin: 'https://other.test' } })),
        empty(),
      ),
    ).toEqual({ kind: 'ignore', reason: 'not-ours' });
    expect(planInbound(change(file({ appProperties: {} })), empty())).toEqual({
      kind: 'ignore',
      reason: 'not-ours',
    });
  });

  it('ignores a file someone else owns, however it is tagged', () => {
    const folder = folderFile({ id: 'theirs', ownedByMe: false });
    expect(planInbound(change(folder, { fileId: 'theirs' }), empty())).toEqual({
      kind: 'ignore',
      reason: 'not-ours',
    });
    const { adopt } = planAdoption(
      [file({ id: 'their-file', ownedByMe: false }), folder],
      snap({ rows: [] }),
    );
    expect(adopt).toEqual([]);
  });

  it('leaves the root to the service', () => {
    const root = file({
      id: 'root',
      name: 'Renamed',
      appProperties: { lwRoot: ORIGIN, lwOrigin: ORIGIN },
    });
    expect(planInbound(change(root, { fileId: 'root' }), empty())).toEqual({
      kind: 'ignore',
      reason: 'root',
    });
  });

  it('ignores a removed file it never knew', () => {
    expect(planInbound(change(null, { fileId: 'stranger' }), empty())).toEqual({
      kind: 'ignore',
      reason: 'unknown-removed',
    });
  });

  it('never makes an item from a file no item owns', () => {
    expect(planInbound(change(file()), empty())).toEqual({
      kind: 'ignore',
      reason: 'unrecorded-item',
    });
  });

  it('ignores a file of ours that carries neither id', () => {
    expect(planInbound(change(file({ appProperties: { lwOrigin: ORIGIN } })), empty())).toEqual({
      kind: 'ignore',
      reason: 'unrecorded',
    });
  });

  it('leaves a copy of a mirrored item alone: another file carrying its id', () => {
    // Copies made in Drive: never applied, re-tagged or adopted.
    const copy = file({ id: 'file-copy', name: 'Copy of Plan.livediagram', parents: ['file-f1'] });
    expect(planInbound(change(copy, { fileId: 'file-copy' }), snap())).toEqual({
      kind: 'ignore',
      reason: 'foreign-copy',
    });
    expect(
      planInbound(change({ ...copy, trashed: true }, { fileId: 'file-copy' }), snap()),
    ).toEqual({
      kind: 'ignore',
      reason: 'foreign-copy',
    });
  });

  it('leaves an unrecorded file of a known item to the reconnect listing', () => {
    expect(
      planInbound(change(file({ id: 'other-file' }), { fileId: 'other-file' }), snap({ rows: [] })),
    ).toEqual({
      kind: 'ignore',
      reason: 'unrecorded-item',
    });
  });
});

describe('planAdoption (a reconnect)', () => {
  it('adopts the one file of a known item, and known folders', () => {
    const { adopt, ambiguous } = planAdoption(
      [file({ id: 'other-file' }), folderFile()],
      snap({ rows: [] }),
    );
    expect(adopt.map((r) => [r.kind, r.id, r.app, r.driveFileId, r.localName])).toEqual([
      ['folder', 'f1', null, 'file-f1', 'Work'],
      ['item', 'i1', 'livediagram', 'other-file', 'Plan'],
    ]);
    expect(adopt[1]).toMatchObject({
      mirroredUpdatedAt: null,
      contentWrittenAt: null,
      md5: 'm1',
      parentId: 'root',
    });
    expect(ambiguous).toEqual([]);
  });

  it('adopts the file of an item in the Trash, under the item’s app', () => {
    const { adopt } = planAdoption(
      [file({ name: '.livediagram', trashed: true })],
      snap({ items: [], trash: [{ ...inTrash(), app: 'liveplanner', name: 'Kept' }], rows: [] }),
    );
    expect(adopt).toEqual([
      expect.objectContaining({
        kind: 'item',
        id: 'i1',
        app: 'liveplanner',
        localName: 'Kept',
        trashed: true,
      }),
    ]);
  });

  it('adopts neither of two files claiming one item: a copy is never the original', () => {
    const { adopt, ambiguous } = planAdoption(
      [file(), file({ id: 'file-copy', name: 'Copy of Plan.livediagram' })],
      snap({ rows: [] }),
    );
    expect(adopt).toEqual([]);
    expect(ambiguous).toEqual(['i1']);
  });

  it('skips files of items already recorded, unknown items, other environments and unknown folders', () => {
    expect(
      planAdoption(
        [
          file({ id: 'file-copy' }),
          file({ id: 'x', appProperties: { lwItemId: 'gone', lwOrigin: ORIGIN } }),
          file({ id: 'y', appProperties: { lwItemId: 'i1', lwOrigin: 'https://other.test' } }),
          file({ id: 'z', appProperties: { lwOrigin: ORIGIN } }),
          folderFile({
            id: 'file-f9',
            appProperties: { lwFolderId: 'f9', lwOrigin: ORIGIN },
            trashed: true,
          }),
          folderFile({ id: 'file-f1-copy' }),
        ],
        snap(),
      ),
    ).toEqual({ adopt: [], ambiguous: [] });
  });
});

describe('orderChanges', () => {
  const at = (ms: number) => new Date(T + ms).toISOString();

  it('puts folders first, then files, each by time', () => {
    const ordered = orderChanges(
      [
        change(file(), { time: at(1) }),
        change(folderFile(), { fileId: 'file-f1', time: at(5) }),
        change(file({ id: 'file-i2' }), { fileId: 'file-i2', time: at(0) }),
        change(folderFile({ id: 'file-f2' }), { fileId: 'file-f2', time: at(3) }),
      ],
      snap(),
    );
    expect(ordered.map((c) => c.fileId)).toEqual(['file-f2', 'file-f1', 'file-i2', 'file-i1']);
  });

  it('knows a recorded folder by its row even when Drive reports it removed', () => {
    const ordered = orderChanges(
      [change(file(), { time: at(0) }), change(null, { fileId: 'file-f1', time: at(9) })],
      snap(),
    );
    expect(ordered.map((c) => c.fileId)).toEqual(['file-f1', 'file-i1']);
  });

  it('keeps one entry per file, the latest', () => {
    const ordered = orderChanges(
      [
        change(file({ name: 'B.livediagram' }), { time: at(2) }),
        change(file({ name: 'A.livediagram' }), { time: at(1) }),
        change(file({ name: 'C.livediagram' }), { time: at(2) }),
      ],
      snap(),
    );
    expect(ordered).toHaveLength(1);
    // The last of equal times wins.
    expect(ordered[0]!.file!.name).toBe('C.livediagram');
  });

  it('answers nothing for nothing', () => {
    expect(orderChanges([], snap())).toEqual([]);
  });
});
