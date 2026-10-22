import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/document';
import { sqliteD1 } from './test-sqlite-d1';
import { copyDocument } from './db/documents';
import { upsertTab } from './db/tabs';
import { recordBlobs } from './db/photo-blobs';
import { runPhotoSweep, sweepPhotoBlobs } from './photo-sweep';
import type { Env } from './types';

// The daily photo blob sweep (docs/specs/031-photo/photo-store.md "Retention") and copies carrying
// refs ("Copies, duplicates and links"), against a real SQLite with every migration.

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const OLD = NOW - 2 * DAY;
const YOUNG = NOW - DAY / 2;

const id = (c: string) => c.repeat(22);

function setup() {
  const bucket = { delete: vi.fn(async () => {}) };
  const db = sqliteD1({ PHOTO_BLOBS: bucket } as unknown as Partial<Env>);
  db.sql.exec(`INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
    VALUES ('A', 'owner', 'A', 0, 0, 0)`);
  return { ...db, bucket };
}

const photoTab = (tabId: string, ...tiles: string[]): Tab =>
  ({
    id: tabId,
    name: tabId,
    elements: [],
    pages: [
      {
        id: 'p1',
        orientation: 'landscape',
        kind: 'photo',
        size: 'photo',
        fit: { width: 10, height: 10 },
      },
    ],
    photos: {
      p1: {
        width: 10,
        height: 10,
        layers: [
          {
            id: 'ly-00000001',
            name: 'L',
            layerKind: 'pixel',
            pixels: { tiles: Object.fromEntries(tiles.map((t, i) => [`${i}.0`, t])) },
          },
        ],
      },
    },
  }) as unknown as Tab;

const refsOf = (sql: ReturnType<typeof setup>['sql'], tab: string) =>
  sql
    .prepare('SELECT blob_id FROM photo_blob_refs WHERE tab_id = ? ORDER BY blob_id')
    .all(tab)
    .map((r) => r.blob_id as string);
const blobs = (sql: ReturnType<typeof setup>['sql']) =>
  sql
    .prepare('SELECT id FROM photo_blobs ORDER BY id')
    .all()
    .map((r) => r.id as string);
const blob = (c: string) => ({ id: id(c), type: 'image/png', size: 10 });

describe('the photo sweep', () => {
  it('keeps what the tab names and young refs, removes the rest and their blobs', async () => {
    const db = setup();
    await upsertTab(db.env, 'A', photoTab('t1', id('a')), 0);
    await recordBlobs(db.env, 't1', [blob('a'), blob('b')], OLD);
    await recordBlobs(db.env, 't1', [blob('c')], YOUNG);
    const out = await sweepPhotoBlobs(db.env, NOW);
    expect(out).toEqual({ refs: 1, blobs: 1 });
    expect(refsOf(db.sql, 't1')).toEqual([id('a'), id('c')]);
    expect(blobs(db.sql)).toEqual([id('a'), id('c')]);
    expect(db.bucket.delete).toHaveBeenCalledWith([`photo/${id('b')}`]);
  });

  it('drops old refs of a tab that is gone, keeping a blob another tab still names', async () => {
    const db = setup();
    await upsertTab(db.env, 'A', photoTab('t2', id('d')), 0);
    await recordBlobs(db.env, 'gone', [blob('d'), blob('e')], OLD);
    await recordBlobs(db.env, 't2', [blob('d')], OLD);
    const out = await sweepPhotoBlobs(db.env, NOW);
    expect(refsOf(db.sql, 'gone')).toEqual([]);
    expect(blobs(db.sql)).toEqual([id('d')]);
    expect(out.blobs).toBe(1);
  });

  it('keeps everything a tab body that does not parse might name, and logs', async () => {
    const db = setup();
    await upsertTab(db.env, 'A', photoTab('t3'), 0);
    db.sql.prepare("UPDATE tabs SET data = '{oops', rev = rev + 1 WHERE id = 't3'").run();
    await recordBlobs(db.env, 't3', [blob('f')], OLD);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await sweepPhotoBlobs(db.env, NOW);
    expect(refsOf(db.sql, 't3')).toEqual([id('f')]);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('logs its outcome, and a failure of R2 or the run', async () => {
    const db = setup();
    await recordBlobs(db.env, 'gone', [blob('g')], OLD);
    db.bucket.delete.mockRejectedValueOnce(new Error('r2'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runPhotoSweep(db.env, NOW);
    expect(err.mock.calls[0]![0]).toBe('photo sweep: R2 delete failed');
    expect(log).toHaveBeenCalledWith('photo sweep: removed 1 refs, deleted 1 blobs');
    await runPhotoSweep({ ...db.env, DB: undefined } as unknown as Env, NOW);
    expect(err.mock.calls.at(-1)![0]).toBe('photo sweep failed');
    err.mockRestore();
    log.mockRestore();
  });
});

describe('copies carry refs', () => {
  it("gives a copied document's tabs every blob their source tab held", async () => {
    const db = setup();
    await upsertTab(db.env, 'A', photoTab('t1', id('h')), 0);
    await recordBlobs(db.env, 't1', [blob('h')], OLD);
    const copy = await copyDocument(db.env, 'A', 'B', 'visitor', 'Copy of A');
    const copied = copy!.tabs[0]!.id;
    expect(refsOf(db.sql, copied)).toEqual([id('h')]);
  });
});
