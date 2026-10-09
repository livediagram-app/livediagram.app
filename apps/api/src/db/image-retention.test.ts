import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrateFrom, sqliteD1 } from '../test-sqlite-d1';
import { resetImageRefIndexMemo } from './image-refs';
import { deleteOldUnusedImages, IMAGE_SWEEP_PAGE, sweepTripped } from './image-retention';
import { deleteDocument } from './documents';
import { upsertTab } from './tabs';
import {
  CUTOFF,
  liveDoc,
  ids,
  imageIds,
  images,
  OLD,
  refsFor,
  setup,
  tabWith,
  YOUNG,
} from './test-image-fixtures';

// The daily unused-image sweep (docs/specs/009-elements/images.md,
// "Retention"): reads only the image reference index, and keeps bytes
// whenever in doubt. Proven against a real SQLite with every migration.

afterEach(() => {
  resetImageRefIndexMemo();
  vi.restoreAllMocks();
});

describe('sweepTripped', () => {
  it('trips only past both the share and the count', () => {
    expect(sweepTripped(21, 21)).toBe(true);
    expect(sweepTripped(20, 20)).toBe(false);
    expect(sweepTripped(60, 30)).toBe(false);
    expect(sweepTripped(60, 31)).toBe(true);
    expect(sweepTripped(0, 0)).toBe(false);
  });
});

describe('deleteOldUnusedImages', () => {
  it('is a no-op without an R2 binding', async () => {
    const { env, sql } = sqliteD1();
    images(sql, OLD, 'old');
    expect(await deleteOldUnusedImages(env, CUTOFF)).toBe(0);
    expect(imageIds(sql)).toEqual(['old']);
  });

  it('deletes nothing while the index backfill is incomplete', async () => {
    const db = setup({ before0050: true });
    db.sql.exec("INSERT INTO tabs (id, name, data, updated_at) VALUES ('t', 't', '{}', 0)");
    migrateFrom(db.sql, '0050');
    images(db.sql, OLD, 'old');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(0);
    expect(imageIds(db.sql)).toEqual(['old']);
    expect(db.bucket.delete).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('image sweep: paused, reference index backfill incomplete');
  });

  it('reaps old unreferenced images only, D1 then R2', async () => {
    const db = setup();
    liveDoc(db.sql, 'A');
    liveDoc(db.sql, 'B', 'someone-else');
    images(db.sql, OLD, 'old-unused', 'old-used', 'old-used-elsewhere');
    images(db.sql, YOUNG, 'young-unused');
    await upsertTab(db.env, 'A', tabWith('t1', 'old-used'), 0);
    // Store-wide: another owner's tab keeps an image alive.
    await upsertTab(db.env, 'B', tabWith('t2', 'old-used-elsewhere'), 0);
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(1);
    expect(imageIds(db.sql)).toEqual(['old-used', 'old-used-elsewhere', 'young-unused']);
    expect(db.bucket.delete).toHaveBeenCalledWith(['old-unused']);
  });

  it('counts a tab no document links (kept conservatively) but not a dangling reference', async () => {
    const db = setup();
    liveDoc(db.sql, 'A');
    images(db.sql, OLD, 'on-orphan-tab', 'on-deleted-tab');
    await upsertTab(db.env, 'A', tabWith('orphan', 'on-orphan-tab'), 0);
    await upsertTab(db.env, 'A', tabWith('gone', 'on-deleted-tab'), 1);
    db.sql.exec("DELETE FROM document_tabs WHERE tab_id = 'orphan'");
    // A tab removed by a path that didn't prune: its row dangles.
    db.sql.exec("DELETE FROM tabs WHERE id = 'gone'");
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(1);
    expect(imageIds(db.sql)).toEqual(['on-orphan-tab']);
    expect(refsFor(db.sql, 'on-deleted-tab')).toBe(0);
  });

  it('reaps the images of a deleted document', async () => {
    const db = setup();
    liveDoc(db.sql, 'A');
    images(db.sql, OLD, 'img');
    await upsertTab(db.env, 'A', tabWith('t1', 'img'), 0);
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(0);
    await deleteDocument(db.env, 'A');
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(1);
  });

  it('keeps an image placed after it was counted', async () => {
    const db = setup();
    liveDoc(db.sql, 'A');
    images(db.sql, OLD, 'late');
    const prepare = db.env.db.prepare.bind(db.env.db);
    // Place the image in the instant between the page read and the delete.
    vi.spyOn(db.env.db, 'prepare').mockImplementation((query: string) => {
      if (query.startsWith('DELETE FROM images')) {
        db.sql.exec("INSERT INTO tabs (id, name, data, updated_at) VALUES ('t', 't', '{}', 0)");
        db.sql.exec("INSERT INTO image_refs (tab_id, image_id) VALUES ('t', 'late')");
      }
      return prepare(query);
    });
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(0);
    expect(imageIds(db.sql)).toEqual(['late']);
    expect(db.bucket.delete).not.toHaveBeenCalled();
  });

  it('trips, deleting nothing, when most old images look unreferenced', async () => {
    const db = setup();
    images(db.sql, OLD, ...ids('lost', 21));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(0);
    expect(imageIds(db.sql)).toHaveLength(21);
    expect(error).toHaveBeenCalledWith(
      'image-sweep-tripwire: 21 of 21 old images unreferenced; nothing deleted',
    );
  });

  it('pages through more unused images than one R2 call takes', async () => {
    const db = setup();
    liveDoc(db.sql, 'A');
    const unused = ids('unused', IMAGE_SWEEP_PAGE + 1);
    const used = ids('used', IMAGE_SWEEP_PAGE + 2);
    images(db.sql, OLD, ...unused, ...used);
    db.sql.exec("INSERT INTO tabs (id, name, data, updated_at) VALUES ('t', 't', '{}', 0)");
    const ref = db.sql.prepare("INSERT INTO image_refs (tab_id, image_id) VALUES ('t', ?)");
    for (const id of used) ref.run(id);
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(IMAGE_SWEEP_PAGE + 1);
    expect(db.bucket.delete).toHaveBeenCalledTimes(2);
    expect(imageIds(db.sql)).toEqual(used);
  });

  it('stops cleanly after an exactly full last page', async () => {
    const db = setup();
    const unused = ids('unused', IMAGE_SWEEP_PAGE);
    const used = ids('used', IMAGE_SWEEP_PAGE);
    images(db.sql, OLD, ...unused, ...used);
    db.sql.exec("INSERT INTO tabs (id, name, data, updated_at) VALUES ('t', 't', '{}', 0)");
    const ref = db.sql.prepare("INSERT INTO image_refs (tab_id, image_id) VALUES ('t', ?)");
    for (const id of used) ref.run(id);
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(IMAGE_SWEEP_PAGE);
    expect(db.bucket.delete).toHaveBeenCalledTimes(1);
  });

  it('logs an R2 failure with the ids and carries on', async () => {
    const db = setup();
    images(db.sql, OLD, 'a');
    db.bucket.delete.mockRejectedValueOnce(new Error('r2 down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(1);
    expect(error).toHaveBeenCalledWith('image sweep: R2 delete failed', ['a'], expect.any(Error));
  });
});
