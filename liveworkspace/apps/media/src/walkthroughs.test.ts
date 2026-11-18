// Walkthroughs at the service (liveworkspace/docs/specs/006-media/walkthroughs.md): starting one, its media, reading,
// deleting by owner, item and account, the caps, sniffing, the guest merge and the sweep of abandoned starts.
import {
  createMediaClient,
  WALKTHROUGH_MAX_MS,
  WALKTHROUGH_MEDIA_MAX_BYTES,
  WALKTHROUGH_PENDING_MS,
  WALKTHROUGHS_PER_ITEM_MAX,
  type WalkthroughEvents,
} from '@liveworkspace/media';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import type { Env } from './env';
import { testDb, type TestDb } from './test-sqlite-d1';
import { parseRange, sweepPendingWalkthroughs } from './walkthroughs';

let db: TestDb;
beforeEach(() => {
  db = testDb({ WALKTHROUGH_MAX_PER_OWNER: '3', WALKTHROUGH_MAX_BYTES_PER_OWNER: '100000' });
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

const fetchVia = (env: Env) =>
  (async (input: RequestInfo | URL, init?: RequestInit) =>
    worker.fetch(new Request(input as string, init), env)) as typeof fetch;

const client = (app: 'livediagram.app' | 'livedesign.app' = 'livediagram.app', env: Env = db.env) =>
  createMediaClient({
    app,
    key: app === 'livediagram.app' ? 'ld-key' : 'lds-key',
    url: 'https://liveworkspace.app/api/media',
    fetch: fetchVia(env),
  }).walkthroughs;

const WEBM = new Uint8Array([
  0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
]);
const MP4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 1, 2, 3, 4, 5, 6, 7, 8]);

const events = (over: Partial<WalkthroughEvents> = {}): WalkthroughEvents => ({
  v: 1,
  durationMs: 4000,
  camera: true,
  corner: 'bottom-left',
  startTab: 'tab-1',
  hidden: ['secret'],
  fingerprints: { 'tab-1': 'abc' },
  events: [
    { t: 0, k: 'view', cx: 10, cy: 20, zoom: 1, w: 800, h: 600 },
    { t: 500, k: 'point', id: 'secret' },
    { t: 600, k: 'point', id: 'shown' },
    { t: 900, k: 'cursor', x: 3, y: 4 },
  ],
  ...over,
});

const startOne = (
  over: {
    item?: string;
    mediaBytes?: number;
    mediaType?: string;
    owner?: string;
    screen?: boolean;
  } = {},
  calls = client(),
) =>
  calls.start(over.owner ?? 'user_1', {
    item: over.item ?? 'doc-1',
    title: '  Tour  of   the  canvas ',
    author: 'Ada',
    mediaType: (over.mediaType ?? 'video/webm') as 'video/webm',
    mediaBytes: over.mediaBytes ?? WEBM.byteLength,
    events: over.screen ? events({ screen: true, events: [], hidden: [] }) : events(),
  });

const ready = async (over: Parameters<typeof startOne>[0] = {}, bytes = WEBM, calls = client()) => {
  const started = await startOne({ mediaBytes: bytes.byteLength, ...over }, calls);
  if (!started.ok) throw new Error(JSON.stringify(started));
  const id = started.value.walkthrough.id;
  const put = await calls.upload(over.owner ?? 'user_1', id, {
    body: bytes.slice().buffer,
    type: over.mediaType ?? 'video/webm',
    length: bytes.byteLength,
  });
  expect(put.ok).toBe(true);
  return id;
};

describe('starting and storing one', () => {
  it('stores the sealed events, then the media, and lists it once ready', async () => {
    const started = await startOne();
    expect(started.ok && started.value.walkthrough).toMatchObject({
      item: 'doc-1',
      title: 'Tour of the canvas',
      author: 'Ada',
      durationMs: 4000,
      camera: true,
      ready: false,
    });
    const id = started.ok ? started.value.walkthrough.id : '';
    // Not listed, nor readable, until its media arrives.
    expect((await client().list('doc-1')).ok && (await client().list('doc-1'))).toMatchObject({
      value: { walkthroughs: [] },
    });
    expect(await client().read(id)).toBeNull();
    // The hidden element's press never reached storage.
    const stored = JSON.parse(
      new TextDecoder().decode(db.objects.get(`walkthroughs/${id}/events.json`)!.bytes),
    );
    expect(stored.events.map((e: { k: string }) => e.k)).toEqual(['view', 'point', 'cursor']);
    expect(stored.events[1].id).toBe('shown');

    const put = await client().upload('user_1', id, {
      body: WEBM.slice().buffer,
      type: 'video/webm;codecs=vp8,opus',
      length: WEBM.byteLength,
    });
    expect(put.ok && put.value.walkthrough.ready).toBe(true);
    const listed = await client().list('doc-1');
    expect(listed.ok && listed.value.walkthroughs.map((w) => [w.walkthrough.id, w.owner])).toEqual([
      [id, 'user_1'],
    ]);
    const read = await client().read(id);
    expect(read?.ok && read.value.events.hidden).toEqual(['secret']);
    const media = await client().media(id, 'doc-1');
    expect(media?.contentType).toBe('video/webm');
    expect(new Uint8Array(await new Response(media!.body).arrayBuffer())).toEqual(WEBM);
    // On another item it is not there.
    expect(await client().media(id, 'doc-2')).toBeNull();
  });

  it("lists a person's own ready ones across the app, newest first, for the Explorer's library", async () => {
    const first = await ready({ item: 'doc-1' });
    const second = await ready({ item: 'doc-2' });
    await ready({ item: 'doc-1', owner: 'user_2' });
    await startOne({ item: 'doc-3' }); // never uploaded: not ready, so not listed
    const listed = await client().listOwned('user_1');
    const ids = listed.ok ? listed.value.walkthroughs.map((w) => w.walkthrough.id) : [];
    expect(new Set(ids)).toEqual(new Set([first, second]));
    expect(listed.ok && listed.value.walkthroughs.every((w) => w.owner === 'user_1')).toBe(true);
    const other = await client('livedesign.app').listOwned('user_1');
    expect(other.ok && other.value.walkthroughs).toEqual([]);
  });

  it('takes Safari MP4 too', async () => {
    const id = await ready({ mediaType: 'audio/mp4' }, MP4);
    expect((await client().read(id))?.ok).toBe(true);
  });

  it('answers only to its own app', async () => {
    const id = await ready();
    expect(await client('livedesign.app').read(id)).toBeNull();
    expect(await client('livedesign.app').media(id, 'doc-1')).toBeNull();
    const listed = await client('livedesign.app').list('doc-1');
    expect(listed.ok && listed.value.walkthroughs).toEqual([]);
  });

  it('refuses a start that is not one, cheapest first', async () => {
    const raw = (body: unknown, headers: Record<string, string> = {}) =>
      worker.fetch(
        new Request('https://liveworkspace.app/api/media/app/walkthroughs?owner=user_1', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ld-key',
            'X-Media-App': 'livediagram.app',
            ...headers,
          },
          body: typeof body === 'string' ? body : JSON.stringify(body),
        }),
        db.env,
      );
    expect((await raw('not json')).status).toBe(400);
    expect((await raw('{}', { 'Content-Length': String(3 * 1024 * 1024) })).status).toBe(413);
    expect((await raw({ item: '' })).status).toBe(400);
    const bad = await startOne({ mediaType: 'video/quicktime' });
    expect(bad.ok ? 0 : bad.status).toBe(415);
    const big = await startOne({ mediaBytes: WALKTHROUGH_MEDIA_MAX_BYTES + 1 });
    expect(bad.ok || big.ok ? 'ok' : big.body).toMatchObject({ error: 'file_too_large' });
    const long = await client().start('user_1', {
      item: 'doc-1',
      title: '',
      author: null,
      mediaType: 'audio/webm',
      mediaBytes: 10,
      events: events({ durationMs: WALKTHROUGH_MAX_MS + 1, events: [] }),
    });
    expect(long.ok ? 0 : long.status).toBe(413);
    expect((await raw({ item: 'x' }, {})).status).toBe(415);
    expect(
      (
        await raw({
          item: 'doc-1',
          mediaType: 'audio/webm',
          mediaBytes: 10,
          events: { v: 2 },
        })
      ).status,
    ).toBe(400);
    const noOwner = await worker.fetch(
      new Request('https://liveworkspace.app/api/media/app/walkthroughs', {
        method: 'POST',
        headers: { Authorization: 'Bearer ld-key', 'X-Media-App': 'livediagram.app' },
        body: '{}',
      }),
      db.env,
    );
    expect(noOwner.status).toBe(400);
  });

  it('refuses media that is not what was declared, or not its owner', async () => {
    const started = await startOne();
    const id = started.ok ? started.value.walkthrough.id : '';
    const wrongOwner = await client().upload('user_2', id, {
      body: WEBM.slice().buffer,
      type: 'video/webm',
      length: WEBM.byteLength,
    });
    expect(wrongOwner.ok ? 0 : wrongOwner.status).toBe(403);
    const wrongType = await client().upload('user_1', id, {
      body: WEBM.slice().buffer,
      type: 'audio/webm',
      length: WEBM.byteLength,
    });
    expect(wrongType.ok ? 0 : wrongType.status).toBe(400);
    // The bytes are not WebM: stored, sniffed, deleted.
    const notWebm = new Uint8Array(WEBM.byteLength).fill(7);
    const sniffed = await client().upload('user_1', id, {
      body: notWebm.buffer,
      type: 'video/webm',
      length: notWebm.byteLength,
    });
    expect(sniffed.ok ? 0 : sniffed.status).toBe(415);
    expect(db.objects.has(`walkthroughs/${id}/media`)).toBe(false);
    const missing = await client().upload('user_1', 'nope', {
      body: WEBM.slice().buffer,
      type: 'video/webm',
      length: WEBM.byteLength,
    });
    expect(missing.ok ? 0 : missing.status).toBe(404);
    await client().upload('user_1', id, {
      body: WEBM.slice().buffer,
      type: 'video/webm',
      length: WEBM.byteLength,
    });
    const again = await client().upload('user_1', id, {
      body: WEBM.slice().buffer,
      type: 'video/webm',
      length: WEBM.byteLength,
    });
    expect(again.ok ? 0 : again.status).toBe(409);
  });

  it('refuses a stored size other than the one declared', async () => {
    const started = await startOne({ mediaBytes: WEBM.byteLength });
    const id = started.ok ? started.value.walkthrough.id : '';
    // A lying Content-Length: the stored object is what arrived.
    const res = await worker.fetch(
      new Request(`https://liveworkspace.app/api/media/app/walkthroughs/${id}/media?owner=user_1`, {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ld-key',
          'X-Media-App': 'livediagram.app',
          'Content-Type': 'video/webm',
          'Content-Length': String(WEBM.byteLength),
        },
        body: WEBM.slice(0, 10),
      }),
      db.env,
    );
    expect(res.status).toBe(400);
  });
});

describe('caps', () => {
  it('holds a person to their count and bytes, and an item to its fifty', async () => {
    await ready();
    await ready();
    await ready();
    const fourth = await startOne();
    expect(fourth.ok ? 0 : fourth.body).toMatchObject({
      error: 'walkthroughs_full',
      reason: 'count',
    });
    const bytes = await startOne({ owner: 'user_2', mediaBytes: 200_000 });
    expect(bytes.ok ? 0 : bytes.body).toMatchObject({
      error: 'walkthroughs_full',
      reason: 'bytes',
    });

    const open = testDb();
    for (let i = 0; i < WALKTHROUGHS_PER_ITEM_MAX; i++) {
      open.sql
        .prepare(
          `INSERT INTO walkthroughs (id, owner, app, item, title, duration_ms, media_type, media_bytes, events_bytes, camera, ready, created_at)
           VALUES (?, 'user_9', 'livediagram.app', 'doc-1', 't', 1, 'audio/webm', 1, 1, 0, 1, ?)`,
        )
        .run(`w${i}`, i);
    }
    const full = await startOne({}, client('livediagram.app', open.env));
    expect(full.ok ? 0 : full.body).toMatchObject({ error: 'item_full', limit: 50 });
  });

  it('has no cap where none is set', async () => {
    const open = testDb();
    for (let i = 0; i < 4; i++) await ready({}, WEBM, client('livediagram.app', open.env));
  });
});

describe('deleting', () => {
  it('lets its owner delete it, and the app for its item, and nobody else', async () => {
    const id = await ready();
    const stranger = await client().remove(id, { owner: 'user_2' });
    expect(stranger.ok ? 0 : stranger.status).toBe(403);
    const otherItem = await client().remove(id, { item: 'doc-2' });
    expect(otherItem.ok ? 0 : otherItem.status).toBe(403);
    expect((await client().remove(id, { owner: 'user_1' })).ok).toBe(true);
    expect(db.objects.has(`walkthroughs/${id}/media`)).toBe(false);
    expect(db.objects.has(`walkthroughs/${id}/events.json`)).toBe(false);
    // Gone already: nothing to refuse.
    expect((await client().remove(id, { owner: 'user_1' })).ok).toBe(true);
    const second = await ready();
    expect((await client().remove(second, { item: 'doc-1' })).ok).toBe(true);
  });

  it('purges every walkthrough on an item, pending ones too', async () => {
    await ready();
    await startOne();
    await ready({ item: 'doc-2' });
    const purged = await client().purge('doc-1');
    expect(purged.ok && purged.value.deleted).toBe(2);
    const left = await client().list('doc-2');
    expect(left.ok && left.value.walkthroughs.length).toBe(1);
  });

  it('goes with its owner, and moves with a guest who signs up', async () => {
    const id = await ready({ owner: 'guest:abc' });
    const call = (path: string, init: RequestInit = {}) =>
      worker.fetch(
        new Request(`https://liveworkspace.app/api/media/app${path}`, {
          ...init,
          headers: {
            Authorization: 'Bearer ld-key',
            'X-Media-App': 'livediagram.app',
            ...init.headers,
          },
        }),
        db.env,
      );
    await call('/owners/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'guest:abc', to: 'user_7' }),
    });
    const listed = await client().list('doc-1');
    expect(listed.ok && listed.value.walkthroughs[0]!.owner).toBe('user_7');
    await call('/owners/user_7', { method: 'DELETE' });
    expect(db.objects.has(`walkthroughs/${id}/media`)).toBe(false);
    expect(await client().read(id)).toBeNull();
  });

  it('logs and keeps going when R2 will not delete', async () => {
    const id = await ready();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = {
      ...db.env,
      MEDIA: { ...db.env.MEDIA!, delete: async () => Promise.reject(new Error('r2')) } as R2Bucket,
    };
    expect((await client('livediagram.app', env).remove(id, { owner: 'user_1' })).ok).toBe(true);
    expect(error).toHaveBeenCalledWith('[media] walkthrough R2 delete failed', expect.any(Error));
  });
});

describe('the sweep', () => {
  it('deletes starts whose media never came, after an hour', async () => {
    const started = await startOne();
    const id = started.ok ? started.value.walkthrough.id : '';
    const kept = await ready();
    expect(await sweepPendingWalkthroughs(db.env, Date.now())).toBe(0);
    expect(await sweepPendingWalkthroughs(db.env, Date.now() + WALKTHROUGH_PENDING_MS + 1)).toBe(1);
    expect(db.objects.has(`walkthroughs/${id}/events.json`)).toBe(false);
    expect((await client().read(kept))?.ok).toBe(true);
    expect(await sweepPendingWalkthroughs({ ...db.env, MEDIA: undefined })).toBe(0);
  });

  it('runs first in the daily job', async () => {
    await startOne();
    db.sql.prepare('UPDATE walkthroughs SET created_at = 0').run();
    await worker.scheduled({} as ScheduledController, db.env);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM walkthroughs').get()).toEqual({ n: 0 });
  });
});

describe('routes that are not there', () => {
  it('answers 404 or 400', async () => {
    const call = (path: string, method = 'GET') =>
      worker.fetch(
        new Request(`https://liveworkspace.app/api/media/app${path}`, {
          method,
          headers: { Authorization: 'Bearer ld-key', 'X-Media-App': 'livediagram.app' },
        }),
        db.env,
      );
    expect((await call('/walkthroughs')).status).toBe(400);
    expect((await call('/walkthroughs', 'DELETE')).status).toBe(400);
    expect((await call('/walkthroughs', 'PUT')).status).toBe(404);
    expect((await call('/walkthroughs/x/other')).status).toBe(404);
    expect((await call('/walkthroughs/x/media', 'PUT')).status).toBe(400);
    expect((await call('/walkthroughs/x', 'PUT')).status).toBe(404);
    expect((await call('/walkthroughs/x/media')).status).toBe(404);
    expect((await call(`/walkthroughs/${'x'.repeat(201)}`)).status).toBe(404);
  });

  it('answers a ready row with no stored objects as missing', async () => {
    const id = await ready();
    db.objects.delete(`walkthroughs/${id}/media`);
    db.objects.delete(`walkthroughs/${id}/events.json`);
    expect(await client().media(id, 'doc-1')).toBeNull();
    expect(await client().read(id)).toBeNull();
  });
});

describe('renaming', () => {
  it('lets its owner rename it, and the app for its item, and nobody else', async () => {
    const id = await ready();
    const renamed = await client().rename(id, { owner: 'user_1' }, '  Launch   plan ');
    expect(renamed.ok && renamed.value.walkthrough.title).toBe('Launch plan');
    const byItem = await client().rename(id, { item: 'doc-1' }, 'From the item');
    expect(byItem.ok && byItem.value.walkthrough.title).toBe('From the item');
    const stranger = await client().rename(id, { owner: 'user_2' }, 'Mine now');
    expect(stranger.ok ? 0 : stranger.status).toBe(403);
    const otherItem = await client().rename(id, { item: 'doc-2' }, 'Elsewhere');
    expect(otherItem.ok ? 0 : otherItem.status).toBe(403);
    const blank = await client().rename(id, { owner: 'user_1' }, '   ');
    expect(blank.ok ? 0 : blank.status).toBe(400);
    const listed = await client().list('doc-1');
    expect(listed.ok && listed.value.walkthroughs[0]!.walkthrough.title).toBe('From the item');
  });
});

describe('sharing a screen recording', () => {
  const shared = (path: string, init?: RequestInit) =>
    worker.fetch(
      new Request(`https://liveworkspace.app/api/media/walkthroughs/shared/${path}`, init),
      db.env,
    );

  it('turns a public link on and off, as its owner or for its item, for a screen recording only', async () => {
    const replay = await ready();
    const notScreen = await client().share(replay, { owner: 'user_1' }, true);
    expect(notScreen.ok ? 0 : notScreen.status).toBe(409);
    const id = await ready({ screen: true });
    const stranger = await client().share(id, { owner: 'user_2' }, true);
    expect(stranger.ok ? 0 : stranger.status).toBe(403);
    const on = await client().share(id, { owner: 'user_1' }, true);
    const code = on.ok ? on.value.walkthrough.shareCode : null;
    expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    // On again keeps the same link, so one already sent goes on working.
    const again = await client().share(id, { item: 'doc-1' }, true);
    expect(again.ok && again.value.walkthrough.shareCode).toBe(code);
    expect((await shared(code!)).status).toBe(200);
    const off = await client().share(id, { owner: 'user_1' }, false);
    expect(off.ok && off.value.walkthrough.shareCode).toBeNull();
    expect((await shared(code!)).status).toBe(404);
  });

  it('answers the public page with what it shows, privately, and nothing else', async () => {
    const id = await ready({ screen: true });
    const on = await client().share(id, { owner: 'user_1' }, true);
    const code = on.ok ? on.value.walkthrough.shareCode! : '';
    const res = await shared(code);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      title: 'Tour of the canvas',
      author: 'Ada',
      app: 'livediagram.app',
      mediaType: 'video/webm',
    });
    // Never its owner, item, id or events.
    expect(Object.keys(body).sort()).toEqual([
      'app',
      'author',
      'createdAt',
      'durationMs',
      'mediaType',
      'title',
    ]);
    expect((await shared(`${code}/events`)).status).toBe(404);
    expect((await shared('not-a-code')).status).toBe(404);
    expect((await shared(code, { method: 'POST' })).status).toBe(404);
  });

  it('streams the film whole, or the range a video element asks for', async () => {
    const id = await ready({ screen: true });
    const on = await client().share(id, { owner: 'user_1' }, true);
    const code = on.ok ? on.value.walkthrough.shareCode! : '';
    const whole = await shared(`${code}/media`);
    expect(whole.status).toBe(200);
    expect(whole.headers.get('Accept-Ranges')).toBe('bytes');
    expect(whole.headers.get('Content-Length')).toBe(String(WEBM.byteLength));
    expect(new Uint8Array(await whole.arrayBuffer())).toEqual(WEBM);
    const part = await shared(`${code}/media`, { headers: { Range: 'bytes=2-5' } });
    expect(part.status).toBe(206);
    expect(part.headers.get('Content-Range')).toBe(`bytes 2-5/${WEBM.byteLength}`);
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(WEBM.slice(2, 6));
    const rest = await shared(`${code}/media`, { headers: { Range: 'bytes=10-' } });
    expect(rest.headers.get('Content-Range')).toBe(
      `bytes 10-${WEBM.byteLength - 1}/${WEBM.byteLength}`,
    );
  });

  it('reads a range header as a video element sends one, and nothing else', () => {
    expect(parseRange('bytes=0-')).toEqual({ offset: 0 });
    expect(parseRange('bytes=5-9')).toEqual({ offset: 5, length: 5 });
    expect(parseRange('bytes=9-5')).toBeNull();
    expect(parseRange('bytes=0-1,4-5')).toBeNull();
    expect(parseRange(null)).toBeNull();
  });
});
