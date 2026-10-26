import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mediaGuestOwner } from '@liveworkspace/media';
import { sqliteD1, type SqliteD1 } from './test-sqlite-d1';
import { mediaServiceFor, type TestMediaService } from './test-media-service';
import { tabWith } from './db/test-image-fixtures';
import { deleteTabRow, upsertTab } from './db/tabs';
import { deleteAccount } from './db/account';
import { drainOutbox } from './design-room/design-outbox';
import {
  announceMediaRefs,
  forgetDesignMediaRefs,
  mergeMediaOwner,
  mediaOwner,
  pushDesignMediaRefs,
} from './media';

// livedesign's side of the media service (liveworkspace/docs/specs/006-media/media.md): each design's own outbox queues it when
// the images it places change, and its drain sends the design's whole set (whose each image is, for its serving
// rules, is db/image-grants.test.ts'); an account's images go with the account.

let db: SqliteD1;
let media: TestMediaService;

beforeEach(() => {
  db = sqliteD1();
  media = mediaServiceFor(db.env);
});
afterEach(() => vi.unstubAllGlobals());

function start(id: string, owner: string) {
  db.sql
    .prepare(
      'INSERT INTO test_designs (id, owner_id, name, saved_at, created_at) VALUES (?, ?, ?, 1, 1)',
    )
    .run(id, owner, id);
}

const upload = (owner: string, sha: string) => {
  const id = `img-${sha}`;
  media.sql
    .prepare(
      `INSERT INTO images (id, owner, app, content_type, byte_size, width, height, sha256, created_at)
       VALUES (?, ?, 'livedesign.app', 'image/png', 1, 1, 1, ?, 1)`,
    )
    .run(id, owner, sha);
  return id;
};

const queued = (design: string) =>
  db.sql.prepare("SELECT 1 FROM outbox WHERE design_id = ? AND kind = 'media'").all(design).length >
  0;

const serviceRefs = () =>
  (
    media.sql.prepare('SELECT document, image_id FROM refs ORDER BY document, image_id').all() as {
      document: string;
      image_id: string;
    }[]
  ).map((r) => `${r.document}:${r.image_id}`);

const completed = () =>
  media.sql.prepare('SELECT app FROM ref_sync WHERE completed_at IS NOT NULL').all();

// Drain the design's outbox as its alarm does, by direct call.
async function drain(design: string) {
  let more = true;
  while (more) more = (await drainOutbox(db.env, design)).more;
}

describe("a design's references", () => {
  it('queues the design when a save changes its images, and only then', async () => {
    start('D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1'), 0);
    await drain('D');
    expect(queued('D')).toBe(false);
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    expect(queued('D')).toBe(true);
    await drain('D');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    expect(queued('D')).toBe(false);
    await upsertTab(db.env, 'D', tabWith('t1'), 0);
    expect(queued('D')).toBe(true);
  });

  it("sends the design's whole set from its outbox, and says the app's set is complete", async () => {
    start('D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    await upsertTab(db.env, 'D', tabWith('t2', 'img-2', 'img-1'), 1);
    await drain('D');
    expect(serviceRefs()).toEqual(['D:img-1', 'D:img-2']);
    expect(queued('D')).toBe(false);
    expect(completed()).toHaveLength(1);
  });

  it('sends a tab dropped, and a design purged, as placing nothing', async () => {
    start('D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    await upsertTab(db.env, 'D', tabWith('t2', 'img-2'), 1);
    await drain('D');
    await deleteTabRow(db.env, 'D', 't2');
    await drain('D');
    expect(serviceRefs()).toEqual(['D:img-1']);
    await forgetDesignMediaRefs(db.env, 'D');
    expect(serviceRefs()).toEqual([]);
  });

  it('keeps the key when the service refuses, for the next drain', async () => {
    start('D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    const inner = globalThis.fetch;
    vi.stubGlobal('fetch', async () => new Response('down', { status: 503 }));
    await expect(pushDesignMediaRefs(db.env, 'D')).rejects.toThrow(/503/);
    vi.stubGlobal('fetch', inner);
    expect(queued('D')).toBe(true);
  });

  it('sends nothing without a media service, and drops the key', async () => {
    start('D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    const env = { ...db.env, MEDIA_KEY: undefined };
    let more = true;
    while (more) more = (await drainOutbox(env, 'D')).more;
    expect(queued('D')).toBe(false);
    expect(media.calls.filter((c) => c.startsWith('POST /app/refs'))).toEqual([]);
  });

  it('announces daily that the set is complete, so a quiet app never holds the sweep up', async () => {
    await announceMediaRefs(db.env);
    expect(media.calls).toEqual(['POST /app/refs']);
    expect(completed()).toHaveLength(1);
  });
});

describe('the account', () => {
  it("deletes an account's images from every app in the service", async () => {
    upload('user_ada', 'a');
    upload('user_bob', 'b');
    const gone = await deleteAccount(db.env, 'user_ada');
    expect(gone.images).toBe(1);
    expect(media.sql.prepare('SELECT owner FROM images').all()).toEqual([{ owner: 'user_bob' }]);
  });

  it("gives a guest's images to the account they became", async () => {
    upload(await mediaGuestOwner('livedesign.app', 'guest-1'), 'a');
    await mergeMediaOwner(db.env, 'guest-1', 'user_ada');
    expect(media.sql.prepare('SELECT owner FROM images').all()).toEqual([{ owner: 'user_ada' }]);
    // Again, as the index's retry would: nothing left to move.
    await mergeMediaOwner(db.env, 'guest-1', 'user_ada');
    expect(media.sql.prepare('SELECT owner FROM images').all()).toEqual([{ owner: 'user_ada' }]);
  });

  it('names an account by its id and a guest by a hash of its id', async () => {
    expect(await mediaOwner('user_ada')).toBe('user_ada');
    expect(await mediaOwner('guest-1')).toBe(await mediaGuestOwner('livedesign.app', 'guest-1'));
  });
});
