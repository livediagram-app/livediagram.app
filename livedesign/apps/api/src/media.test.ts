import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mediaGuestOwner } from '@liveworkspace/media';
import { sqliteD1, type SqliteD1 } from './test-sqlite-d1';
import { mediaServiceFor, type TestMediaService } from './test-media-service';
import { liveDoc, tabWith } from './db/test-image-fixtures';
import { deleteTabRow, linkTabToDesign, upsertTab } from './db/tabs';
import { designRemovalStatements } from './db/design-removal';
import { deleteAccount, migrateOwnerId } from './db/account';
import { flushMediaRefs, mediaOwner } from './media';

// livedesign's side of the media service's references (liveworkspace/docs/media.md "References"): the
// writers queue the designs whose images changed, and the cron sends each one's whole set.

let db: SqliteD1;
let media: TestMediaService;

beforeEach(() => {
  db = sqliteD1();
  media = mediaServiceFor(db.env);
});
afterEach(() => vi.unstubAllGlobals());

const queued = () =>
  (
    db.sql.prepare('SELECT design_id FROM media_ref_outbox ORDER BY design_id').all() as {
      design_id: string;
    }[]
  ).map((r) => r.design_id);

const serviceRefs = () =>
  (
    media.sql.prepare('SELECT document, image_id FROM refs ORDER BY document, image_id').all() as {
      document: string;
      image_id: string;
    }[]
  ).map((r) => `${r.document}:${r.image_id}`);

const completed = () =>
  media.sql.prepare('SELECT app FROM ref_sync WHERE completed_at IS NOT NULL').all();

describe('the reference queue', () => {
  it('queues a design when a save changes its images, and only then', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1'), 0);
    expect(queued()).toEqual([]);
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    expect(queued()).toEqual(['D']);
    db.sql.exec('DELETE FROM media_ref_outbox');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    expect(queued()).toEqual([]);
    await upsertTab(db.env, 'D', tabWith('t1'), 0);
    expect(queued()).toEqual(['D']);
  });

  it('queues every design holding a shared tab, and a design a tab is linked into or out of', async () => {
    liveDoc(db.sql, 'A', 'user_ada');
    liveDoc(db.sql, 'B', 'user_ada');
    await upsertTab(db.env, 'A', tabWith('t1', 'img-1'), 0);
    db.sql.exec('DELETE FROM media_ref_outbox');
    await linkTabToDesign(db.env, 'B', 't1');
    expect(queued()).toEqual(['B']);
    db.sql.exec('DELETE FROM media_ref_outbox');
    await upsertTab(db.env, 'A', tabWith('t1', 'img-2'), 0);
    expect(queued()).toEqual(['A', 'B']);
    db.sql.exec('DELETE FROM media_ref_outbox');
    await deleteTabRow(db.env, 'B', 't1');
    expect(queued()).toEqual(['B']);
  });

  it('queues a removed design that placed images', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    liveDoc(db.sql, 'E', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    await upsertTab(db.env, 'E', tabWith('t2'), 0);
    db.sql.exec('DELETE FROM media_ref_outbox');
    await db.env.DB.batch(designRemovalStatements(db.env, { ids: ['D', 'E'] }));
    expect(queued()).toEqual(['D']);
  });
});

describe('flushMediaRefs', () => {
  it("sends each queued design's whole set, then says complete once the queue is empty", async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    await upsertTab(db.env, 'D', tabWith('t2', 'img-2'), 1);
    expect(await flushMediaRefs(db.env)).toBe(1);
    expect(serviceRefs()).toEqual(['D:img-1', 'D:img-2']);
    expect(queued()).toEqual([]);
    expect(completed()).toHaveLength(1);
  });

  it('sends a removed design as placing nothing', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    await flushMediaRefs(db.env);
    await db.env.DB.batch(designRemovalStatements(db.env, { ids: ['D'] }));
    await flushMediaRefs(db.env);
    expect(serviceRefs()).toEqual([]);
  });

  it('keeps a design queued again while it was sending', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    db.sql.prepare('UPDATE media_ref_outbox SET queued_at = queued_at - 10').run();
    const inner = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      db.sql.prepare('UPDATE media_ref_outbox SET queued_at = queued_at + 20').run();
      return inner(input, init);
    });
    await flushMediaRefs(db.env);
    expect(queued()).toEqual(['D']);
  });

  it('sends nothing when nothing is queued, except the daily run that says complete', async () => {
    expect(await flushMediaRefs(db.env)).toBe(0);
    expect(media.calls).toEqual([]);
    await flushMediaRefs(db.env, true);
    expect(media.calls).toEqual(['POST /app/refs']);
    expect(completed()).toHaveLength(1);
  });

  it('drops the queue when this deploy has no media service', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    await flushMediaRefs({ ...db.env, MEDIA_KEY: undefined });
    expect(queued()).toEqual([]);
    expect(media.calls).toEqual([]);
  });
});

describe('the account', () => {
  const upload = (owner: string, sha: string) =>
    media.sql
      .prepare(
        `INSERT INTO images (id, owner, app, content_type, byte_size, width, height, sha256, created_at)
         VALUES (?, ?, 'livedesign.app', 'image/png', 1, 1, 1, ?, 1)`,
      )
      .run(`${sha}-${owner}`, owner, sha);

  it("moves a guest's images to the account on sign-up, here and in the service", async () => {
    const guest = await mediaGuestOwner('livedesign.app', 'guest-1');
    upload(guest, 'a');
    db.sql
      .prepare("INSERT INTO media_images (id, owner_id) VALUES (?, 'guest-1')")
      .run(`a-${guest}`);
    const moved = await migrateOwnerId(db.env, 'guest-1', 'user_ada');
    expect(moved.images).toBe(1);
    expect(media.sql.prepare('SELECT owner FROM images').all()).toEqual([{ owner: 'user_ada' }]);
    expect(db.sql.prepare('SELECT owner_id FROM media_images').all()).toEqual([
      { owner_id: 'user_ada' },
    ]);
  });

  it("deletes an account's images from every app, here and in the service", async () => {
    upload('user_ada', 'a');
    upload('user_bob', 'b');
    db.sql
      .prepare("INSERT INTO media_images (id, owner_id) VALUES ('a-user_ada', 'user_ada')")
      .run();
    const gone = await deleteAccount(db.env, 'user_ada');
    expect(gone.images).toBe(1);
    expect(media.sql.prepare('SELECT owner FROM images').all()).toEqual([{ owner: 'user_bob' }]);
    expect(db.sql.prepare('SELECT * FROM media_images').all()).toEqual([]);
  });

  it('names an account by its id and a guest by a hash of its id', async () => {
    expect(await mediaOwner('user_ada')).toBe('user_ada');
    expect(await mediaOwner('guest-1')).toBe(await mediaGuestOwner('livedesign.app', 'guest-1'));
  });
});
