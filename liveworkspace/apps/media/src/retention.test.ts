// The unused-image sweep (liveworkspace/docs/specs/006-media/media.md "Retention"), against the real schema.
import { beforeEach, describe, expect, it } from 'vitest';
import { syncRefs } from './refs';
import { sweepTripped, sweepUnusedImages } from './retention';
import { testDb, type TestDb } from './test-sqlite-d1';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 22);
const CUTOFF = NOW - 30 * DAY;

let db: TestDb;
beforeEach(() => {
  db = testDb();
});

function image(id: string, ageDays: number) {
  db.sql
    .prepare(
      `INSERT INTO images (id, owner, app, content_type, byte_size, width, height, sha256, original_name, created_at)
       VALUES (?, 'user_1', 'livediagram.app', 'image/png', 1, 1, 1, ?, NULL, ?)`,
    )
    .run(id, `sha-${id}`, NOW - ageDays * DAY);
  db.objects.set(id, { bytes: new Uint8Array([1]) });
}

const ids = () =>
  db.sql
    .prepare('SELECT id FROM images ORDER BY id')
    .all()
    .map((r) => r.id);

// Both keyed apps (livediagram and livedesign) report everything.
async function allReported() {
  await syncRefs(db.env, 'livediagram.app', [], true);
  await syncRefs(db.env, 'livedesign.app', [], true);
}

describe('sweepUnusedImages', () => {
  it('waits until every app with a key has reported its documents', async () => {
    image('old', 40);
    await syncRefs(db.env, 'livediagram.app', [], true);
    expect(await sweepUnusedImages(db.env, CUTOFF)).toBe(0);
    expect(ids()).toEqual(['old']);
    await syncRefs(db.env, 'livedesign.app', [], true);
    expect(await sweepUnusedImages(db.env, CUTOFF)).toBe(1);
    expect(ids()).toEqual([]);
    expect(db.objects.size).toBe(0);
  });

  it('keeps a young image and one any app places', async () => {
    image('young', 5);
    image('placed', 40);
    image('placed-elsewhere', 40);
    image('unplaced', 40);
    await allReported();
    await syncRefs(db.env, 'livediagram.app', [{ document: 'd1', images: ['placed'] }], false);
    await syncRefs(
      db.env,
      'livedesign.app',
      [{ document: 'p1', images: ['placed-elsewhere'] }],
      false,
    );
    expect(await sweepUnusedImages(db.env, CUTOFF)).toBe(1);
    expect(ids()).toEqual(['placed', 'placed-elsewhere', 'young']);
  });

  it('slows a run that would reap a suspicious share to one page, oldest first', async () => {
    for (let i = 0; i < 30; i++) image(`img-${String(i).padStart(2, '0')}`, 40 + i);
    await allReported();
    expect(sweepTripped(30, 30)).toBe(true);
    expect(await sweepUnusedImages(db.env, CUTOFF)).toBe(30);
    expect(ids()).toEqual([]);
  });

  it('does nothing without a bucket', async () => {
    image('old', 40);
    await allReported();
    expect(await sweepUnusedImages({ ...db.env, MEDIA: undefined }, CUTOFF)).toBe(0);
    expect(ids()).toEqual(['old']);
  });
});

describe('sweepTripped', () => {
  it('trips only past both the share and the count', () => {
    expect(sweepTripped(100, 20)).toBe(false);
    expect(sweepTripped(30, 21)).toBe(true);
    expect(sweepTripped(100, 40)).toBe(false);
  });
});
