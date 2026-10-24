import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamPerson } from '@liveworkspace/auth-client';
import { recordItemEditor } from '@liveworkspace/index-app';
import { sqliteD1, testCopyDesign, type SqliteD1 } from '../test-sqlite-d1';
import { mediaServiceFor, type TestMediaService } from '../test-media-service';
import { ACCOUNTS_ENV, fakeAccounts, type FakeAccounts } from '../test-accounts';
import { DESIGN_OUTBOX, drainOutbox } from '../design-room/design-outbox';
import { mediaOwner } from '../media';
import { upsertTab } from './tabs';
import { liveDesign, mediaImages, tabWith } from './test-image-fixtures';
import {
  clearImageGrantCachesForTests,
  designServesImage,
  grantPlacedImages,
  imageOwners,
  servableImageIds,
} from './image-grants';

// Which images a design may serve (docs/specs/009-elements/images.md, "Placement grants"), in the design's own
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
  db = sqliteD1(ACCOUNTS_ENV);
  media = mediaServiceFor(db.env);
  accounts = fakeAccounts(globalThis.fetch);
  vi.stubGlobal('fetch', accounts.fetch);
  clearImageGrantCachesForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const grants = () =>
  (
    db.sql.prepare('SELECT image_id FROM image_grants ORDER BY image_id').all() as {
      image_id: string;
    }[]
  ).map((r) => r.image_id);

const exec = (q: string, ...b: (string | number)[]) => db.sql.prepare(q).run(...b);
const lookups = () => media.calls.filter((c) => c.startsWith('GET /app/images/')).length;

describe('designServesImage', () => {
  it("serves the design owner's own image it places, and no one else's", async () => {
    liveDesign(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_ada', ['mine']);
    mediaImages(media, 'user_bob', ['bobs']);
    await upsertTab(db.env, 'D', tabWith('t1', 'mine', 'bobs', 'unknown'), 0);
    expect(await designServesImage(db.env, 'D', 'mine')).toBe(true);
    expect(await designServesImage(db.env, 'D', 'bobs')).toBe(false);
    expect(await designServesImage(db.env, 'D', 'unknown')).toBe(false);
  });

  it('refuses an image the design does not place, even its owner’s, asking the service nothing', async () => {
    liveDesign(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_ada', ['elsewhere']);
    expect(await designServesImage(db.env, 'D', 'elsewhere')).toBe(false);
    expect(lookups()).toBe(0);
  });

  it('confines a tab-scoped visitor to their own tab', async () => {
    liveDesign(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_ada', ['i1', 'i2']);
    await upsertTab(db.env, 'D', tabWith('t1', 'i1'), 0);
    await upsertTab(db.env, 'D', tabWith('t2', 'i2'), 1);
    expect(await designServesImage(db.env, 'D', 'i1', 't1')).toBe(true);
    expect(await designServesImage(db.env, 'D', 'i2', 't1')).toBe(false);
  });

  it("names a guest owner as the service does: by the hash of the guest's id", async () => {
    liveDesign(db.sql, 'D', 'guest-1');
    mediaImages(media, await mediaOwner('guest-1'), ['g']);
    await upsertTab(db.env, 'D', tabWith('t1', 'g'), 0);
    expect(await designServesImage(db.env, 'D', 'g')).toBe(true);
  });
});

describe('servableImageIds', () => {
  it('serves the images of someone who wrote to it since its last push', async () => {
    liveDesign(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_bob', ['bobs']);
    expect([...(await servableImageIds(db.env, 'D', ['bobs']))]).toEqual([]);
    recordItemEditor(exec, DESIGN_OUTBOX, 'D', 'user_bob', 1);
    expect([...(await servableImageIds(db.env, 'D', ['bobs']))]).toEqual(['bobs']);
  });

  it("serves a joined teammate's images on a team's design, not an invited person's", async () => {
    liveDesign(db.sql, 'D', 'user_ada', 'team_1');
    accounts.teamPeople.set('team_1', [
      member('user_ada'),
      member('user_bob'),
      member('user_cy', 'invited'),
    ]);
    mediaImages(media, 'user_bob', ['bobs']);
    mediaImages(media, 'user_cy', ['cys']);
    expect([...(await servableImageIds(db.env, 'D', ['bobs', 'cys']))]).toEqual(['bobs']);
  });

  it('asks the service once per image, then answers from the design, an unknown id as no one’s', async () => {
    liveDesign(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_ada', ['a', 'b']);
    await servableImageIds(db.env, 'D', ['a', 'b', 'nope']);
    await servableImageIds(db.env, 'D', ['a', 'b', 'nope']);
    expect(lookups()).toBe(3);
    expect(await imageOwners(db.env, ['a', 'b', 'nope'])).toEqual(
      new Map([
        ['a', 'user_ada'],
        ['b', 'user_ada'],
        ['nope', ''],
      ]),
    );
  });

  it('answers 200 placed images within budget', async () => {
    liveDesign(db.sql, 'D', 'user_ada', 'team_1');
    accounts.teamPeople.set('team_1', [member('user_ada'), member('user_bob')]);
    const ids = Array.from({ length: 200 }, (_, i) => `img-${i}`);
    mediaImages(media, 'user_bob', ids);
    const cold = performance.now();
    expect((await servableImageIds(db.env, 'D', ids)).size).toBe(200);
    const coldMs = performance.now() - cold;
    const warm = performance.now();
    expect((await servableImageIds(db.env, 'D', ids)).size).toBe(200);
    const warmMs = performance.now() - warm;
    // Cold asks the service for each image (in process here); warm is two reads of the design's own tables.
    expect(coldMs).toBeLessThan(2_000);
    expect(warmMs).toBeLessThan(100);
  });
});

describe('placement grants', () => {
  it("grants an editor's placed images as the design pushes them, and keeps serving them after", async () => {
    liveDesign(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_bob', ['bobs']);
    recordItemEditor(exec, DESIGN_OUTBOX, 'D', 'user_bob', 1);
    await upsertTab(db.env, 'D', tabWith('t1', 'bobs'), 0);
    await drainOutbox(db.env, 'D', null);
    expect(grants()).toEqual(['bobs']);
    expect(db.sql.prepare(`SELECT 1 FROM outbox WHERE kind = 'edit'`).all()).toEqual([]);
    expect(await designServesImage(db.env, 'D', 'bobs')).toBe(true);
  });

  it('grants nothing for an image its owner may not place here', async () => {
    liveDesign(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_ada', ['mine']);
    mediaImages(media, 'user_mallory', ['pasted']);
    expect(await grantPlacedImages(db.env, 'D', ['mine', 'pasted'], ['user_bob@1'], 1)).toBe(0);
    expect(grants()).toEqual([]);
  });

  it("a copy serves the source's images, nothing the source could not, and needs no service to know whose", async () => {
    liveDesign(db.sql, 'src', 'user_ada');
    mediaImages(media, 'user_ada', ['adas']);
    mediaImages(media, 'user_carol', ['planted']);
    await upsertTab(db.env, 'src', tabWith('t1', 'adas', 'planted'), 0);
    await testCopyDesign(db.env, 'src', 'copy', 'user_visitor', 'Copy');
    expect(grants()).toEqual(['adas']);
    const asked = lookups();
    expect([...(await servableImageIds(db.env, 'copy', ['adas', 'planted']))]).toEqual(['adas']);
    expect(lookups()).toBe(asked);
  });
});

describe('edges', () => {
  it('answers nothing for no images, or for a design it does not hold', async () => {
    liveDesign(db.sql, 'D', 'user_ada');
    expect(await servableImageIds(db.env, 'D', [])).toEqual(new Set());
    expect(await servableImageIds(db.env, 'missing', ['a'])).toEqual(new Set());
    expect(await grantPlacedImages(db.env, 'D', [], [], 1)).toBe(0);
    expect(await grantPlacedImages(db.env, 'missing', ['a'], [], 1)).toBe(0);
    expect(media.calls).toEqual([]);
  });

  it('serves no image when the media service is not set up', async () => {
    liveDesign(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_ada', ['mine']);
    await upsertTab(db.env, 'D', tabWith('t1', 'mine'), 0);
    const env = { ...db.env, MEDIA_KEY: undefined };
    expect(await designServesImage(env, 'D', 'mine')).toBe(false);
  });
});
