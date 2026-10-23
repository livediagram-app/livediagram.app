import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mediaGuestOwner } from '@liveworkspace/media';
import { sqliteD1, type SqliteD1 } from './test-sqlite-d1';
import { mediaServiceFor, type TestMediaService } from './test-media-service';
import { liveDoc, tabWith } from './db/test-image-fixtures';
import { deleteTabRow, upsertTab } from './db/tabs';
import { documentRemovalStatements } from './db/document-removal';
import { deleteAccount, migrateOwnerId } from './db/account';
import { flushMediaRefs, mediaOwner } from './media';

// livedocuments' side of the media service's references (liveworkspace/docs/media.md "References"): the
// writers queue the documents whose images changed, and the cron sends each one's whole set.

let db: SqliteD1;
let media: TestMediaService;

beforeEach(() => {
  db = sqliteD1();
  media = mediaServiceFor(db.env);
});
afterEach(() => vi.unstubAllGlobals());

// What is queued once the documents' pushes have landed (a document queues its set as it pushes it to D1).
const queued = async () => {
  await db.flush();
  return (
    db.sql.prepare('SELECT document_id FROM media_ref_outbox ORDER BY document_id').all() as {
      document_id: string;
    }[]
  ).map((r) => r.document_id);
};

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
  it('queues a document when a save changes its images, and only then', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1'), 0);
    expect(await queued()).toEqual([]);
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    expect(await queued()).toEqual(['D']);
    await db.flush();
    db.sql.exec('DELETE FROM media_ref_outbox');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    expect(await queued()).toEqual([]);
    await upsertTab(db.env, 'D', tabWith('t1'), 0);
    expect(await queued()).toEqual(['D']);
  });

  it('queues a document when a tab placing images goes, and not for one that placed none', async () => {
    liveDoc(db.sql, 'A', 'user_ada');
    await upsertTab(db.env, 'A', tabWith('t1', 'img-1'), 0);
    await upsertTab(db.env, 'A', tabWith('t2'), 1);
    await db.flush();
    db.sql.exec('DELETE FROM media_ref_outbox');
    await deleteTabRow(db.env, 'A', 't2');
    expect(await queued()).toEqual([]);
    await deleteTabRow(db.env, 'A', 't1');
    expect(await queued()).toEqual(['A']);
  });

  it('queues a removed document that placed images', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    liveDoc(db.sql, 'E', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    await upsertTab(db.env, 'E', tabWith('t2'), 0);
    await db.flush();
    db.sql.exec('DELETE FROM media_ref_outbox');
    await db.env.DB.batch(documentRemovalStatements(db.env, { ids: ['D', 'E'] }));
    expect(await queued()).toEqual(['D']);
  });
});

describe('flushMediaRefs', () => {
  it("sends each queued document's whole set, then says complete once the queue is empty", async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    await upsertTab(db.env, 'D', tabWith('t2', 'img-2'), 1);
    expect(await flushMediaRefs(db.env)).toBe(1);
    expect(serviceRefs()).toEqual(['D:img-1', 'D:img-2']);
    expect(await queued()).toEqual([]);
    expect(completed()).toHaveLength(1);
  });

  it('sends a removed document as placing nothing', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    await flushMediaRefs(db.env);
    await db.env.DB.batch(documentRemovalStatements(db.env, { ids: ['D'] }));
    await flushMediaRefs(db.env);
    expect(serviceRefs()).toEqual([]);
  });

  it('keeps a document queued again while it was sending', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    await db.flush();
    db.sql.prepare('UPDATE media_ref_outbox SET queued_at = queued_at - 10').run();
    const inner = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      db.sql.prepare('UPDATE media_ref_outbox SET queued_at = queued_at + 20').run();
      return inner(input, init);
    });
    await flushMediaRefs(db.env);
    expect(await queued()).toEqual(['D']);
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
    expect(await queued()).toEqual([]);
    expect(media.calls).toEqual([]);
  });
});

describe('the account', () => {
  const upload = (owner: string, sha: string) =>
    media.sql
      .prepare(
        `INSERT INTO images (id, owner, app, content_type, byte_size, width, height, sha256, created_at)
         VALUES (?, ?, 'livedocuments.app', 'image/png', 1, 1, 1, ?, 1)`,
      )
      .run(`${sha}-${owner}`, owner, sha);

  it("moves a guest's images to the account on sign-up, here and in the service", async () => {
    const guest = await mediaGuestOwner('livedocuments.app', 'guest-1');
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
    expect(await mediaOwner('guest-1')).toBe(await mediaGuestOwner('livedocuments.app', 'guest-1'));
  });
});
