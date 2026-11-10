// The picture a pass reads (liveworkspace/docs/specs/005-drive/drive.md "Cadence", "The picture"): what changed between
// whole reads, merged over the kept one, and each kind of change reaching Drive under it, with the index's own rules
// (a move and the Trash leave updatedAt alone, a rename and a save move it on).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DRIVE_ITEM_MIN_WRITE_INTERVAL_MS } from '@liveworkspace/drive';
import { harness, nodeSql, PERSON, type Harness } from '../test-support';
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
