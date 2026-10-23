import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { mediaServiceFor, type TestMediaService } from '../test-media-service';
import { exportDocumentCopy, importDocumentCopy } from '../document-room/document-content';
import { drainOutbox, recordEditor } from '../document-room/document-outbox';
import { mediaOwner } from '../media';
import { documentPlacesImage } from './image-refs';
import { upsertTab } from './tabs';
import { liveDoc, mediaImages, tabWith } from './test-image-fixtures';
import {
  clearImageGrantCachesForTests,
  documentMayServeImage,
  grantPlacedImages,
  imageOwners,
  servableImageIds,
} from './image-grants';

// Which images a canvas may serve (docs/specs/009-elements/images.md, "Placement grants"), in the canvas's own
// SQLite, against the real media service. A team's joined people are the liveworkspace accounts Worker's
// (liveworkspace/team-people.ts), stood in for here.

const { teams } = vi.hoisted(() => ({ teams: new Map<string, string[]>() }));
vi.mock('../liveworkspace/team-people', () => ({
  joinedMembers: async (_env: unknown, teamId: string) => teams.get(teamId) ?? [],
}));

let db: SqliteD1;
let media: TestMediaService;

beforeEach(() => {
  db = sqliteD1();
  media = mediaServiceFor(db.env);
  teams.clear();
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

// The byte endpoint's whole share check (document-room servesImage): the canvas places the image, in the visitor's
// tab when the link is tab-scoped, and may serve it.
async function servesImage(documentId: string, imageId: string, onlyTabId: string | null = null) {
  const [placed, may] = await Promise.all([
    documentPlacesImage(db.env, documentId, imageId, onlyTabId),
    documentMayServeImage(db.env, documentId, imageId),
  ]);
  return placed && may;
}

describe('servableImageIds', () => {
  it("serves the canvas owner's own images, and refuses anyone else's", async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_ada', ['mine']);
    mediaImages(media, 'user_bob', ['bobs']);
    expect([...(await servableImageIds(db.env, 'D', ['mine', 'bobs', 'unknown']))]).toEqual([
      'mine',
    ]);
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

  it("serves a joined teammate's images on a team's canvas, not an invited person's", async () => {
    liveDoc(db.sql, 'D', 'user_ada', 'D', 'team_1');
    // joinedMembers answers only the joined: user_cy is invited.
    teams.set('team_1', ['user_ada', 'user_bob']);
    mediaImages(media, 'user_bob', ['bobs']);
    mediaImages(media, 'user_cy', ['cys']);
    expect([...(await servableImageIds(db.env, 'D', ['bobs', 'cys']))]).toEqual(['bobs']);
  });

  it('asks the service once per image, then answers from the canvas', async () => {
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
    teams.set('team_1', ['user_ada', 'user_bob']);
    const ids = Array.from({ length: 200 }, (_, i) => `img-${i}`);
    mediaImages(media, 'user_bob', ids);
    const cold = performance.now();
    expect((await servableImageIds(db.env, 'D', ids)).size).toBe(200);
    const coldMs = performance.now() - cold;
    const warm = performance.now();
    expect((await servableImageIds(db.env, 'D', ids)).size).toBe(200);
    const warmMs = performance.now() - warm;
    // Cold asks the service for each image (in process here); warm is two reads of the canvas's own tables.
    expect(coldMs).toBeLessThan(2_000);
    expect(warmMs).toBeLessThan(100);
  });
});

describe('the share check', () => {
  it('refuses an image the canvas does not place, even its owner’s', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_ada', ['elsewhere']);
    expect(await servesImage('D', 'elsewhere')).toBe(false);
  });

  // The paste-the-id case: a reader of Ada's canvas copies an image id into a canvas of their own.
  it("refuses another owner's image placed in a canvas that owner has no tie to", async () => {
    liveDoc(db.sql, 'theirs', 'user_mallory');
    mediaImages(media, 'user_ada', ['adas']);
    await upsertTab(db.env, 'theirs', tabWith('t1', 'adas'), 0);
    expect(await servesImage('theirs', 'adas')).toBe(false);
  });

  it('confines a tab-scoped visitor to their own tab', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_ada', ['i1', 'i2']);
    await upsertTab(db.env, 'D', tabWith('t1', 'i1'), 0);
    await upsertTab(db.env, 'D', tabWith('t2', 'i2'), 1);
    expect(await servesImage('D', 'i1', 't1')).toBe(true);
    expect(await servesImage('D', 'i2', 't1')).toBe(false);
  });
});

describe('placement grants', () => {
  it("grants an editor's placed images as the canvas pushes them, and keeps serving them after", async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_bob', ['bobs']);
    recordEditor(exec, 'D', 'user_bob', 1);
    await upsertTab(db.env, 'D', tabWith('t1', 'bobs'), 0);
    await drainOutbox(db.env, 'D', null);
    expect(grants()).toEqual(['bobs']);
    expect(db.sql.prepare(`SELECT 1 FROM outbox WHERE kind = 'edit'`).all()).toEqual([]);
    expect(await documentMayServeImage(db.env, 'D', 'bobs')).toBe(true);
  });

  // A grant outlives the membership: a teammate's images keep serving once they leave the team, or the canvas
  // changes hands.
  it("keeps a teammate's granted image serving after they leave and the canvas changes owner", async () => {
    liveDoc(db.sql, 'D', 'user_ada', 'D', 'team_1');
    teams.set('team_1', ['user_ada', 'user_bob']);
    mediaImages(media, 'user_bob', ['bobs']);
    await upsertTab(db.env, 'D', tabWith('t1', 'bobs'), 0);
    await drainOutbox(db.env, 'D', null);
    expect(grants()).toEqual(['bobs']);
    teams.set('team_1', ['user_ada']);
    db.sql.prepare(`UPDATE document SET owner_id = 'user_cy', team_id = NULL WHERE id = 'D'`).run();
    clearImageGrantCachesForTests();
    expect(await servesImage('D', 'bobs')).toBe(true);
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
    db.sql
      .prepare(`UPDATE document SET owner_id = 'user_bob', created_at = 1 WHERE id = 'C'`)
      .run();
    expect(grants()).toEqual(['adas']);
    expect([...(await servableImageIds(db.env, 'C', ['adas', 'pasted']))]).toEqual(['adas']);
  });

  it('a Community copy carries them too', async () => {
    liveDoc(db.sql, 'S', 'user_ada');
    mediaImages(media, 'user_ada', ['adas']);
    await upsertTab(db.env, 'S', tabWith('t1', 'adas'), 0);
    const copy = await exportDocumentCopy(db.env, 'S', null, null, true);
    expect(copy?.images).toEqual(['adas']);
  });
});

describe('edges', () => {
  it('answers nothing for no images, or for a canvas it does not hold', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    expect(await servableImageIds(db.env, 'D', [])).toEqual(new Set());
    expect(await servableImageIds(db.env, 'missing', ['a'])).toEqual(new Set());
    expect(await grantPlacedImages(db.env, 'D', [], [], 1)).toBe(0);
    expect(await grantPlacedImages(db.env, 'missing', ['a'], [], 1)).toBe(0);
    expect(media.calls).toEqual([]);
  });

  it('serves no image when the media service is not set up', async () => {
    liveDoc(db.sql, 'D', 'user_ada');
    mediaImages(media, 'user_ada', ['mine']);
    const env = { ...db.env, MEDIA_KEY: undefined };
    expect(await documentMayServeImage(env, 'D', 'mine')).toBe(false);
  });

  it('serves an ownerless canvas no one else’s images, and a team accounts does not know only its own', async () => {
    liveDoc(db.sql, 'O', '');
    liveDoc(db.sql, 'T', 'user_ada', 'T', 'team_gone');
    mediaImages(media, 'user_bob', ['bobs']);
    expect(await documentMayServeImage(db.env, 'O', 'bobs')).toBe(false);
    expect(await documentMayServeImage(db.env, 'T', 'bobs')).toBe(false);
  });
});
