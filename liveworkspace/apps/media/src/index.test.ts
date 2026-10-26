// The Worker over HTTP (liveworkspace/docs/specs/006-media/media.md "The API"): each app behind its own key, uploads and
// what they refuse, the gallery across apps, the bytes, references and owners.
import type {
  MediaImageResponse,
  MediaListResponse,
  MediaMergeResponse,
  MediaUploadResponse,
  MediaUsageResponse,
} from '@liveworkspace/media';
import { beforeEach, describe, expect, it } from 'vitest';
import worker from './index';
import type { Env } from './env';
import { testDb, type TestDb } from './test-sqlite-d1';

const BASE = 'https://liveworkspace.app/api/media';

let db: TestDb;
beforeEach(() => {
  db = testDb();
});

const call = (path: string, init: RequestInit = {}, env: Env = db.env) =>
  worker.fetch(new Request(`${BASE}${path}`, init), env);

const asApp = (path: string, init: RequestInit = {}, app = 'livediagram.app', key = 'ld-key') =>
  call(path, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'X-Media-App': app, ...init.headers },
  });
const asDesign = (path: string, init: RequestInit = {}) =>
  asApp(path, init, 'livedesign.app', 'lds-key');

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (seed: number, size = 32) =>
  new Uint8Array([...PNG_SIGNATURE, ...Array.from({ length: size }, (_, i) => (seed + i) % 256)]);

// A JPEG with an Exif segment (APP1) carrying a marker string the stored copy must not keep.
const segment = (marker: number, payload: number[]) => {
  const len = payload.length + 2;
  return [0xff, marker, (len >> 8) & 0xff, len & 0xff, ...payload];
};
const SECRET = [...new TextEncoder().encode('GPS-SECRET')];
const jpeg = () =>
  new Uint8Array([
    0xff,
    0xd8,
    ...segment(0xe1, SECRET),
    ...segment(0xdb, [0, 1, 2, 3]),
    ...segment(0xda, [0, 1, 2]),
    0x11,
    0x22,
    0xff,
    0xd9,
  ]);

const sha256 = async (bytes: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');

type UploadInit = {
  owner?: string;
  type?: string;
  width?: number;
  height?: number;
  name?: string;
  sha?: string;
};
const upload = (bytes: Uint8Array, init: UploadInit = {}, as = asApp) =>
  as(`/app/images?owner=${init.owner ?? 'user_1'}`, {
    method: 'POST',
    headers: {
      'Content-Type': init.type ?? 'image/png',
      'Content-Length': String(bytes.byteLength),
      'X-Image-Width': String(init.width ?? 40),
      'X-Image-Height': String(init.height ?? 30),
      ...(init.name ? { 'X-Image-Original-Name': encodeURIComponent(init.name) } : {}),
      ...(init.sha ? { 'X-Image-Sha256': init.sha } : {}),
    },
    body: bytes,
  });

const uploaded = async (bytes: Uint8Array, init: UploadInit = {}, as = asApp) => {
  const res = await upload(bytes, init, as);
  expect(res.status).toBe(200);
  return (await res.json()) as MediaUploadResponse;
};

describe('who may call', () => {
  it('turns away a caller without its app key', async () => {
    expect((await call('/app/images?owner=user_1')).status).toBe(401);
    expect((await asApp('/app/images?owner=user_1', {}, 'livediagram.app', 'wrong')).status).toBe(
      401,
    );
    // A key speaks only for its own app.
    expect((await asApp('/app/images?owner=user_1', {}, 'livedesign.app', 'ld-key')).status).toBe(
      401,
    );
    // An app given no key can't use the service at all.
    expect((await asApp('/app/images?owner=user_1', {}, 'liveplanner.app', '')).status).toBe(401);
  });

  it('answers nothing outside its API, or at all when switched off', async () => {
    const res = await worker.fetch(new Request('https://liveworkspace.app/api/other'), db.env);
    expect(res.status).toBe(404);
    const disabled = await call(
      '/app/images?owner=user_1',
      { headers: { Authorization: 'Bearer ld-key', 'X-Media-App': 'livediagram.app' } },
      { ...db.env, MEDIA_ENABLED: 'off' },
    );
    expect(disabled.status).toBe(404);
  });

  it('answers 503 without a bucket', async () => {
    const res = await call(
      '/app/images?owner=user_1',
      { headers: { Authorization: 'Bearer ld-key', 'X-Media-App': 'livediagram.app' } },
      { ...db.env, MEDIA: undefined },
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'media_unavailable' });
  });
});

describe('uploads', () => {
  it('stores a picture and lists it in the owner gallery, newest first', async () => {
    const first = await uploaded(png(1), { name: 'Screen shot 1.png' });
    expect(first.deduped).toBe(false);
    expect(first.image).toMatchObject({
      contentType: 'image/png',
      width: 40,
      height: 30,
      originalName: 'Screen shot 1.png',
      app: 'livediagram.app',
    });
    const second = await uploaded(png(2));
    db.sql
      .prepare('UPDATE images SET created_at = created_at - 1000 WHERE id = ?')
      .run(first.image.id);
    const list = (await (await asApp('/app/images?owner=user_1')).json()) as MediaListResponse;
    expect(list.images.map((i) => i.id)).toEqual([second.image.id, first.image.id]);
    expect(db.objects.has(first.image.id)).toBe(true);
    // Another owner sees none of it.
    const other = (await (await asApp('/app/images?owner=user_2')).json()) as MediaListResponse;
    expect(other.images).toEqual([]);
  });

  it('answers the same bytes from the same owner with the one image, in any app', async () => {
    const first = await uploaded(png(1));
    const again = await uploaded(png(1), {}, asDesign);
    expect(again).toEqual({ image: first.image, deduped: true });
    expect(db.objects.size).toBe(1);
    // A different owner with the same bytes gets their own.
    const theirs = await uploaded(png(1), { owner: 'user_2' });
    expect(theirs.image.id).not.toBe(first.image.id);
  });

  it('answers a known hash without reading the body', async () => {
    const first = await uploaded(png(1));
    const res = await upload(png(9), { sha: await sha256(png(1)) });
    expect(await res.json()).toEqual({ image: first.image, deduped: true });
  });

  it('refuses what is not an accepted picture', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect((await upload(svg, { type: 'image/svg+xml' })).status).toBe(415);
    // A declared PNG that is really an SVG.
    const smuggled = await upload(svg, { type: 'image/png' });
    expect(smuggled.status).toBe(415);
    expect(await smuggled.json()).toMatchObject({ error: 'unsupported_type' });
    // A JPEG declared as a PNG.
    expect((await upload(jpeg(), { type: 'image/png' })).status).toBe(415);
    expect(db.objects.size).toBe(0);
  });

  it('refuses a file over the cap and an upload with no size or dimensions', async () => {
    const big = await asApp('/app/images?owner=user_1', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(11 * 1024 * 1024),
        'X-Image-Width': '1',
        'X-Image-Height': '1',
      },
      body: png(1),
    });
    expect(big.status).toBe(413);
    expect((await upload(png(1), { width: 0 })).status).toBe(400);
    expect((await upload(png(1), { owner: '' })).status).toBe(400);
  });

  it('strips a JPEG of its metadata before storing it', async () => {
    const { image } = await uploaded(jpeg(), { type: 'image/jpeg' });
    const stored = db.objects.get(image.id)!.bytes;
    expect(new TextDecoder().decode(stored)).not.toContain('GPS-SECRET');
    expect(image.byteSize).toBe(stored.byteLength);
    // Uploading the same file again still dedupes, on the hash of the file as picked.
    expect((await uploaded(jpeg(), { type: 'image/jpeg' })).deduped).toBe(true);
  });

  it('holds each owner to the gallery caps across every app', async () => {
    const capped = { ...db.env, IMAGE_MAX_PER_OWNER: '2' };
    const send = async (seed: number, sha?: boolean) =>
      call(
        '/app/images?owner=user_1',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ld-key',
            'X-Media-App': 'livediagram.app',
            'Content-Type': 'image/png',
            'Content-Length': String(png(seed).byteLength),
            'X-Image-Width': '1',
            'X-Image-Height': '1',
            ...(sha ? { 'X-Image-Sha256': await sha256(png(seed)) } : {}),
          },
          body: png(seed),
        },
        capped,
      );
    expect((await send(1)).status).toBe(200);
    expect((await send(2)).status).toBe(200);
    const full = await send(3);
    expect(full.status).toBe(403);
    expect(await full.json()).toEqual({
      error: 'gallery_full',
      reason: 'count',
      limit: 2,
      current: 2,
    });
    // A file the owner already has still answers by its hash: it adds nothing.
    expect((await send(1, true)).status).toBe(200);
  });
});

describe('reading', () => {
  it('serves the bytes to any app, naming the owner for the app to apply its own rule', async () => {
    const { image } = await uploaded(png(1));
    const res = await asDesign(`/app/images/${image.id}/bytes`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('X-Media-Owner')).toBe('user_1');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(png(1));
    expect((await asDesign('/app/images/nope/bytes')).status).toBe(404);
  });

  it('answers one image with its owner', async () => {
    const { image } = await uploaded(png(1));
    const res = (await (await asApp(`/app/images/${image.id}`)).json()) as MediaImageResponse;
    expect(res).toEqual({ image, owner: 'user_1' });
    expect((await asApp('/app/images/nope')).status).toBe(404);
  });
});

describe('deleting', () => {
  it('lets only its owner delete an image, row and bytes', async () => {
    const { image } = await uploaded(png(1));
    const del = (owner: string) =>
      asApp(`/app/images/${image.id}?owner=${owner}`, { method: 'DELETE' });
    expect((await del('user_2')).status).toBe(403);
    expect(db.objects.has(image.id)).toBe(true);
    expect((await del('user_1')).status).toBe(200);
    expect(db.objects.has(image.id)).toBe(false);
    expect((await asApp(`/app/images/${image.id}`)).status).toBe(404);
    // Already gone is fine.
    expect((await del('user_1')).status).toBe(200);
  });

  it('deletes everything an account uploaded, in every app', async () => {
    await uploaded(png(1));
    await uploaded(png(2), {}, asDesign);
    const keep = await uploaded(png(3), { owner: 'user_2' });
    const res = await asApp('/app/owners/user_1', { method: 'DELETE' });
    expect(await res.json()).toEqual({ deleted: 2 });
    expect([...db.objects.keys()]).toEqual([keep.image.id]);
  });
});

describe('references and usage', () => {
  const sync = (body: unknown, as = asApp) =>
    as('/app/refs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('keeps each document to what it places now, per app, and maps the owner usage', async () => {
    const a = await uploaded(png(1));
    const b = await uploaded(png(2));
    expect(
      (await sync({ documents: [{ document: 'd1', images: [a.image.id, b.image.id] }] })).status,
    ).toBe(200);
    expect(
      (await sync({ documents: [{ document: 'p1', images: [a.image.id] }] }, asDesign)).status,
    ).toBe(200);
    // d1 drops b.
    await sync({ documents: [{ document: 'd1', images: [a.image.id] }] });
    const usage = (await (await asApp('/app/usage?owner=user_1')).json()) as MediaUsageResponse;
    expect(usage.usage).toEqual({
      [a.image.id]: [
        { app: 'livedesign.app', document: 'p1' },
        { app: 'livediagram.app', document: 'd1' },
      ],
    });
    // An empty list clears a document.
    await sync({ documents: [{ document: 'p1', images: [] }] }, asDesign);
    const after = (await (await asApp('/app/usage?owner=user_1')).json()) as MediaUsageResponse;
    expect(after.usage[a.image.id]).toEqual([{ app: 'livediagram.app', document: 'd1' }]);
  });

  it('refuses a malformed sync', async () => {
    expect((await sync({ documents: 'no' })).status).toBe(400);
    expect((await sync({ documents: [{ document: '', images: [] }] })).status).toBe(400);
    expect((await sync({ documents: [{ document: 'd', images: [1] }] })).status).toBe(400);
    const many = Array.from({ length: 501 }, (_, i) => ({ document: `d${i}`, images: [] }));
    expect((await sync({ documents: many })).status).toBe(400);
  });
});

describe('a guest signing up', () => {
  it('moves the guest images to the account, keeping those whose bytes the account has', async () => {
    const shared = await uploaded(png(1), { owner: 'user_1' });
    const dup = await uploaded(png(1), { owner: 'guest:abc' });
    const fresh = await uploaded(png(2), { owner: 'guest:abc' });
    const res = await asApp('/app/owners/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'guest:abc', to: 'user_1' }),
    });
    expect((await res.json()) as MediaMergeResponse).toEqual({
      moved: [fresh.image.id],
      kept: [dup.image.id],
    });
    const list = (await (await asApp('/app/images?owner=user_1')).json()) as MediaListResponse;
    expect(list.images.map((i) => i.id).sort()).toEqual([shared.image.id, fresh.image.id].sort());
  });
});
