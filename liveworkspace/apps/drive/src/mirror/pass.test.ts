// Passes (liveworkspace/docs/drive.md "Outbound", "Inbound", "Cadence"): the first mirror, both directions of
// renames, moves and the bin, echoes, conflicts, deleted folders, purges, batches and back-off, against the fake
// Google and an in-memory index.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DRIVE_FALLBACK_CHECK_WATCHED_MS,
  DRIVE_ITEM_MIN_WRITE_INTERVAL_MS,
  DRIVE_PASS_MAX_WRITES,
} from '@liveworkspace/drive';
import { GOOGLE_USER, harness, ORIGIN, PERSON, type Harness } from '../test-support';

let h: Harness;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  h = harness();
});

afterEach(() => vi.restoreAllMocks());

async function connected() {
  expect(await h.connect()).toEqual({ outcome: 'connected' });
  await h.runDue();
}

describe('the first mirror', () => {
  it('makes the root, the folder tree and every item, in matching folders', async () => {
    const work = h.index.addFolder('Work');
    const plans = h.index.addFolder('Plans', work.id);
    const a = h.index.addItem({ name: 'Flow', folderId: work.id });
    const b = h.index.addItem({ name: 'Roadmap', app: 'liveplanner', folderId: plans.id });
    const c = h.index.addItem({ name: 'Loose', app: 'livedesign' });
    await connected();

    const root = h.files().find((f) => f.appProperties.lwRoot === ORIGIN)!;
    expect(root.name).toBe('liveworkspace (development)');
    expect(h.folderFileOf(work.id)!.parents).toEqual([root.id]);
    expect(h.folderFileOf(plans.id)!.parents).toEqual([h.folderFileOf(work.id)!.id]);
    const fa = h.fileOf(a.id)!;
    expect(fa.name).toBe('Flow.livediagram');
    expect(fa.mimeType).toBe('application/vnd.livediagram+json');
    expect(fa.parents).toEqual([h.folderFileOf(work.id)!.id]);
    expect(fa.appProperties).toEqual({ lwItemId: a.id, lwApp: 'livediagram', lwOrigin: ORIGIN });
    expect(fa.thumbnail).not.toBeNull();
    expect(h.fileOf(b.id)!.name).toBe('Roadmap.liveplanner');
    expect(h.fileOf(b.id)!.parents).toEqual([h.folderFileOf(plans.id)!.id]);
    expect(h.fileOf(c.id)!.parents).toEqual([root.id]);
    expect(h.folderFileOf(work.id)!.appProperties).toEqual({
      lwFolderId: work.id,
      lwOrigin: ORIGIN,
    });
    // The index hears of the person, and a channel is open for Drive's side.
    expect(h.index.mirrored.has(PERSON)).toBe(true);
    expect([...h.google.channels.values()][0]!.address).toBe(`${ORIGIN}/api/drive/push`);
    const summary = h.mirror.connectionSummary(PERSON);
    expect(summary).toMatchObject({
      connected: true,
      status: 'ok',
      items: 3,
      syncing: false,
      progress: null,
    });
  });

  it('writes in batches, with progress, and finishes in the next alarms', async () => {
    const total = DRIVE_PASS_MAX_WRITES + 5;
    for (let i = 0; i < total; i++) h.index.addItem({ name: `Item ${i}` });
    await h.connect();
    // The alarm fires (and is cleared, as the runtime clears it).
    h.alarm.at = null;
    await h.mirror.alarm();
    expect(h.files().filter((f) => f.appProperties.lwItemId)).toHaveLength(DRIVE_PASS_MAX_WRITES);
    expect(h.mirror.connectionSummary(PERSON)).toMatchObject({
      syncing: true,
      progress: { done: DRIVE_PASS_MAX_WRITES, total },
    });
    expect(h.alarm.at).toBe(h.clock.now() + 1000);
    await h.runDue();
    expect(h.files().filter((f) => f.appProperties.lwItemId)).toHaveLength(total);
    expect(h.mirror.connectionSummary(PERSON)).toMatchObject({ syncing: false, progress: null });
  });

  it('finds the root again on a reconnect, and adopts the files it made rather than making second ones', async () => {
    const a = h.index.addItem({ name: 'Flow' });
    await connected();
    const fileId = h.fileOf(a.id)!.id;
    await h.mirror.disconnect(PERSON);
    await connected();
    expect(
      h
        .files()
        .filter((f) => f.appProperties.lwItemId === a.id)
        .map((f) => f.id),
    ).toEqual([fileId]);
    expect(h.files().filter((f) => f.appProperties.lwRoot)).toHaveLength(1);
  });
});

describe('the root', () => {
  it('is never a folder someone else owns, tagged as a root and shared with the person', async () => {
    const theirs = h.google.otherUserFile({
      owner: 'mallory-google',
      name: 'liveworkspace (development)',
      mimeType: 'application/vnd.google-apps.folder',
      content: '',
      appProperties: { lwRoot: ORIGIN },
      shareWith: GOOGLE_USER,
    });
    // Opened once with the app (the Picker, or Open with), so drive.file lists it.
    h.google.grantAccess(GOOGLE_USER, theirs);
    const a = h.index.addItem({ name: 'Flow' });
    await connected();
    const root = h.store.connection()!.rootId;
    expect(root).not.toBe(theirs);
    expect(h.fileOf(a.id)!.parents).toEqual([root]);
  });
});

describe('outbound', () => {
  it('follows renames, moves, the Trash and a restore', async () => {
    const folder = h.index.addFolder('Work');
    const a = h.index.addItem({ name: 'Flow' });
    await connected();
    h.clock.advance(1000);
    h.index.edit(a.id, { name: 'Flow 2', folderId: folder.id });
    await h.pass();
    expect(h.fileOf(a.id)).toMatchObject({
      name: 'Flow 2.livediagram',
      parents: [h.folderFileOf(folder.id)!.id],
    });
    h.index.edit(a.id, { trashedAt: h.clock.now() });
    await h.pass();
    expect(h.fileOf(a.id)!.trashed).toBe(true);
    h.index.edit(a.id, { trashedAt: null });
    await h.pass();
    expect(h.fileOf(a.id)!.trashed).toBe(false);
  });

  it('rewrites contents at most once per interval, the later edit when it ends', async () => {
    const a = h.index.addItem({ name: 'Flow' });
    await connected();
    h.doors.exports = [];
    h.clock.advance(1000);
    h.index.edit(a.id, {});
    await h.pass();
    expect(h.doors.exports).toEqual([]);
    // Waiting for the interval, and scheduled for when it ends.
    expect(h.mirror.marks(PERSON).marks.find((m) => m.id === a.id)!.state).toBe('waiting');
    expect(h.alarm.at).toBeLessThanOrEqual(h.clock.now() + DRIVE_ITEM_MIN_WRITE_INTERVAL_MS);
    h.clock.advance(DRIVE_ITEM_MIN_WRITE_INTERVAL_MS);
    await h.runDue();
    expect(h.doors.exports).toEqual([a.id]);
    expect(h.mirror.marks(PERSON).marks.find((m) => m.id === a.id)!.state).toBe('synced');
  });

  it('bins a purged item’s file, never deleting it', async () => {
    const a = h.index.addItem({ name: 'Flow' });
    await connected();
    h.index.items.delete(a.id);
    await h.pass();
    const file = h.fileOf(a.id)!;
    expect(file.trashed).toBe(true);
    expect(h.google.requests.some((r) => r.method === 'DELETE')).toBe(false);
  });

  it('bins the Drive folder of a folder deleted here, after its contents move up', async () => {
    const folder = h.index.addFolder('Work');
    const a = h.index.addItem({ name: 'Flow', folderId: folder.id });
    await connected();
    const folderFile = h.folderFileOf(folder.id)!.id;
    h.index.deleteFolderHere(folder.id);
    await h.pass();
    expect(h.google.get(folderFile)!.trashed).toBe(true);
    const root = h.files().find((f) => f.appProperties.lwRoot)!;
    expect(h.fileOf(a.id)).toMatchObject({ trashed: false, parents: [root.id] });
    // Nothing brings it back on the next pass.
    await h.pass();
    expect(h.index.folders.has(folder.id)).toBe(false);
  });

  it('skips an item its app no longer has, and marks a failed write', async () => {
    const a = h.index.addItem({ name: 'Gone' });
    h.doors.missing.add(a.id);
    const b = h.index.addItem({ name: 'Broken' });
    h.google.fail({ status: 500, match: (r) => r.path.startsWith('/upload') });
    await connected();
    expect(h.fileOf(a.id)).toBeUndefined();
    const marks = h.mirror.marks(PERSON).marks;
    expect(marks.filter((m) => m.state === 'failed').map((m) => m.id)).toHaveLength(1);
    await h.pass();
    expect(h.fileOf(b.id)).toBeDefined();
    expect(h.mirror.marks(PERSON).marks.find((m) => m.id === b.id)!.state).toBe('synced');
  });
});

describe('inbound', () => {
  let a: { id: string };
  let folder: { id: string };

  beforeEach(async () => {
    folder = h.index.addFolder('Work');
    a = h.index.addItem({ name: 'Flow' });
    await connected();
    h.index.writes = [];
    h.clock.advance(60_000);
  });

  it('applies a rename, dropping the extension', async () => {
    h.google.userRename(h.fileOf(a.id)!.id, 'Renamed.livediagram');
    await h.pass();
    expect(h.index.items.get(a.id)!.name).toBe('Renamed');
    expect(h.index.writes).toEqual([`rename-item ${a.id} Renamed`]);
  });

  it('applies a move into a mirrored folder, and to the root with a notice from one it can’t see', async () => {
    h.google.userMove(h.fileOf(a.id)!.id, h.folderFileOf(folder.id)!.id);
    await h.pass();
    expect(h.index.items.get(a.id)!.folderId).toBe(folder.id);
    const unseen = h.google.userCreateFolder(GOOGLE_USER, 'Private');
    h.google.userMove(h.fileOf(a.id)!.id, unseen);
    await h.pass();
    expect(h.index.items.get(a.id)!.folderId).toBeNull();
    expect(h.mirror.marks(PERSON).marks.find((m) => m.id === a.id)!.notice).toBe('unseen_folder');
    expect(h.mirror.connectionSummary(PERSON)).toMatchObject({
      notices: [{ id: a.id, kind: 'item', name: 'Flow' }],
    });
    // The file stays where the person put it.
    await h.pass();
    expect(h.fileOf(a.id)!.parents).toEqual([unseen]);
  });

  it('takes a file binned in Drive to the Trash, and a restore back', async () => {
    h.google.userTrash(h.fileOf(a.id)!.id);
    await h.pass();
    expect(h.index.items.get(a.id)!.trashedAt).not.toBeNull();
    h.google.userRestore(h.fileOf(a.id)!.id);
    await h.pass();
    expect(h.index.items.get(a.id)!.trashedAt).toBeNull();
  });

  it('bins a folder’s items and removes the folder when it is binned in Drive', async () => {
    const inside = h.index.addItem({ name: 'Inside', folderId: folder.id });
    await h.pass();
    h.google.userTrash(h.folderFileOf(folder.id)!.id);
    await h.pass();
    expect(h.index.folders.has(folder.id)).toBe(false);
    expect(h.index.items.get(inside.id)!.trashedAt).not.toBeNull();
  });

  it('purges only from the Trash when a file is deleted for good', async () => {
    const fileId = h.fileOf(a.id)!.id;
    h.google.userDeleteForever(fileId);
    await h.pass();
    // A live item is never deleted: its file is made again.
    expect(h.index.items.has(a.id)).toBe(true);
    expect(h.fileOf(a.id)!.id).not.toBe(fileId);
    h.google.userTrash(h.fileOf(a.id)!.id);
    await h.pass();
    h.google.userDeleteForever(h.fileOf(a.id)!.id);
    await h.pass();
    expect(h.index.items.has(a.id)).toBe(false);
  });

  it('reads its own writes back as echoes', async () => {
    h.index.edit(a.id, { name: 'Here' });
    await h.pass();
    h.index.writes = [];
    await h.pass();
    await h.pass();
    expect(h.index.writes).toEqual([]);
  });

  it('ignores contents edited in Drive, and rewrites them from liveworkspace', async () => {
    h.google.userEditContent(h.fileOf(a.id)!.id, 'scribbled');
    h.clock.advance(DRIVE_ITEM_MIN_WRITE_INTERVAL_MS);
    await h.pass();
    expect(h.index.writes).toEqual([]);
    expect(JSON.parse(h.fileOf(a.id)!.content).kind).toBe('livediagram.document');
  });

  it('lets the later change win when both sides renamed', async () => {
    // Renamed here first, then in Drive: Drive's is later.
    h.index.edit(a.id, { name: 'Local' });
    h.clock.advance(1000);
    h.google.userRename(h.fileOf(a.id)!.id, 'Remote.livediagram');
    await h.pass();
    expect(h.index.items.get(a.id)!.name).toBe('Remote');
    expect(h.fileOf(a.id)!.name).toBe('Remote.livediagram');
    // Renamed in Drive first, then here: liveworkspace's is later and Drive is put back.
    h.clock.advance(1000);
    h.google.userRename(h.fileOf(a.id)!.id, 'Older.livediagram');
    h.clock.advance(1000);
    h.index.edit(a.id, { name: 'Newer' });
    await h.pass();
    expect(h.index.items.get(a.id)!.name).toBe('Newer');
    expect(h.fileOf(a.id)!.name).toBe('Newer.livediagram');
  });

  it('keeps a folder deleted here deleted, whatever Drive last said of it', async () => {
    const folderFile = h.folderFileOf(folder.id)!.id;
    h.google.userRename(folderFile, 'Renamed in Drive');
    h.index.deleteFolderHere(folder.id);
    await h.pass();
    expect(h.index.folders.has(folder.id)).toBe(false);
    expect(h.google.get(folderFile)!.trashed).toBe(true);
  });
});

describe('cadence', () => {
  it('debounces signals into one pass, and keeps the fallback check while the channel is up', async () => {
    h.index.addItem({ name: 'Flow' });
    await connected();
    const fallback = h.alarm.at!;
    expect(fallback).toBeLessThanOrEqual(h.clock.now() + DRIVE_FALLBACK_CHECK_WATCHED_MS);
    await h.mirror.signal(PERSON);
    const first = h.alarm.at!;
    expect(first).toBe(h.clock.now() + 30_000);
    h.clock.advance(10_000);
    await h.mirror.signal(PERSON);
    expect(h.alarm.at).toBe(first);
  });

  it('turns Needs reconnecting on a refused grant, and stops scheduling', async () => {
    h.index.addItem({ name: 'Flow' });
    await connected();
    h.google.revokeGrant(GOOGLE_USER);
    h.clock.advance(2 * 3600_000);
    await h.pass();
    expect(h.mirror.connectionSummary(PERSON)).toMatchObject({
      status: 'needs_reconnect',
      syncing: false,
    });
    expect(h.alarm.at).toBeNull();
    await h.mirror.signal(PERSON);
    expect(h.alarm.at).toBeNull();
    // A new consent by the same account brings it back.
    expect(await h.connect()).toEqual({ outcome: 'connected' });
    expect(h.mirror.connectionSummary(PERSON)).toMatchObject({ status: 'ok' });
  });

  it('backs off on a rate limit', async () => {
    h.index.addItem({ name: 'Flow' });
    await h.connect();
    h.google.fail({
      status: 429,
      reason: 'rateLimitExceeded',
      match: (r) => r.path.startsWith('/upload'),
    });
    await h.runDue();
    expect(h.mirror.connectionSummary(PERSON)).toMatchObject({ status: 'error' });
    expect(h.alarm.at).toBe(h.clock.now() + 2 * DRIVE_ITEM_MIN_WRITE_INTERVAL_MS);
  });
});
