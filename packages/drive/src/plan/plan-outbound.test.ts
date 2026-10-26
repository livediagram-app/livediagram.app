import { describe, expect, it } from 'vitest';
import { DRIVE_ITEM_MIN_WRITE_INTERVAL_MS } from '../constants';
import { planOutbound, type OutboundOp } from './plan-outbound';
import { buildSnapshot } from './snapshot';
import type { DriveRow, MirrorFolder, MirrorItem, MirrorTrashed } from './types';

// Each row of the spec's Outbound table as a pure plan (liveworkspace/docs/specs/005-drive/drive.md "Outbound: liveworkspace to
// Drive").

const ORIGIN = 'https://liveworkspace.test';
const NOW = 1_800_000_000_000;
const INTERVAL = DRIVE_ITEM_MIN_WRITE_INTERVAL_MS;

const item = (id: string, over: Partial<MirrorItem> = {}): MirrorItem => ({
  id,
  app: 'livediagram',
  name: id.toUpperCase(),
  folderId: null,
  updatedAt: NOW - 10 * INTERVAL,
  createdAt: 0,
  ...over,
});

const folder = (
  id: string,
  parentId: string | null = null,
  over: Partial<MirrorFolder> = {},
): MirrorFolder => ({
  id,
  name: id.toUpperCase(),
  parentId,
  updatedAt: 0,
  ...over,
});

// The row of an item mirrored as it stands (`it`), in the Drive folder `parentId`.
const itemRow = (it: MirrorItem, parentId = 'root', over: Partial<DriveRow> = {}): DriveRow => ({
  kind: 'item',
  id: it.id,
  app: it.app,
  driveFileId: `file-${it.id}`,
  name: `${it.name}.livediagram`,
  localName: it.name,
  parentId,
  trashed: false,
  md5: 'm',
  headRevisionId: 'r',
  mirroredUpdatedAt: it.updatedAt,
  contentWrittenAt: it.updatedAt,
  notice: null,
  noticeParentId: null,
  ...over,
});

const folderRow = (f: MirrorFolder, parentId = 'root', over: Partial<DriveRow> = {}): DriveRow => ({
  kind: 'folder',
  id: f.id,
  app: null,
  driveFileId: `file-${f.id}`,
  name: f.name,
  localName: f.name,
  parentId,
  trashed: false,
  md5: null,
  headRevisionId: null,
  mirroredUpdatedAt: null,
  contentWrittenAt: null,
  notice: null,
  noticeParentId: null,
  ...over,
});

function plan(
  input: {
    items?: MirrorItem[];
    folders?: MirrorFolder[];
    trash?: MirrorTrashed[];
    rows?: DriveRow[];
  },
  opts: { now?: number; flush?: boolean; writeIntervalMs?: number } = {},
) {
  const snapshot = buildSnapshot({
    origin: ORIGIN,
    rootFolderId: 'root',
    items: input.items ?? [],
    folders: input.folders ?? [],
    trash: input.trash ?? [],
    rows: input.rows ?? [],
  });
  return planOutbound(snapshot, { now: NOW, flush: false, writeIntervalMs: INTERVAL, ...opts });
}

// A compact view of a plan: op and the id it acts on.
const summary = (ops: OutboundOp[]) =>
  ops.map((o) => {
    switch (o.op) {
      case 'create-folder':
      case 'update-folder':
        return `${o.op}:${o.folder.id}`;
      case 'create-file':
      case 'update-file':
        return `${o.op}:${o.item.id}`;
      default:
        return `${o.op}:${o.row.id}`;
    }
  });

describe('planOutbound: a first mirror', () => {
  it('creates the folder tree parents first, then every item oldest first', () => {
    // Listed children first and out of id order, so the order comes from the plan, not the input.
    const folders = [folder('c', 'b'), folder('b', 'a'), folder('z'), folder('a')];
    const items = [
      item('new', { createdAt: 2 }),
      item('old', { createdAt: 1, folderId: 'c' }),
      item('mid', { createdAt: 1 }),
    ];
    const { ops, nextDueAt } = plan({ items, folders });
    expect(summary(ops)).toEqual([
      'create-folder:a',
      'create-folder:z',
      'create-folder:b',
      'create-folder:c',
      'create-file:mid',
      'create-file:old',
      'create-file:new',
    ]);
    expect(nextDueAt).toBeNull();
  });

  it('survives a folder cycle without looping', () => {
    const { ops } = plan({ folders: [folder('a', 'b'), folder('b', 'a')] });
    expect(summary(ops).toSorted()).toEqual(['create-folder:a', 'create-folder:b']);
  });

  it('plans nothing when both sides already match', () => {
    const f = folder('f');
    const it = item('i', { folderId: 'f' });
    expect(
      plan({ items: [it], folders: [f], rows: [folderRow(f), itemRow(it, 'file-f')] }),
    ).toEqual({
      ops: [],
      nextDueAt: null,
    });
  });
});

describe('planOutbound: folders', () => {
  it('renames, moves and untrashes a mirrored folder', () => {
    const a = folder('a');
    const b = folder('b');
    const renamed = plan({ folders: [{ ...a, name: 'New' }], rows: [folderRow(a)] });
    expect(renamed.ops).toEqual([
      {
        op: 'update-folder',
        folder: { ...a, name: 'New' },
        row: folderRow(a),
        rename: true,
        move: false,
        untrash: false,
      },
    ]);
    const moved = plan({
      folders: [{ ...a, parentId: 'b' }, b],
      rows: [folderRow(a), folderRow(b)],
    });
    expect(moved.ops).toEqual([
      expect.objectContaining({ op: 'update-folder', rename: false, move: true, untrash: false }),
    ]);
    const binned = plan({ folders: [a], rows: [folderRow(a, 'root', { trashed: true })] });
    expect(binned.ops).toEqual([
      expect.objectContaining({ op: 'update-folder', untrash: true, rename: false, move: false }),
    ]);
  });

  it('gives back a folder name emptied in Drive', () => {
    const a = folder('a');
    const { ops } = plan({ folders: [a], rows: [folderRow(a, 'root', { name: '  ' })] });
    expect(ops).toEqual([expect.objectContaining({ op: 'update-folder', rename: true })]);
  });

  it('waits to move a folder whose new parent is not mirrored yet: it is created first this pass', () => {
    const a = folder('a', 'new');
    const { ops } = plan({ folders: [a, folder('new')], rows: [folderRow(a)] });
    // The parent's create comes first; the move waits for the next pass, when its row exists.
    expect(summary(ops)).toEqual(['create-folder:new']);
  });

  it('leaves a top-level folder where the person put it in an unseen Drive folder', () => {
    const a = folder('a');
    const row = folderRow(a, 'hidden', { notice: 'unseen_folder', noticeParentId: 'hidden' });
    expect(plan({ folders: [a], rows: [row] }).ops).toEqual([]);
  });

  it('bins the Drive folder of a folder deleted here, last', () => {
    const gone = folder('gone');
    const it = item('i');
    const old = item('old');
    const { ops } = plan({
      items: [it],
      folders: [],
      rows: [folderRow(gone), itemRow(old)],
    });
    expect(summary(ops)).toEqual(['create-file:i', 'trash-file:old', 'bin-folder:gone']);
    expect(ops.at(-1)).toEqual({ op: 'bin-folder', row: folderRow(gone) });
  });

  it('bins a deleted folder even when its Drive folder is already in the bin', () => {
    const gone = folder('gone');
    expect(summary(plan({ rows: [folderRow(gone, 'root', { trashed: true })] }).ops)).toEqual([
      'bin-folder:gone',
    ]);
  });
});

describe('planOutbound: items', () => {
  it('renames, moves and untrashes a mirrored item without touching its contents', () => {
    const f = folder('f');
    const it = item('i');
    const rows = [folderRow(f), itemRow(it)];
    const renamed = plan({ items: [{ ...it, name: 'New' }], folders: [f], rows });
    expect(renamed.ops).toEqual([
      expect.objectContaining({
        op: 'update-file',
        rename: true,
        move: false,
        untrash: false,
        content: false,
      }),
    ]);
    const moved = plan({ items: [{ ...it, folderId: 'f' }], folders: [f], rows });
    expect(moved.ops).toEqual([
      expect.objectContaining({
        op: 'update-file',
        rename: false,
        move: true,
        untrash: false,
        content: false,
      }),
    ]);
    const restored = plan({
      items: [it],
      folders: [f],
      rows: [folderRow(f), itemRow(it, 'root', { trashed: true })],
    });
    expect(restored.ops).toEqual([
      expect.objectContaining({
        op: 'update-file',
        rename: false,
        move: false,
        untrash: true,
        content: false,
      }),
    ]);
  });

  it('gives back a name emptied in Drive, and renames back after a lost conflict', () => {
    const it = item('i');
    expect(
      plan({ items: [it], rows: [itemRow(it, 'root', { name: '.livediagram' })] }).ops,
    ).toEqual([expect.objectContaining({ op: 'update-file', rename: true })]);
    // Inbound recorded Drive's name ("Drive") but kept liveworkspace's.
    expect(
      plan({
        items: [it],
        rows: [itemRow(it, 'root', { name: 'Drive.livediagram', localName: 'Drive' })],
      }).ops,
    ).toEqual([expect.objectContaining({ op: 'update-file', rename: true })]);
  });

  it('moves back from a mirrored folder after a lost conflict', () => {
    const f = folder('f');
    const it = item('i');
    expect(
      plan({ items: [it], folders: [f], rows: [folderRow(f), itemRow(it, 'file-f')] }).ops,
    ).toEqual([expect.objectContaining({ op: 'update-file', move: true })]);
  });

  it('leaves a top-level item where the person put it in an unseen Drive folder', () => {
    const it = item('i');
    const row = itemRow(it, 'hidden', { notice: 'unseen_folder', noticeParentId: 'hidden' });
    expect(plan({ items: [it], rows: [row] }).ops).toEqual([]);
  });

  it('moves an item into a folder out of an unseen one', () => {
    const f = folder('f');
    const it = item('i', { folderId: 'f' });
    const row = itemRow(it, 'hidden', { notice: 'unseen_folder', noticeParentId: 'hidden' });
    expect(plan({ items: [it], folders: [f], rows: [folderRow(f), row] }).ops).toEqual([
      expect.objectContaining({ op: 'update-file', move: true }),
    ]);
  });

  it('waits to move an item whose folder is not mirrored yet', () => {
    const it = item('i', { folderId: 'new' });
    const { ops } = plan({ items: [it], folders: [folder('new')], rows: [itemRow(it)] });
    expect(summary(ops)).toEqual(['create-folder:new']);
  });
});

describe('planOutbound: contents and the write interval', () => {
  const written = NOW - 60_000;
  const edited = (over: Partial<MirrorItem> = {}) => item('i', { updatedAt: NOW - 1000, ...over });
  const rowOf = (over: Partial<DriveRow> = {}) =>
    itemRow(item('i'), 'root', { mirroredUpdatedAt: written, contentWrittenAt: written, ...over });

  it('holds an edit inside the interval, saying when it is due', () => {
    const { ops, nextDueAt } = plan({ items: [edited()], rows: [rowOf()] });
    expect(ops).toEqual([]);
    expect(nextDueAt).toBe(written + INTERVAL);
  });

  it('writes an edit once the interval has passed', () => {
    const { ops, nextDueAt } = plan(
      { items: [edited()], rows: [rowOf()] },
      { now: written + INTERVAL },
    );
    expect(ops).toEqual([
      expect.objectContaining({ op: 'update-file', content: true, rename: false, move: false }),
    ]);
    expect(nextDueAt).toBeNull();
  });

  it('follows the interval it is given (stretched under back-off)', () => {
    const doubled = plan(
      { items: [edited()], rows: [rowOf()] },
      { now: written + INTERVAL, writeIntervalMs: 2 * INTERVAL },
    );
    expect(doubled.ops).toEqual([]);
    expect(doubled.nextDueAt).toBe(written + 2 * INTERVAL);
  });

  it('writes straight away on a flush (Check now), ignoring the interval', () => {
    const { ops, nextDueAt } = plan({ items: [edited()], rows: [rowOf()] }, { flush: true });
    expect(ops).toEqual([expect.objectContaining({ op: 'update-file', content: true })]);
    expect(nextDueAt).toBeNull();
  });

  it('writes straight away when the contents were never written', () => {
    const { ops } = plan({
      items: [edited()],
      rows: [rowOf({ mirroredUpdatedAt: null, contentWrittenAt: null })],
    });
    expect(ops).toEqual([expect.objectContaining({ op: 'update-file', content: true })]);
  });

  it('rewrites contents edited in Drive (mirroredUpdatedAt 0), at the interval', () => {
    const it = item('i');
    const due = plan({
      items: [it],
      rows: [itemRow(it, 'root', { mirroredUpdatedAt: 0, contentWrittenAt: written - INTERVAL })],
    });
    expect(due.ops).toEqual([expect.objectContaining({ op: 'update-file', content: true })]);
    const held = plan({
      items: [it],
      rows: [itemRow(it, 'root', { mirroredUpdatedAt: 0, contentWrittenAt: written })],
    });
    expect(held.ops).toEqual([]);
    expect(held.nextDueAt).toBe(written + INTERVAL);
  });

  it('renames at once while the contents wait', () => {
    const { ops, nextDueAt } = plan({ items: [edited({ name: 'New' })], rows: [rowOf()] });
    expect(ops).toEqual([
      expect.objectContaining({ op: 'update-file', rename: true, content: false }),
    ]);
    expect(nextDueAt).toBe(written + INTERVAL);
  });

  it('answers the earliest due time across items', () => {
    const a = item('a', { updatedAt: NOW - 1000 });
    const b = item('b', { updatedAt: NOW - 1000 });
    const { nextDueAt } = plan({
      items: [a, b],
      rows: [
        itemRow(item('a'), 'root', { mirroredUpdatedAt: written, contentWrittenAt: NOW - 1000 }),
        itemRow(item('b'), 'root', { mirroredUpdatedAt: written, contentWrittenAt: NOW - 2000 }),
      ],
    });
    expect(nextDueAt).toBe(NOW - 2000 + INTERVAL);
  });

  it('writes nothing for an item no newer than its file', () => {
    const it = item('i');
    expect(plan({ items: [it], rows: [itemRow(it, 'root', { contentWrittenAt: null })] })).toEqual({
      ops: [],
      nextDueAt: null,
    });
  });
});

describe('planOutbound: items leaving the person’s work', () => {
  it('bins the file of an item moved to the Trash', () => {
    const it = item('i');
    const { ops } = plan({
      trash: [{ id: 'i', app: 'livediagram', name: 'I', trashedAt: NOW }],
      rows: [itemRow(it)],
    });
    expect(ops).toEqual([{ op: 'trash-file', row: itemRow(it) }]);
  });

  it('bins, never deletes, the file of an item gone from both lists (purged or moved into a team)', () => {
    const it = item('i');
    const { ops } = plan({ rows: [itemRow(it)] });
    expect(ops).toEqual([{ op: 'trash-file', row: itemRow(it) }]);
    expect(ops.some((o) => (o.op as string).startsWith('delete'))).toBe(false);
  });

  it('leaves a file already in the bin alone', () => {
    const it = item('i');
    expect(plan({ rows: [itemRow(it, 'root', { trashed: true })] }).ops).toEqual([]);
    expect(
      plan({
        trash: [{ id: 'i', app: 'livediagram', name: 'I', trashedAt: NOW }],
        rows: [itemRow(it, 'root', { trashed: true })],
      }).ops,
    ).toEqual([]);
  });

  it('creates the file of an item moved back out of a team that has no row', () => {
    expect(summary(plan({ items: [item('i')] }).ops)).toEqual(['create-file:i']);
  });
});

describe('planOutbound: order', () => {
  it('runs folder creates and updates, then files, then bins, then folders last', () => {
    const a = folder('a');
    const b = folder('b', 'a');
    const kept = item('kept', { createdAt: 1, name: 'Renamed' });
    const fresh = item('fresh', { createdAt: 2, folderId: 'b' });
    const { ops } = plan({
      items: [fresh, kept],
      folders: [b, { ...a, name: 'A2' }],
      rows: [
        folderRow(a),
        folderRow(folder('gone')),
        itemRow(item('kept', { createdAt: 1 })),
        itemRow(item('binned')),
      ],
    });
    expect(summary(ops)).toEqual([
      'update-folder:a',
      'create-folder:b',
      'update-file:kept',
      'create-file:fresh',
      'trash-file:binned',
      'bin-folder:gone',
    ]);
  });

  // A folder chain 4000 deep took 3.6 s when each folder walked to the top on its own; linear, it takes ~2 ms.
  it('plans a deep tree in linear time', () => {
    const folders = Array.from({ length: 4000 }, (_, i) =>
      folder(`f${i}`, i === 0 ? null : `f${i - 1}`),
    );
    const items = Array.from({ length: 5000 }, (_, i) =>
      item(`i${i}`, { createdAt: i, folderId: `f${i % 4000}` }),
    );
    const started = performance.now();
    const { ops } = plan({ items, folders });
    expect(ops).toHaveLength(9000);
    expect(ops[0]).toMatchObject({ op: 'create-folder', folder: { id: 'f0' } });
    expect(ops[3999]).toMatchObject({ op: 'create-folder', folder: { id: 'f3999' } });
    expect(performance.now() - started).toBeLessThan(500);
  });
});
