import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mediaGuestOwner } from '@liveworkspace/media';
import { makeTestRouteContext } from './test-route-context';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { mediaServiceFor, type TestMediaService } from '../test-media-service';
import { tabWith } from '../db/test-image-fixtures';
import { upsertTab } from '../db/tabs';
import type { Env } from '../types';

// handleImages over the real media service (liveworkspace/docs/media.md), in this process: the gallery,
// uploads and deletes go to it, and the byte read keeps this api's own policy (docs/specs/009-elements/images.md):
// the image's owner, OR a reader of a design (the index's grant) that places the image and may serve it, as the
// design's own store answers.

const { resolveDesignGrant } = vi.hoisted(() => ({ resolveDesignGrant: vi.fn() }));
vi.mock('./design-grant', () => ({ resolveDesignGrant }));

// The index's app client, for the Timeline's "Images Uploaded".
const { pushPersonEvents } = vi.hoisted(() => ({ pushPersonEvents: vi.fn(async () => {}) }));
vi.mock('../index-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../index-service')>()),
  indexAppClient: () => ({ pushPersonEvents }),
}));

// The index as the caller reaches it, for the Gallery's usage names.
const { clientFor } = vi.hoisted(() => ({ clientFor: vi.fn() }));
vi.mock('./index-adapters', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./index-adapters')>()),
  clientFor,
}));

// The index's grant to read a design, the whole design or one tab of it.
const viewGrant = (tab: string | null = null) => ({ level: 'view', tab });

import { handleImages, originalNameOf } from './images';
import { ORIGINAL_NAME_MAX } from '@liveworkspace/media';

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4,
]);
const OTHER_PNG = new Uint8Array([...PNG, 9]);

let db: SqliteD1;
let media: TestMediaService;

beforeEach(() => {
  db = sqliteD1();
  media = mediaServiceFor(db.env);
  resolveDesignGrant.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

type Opts = { owner?: string | null; workbench?: unknown; token?: { id: string }; env?: Env };

let waits: Promise<unknown>[] = [];

const call = (method: string, path: string, opts: Opts = {}, request?: RequestInit) => {
  const ctx = makeTestRouteContext(method, path, {
    owner: opts.owner === undefined ? 'user_ada' : opts.owner,
    env: opts.env ?? db.env,
    ...(opts.workbench ? { workbench: opts.workbench as never } : {}),
    ...(opts.token ? { token: opts.token } : {}),
  });
  const waitUntil = (p: Promise<unknown>) => void waits.push(p);
  if (!request) return handleImages({ ...ctx, waitUntil });
  return handleImages({
    ...ctx,
    waitUntil,
    request: new Request(`https://api.test${path}`, { method, ...request }),
  });
};

const upload = (bytes: Uint8Array, opts: Opts = {}, headers: Record<string, string> = {}) =>
  call('POST', '/api/images', opts, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(bytes.byteLength),
      'X-Image-Width': '4',
      'X-Image-Height': '3',
      ...headers,
    },
    body: bytes,
  });

async function uploaded(bytes = PNG, opts: Opts = {}): Promise<string> {
  const res = await upload(bytes, opts);
  expect(res.status).toBe(200);
  return (await res.json<{ image: { id: string } }>()).image.id;
}

const mirror = () =>
  db.sql.prepare('SELECT image_id, owner_id FROM image_owners ORDER BY image_id').all() as {
    image_id: string;
    owner_id: string;
  }[];

function start(id: string, owner: string) {
  db.sql
    .prepare(
      'INSERT INTO test_designs (id, owner_id, name, saved_at, created_at) VALUES (?, ?, ?, 1, 1)',
    )
    .run(id, owner, id);
}

describe('handleImages', () => {
  it('503 without the media service (deployment without MEDIA_KEY)', async () => {
    const env = { ...db.env, MEDIA_KEY: undefined } as Env;
    expect((await call('GET', '/api/images', { env })).status).toBe(503);
  });

  it('400 listing the gallery with no owner', async () => {
    expect((await call('GET', '/api/images', { owner: null })).status).toBe(400);
  });

  it("puts a new upload on the uploader's Timeline, and not the same bytes again", async () => {
    pushPersonEvents.mockClear();
    waits = [];
    await upload(PNG);
    await upload(PNG);
    await Promise.all(waits);
    expect(pushPersonEvents).toHaveBeenCalledTimes(1);
    expect(pushPersonEvents).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'image_uploaded', actorId: 'user_ada', count: 1 }),
    ]);
  });

  it('uploads to the service and dedupes the same bytes', async () => {
    const first = await upload(PNG);
    expect(first.status).toBe(200);
    const body = (await first.json()) as { image: Record<string, unknown>; deduped: boolean };
    expect(body.deduped).toBe(false);
    expect(body.image).toMatchObject({ contentType: 'image/png', width: 4, height: 3 });
    expect(body.image).not.toHaveProperty('app');
    const again = (await (await upload(PNG)).json()) as { image: { id: string }; deduped: boolean };
    expect(again).toMatchObject({ image: { id: body.image.id }, deduped: true });
  });

  it("keeps a guest's id in this api: the service holds the guest's images under a hash", async () => {
    const id = await uploaded(PNG, { owner: 'guest-1' });
    const owners = media.sql.prepare('SELECT owner FROM images').all() as { owner: string }[];
    expect(owners).toEqual([{ owner: await mediaGuestOwner('livedesign.app', 'guest-1') }]);
    // The guest reads their own image back by their own id.
    expect((await call('GET', `/api/images/${id}`, { owner: 'guest-1' })).status).toBe(200);
  });

  it('lists the gallery from every app', async () => {
    const id = await uploaded();
    media.sql
      .prepare(
        `INSERT INTO images (id, owner, app, content_type, byte_size, width, height, sha256, created_at)
         VALUES ('from-docs', 'user_ada', 'livedesigns.app', 'image/png', 1, 1, 1, 'x', 1)`,
      )
      .run();
    const res = await call('GET', '/api/images');
    const { images } = (await res.json()) as { images: { id: string }[] };
    expect(images.map((i) => i.id).sort()).toEqual(['from-docs', id].sort());
    expect(images[0]).not.toHaveProperty('app');
  });

  it('refuses an unsupported type or an oversize file without calling the service', async () => {
    const svg = await upload(PNG, {}, { 'Content-Type': 'image/svg+xml' });
    expect(svg.status).toBe(415);
    const big = await call(
      'POST',
      '/api/images',
      {},
      {
        headers: { 'Content-Type': 'image/png', 'Content-Length': String(11 * 1024 * 1024) },
        body: PNG,
      },
    );
    expect(big.status).toBe(413);
    expect(media.calls).toEqual([]);
  });

  it("passes the service's refusals on: a full gallery, bytes that aren't the declared type", async () => {
    await uploaded();
    media.env.IMAGE_MAX_PER_OWNER = '1';
    const full = await upload(OTHER_PNG);
    expect(full.status).toBe(403);
    expect(await full.json()).toMatchObject({ error: 'gallery_full', reason: 'count', limit: 1 });
    const fake = await upload(new Uint8Array([1, 2, 3, 4]), { owner: 'user_bob' });
    expect(fake.status).toBe(415);
  });

  describe('the hash-only dedupe shortcut', () => {
    const probe = (opts: Opts) => upload(new Uint8Array([0]), opts, { 'X-Image-Sha256': sha });
    let sha = '';
    beforeEach(async () => {
      const digest = await crypto.subtle.digest('SHA-256', PNG);
      sha = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    });

    it("answers the owner's own editor from the hash alone", async () => {
      const id = await uploaded();
      const res = await probe({});
      expect(await res.json()).toMatchObject({ image: { id }, deduped: true });
    });

    it.each([
      [
        'a workbench session',
        { workbench: { designId: 'd1', ownerId: 'user_ada', sessionId: 's1' } },
      ],
      ['an API token', { token: { id: 'tok-1' } }],
    ])('never answers %s from the hash alone', async (_label, opts) => {
      const id = await uploaded();
      const res = await probe(opts);
      expect(res.status).toBe(415);
      expect(JSON.stringify(await res.json())).not.toContain(id);
    });
  });

  describe('the byte read', () => {
    it('serves the owner, privately and with the stored type', async () => {
      const id = await uploaded();
      const res = await call('GET', `/api/images/${id}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/png');
      expect(res.headers.get('Cache-Control')).toBe('private, max-age=86400');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
    });

    it('404s an unknown image, and remembers so without asking again', async () => {
      expect((await call('GET', '/api/images/nope')).status).toBe(404);
      expect((await call('GET', '/api/images/nope')).status).toBe(404);
      expect(media.calls).toEqual(['GET /app/images/nope']);
    });

    it('404s a non-owner with no design to read it through', async () => {
      const id = await uploaded();
      expect((await call('GET', `/api/images/${id}`, { owner: 'user_bob' })).status).toBe(404);
    });

    it('serves a reader of a design that places the image and may serve it', async () => {
      const id = await uploaded();
      start('d1', 'user_ada');
      await upsertTab(db.env, 'd1', tabWith('t1', id), 0);
      resolveDesignGrant.mockResolvedValue(viewGrant());
      const res = await call('GET', `/api/images/${id}?d=d1`, { owner: 'visitor' });
      expect(res.status).toBe(200);
    });

    it('serves an image uploaded in another app, asking the service whose it is', async () => {
      media.sql
        .prepare(
          `INSERT INTO images (id, owner, app, content_type, byte_size, width, height, sha256, created_at)
           VALUES ('from-docs', 'user_ada', 'livedesigns.app', 'image/png', 16, 4, 3, 'x', 1)`,
        )
        .run();
      media.objects.set('from-docs', { bytes: PNG, contentType: 'image/png' });
      start('d1', 'user_ada');
      await upsertTab(db.env, 'd1', tabWith('t1', 'from-docs'), 0);
      resolveDesignGrant.mockResolvedValue(viewGrant());
      const res = await call('GET', '/api/images/from-docs?d=d1', { owner: 'visitor' });
      expect(res.status).toBe(200);
      // The design learnt whose it is the first time it judged it.
      expect(mirror()).toEqual([{ image_id: 'from-docs', owner_id: 'user_ada' }]);
    });

    it('404s a readable design that places the image but may not serve it', async () => {
      const id = await uploaded();
      start('d2', 'user_mallory');
      await upsertTab(db.env, 'd2', tabWith('t2', id), 0);
      resolveDesignGrant.mockResolvedValue(viewGrant());
      const res = await call('GET', `/api/images/${id}?d=d2`, { owner: 'visitor' });
      expect(res.status).toBe(404);
    });

    // docs/specs/013-workspace/workbench-embeds.md: a workbench session reads images through its own design
    // only, never by owning them, so it cannot walk its owner's gallery by id.
    describe('under a workbench session', () => {
      const workbench = { scope: 'design', designId: 'd1', ownerId: 'user_ada' };

      it('skips the owner shortcut and refuses any design but its own', async () => {
        const id = await uploaded();
        expect((await call('GET', `/api/images/${id}`, { workbench })).status).toBe(404);
        resolveDesignGrant.mockResolvedValue(viewGrant());
        expect((await call('GET', `/api/images/${id}?d=d2`, { workbench })).status).toBe(404);
        expect(resolveDesignGrant).not.toHaveBeenCalled();
      });

      it('serves an image its own design serves', async () => {
        const id = await uploaded();
        start('d1', 'user_ada');
        await upsertTab(db.env, 'd1', tabWith('t1', id), 0);
        resolveDesignGrant.mockResolvedValue(viewGrant());
        expect((await call('GET', `/api/images/${id}?d=d1`, { workbench })).status).toBe(200);
      });
    });
  });

  describe('usage', () => {
    // Images the owner keeps in the service, and the items, in any app, that place them.
    const placed = (refs: [app: string, document: string, image: string][]) => {
      const image = media.sql.prepare(
        `INSERT OR IGNORE INTO images (id, owner, app, content_type, byte_size, width, height, sha256, created_at)
         VALUES (?, 'user_ada', 'livedesign.app', 'image/png', 4, 1, 1, ?, 1)`,
      );
      const ref = media.sql.prepare('INSERT INTO refs (app, document, image_id) VALUES (?, ?, ?)');
      for (const [app, document, id] of refs) {
        image.run(id, `sha-${id}`);
        ref.run(app, document, id);
      }
    };
    const index = (items: Record<string, { title: string; app: string; trashedAt?: number }>) =>
      clientFor.mockReturnValue({
        getItem: async (id: string) => {
          const found = items[id];
          if (!found) throw new Error('not_found');
          return { item: { id, trashedAt: null, ...found } };
        },
      });

    // An image placed only in a livedocuments document read "Not used": the gallery lists every app's images but
    // counted only designs.
    it("names each image's items in every app, by name", async () => {
      placed([
        ['livedesign.app', 'P', 'a'],
        ['livedocuments.app', 'D', 'a'],
        ['livedocuments.app', 'gone', 'b'],
        ['livediagram.app', 'T', 'b'],
      ]);
      index({
        P: { title: 'Poster', app: 'livedesign' },
        D: { title: 'Brief', app: 'livedocuments' },
        T: { title: 'Board', app: 'livediagram', trashedAt: 1 },
      });
      expect(await (await call('GET', '/api/images/usage')).json()).toEqual({
        usage: {
          a: [
            { id: 'D', name: 'Brief', app: 'livedocuments' },
            { id: 'P', name: 'Poster', app: 'livedesign' },
          ],
        },
      });
    });

    it('answers an empty map, without the index, when nothing places them', async () => {
      expect(await (await call('GET', '/api/images/usage')).json()).toEqual({ usage: {} });
      expect(clientFor).not.toHaveBeenCalled();
    });
  });

  describe('DELETE', () => {
    it("refuses another owner's image", async () => {
      const id = await uploaded();
      expect((await call('DELETE', `/api/images/${id}`, { owner: 'user_bob' })).status).toBe(403);
      expect(media.objects.has(id)).toBe(true);
    });

    it("deletes the owner's image from the service and forgets it here", async () => {
      const id = await uploaded();
      const res = await call('DELETE', `/api/images/${id}`);
      expect(await res.json()).toEqual({ ok: true });
      expect(media.objects.has(id)).toBe(false);
    });

    it('is idempotent: ok when the image is already gone', async () => {
      expect(await (await call('DELETE', '/api/images/gone')).json()).toEqual({ ok: true });
    });
  });
});

// A file's own name rides a header, percent-encoded by the editor: a header is Latin-1 only.
describe('originalNameOf', () => {
  it('decodes an encoded name, keeps an older raw one, and caps the length', () => {
    const screenshot = 'Screenshot 2026-10-10 at 9.41.02 AM.png';
    expect(originalNameOf(encodeURIComponent(screenshot))).toBe(screenshot);
    expect(originalNameOf(encodeURIComponent('diagram 図 😀.png'))).toBe('diagram 図 😀.png');
    expect(originalNameOf('100% done.png')).toBe('100% done.png');
    expect(originalNameOf(null)).toBeNull();
    expect(Array.from(originalNameOf(encodeURIComponent('😀'.repeat(500)))!)).toHaveLength(
      ORIGINAL_NAME_MAX,
    );
  });
});
