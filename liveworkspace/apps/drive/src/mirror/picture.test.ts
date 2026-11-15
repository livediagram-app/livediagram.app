// The picture a pass reads (liveworkspace/docs/specs/005-drive/drive.md "Cadence", "The picture"): what changed between
// whole reads, merged over the kept one, and each kind of change reaching Drive under it, with the index's own rules
// (a move and the Trash leave updatedAt alone, a rename and a save move it on).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DRIVE_ITEM_MIN_WRITE_INTERVAL_MS } from '@liveworkspace/drive';
import { harness, nodeSql, PERSON, type Harness } from '../test-support';
import { BudgetSpent } from './meter';
import { MirrorStore } from './store';
import {
  DRIVE_PICTURE_FULL_MS,
  DRIVE_PICTURE_RECHECKS_MAX,
  DRIVE_PICTURE_SLACK_MS,
  pictureIndex,
} from './picture';

// Far enough on that what the last whole read saw is outside a read of what changed, and the next whole read not due.
const PAST_SLACK = DRIVE_PICTURE_SLACK_MS + 60_000;

let h: Harness;

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  h = harness();
});

afterEach(() => vi.restoreAllMocks());

// A pass far enough on that what the first read saw falls outside the next read of what changed.
async function settle() {
  h.clock.advance(PAST_SLACK);
  await h.pass();
  h.clock.advance(1000);
}

async function connected() {
  expect(await h.connect()).toEqual({ outcome: 'connected' });
  await h.runDue();
}

// As the index does them: neither a move nor the Trash moves updatedAt on.
const quietly = {
  move: (id: string, folderId: string | null) => {
    h.index.items.get(id)!.folderId = folderId;
  },
  trash: (id: string) => {
    h.index.items.get(id)!.trashedAt = h.clock.now();
  },
  restore: (id: string) => {
    h.index.items.get(id)!.trashedAt = null;
  },
};

describe('between whole reads', () => {
  it('mirrors a new item, a save and a rename from what changed', async () => {
    const a = h.index.addItem({ name: 'Flow' });
    await connected();
    const whole = h.index.wholeReads;

    h.clock.advance(1000);
    const b = h.index.addItem({ name: 'Second' });
    await h.pass();
    expect(h.fileOf(b.id)).toMatchObject({ name: 'Second.livediagram', trashed: false });

    h.clock.advance(DRIVE_ITEM_MIN_WRITE_INTERVAL_MS);
    h.doors.exports = [];
    h.index.edit(a.id, {});
    await h.pass();
    expect(h.doors.exports).toEqual([a.id]);

    h.clock.advance(1000);
    h.index.edit(a.id, { name: 'Flow 2' });
    await h.pass();
    expect(h.fileOf(a.id)!.name).toBe('Flow 2.livediagram');
    expect(h.index.wholeReads).toBe(whole);
  });

  it('follows the Trash, a restore and a delete for good without a whole read', async () => {
    const a = h.index.addItem({ name: 'Flow' });
    const b = h.index.addItem({ name: 'Other' });
    await connected();
    const whole = h.index.wholeReads;

    await settle();
    quietly.trash(a.id);
    quietly.trash(b.id);
    await h.pass();
    expect(h.fileOf(a.id)!.trashed).toBe(true);
    expect(h.fileOf(b.id)!.trashed).toBe(true);

    // Out of the Trash: a, restored, is live again; b, deleted for good, stays in Drive's bin.
    quietly.restore(a.id);
    h.index.items.delete(b.id);
    await h.pass();
    expect(h.fileOf(a.id)!.trashed).toBe(false);
    expect(h.fileOf(b.id)!.trashed).toBe(true);
    expect(h.google.requests.some((r) => r.method === 'DELETE')).toBe(false);
    expect(h.index.wholeReads).toBe(whole);
  });

  it('mirrors folder changes from the folders it reads whole each pass', async () => {
    const work = h.index.addFolder('Work');
    await connected();
    const whole = h.index.wholeReads;
    h.clock.advance(1000);
    const plans = h.index.addFolder('Plans', work.id);
    h.index.folders.set(work.id, { ...work, name: 'Work 2', updatedAt: h.clock.now() });
    await h.pass();
    expect(h.folderFileOf(work.id)!.name).toBe('Work 2');
    expect(h.folderFileOf(plans.id)!.parents).toEqual([h.folderFileOf(work.id)!.id]);
    expect(h.index.wholeReads).toBe(whole);
  });

  it('sees a move at the next whole read, at most DRIVE_PICTURE_FULL_MS on', async () => {
    const work = h.index.addFolder('Work');
    const a = h.index.addItem({ name: 'Flow' });
    await connected();
    const root = h.files().find((f) => f.appProperties.lwRoot)!;

    await settle();
    quietly.move(a.id, work.id);
    await h.pass();
    // A move leaves updatedAt alone: a read of what changed can't see it yet.
    expect(h.fileOf(a.id)!.parents).toEqual([root.id]);

    h.clock.advance(DRIVE_PICTURE_FULL_MS);
    await h.pass();
    expect(h.fileOf(a.id)!.parents).toEqual([h.folderFileOf(work.id)!.id]);
  });

  it('reads whole when a folder an item was in is gone', async () => {
    const work = h.index.addFolder('Work');
    const a = h.index.addItem({ name: 'Flow', folderId: work.id });
    await connected();
    const whole = h.index.wholeReads;
    await settle();
    h.index.deleteFolderHere(work.id);
    await h.pass();
    const root = h.files().find((f) => f.appProperties.lwRoot)!;
    expect(h.fileOf(a.id)).toMatchObject({ trashed: false, parents: [root.id] });
    expect(h.index.wholeReads).toBe(whole + 1);
  });

  it('reads whole when more items left the Trash than it reads one by one', async () => {
    const ids = Array.from(
      { length: DRIVE_PICTURE_RECHECKS_MAX + 1 },
      (_, i) => h.index.addItem({ name: `Item ${i}`, trashedAt: 1 }).id,
    );
    await connected();
    const whole = h.index.wholeReads;
    await settle();
    for (const id of ids) quietly.restore(id);
    await h.pass();
    expect(h.index.wholeReads).toBe(whole + 1);
    for (const id of ids) expect(h.fileOf(id)!.trashed).toBe(false);
  });

  it('reads whole on Check now, and after the mirror itself changed the index', async () => {
    const a = h.index.addItem({ name: 'Flow' });
    await connected();
    let whole = h.index.wholeReads;

    h.clock.advance(60_000);
    await h.mirror.check(PERSON);
    await h.runDue();
    expect(h.index.wholeReads).toBe(whole + 1);

    // Binned in Drive: the mirror trashes it in the index, and the pass after reads whole.
    whole = h.index.wholeReads;
    h.clock.advance(1000);
    h.google.userTrash(h.fileOf(a.id)!.id);
    await h.pass();
    expect(h.index.items.get(a.id)!.trashedAt).not.toBeNull();
    expect(h.index.wholeReads).toBeGreaterThan(whole);
    whole = h.index.wholeReads;
    h.clock.advance(1000);
    await h.pass();
    expect(h.index.wholeReads).toBe(whole);
  });
});

describe('what a pass reads', () => {
  it('reads a page or two at 2,000 items where a whole read takes every page', async () => {
    const store = new MirrorStore(nodeSql());
    const folders = Array.from({ length: 20 }, (_, i) => h.index.addFolder(`F${i}`).id);
    for (let i = 0; i < 2000; i++) {
      h.index.addItem({ name: `Item ${i}`, folderId: folders[i % 20]!, updatedAt: 1000 + i });
    }
    for (let i = 0; i < 30; i++) h.index.addItem({ name: `Old ${i}`, trashedAt: 5 });
    const index = pictureIndex(h.index.forPerson(PERSON), store, h.clock.now);
    const measure = async () => {
      const [requests, rows] = [h.index.requests, h.index.rowsRead];
      const picture = await index.picture();
      return { requests: h.index.requests - requests, rows: h.index.rowsRead - rows, picture };
    };

    const whole = await measure();
    expect(whole.picture.items).toHaveLength(2000);
    // A save on three items, half a minute on.
    h.clock.advance(30_000);
    for (const id of [...h.index.items.keys()].slice(0, 3)) h.index.edit(id, {});
    const changed = await measure();
    console.info(
      `[drive picture] 2,000 items: whole ${whole.requests} requests / ${whole.rows} rows, ` +
        `what changed ${changed.requests} requests / ${changed.rows} rows`,
    );
    expect(whole).toMatchObject({ requests: 12, rows: 2050 });
    expect(changed).toMatchObject({ requests: 3, rows: 53 });
    expect(new Set(changed.picture.items.map((i) => i.id))).toEqual(
      new Set(whole.picture.items.map((i) => i.id)),
    );
    // The slack looks back past the last read; the whole read comes back when due.
    expect(DRIVE_PICTURE_SLACK_MS).toBeGreaterThan(0);
    h.clock.advance(DRIVE_PICTURE_FULL_MS);
    expect((await measure()).requests).toBe(12);
  });

  // Work Tracker 425: a picture past what one pass may read finishes over several, and none of them sees half of it.
  it('reads a picture bigger than a pass over several, never handing out a half-read one', async () => {
    const store = new MirrorStore(nodeSql());
    h.index.pageSize = 10;
    const folder = h.index.addFolder('Work').id;
    for (let i = 0; i < 55; i++)
      h.index.addItem({ name: `Item ${i}`, folderId: i % 2 ? folder : null, updatedAt: 1000 + i });
    for (let i = 0; i < 12; i++) h.index.addItem({ name: `Old ${i}`, trashedAt: 50 + i });
    h.clock.advance(DRIVE_PICTURE_FULL_MS);
    // 6 pages of items, 1 of folders and 2 of the Trash: 9 pages, 4 a pass.
    const pass = () => pictureIndex(h.index.forPerson(PERSON), store, h.clock.now, 4);
    const marks: string[] = [];
    for (let i = 0; i < 2; i++) {
      await expect(pass().picture()).rejects.toThrow(BudgetSpent);
      marks.push(store.pictureReadMark());
      h.clock.advance(1000);
    }
    expect(new Set(marks).size).toBe(2);
    expect(store.pictureState()).toBeNull();
    // Meanwhile: one item saved, one made, one trashed and one restored, all after the read began.
    const [first, second] = [...h.index.items.keys()];
    h.index.edit(first!, { name: 'Saved meanwhile' });
    const made = h.index.addItem({ name: 'Made meanwhile' });
    const restored = [...h.index.items.values()].find((i) => i.trashedAt !== null)!.id;
    quietly.trash(second!);
    quietly.restore(restored);
    const picture = await pass().picture();
    expect(store.pictureRead()).toBeNull();
    expect(store.pictureReadMark()).toBe('');
    const live = new Map(picture.items.map((i) => [i.id, i]));
    expect(live.size).toBe(55 + 1 - 1 + 1);
    expect(live.get(first!)!.name).toBe('Saved meanwhile');
    expect(live.has(made.id)).toBe(true);
    expect(live.has(second!)).toBe(false);
    expect(live.has(restored)).toBe(true);
    expect(picture.trash.map((t) => t.id)).toContain(second);
    expect(picture.folders.map((f) => f.id)).toEqual([folder]);
    expect(h.index.wholeReads).toBe(1);
    // Kept as one whole read: the next read is of what changed.
    expect(store.keptPicture().items.size).toBe(live.size);
    await pass().picture();
    expect(h.index.wholeReads).toBe(1);
  });

  it('drops a whole read in progress when the mirror writes to the index, and starts it afresh', async () => {
    const store = new MirrorStore(nodeSql());
    h.index.pageSize = 10;
    for (let i = 0; i < 40; i++) h.index.addItem({ name: `Item ${i}`, updatedAt: 1000 + i });
    const pass = () => pictureIndex(h.index.forPerson(PERSON), store, h.clock.now, 2);
    await expect(pass().picture()).rejects.toThrow(BudgetSpent);
    expect(store.pictureRead()).not.toBeNull();
    const [id] = [...h.index.items.keys()];
    await pass().renameItem(id!, 'Renamed');
    expect(store.pictureRead()).toBeNull();
    expect(store.stagedPicture()).toEqual({ items: [], folders: [], trash: [] });
    // A page from the dropped read lands on nothing.
    expect(store.addPicturePage(1, 'items', [], null)).toBe(false);
    h.clock.advance(1000);
    await expect(pass().picture()).rejects.toThrow(BudgetSpent);
    expect(h.index.wholeReads).toBe(2);
  });

  it('stages nothing from a page that lands after its read was dropped', async () => {
    const store = new MirrorStore(nodeSql());
    h.index.addItem({ name: 'Flow' });
    const raw = h.index.forPerson(PERSON);
    // A write elsewhere drops the read while its page is on the way.
    const racing = {
      ...raw,
      picturePage: async (...args: Parameters<typeof raw.picturePage>) => {
        const page = await raw.picturePage(...args);
        store.stalePicture();
        return page;
      },
    };
    await expect(pictureIndex(racing, store, h.clock.now).picture()).rejects.toThrow(BudgetSpent);
    expect(store.pictureRead()).toBeNull();
    expect(store.stagedPicture()).toEqual({ items: [], folders: [], trash: [] });
  });

  it('reads whole again when what changed during a long read cannot be trusted', async () => {
    const store = new MirrorStore(nodeSql());
    h.index.pageSize = 10;
    const work = h.index.addFolder('Work').id;
    for (let i = 0; i < 30; i++)
      h.index.addItem({ name: `Item ${i}`, folderId: work, updatedAt: 1000 + i });
    h.clock.advance(DRIVE_PICTURE_FULL_MS);
    const pass = () => pictureIndex(h.index.forPerson(PERSON), store, h.clock.now, 3);
    await expect(pass().picture()).rejects.toThrow(BudgetSpent);
    h.clock.advance(1000);
    // The folder every item read so far was in goes: they move up untouched, which what changed can't show.
    h.index.deleteFolderHere(work);
    await expect(pass().picture()).rejects.toThrow(BudgetSpent);
    expect(store.pictureRead()).toBeNull();
    expect(store.pictureState()!.fullAt).toBe(0);
    h.clock.advance(1000);
    const picture = await pictureIndex(h.index.forPerson(PERSON), store, h.clock.now).picture();
    expect(picture.items.every((i) => i.folderId === null)).toBe(true);
    expect(h.index.wholeReads).toBe(2);
  });

  it('reads whole with nothing kept, and keeps only what differs', async () => {
    const store = new MirrorStore(nodeSql());
    const index = pictureIndex(h.index.forPerson(PERSON), store, h.clock.now);
    h.index.addItem({ name: 'Flow' });
    await index.picture();
    expect(h.index.wholeReads).toBe(1);
    await index.picture();
    expect(h.index.wholeReads).toBe(1);
    // Forgotten (an account switch): whole again.
    store.clearRows();
    await index.picture();
    expect(h.index.wholeReads).toBe(2);
    await index.picture({ full: true });
    expect(h.index.wholeReads).toBe(3);
  });
});
