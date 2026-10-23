import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamPerson } from '@liveworkspace/auth-client';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { mediaServiceFor, type TestMediaService } from '../test-media-service';
import { ACCOUNTS_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import { exportDocumentCopy, importDocumentCopy } from '../document-room/document-content';
import { drainOutbox, recordEditor } from '../document-room/document-outbox';
import { mediaOwner } from '../media';
import { upsertTab } from './tabs';
import { liveDoc, mediaImages, tabWith } from './test-image-fixtures';
import {
  clearImageGrantCachesForTests,
  documentMayServeImage,
  grantPlacedImages,
  imageOwners,
  servableImageIds,
} from './image-grants';

// Which images a document may serve (docs/specs/009-elements/images.md, "Placement grants"), in the document's own
// SQLite, against the real media service and the accounts stand-in for a team's people.

let db: SqliteD1;
let media: TestMediaService;
let accounts: FakeAccounts;

const member = (userId: string, status: TeamPerson['status'] = 'joined'): TeamPerson => ({
  id: `m-${userId}`,
  userId,
  email: `${userId}@x.test`,
  name: null,
  role: 'member',
  status,
});

beforeEach(() => {
  db = sqliteD1(ACCOUNTS_ON);
  accounts = stubAccounts();
  media = mediaServiceFor(db.env, { passOn: true });
  clearImageGrantCachesForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const grants = () =>
  (db.sql.prepare('SELECT image_id FROM image_grants ORDER BY image_id').all() as { image_id: string }[]).map(
    (r) => r.image_id,
  );

const exec = (q: string, ...b: (string | number)[]) => db.sql.prepare(q).run(...b);

describe('servableImageIds', () => {
  it("serves the document owner's own images, and refuses anyone else's", async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_ada', ['mine']);
    mediaImages(media, 'user_bob', ['bobs']);
    expect([...(await servableImageIds(db.env, 'D', ['mine', 'bobs', 'unknown']))]).toEqual(['mine']);
  });

  it("names a guest owner as the service does: by the hash of the guest's id", async () => {
    liveDoc(db.sql, 'D', 'guest-1');
    mediaImages(media, await mediaOwner('guest-1'), ['g']);
    expect(await documentMayServeImage(db.env, 'D', 'g')).toBe(true);
  });

  it('serves the images of someone who wrote to it since its last push', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_bob', ['bobs']);
    expect(await documentMayServeImage(db.env, 'D', 'bobs')).toBe(false);
    recordEditor(exec, 'D', 'user_bob', 1);
    expect(await documentMayServeImage(db.env, 'D', 'bobs')).toBe(true);
  });

  it("serves a joined teammate's images on a team's document, not an invited person's", async () => {
    liveDoc(db.sql, 'D', 'user_ada', 'D', 'team_1');
    accounts.teams.set('team_1', [member('user_ada'), member('user_bob'), member('user_cy', 'invited')]);
    mediaImages(media, 'user_bob', ['bobs']);
    mediaImages(media, 'user_cy', ['cys']);
    expect([...(await servableImageIds(db.env, 'D', ['bobs', 'cys']))]).toEqual(['bobs']);
  });

  it('asks the service once per image, then answers from the document', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_ada', ['a', 'b']);
    await servableImageIds(db.env, 'D', ['a', 'b']);
    await servableImageIds(db.env, 'D', ['a', 'b']);
    expect(media.calls.filter((c) => c.startsWith('GET /app/images/'))).toHaveLength(2);
    expect(await imageOwners(db.env, ['a', 'b'])).toEqual(
      new Map([
        ['a', 'user_ada'],
        ['b', 'user_ada'],
      ]),
    );
  });

  it('answers 200 placed images within budget', async () => {
    liveDoc(db.sql, 'D', 'user_ada', 'D', 'team_1');
    accounts.teams.set('team_1', [member('user_ada'), member('user_bob')]);
    const ids = Array.from({ length: 200 }, (_, i) => `img-${i}`);
    mediaImages(media, 'user_bob', ids);
    const cold = performance.now();
    expect((await servableImageIds(db.env, 'D', ids)).size).toBe(200);
    const coldMs = performance.now() - cold;
    const warm = performance.now();
    expect((await servableImageIds(db.env, 'D', ids)).size).toBe(200);
    const warmMs = performance.now() - warm;
    // Cold asks the service for each image (in process here); warm is two reads of the document's own tables.
    expect(coldMs).toBeLessThan(2_000);
    expect(warmMs).toBeLessThan(100);
  });
});

describe('placement grants', () => {
  it("grants an editor's placed images as the document pushes them, and keeps serving them after", async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_bob', ['bobs']);
    recordEditor(exec, 'D', 'user_bob', 1);
    await upsertTab(db.env, 'D', tabWith('t1', 'bobs'), 0);
    await drainOutbox(db.env, 'D', null);
    expect(grants()).toEqual(['bobs']);
    expect(db.sql.prepare(`SELECT 1 FROM outbox WHERE kind = 'edit'`).all()).toEqual([]);
    expect(await documentMayServeImage(db.env, 'D', 'bobs')).toBe(true);
  });

  it('grants nothing for an image its owner may not place here', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_ada', ['mine']);
    mediaImages(media, 'user_mallory', ['pasted']);
    expect(await grantPlacedImages(db.env, 'D', ['mine', 'pasted'], ['user_bob@1'], 1)).toBe(0);
    expect(grants()).toEqual([]);
  });

  it('a copy carries a grant for each image its source could serve, and only those', async () => {
    liveDoc(db.sql, 'S', 'user_ada');
    mediaImages(media, 'user_ada', ['adas']);
    mediaImages(media, 'user_mallory', ['pasted']);
    await upsertTab(db.env, 'S', tabWith('t1', 'adas', 'pasted'), 0);
    const copy = await exportDocumentCopy(db.env, 'S', null, null);
    expect(copy?.images).toEqual(['adas']);
    await importDocumentCopy(db.env, 'C', copy!);
    db.sql.prepare(`UPDATE document SET owner_id = 'user_bob', created_at = 1 WHERE id = 'C'`).run();
    expect(grants()).toEqual(['adas']);
    expect([...(await servableImageIds(db.env, 'C', ['adas', 'pasted']))]).toEqual(['adas']);
  });
});
