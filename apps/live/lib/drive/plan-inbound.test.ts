import { describe, expect, it } from 'vitest';
import type { DriveItem } from '@livediagram/api-schema';
import type { DriveChange, DriveFile } from './drive-client';
import { orderChanges, planAdoption, planInbound } from './plan-inbound';
import { buildSnapshot } from './snapshot';

// Each row of the spec's Inbound table as a pure decision
// (docs/specs/022-drive-mirror/drive-mirror.md, "Inbound: Drive to livediagram").

const HOST = 'livediagram.test';
const T = Date.parse('2026-09-28T12:00:00Z');

function item(over: Partial<DriveItem> = {}): DriveItem {
  return {
    kind: 'diagram',
    ldId: 'd1',
    driveFileId: 'file-d1',
    name: 'Plan.livediagram',
    ldName: 'Plan',
    parentId: 'root',
    trashed: false,
    md5: 'm1',
    headRevisionId: 'r1',
    mirroredSavedAt: T - 1000,
    notice: null,
    noticeParentId: null,
    ...over,
  };
}

const folderItem = item({
  kind: 'folder',
  ldId: 'f1',
  driveFileId: 'file-f1',
  name: 'Work',
  ldName: 'Work',
  md5: null,
  headRevisionId: null,
  mirroredSavedAt: null,
});

function file(over: Partial<DriveFile> = {}): DriveFile {
  return {
    id: 'file-d1',
    name: 'Plan.livediagram',
    mimeType: 'application/vnd.livediagram+json',
    parents: ['root'],
    trashed: false,
    appProperties: { ldDiagramId: 'd1', ldOrigin: HOST },
    md5Checksum: 'm1',
    headRevisionId: 'r1',
    ownedByMe: true,
    ...over,
  };
}

function change(f: DriveFile | null, over: Partial<DriveChange> = {}): DriveChange {
  return {
    fileId: f?.id ?? 'file-d1',
    removed: f === null,
    time: new Date(T).toISOString(),
    file: f,
    ...over,
  };
}

function snap(
  opts: {
    live?: boolean;
    trashed?: boolean;
    name?: string;
    folderId?: string | null;
    savedAt?: number;
    items?: DriveItem[];
  } = {},
) {
  return buildSnapshot({
    host: HOST,
    rootFolderId: 'root',
    diagrams:
      opts.live === false
        ? []
        : [
            {
              id: 'd1',
              name: opts.name ?? 'Plan',
              folderId: opts.folderId ?? null,
              savedAt: opts.savedAt ?? T - 60_000,
              createdAt: 0,
            },
          ],
    folders: [{ id: 'f1', name: 'Work', parentId: null, updatedAt: T - 60_000 }],
    trash: opts.trashed ? [{ id: 'd1', name: 'Plan', trashedAt: T - 5000 }] : [],
    items: opts.items ?? [item(), folderItem],
  });
}

describe('planInbound: diagrams', () => {
  it('treats a change matching the recorded state as an echo', () => {
    expect(planInbound(change(file()), snap())).toEqual({ kind: 'echo' });
  });

  it('renames the diagram, dropping the extension', () => {
    const d = planInbound(change(file({ name: 'Roadmap.livediagram' })), snap());
    expect(d).toMatchObject({
      kind: 'apply',
      effects: [{ kind: 'rename-diagram', id: 'd1', name: 'Roadmap' }],
      types: ['Rename'],
      record: { name: 'Roadmap.livediagram', ldName: 'Roadmap' },
    });
  });

  it('keeps the old name when the Drive name is empty once stripped', () => {
    const d = planInbound(change(file({ name: '.livediagram' })), snap());
    expect(d).toMatchObject({ kind: 'apply', effects: [] });
  });

  it('lets the later side win when both renamed', () => {
    // livediagram renamed to "Local" after Drive's change: livediagram wins.
    const localLater = planInbound(
      change(file({ name: 'Drive.livediagram' })),
      snap({ name: 'Local', savedAt: T + 1000 }),
    );
    expect(localLater).toMatchObject({ kind: 'apply', effects: [], record: { ldName: 'Drive' } });
    // Drive's rename is the later one: Drive wins.
    const driveLater = planInbound(
      change(file({ name: 'Drive.livediagram' })),
      snap({ name: 'Local', savedAt: T - 1000 }),
    );
    expect(driveLater).toMatchObject({ effects: [{ kind: 'rename-diagram', name: 'Drive' }] });
  });

  it('moves into a mirrored folder, or to Unsorted for the root', () => {
    expect(planInbound(change(file({ parents: ['file-f1'] })), snap())).toMatchObject({
      effects: [{ kind: 'move-diagram', folderId: 'f1' }],
      types: ['Move'],
    });
    const fromFolder = snap({ folderId: 'f1', items: [item({ parentId: 'file-f1' }), folderItem] });
    expect(planInbound(change(file({ parents: ['root'] })), fromFolder)).toMatchObject({
      effects: [{ kind: 'move-diagram', folderId: null }],
    });
  });

  it('moves to Unsorted with a notice for a folder livediagram cannot see, or none', () => {
    const d = planInbound(
      change(file({ parents: ['hidden'] })),
      snap({ folderId: 'f1', items: [item({ parentId: 'file-f1' }), folderItem] }),
    );
    expect(d).toMatchObject({
      effects: [{ kind: 'move-diagram', folderId: null }],
      types: ['UnknownFolder'],
      record: { notice: 'unseen_folder', noticeParentId: 'hidden', parentId: 'hidden' },
    });
    const outside = planInbound(change(file({ parents: [] })), snap());
    expect(outside).toMatchObject({ types: ['UnknownFolder'] });
  });

  it('trashes a live diagram binned in Drive', () => {
    expect(planInbound(change(file({ trashed: true })), snap())).toMatchObject({
      effects: [{ kind: 'trash-diagram', id: 'd1' }],
      types: ['Trash'],
    });
  });

  it('restores a trashed diagram and places it where its file sits', () => {
    const d = planInbound(
      change(file({ trashed: false, parents: ['file-f1'] })),
      snap({ live: false, trashed: true, items: [item({ trashed: true }), folderItem] }),
    );
    expect(d).toMatchObject({
      effects: [{ kind: 'restore-diagram' }, { kind: 'move-diagram', folderId: 'f1' }],
      types: ['Restore'],
    });
  });

  it('purges a trashed diagram whose file was deleted for good', () => {
    const d = planInbound(
      change(null),
      snap({ live: false, trashed: true, items: [item({ trashed: true }), folderItem] }),
    );
    expect(d).toMatchObject({ effects: [{ kind: 'purge-diagram', id: 'd1' }], types: ['Purge'] });
  });

  it('never deletes a live diagram whose file was removed; it forgets the file', () => {
    expect(planInbound(change(null), snap())).toMatchObject({ kind: 'forget' });
  });

  it('schedules a rewrite when the contents were edited in Drive', () => {
    const d = planInbound(change(file({ md5Checksum: 'other', headRevisionId: 'r9' })), snap());
    expect(d).toMatchObject({
      kind: 'apply',
      effects: [],
      record: { md5: 'other', mirroredSavedAt: 0 },
    });
  });

  it('records a change whose value livediagram already holds without applying it', () => {
    const d = planInbound(change(file({ name: 'Plan2.livediagram' })), snap({ name: 'Plan2' }));
    expect(d).toMatchObject({
      kind: 'apply',
      effects: [],
      record: { name: 'Plan2.livediagram', ldName: 'Plan2' },
    });
  });
});

describe('planInbound: folders', () => {
  const folderFile = (over: Partial<DriveFile> = {}) =>
    file({
      id: 'file-f1',
      name: 'Work',
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { ldFolderId: 'f1', ldOrigin: HOST },
      md5Checksum: null,
      headRevisionId: null,
      ...over,
    });

  it('renames and bins a mirrored folder', () => {
    expect(planInbound(change(folderFile({ name: 'Jobs' })), snap())).toMatchObject({
      effects: [{ kind: 'rename-folder', id: 'f1', name: 'Jobs' }],
    });
    expect(planInbound(change(folderFile({ trashed: true })), snap())).toMatchObject({
      effects: [{ kind: 'bin-folder', id: 'f1' }],
      types: ['Trash'],
    });
  });

  it('re-creates a folder deleted here and restored in Drive, under its Drive parent', () => {
    const noFolder = buildSnapshot({
      host: HOST,
      rootFolderId: 'root',
      diagrams: [],
      folders: [],
      trash: [],
      items: [],
    });
    const d = planInbound(change(folderFile({ name: 'Work' })), noFolder);
    expect(d).toMatchObject({
      effects: [
        { kind: 'recreate-folder', id: 'f1', name: 'Work', parentId: null, fileId: 'file-f1' },
      ],
      types: ['Restore'],
    });
  });
});

describe('planInbound: unrecorded files', () => {
  const empty = () =>
    buildSnapshot({
      host: HOST,
      rootFolderId: 'root',
      diagrams: [],
      folders: [],
      trash: [],
      items: [],
    });

  it('ignores files from other deployments, saying whether they carried appProperties', () => {
    expect(
      planInbound(
        change(file({ appProperties: { ldDiagramId: 'd1', ldOrigin: 'other.host' } })),
        empty(),
      ),
    ).toEqual({ kind: 'ignore', reason: 'not-ours', hadAppProperties: true });
    expect(planInbound(change(file({ appProperties: {} })), empty())).toEqual({
      kind: 'ignore',
      reason: 'not-ours',
      hadAppProperties: false,
    });
  });

  it('never makes a diagram from a file no diagram owns', () => {
    expect(planInbound(change(file()), empty())).toEqual({
      kind: 'ignore',
      reason: 'unrecorded-diagram',
    });
  });

  it('leaves a copy of a mirrored diagram alone: another file carrying its id', () => {
    // docs/specs/022-drive-mirror/drive-mirror.md, "Copies made in Drive": never applied,
    // re-tagged or adopted.
    const copy = file({ id: 'file-copy', name: 'Copy of Plan.livediagram', parents: ['file-f1'] });
    expect(planInbound(change(copy, { fileId: 'file-copy' }), snap())).toEqual({
      kind: 'ignore',
      reason: 'foreign-copy',
    });
    expect(
      planInbound(change({ ...copy, trashed: true }, { fileId: 'file-copy' }), snap()),
    ).toEqual({ kind: 'ignore', reason: 'foreign-copy' });
  });

  it('leaves an unrecorded file of a known diagram to the reconnect listing', () => {
    expect(planInbound(change(file({ id: 'other-file' })), snap({ items: [] }))).toEqual({
      kind: 'ignore',
      reason: 'unrecorded-diagram',
    });
  });
});

describe('planAdoption (a reconnect)', () => {
  it('adopts the one file of a known diagram, and known folders', () => {
    const folderFile = file({
      id: 'file-f1',
      name: 'Work',
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { ldFolderId: 'f1', ldOrigin: HOST },
      md5Checksum: null,
      headRevisionId: null,
    });
    const { adopt, ambiguous } = planAdoption(
      [file({ id: 'other-file' }), folderFile],
      snap({ items: [] }),
    );
    expect(adopt.map((i) => [i.kind, i.ldId, i.driveFileId])).toEqual([
      ['folder', 'f1', 'file-f1'],
      ['diagram', 'd1', 'other-file'],
    ]);
    expect(ambiguous).toEqual([]);
  });

  it('adopts neither of two files claiming one diagram: a copy is never the original', () => {
    const { adopt, ambiguous } = planAdoption(
      [file(), file({ id: 'file-copy', name: 'Copy of Plan.livediagram' })],
      snap({ items: [] }),
    );
    expect(adopt).toEqual([]);
    expect(ambiguous).toEqual(['d1']);
  });

  it('skips files of diagrams already recorded, unknown diagrams and other deployments', () => {
    expect(
      planAdoption(
        [
          file({ id: 'file-copy' }),
          file({ id: 'x', appProperties: { ldDiagramId: 'gone', ldOrigin: HOST } }),
          file({ id: 'y', appProperties: { ldDiagramId: 'd1', ldOrigin: 'other.host' } }),
        ],
        snap(),
      ),
    ).toEqual({ adopt: [], ambiguous: [] });
  });
});

describe('orderChanges', () => {
  it('puts folders first, then files, each by time', () => {
    const s = snap();
    const later = new Date(T + 5).toISOString();
    const ordered = orderChanges(
      [
        change(file(), { time: new Date(T + 1).toISOString() }),
        change(file({ id: 'file-f1' }), { fileId: 'file-f1', time: later }),
      ],
      s,
    );
    expect(ordered.map((c) => c.fileId)).toEqual(['file-f1', 'file-d1']);
  });
});
