// Largest Image and Image Storage with Pro on (liveworkspace/docs/specs/006-media/media.md "With Pro on"): the tier's
// limits in place of the legacy caps, Largest Image by the better of the uploader's and the item owner's and Image
// Storage by the uploader's own alone, nothing a request claims trusted, a declared size refused before the body is
// read, and the gallery's storage answer.
import {
  MAX_IMAGE_BYTES,
  MEDIA_ITEM_OWNER_HEADER,
  type MediaListResponse,
} from '@liveworkspace/media';
import { TIER_LIMITS } from '@liveworkspace/subscription';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import type { Env } from './env';
import { testDb, type TestDb } from './test-sqlite-d1';
import { person, subscriptionStub } from './test-subscription';

const BASE = 'https://liveworkspace.app/api/media';
const FREE = TIER_LIMITS.free;
const PRO = TIER_LIMITS.pro;
const TEAM = TIER_LIMITS.team;

let db: TestDb;
beforeEach(() => {
  db = testDb({ IMAGE_MAX_PER_OWNER: '2', IMAGE_MAX_BYTES_PER_OWNER: '20000000' });
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (size: number, seed = 1) => {
  const bytes = new Uint8Array(size);
  bytes.set(PNG);
  bytes[size - 1] = seed;
  return bytes;
};

type Sent = { owner: string; headers?: Record<string, string>; declared?: number };
const upload = (env: Env, bytes: Uint8Array | ReadableStream, sent: Sent) =>
  worker.fetch(
    new Request(`${BASE}/app/images?owner=${sent.owner}`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ld-key',
        'X-Media-App': 'livediagram.app',
        'Content-Type': 'image/png',
        'Content-Length': String(
          sent.declared ?? (bytes instanceof Uint8Array ? bytes.byteLength : 0),
        ),
        'X-Image-Width': '40',
        'X-Image-Height': '30',
        ...sent.headers,
      },
      body: bytes,
      duplex: 'half',
    } as RequestInit),
    env,
  );

const list = async (env: Env, owner: string) =>
  (await (
    await worker.fetch(
      new Request(`${BASE}/app/images?owner=${owner}`, {
        headers: { Authorization: 'Bearer ld-key', 'X-Media-App': 'livediagram.app' },
      }),
      env,
    )
  ).json()) as MediaListResponse;

// A picture's row without its bytes: what fills a gallery to its limit without uploading 500 MB.
const fill = (owner: string, bytes: number) =>
  db.env.MEDIA_DB.prepare(
    `INSERT INTO images (id, owner, app, content_type, byte_size, width, height, sha256, created_at)
     VALUES (?, ?, 'livediagram.app', 'image/png', ?, 1, 1, ?, 1)`,
  )
    .bind(`fill-${owner}`, owner, bytes, `sha-${owner}`)
    .run();

describe('with Pro off', () => {
  it('keeps the 10 MB cap and the caps from [vars], asks the service nothing and reports nothing', async () => {
    const sub = subscriptionStub();
    const env = { ...db.env, ...sub.env, PRO_ENABLED: 'false' };
    const owner = person('off');
    const over = await upload(env, png(16), { owner, declared: MAX_IMAGE_BYTES + 1 });
    expect(over.status).toBe(413);
    expect(await over.json()).toEqual({ error: 'file_too_large', limitBytes: MAX_IMAGE_BYTES });
    // Under the legacy 10 MiB: stored.
    expect((await upload(env, png(MAX_IMAGE_BYTES - 1), { owner })).status).toBe(200);
    expect((await upload(env, png(64, 2), { owner })).status).toBe(200);
    const full = await upload(env, png(64, 3), { owner });
    expect(await full.json()).toEqual({
      error: 'gallery_full',
      reason: 'count',
      limit: 2,
      current: 2,
    });
    expect(await list(env, owner)).not.toHaveProperty('storage');
    expect(sub.asked).toEqual([]);
    expect(sub.gauges).toEqual([]);
  });
});

describe('Largest Image', () => {
  it('takes an image of exactly 25 MB and refuses one byte more, saying the limit', async () => {
    const sub = subscriptionStub();
    const env = { ...db.env, ...sub.env };
    const owner = person('free');
    expect((await upload(env, png(FREE.imageMaxBytes), { owner })).status).toBe(200);
    const over = await upload(env, png(FREE.imageMaxBytes + 1), { owner });
    expect(over.status).toBe(413);
    expect(await over.json()).toEqual({
      error: 'file_too_large',
      limitBytes: FREE.imageMaxBytes,
      limit: FREE.imageMaxBytes,
      current: FREE.imageMaxBytes + 1,
      owner: `p:${owner}`,
    });
  });

  it('is the same 25 MB on Pro (owner, 2026-11-23): not a byte over', async () => {
    expect(PRO.imageMaxBytes).toBe(FREE.imageMaxBytes);
    const owner = person('pro');
    const sub = subscriptionStub({ [`p:${owner}`]: 'pro' });
    const env = { ...db.env, ...sub.env };
    expect((await upload(env, png(PRO.imageMaxBytes), { owner })).status).toBe(200);
    const over = await upload(env, png(16), { owner, declared: PRO.imageMaxBytes + 1 });
    expect(over.status).toBe(413);
    expect(await over.json()).toMatchObject({ limit: PRO.imageMaxBytes });
  });

  it('refuses a declared size over 25 MB before a byte of the body is read', async () => {
    const sub = subscriptionStub();
    const env = { ...db.env, ...sub.env };
    let read = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          read = true;
          controller.enqueue(png(1024));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const refused = await upload(env, body, {
      owner: person('free'),
      declared: FREE.imageMaxBytes + 1,
    });
    expect(refused.status).toBe(413);
    expect(await refused.json()).toMatchObject({
      error: 'file_too_large',
      limit: FREE.imageMaxBytes,
      current: FREE.imageMaxBytes + 1,
    });
    expect(read).toBe(false);
  });

  it('believes the body over the declared size', async () => {
    const sub = subscriptionStub();
    const env = { ...db.env, ...sub.env };
    const refused = await upload(env, png(FREE.imageMaxBytes + 1), {
      owner: person('free'),
      declared: 1024,
    });
    expect(refused.status).toBe(413);
  });
});

describe('who pays', () => {
  it('lends a Free uploader none of a Pro for Teams item’s storage', async () => {
    const owner = person('free');
    const sub = subscriptionStub({ 't:team_garden': 'team' });
    const env = { ...db.env, ...sub.env };
    const headers = { [MEDIA_ITEM_OWNER_HEADER]: 't:team_garden' };
    // Their gallery is their own: it fills at Free's 500 MB in the team's item too (it was the team's 250 GB, in
    // every app, charged to nobody), and the refusal names them, never the team.
    await fill(owner, FREE.imageStorageBytes);
    const full = await upload(env, png(64, 3), { owner, headers });
    expect(full.status).toBe(403);
    expect(await full.json()).toEqual({
      error: 'gallery_full',
      reason: 'bytes',
      limit: FREE.imageStorageBytes,
      current: FREE.imageStorageBytes,
      owner: `p:${owner}`,
    });
    expect(TEAM.imageStorageBytes).toBeGreaterThan(FREE.imageStorageBytes);
  });

  it('holds a guest’s gallery to Free in a paying owner’s item', async () => {
    const sub = subscriptionStub({ 'p:user_host2': 'pro' });
    const env = { ...db.env, ...sub.env };
    const guest = 'guest:9876fedc';
    const headers = { [MEDIA_ITEM_OWNER_HEADER]: 'p:user_host2' };
    await fill(guest, FREE.imageStorageBytes);
    const full = await upload(env, png(64), { owner: guest, headers });
    expect(await full.json()).toMatchObject({
      error: 'gallery_full',
      limit: FREE.imageStorageBytes,
      owner: null,
    });
  });

  it('lets a Pro uploader keep their own limits in a Free owner’s item', async () => {
    const owner = person('pro');
    const sub = subscriptionStub({ [`p:${owner}`]: 'pro' });
    const env = { ...db.env, ...sub.env };
    const headers = { [MEDIA_ITEM_OWNER_HEADER]: 'p:user_someone_free' };
    const stored = await upload(env, png(1024), { owner, headers });
    expect(stored.status).toBe(200);
    expect(sub.asked).toEqual(expect.arrayContaining([`p:${owner}`, 'p:user_someone_free']));
  });

  it('holds a guest to Largest Image, alone or in a paying owner’s item', async () => {
    const sub = subscriptionStub({ 'p:user_host': 'pro' });
    const env = { ...db.env, ...sub.env };
    const guest = 'guest:0123abcd';
    const alone = await upload(env, png(FREE.imageMaxBytes + 1), { owner: guest });
    expect(await alone.json()).toMatchObject({ limit: FREE.imageMaxBytes, owner: null });
    const hosted = await upload(env, png(1024), {
      owner: guest,
      headers: { [MEDIA_ITEM_OWNER_HEADER]: 'p:user_host' },
    });
    expect(hosted.status).toBe(200);
    // A guest has no subscription to show usage on.
    expect(sub.gauges).toEqual([]);
  });

  it('ignores a tier a request claims, in any header, and an item owner that is not a scope', async () => {
    const sub = subscriptionStub();
    const env = { ...db.env, ...sub.env };
    const owner = person('free');
    const claimed = await upload(env, png(FREE.imageMaxBytes + 1), {
      owner,
      headers: {
        'X-Subscription-Tier': 'team',
        'X-Tier': 'pro',
        'X-Media-Tier': 'pro',
        [MEDIA_ITEM_OWNER_HEADER]: 'team',
      },
    });
    expect(claimed.status).toBe(413);
    expect(await claimed.json()).toMatchObject({ limit: FREE.imageMaxBytes });
    // Only the uploader was ever looked up.
    expect(sub.asked).toEqual([`p:${owner}`]);
  });
});

describe('Image Storage', () => {
  it('fills at Free’s 500 MB by bytes, with no count cap, and names whose limit it is', async () => {
    const sub = subscriptionStub();
    const env = { ...db.env, ...sub.env };
    const owner = person('free');
    // The [vars] hold 2 images and 20 MB: neither applies with Pro on.
    for (const seed of [1, 2, 3]) {
      expect((await upload(env, png(600_000, seed), { owner })).status).toBe(200);
    }
    await fill(owner, FREE.imageStorageBytes - 3 * 600_000 - 100);
    expect((await upload(env, png(100, 4), { owner })).status).toBe(200);
    const full = await upload(env, png(100, 5), { owner });
    expect(full.status).toBe(403);
    expect(await full.json()).toEqual({
      error: 'gallery_full',
      reason: 'bytes',
      limit: FREE.imageStorageBytes,
      current: FREE.imageStorageBytes,
      owner: `p:${owner}`,
    });
  });

  it('stores more on Pro', async () => {
    const owner = person('pro');
    const sub = subscriptionStub({ [`p:${owner}`]: 'pro' });
    const env = { ...db.env, ...sub.env };
    await fill(owner, FREE.imageStorageBytes);
    expect((await upload(env, png(100), { owner })).status).toBe(200);
  });

  it('answers the gallery with its storage, from the owner’s own tier', async () => {
    const owner = person('free');
    const sub = subscriptionStub();
    const env = { ...db.env, ...sub.env };
    await upload(env, png(1000), { owner });
    expect((await list(env, owner)).storage).toEqual({
      used: 1000,
      limit: FREE.imageStorageBytes,
      maxImageBytes: FREE.imageMaxBytes,
      owner: `p:${owner}`,
    });
  });

  it('reports nothing to the subscription service: it is asked, live, when a person reads their usage', async () => {
    const owner = person('free');
    const sub = subscriptionStub();
    const env = { ...db.env, ...sub.env };
    const stored = await upload(env, png(1000), { owner });
    const { image } = (await stored.json()) as { image: { id: string } };
    await worker.fetch(
      new Request(`${BASE}/app/images/${image.id}?owner=${owner}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ld-key', 'X-Media-App': 'livediagram.app' },
      }),
      env,
    );
    expect(sub.gauges).toEqual([]);
  });
});
