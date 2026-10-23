import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMediaClient, mediaGuestOwner } from '@liveworkspace/media';
import { sqliteD1, type SqliteD1 } from './test-sqlite-d1';
import { mediaServiceFor, type TestMediaService } from './test-media-service';
import { liveDoc, mediaImages, tabWith } from './db/test-image-fixtures';
import { deleteTabRow, upsertTab } from './db/tabs';
import { deleteAccount } from './db/account';
import { drainOutbox, forgetImageRefs } from './document-room/document-outbox';
import {
  clearMediaOwnersForTests,
  MEDIA_APP,
  mediaImageOwner,
  mediaOwner,
  rememberMediaOwner,
} from './media';

// livedocuments' side of the media service's references (liveworkspace/docs/media.md "References"): each document
// tells the service its whole set of images as it changes, from its own outbox, and a purged one tells it none.

let db: SqliteD1;
let media: TestMediaService;

beforeEach(() => {
  db = sqliteD1();
  media = mediaServiceFor(db.env);
  clearMediaOwnersForTests();
});
afterEach(() => vi.unstubAllGlobals());

const pending = () =>
  (
    db.sql
      .prepare(`SELECT document_id FROM outbox WHERE kind = 'images' ORDER BY document_id`)
      .all() as {
      document_id: string;
    }[]
  ).map((r) => r.document_id);

const serviceRefs = () =>
  (
    media.sql.prepare('SELECT document, image_id FROM refs ORDER BY document, image_id').all() as {
      document: string;
      image_id: string;
    }[]
  ).map((r) => `${r.document}:${r.image_id}`);

const push = (id: string) => drainOutbox(db.env, id, null);

describe("a document's images", () => {
  it('owes the service its set when a save changes its images, and only then', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1'), 0);
    await push('D');
    await upsertTab(db.env, 'D', tabWith('t1'), 0);
    expect(pending()).toEqual([]);
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    expect(pending()).toEqual(['D']);
    await push('D');
    expect(pending()).toEqual([]);
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    expect(pending()).toEqual([]);
  });

  it('sends the whole set, across its tabs, and the set without a tab that goes', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1', 'img-2'), 0);
    await upsertTab(db.env, 'D', tabWith('t2', 'img-2', 'img-3'), 1);
    await push('D');
    expect(serviceRefs()).toEqual(['D:img-1', 'D:img-2', 'D:img-3']);
    await deleteTabRow(db.env, 'D', 't1');
    expect(pending()).toEqual(['D']);
    await push('D');
    expect(serviceRefs()).toEqual(['D:img-2', 'D:img-3']);
  });

  it('keeps its key when the service fails, for the next drain', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    db.env.MEDIA_KEY = 'wrong';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(push('D')).rejects.toThrow(/media/);
    expect(pending()).toEqual(['D']);
  });

  it('drops its key without a media service', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    db.env.MEDIA_KEY = undefined;
    await push('D');
    expect(pending()).toEqual([]);
    expect(media.calls).toEqual([]);
  });

  it('a purged document places nothing', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    await upsertTab(db.env, 'D', tabWith('t1', 'img-1'), 0);
    await push('D');
    await forgetImageRefs(db.env, 'D');
    expect(serviceRefs()).toEqual([]);
  });
});

describe('whose an image is', () => {
  it('asks the service once per image, and forgets an image its owner deleted', async () => {
    mediaImages(media, 'user_ada', ['a']);
    const client = createMediaClient({
      app: MEDIA_APP,
      key: db.env.MEDIA_KEY!,
      url: db.env.MEDIA_URL,
    });
    expect(await mediaImageOwner(client, 'a')).toBe('user_ada');
    expect(await mediaImageOwner(client, 'a')).toBe('user_ada');
    expect(await mediaImageOwner(client, 'nope')).toBe('');
    expect(media.calls).toEqual(['GET /app/images/a', 'GET /app/images/nope']);
    rememberMediaOwner('a', null);
    await mediaImageOwner(client, 'a');
    expect(media.calls).toHaveLength(3);
  });

  it('names an account by its id and a guest by a hash of its id', async () => {
    expect(await mediaOwner('user_ada')).toBe('user_ada');
    expect(await mediaOwner('guest-1')).toBe(await mediaGuestOwner('livedocuments.app', 'guest-1'));
  });
});

describe('the account', () => {
  it("deletes an account's images from every app in the service", async () => {
    mediaImages(media, 'user_ada', ['a']);
    mediaImages(media, 'user_bob', ['b']);
    const gone = await deleteAccount(db.env, 'user_ada');
    expect(gone.images).toBe(1);
    expect(media.sql.prepare('SELECT owner FROM images').all()).toEqual([{ owner: 'user_bob' }]);
  });
});
