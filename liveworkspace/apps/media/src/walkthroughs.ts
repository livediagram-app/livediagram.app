// Walkthroughs at the service (liveworkspace/docs/specs/006-media/walkthroughs.md "The service's routes"): the table,
// its two objects in R2, and the routes an app's Worker calls with its key. A walkthrough answers only to its own app.

import {
  containerOf,
  MEDIA_ID_MAX,
  parseWalkthroughStart,
  sealWalkthroughEvents,
  sniffWalkthroughContainer,
  isWalkthroughShareCode,
  normaliseWalkthroughTitle,
  WALKTHROUGH_MAX_MS,
  WALKTHROUGH_PENDING_MS,
  WALKTHROUGH_SHARE_CODE_LENGTH,
  WALKTHROUGH_START_MAX_BYTES,
  WALKTHROUGHS_PER_ITEM_MAX,
  WALKTHROUGHS_PER_OWNER_LIST_MAX,
  walkthroughMediaType,
  type MediaApp,
  type PayerLimits,
  type Walkthrough,
  type WalkthroughEvents,
  type WalkthroughLimits,
  type WalkthroughMediaType,
  type WalkthroughShared,
} from '@liveworkspace/media';
import { readCappedBody } from '@liveworkspace/api-kit/request-body';
import { parsePositiveCap, type Env } from './env';
import { badRequest, forbidden, json, notFound, ok } from './http';
import { ownLimits, proOn, uploadLimits } from './tier';

type Row = {
  id: string;
  owner: string;
  app: MediaApp;
  item: string;
  title: string;
  author: string | null;
  duration_ms: number;
  media_type: WalkthroughMediaType;
  media_bytes: number;
  events_bytes: number;
  camera: number;
  ready: number;
  created_at: number;
  screen: number;
  share_code: string | null;
};

type Caps = { max: number | null; maxBytes: number | null };

const mediaKey = (id: string) => `walkthroughs/${id}/media`;
const eventsKey = (id: string) => `walkthroughs/${id}/events.json`;
const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MEDIA_ID_MAX;

function rowToWalkthrough(row: Row): Walkthrough {
  return {
    id: row.id,
    item: row.item,
    title: row.title,
    author: row.author,
    durationMs: row.duration_ms,
    mediaType: row.media_type,
    mediaBytes: row.media_bytes,
    camera: row.camera === 1,
    screen: row.screen === 1,
    shareCode: row.share_code,
    createdAt: row.created_at,
    ready: row.ready === 1,
  };
}

const refused = (
  app: MediaApp,
  status: number,
  body: { error: string } & Record<string, unknown>,
) => {
  console.warn('[media] walkthrough refused', { app, error: body.error });
  return json(body, { status });
};

// Its owner, or the app for an Editor of its item (the app has checked the grant).
const mayManage = (row: Row, owner: string | null, item: string | null) =>
  (isId(owner) && row.owner === owner) || (isId(item) && row.item === item);

// 22 URL-safe characters from 16 random bytes and a little more: 132 bits, unguessable.
function newShareCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(17));
  const text = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return text.slice(0, WALKTHROUGH_SHARE_CODE_LENGTH);
}

function getRow(env: Env, app: MediaApp, id: string): Promise<Row | null> {
  return env.MEDIA_DB.prepare('SELECT * FROM walkthroughs WHERE id = ? AND app = ?')
    .bind(id, app)
    .first<Row>();
}

// The row's two objects, after the row has gone: a failed delete leaves bytes nothing names, never a row without them.
async function deleteObjects(bucket: R2Bucket, ids: readonly string[]): Promise<void> {
  const keys = ids.flatMap((id) => [mediaKey(id), eventsKey(id)]);
  for (let i = 0; i < keys.length; i += 1000) {
    try {
      await bucket.delete(keys.slice(i, i + 1000));
    } catch (err) {
      console.error('[media] walkthrough R2 delete failed', err);
    }
  }
}

/**
 * A list's rows and, with Pro on, what `recorder` may record and keep: how many walkthroughs they hold in every app
 * (started ones included: what Walkthroughs Stored counts) read in the list's own batch, beside the read of their
 * limits. With Pro off, or nobody to count for, the list is the only read.
 */
async function listWithLimits(
  env: Env,
  list: D1PreparedStatement,
  recorder: string | null,
  limitsOf: (recorder: string) => Promise<PayerLimits | null>,
): Promise<{ rows: Row[]; tier: PayerLimits | null; stored: number }> {
  if (recorder === null || !proOn(env)) {
    return { rows: (await list.all<Row>()).results, tier: null, stored: 0 };
  }
  const count = env.MEDIA_DB.prepare(
    'SELECT COUNT(*) AS count FROM walkthroughs WHERE owner = ?',
  ).bind(recorder);
  const [[listed, counted], tier] = await Promise.all([
    env.MEDIA_DB.batch<Row | { count: number }>([list, count]),
    limitsOf(recorder),
  ]);
  const held = counted!.results[0] as { count: number } | undefined;
  return { rows: listed!.results as Row[], tier, stored: held?.count ?? 0 };
}

export async function handleWalkthroughs(
  request: Request,
  env: Env,
  bucket: R2Bucket,
  app: MediaApp,
  url: URL,
  segments: readonly string[],
): Promise<Response> {
  const method = request.method;
  const owner = url.searchParams.get('owner');
  const item = url.searchParams.get('item');

  if (segments.length === 1) {
    // GET /app/walkthroughs?item=: an item's ready walkthroughs, newest first.
    // GET /app/walkthroughs?owner=: a person's own ready ones in this app, newest first (the Explorer's library).
    if (method === 'GET' && item === null && owner !== null) {
      if (!isId(owner)) return badRequest('invalid_owner');
      // With Pro on, what the person's own tier keeps and how many they hold, in every app (walkthroughs.md "The
      // Explorer's Walkthroughs"): the library's usage meter. Their own tier alone: no item is named here.
      const {
        rows,
        tier: own,
        stored,
      } = await listWithLimits(
        env,
        env.MEDIA_DB.prepare(
          `SELECT * FROM walkthroughs WHERE owner = ? AND app = ? AND ready = 1
            ORDER BY created_at DESC, id LIMIT ${WALKTHROUGHS_PER_OWNER_LIST_MAX}`,
        ).bind(owner, app),
        owner,
        (person) => ownLimits(env, person),
      );
      const limits: WalkthroughLimits | null = own
        ? {
            maxMs: own.walkthroughMaxMs,
            stored,
            storedLimit: own.walkthroughsStored,
            owner: own.storageOwner,
            storedOwner: own.storageOwner,
          }
        : null;
      return json({
        walkthroughs: rows.map((row) => ({
          walkthrough: rowToWalkthrough(row),
          owner: row.owner,
        })),
        ...(limits ? { limits } : {}),
      });
    }
    if (method === 'GET') {
      if (!isId(item)) return badRequest('invalid_item');
      // `&for=<recorder>`: with Pro on, what that person may record on this item (walkthroughs.md "With Pro on").
      const recorder = url.searchParams.get('for');
      const { rows, tier, stored } = await listWithLimits(
        env,
        env.MEDIA_DB.prepare(
          `SELECT * FROM walkthroughs WHERE app = ? AND item = ? AND ready = 1
            ORDER BY created_at DESC, id LIMIT ${WALKTHROUGHS_PER_ITEM_MAX}`,
        ).bind(app, item),
        isId(recorder) ? recorder : null,
        (person) => uploadLimits(env, request, person),
      );
      const limits: WalkthroughLimits | null = tier
        ? {
            maxMs: tier.walkthroughMaxMs,
            stored,
            storedLimit: tier.walkthroughsStored,
            owner: tier.owner,
            storedOwner: tier.storageOwner,
          }
        : null;
      return json({
        walkthroughs: rows.map((row) => ({
          walkthrough: rowToWalkthrough(row),
          owner: row.owner,
        })),
        ...(limits ? { limits } : {}),
      });
    }
    // POST /app/walkthroughs?owner=: start one.
    if (method === 'POST') {
      if (!isId(owner)) return badRequest('invalid_owner');
      return start(request, env, bucket, app, owner);
    }
    // DELETE /app/walkthroughs?item=: the item was purged.
    if (method === 'DELETE') {
      if (!isId(item)) return badRequest('invalid_item');
      const gone = await env.MEDIA_DB.prepare(
        'DELETE FROM walkthroughs WHERE app = ? AND item = ? RETURNING id',
      )
        .bind(app, item)
        .all<{ id: string }>();
      const ids = gone.results.map((r) => r.id);
      await deleteObjects(bucket, ids);
      console.info('[media] walkthroughs purged', { app, deleted: ids.length });
      return json({ deleted: ids.length });
    }
    return notFound();
  }

  const id = segments[1];
  if (!isId(id)) return notFound();

  // PUT /app/walkthroughs/<id>/media?owner=: its media, streamed into R2.
  if (segments.length === 3 && segments[2] === 'media' && method === 'PUT') {
    if (!isId(owner)) return badRequest('invalid_owner');
    return putMedia(request, env, bucket, app, owner, id);
  }

  // PUT | DELETE /app/walkthroughs/<id>/share?owner= | ?item=: its public link on (a fresh code) or off.
  if (
    segments.length === 3 &&
    segments[2] === 'share' &&
    (method === 'PUT' || method === 'DELETE')
  ) {
    const row = await getRow(env, app, id);
    if (!row || row.ready !== 1) return notFound();
    if (!mayManage(row, owner, item)) return forbidden();
    if (method === 'PUT' && row.screen !== 1) return refused(app, 409, { error: 'not_screen' });
    // On keeps a code already set, so pressing it twice never breaks a link already sent.
    const code = method === 'PUT' ? (row.share_code ?? newShareCode()) : null;
    await env.MEDIA_DB.prepare('UPDATE walkthroughs SET share_code = ? WHERE id = ?')
      .bind(code, id)
      .run();
    console.info('[media] walkthrough link', { app, on: code !== null });
    return json({ walkthrough: rowToWalkthrough({ ...row, share_code: code }) });
  }

  // GET /app/walkthroughs/<id>/media?item=: its media's bytes.
  if (segments.length === 3 && segments[2] === 'media' && method === 'GET') {
    const row = await getRow(env, app, id);
    if (!row || row.ready !== 1 || (item !== null && row.item !== item)) return notFound();
    const object = await bucket.get(mediaKey(id));
    if (!object) return notFound();
    return new Response(object.body, {
      headers: {
        'Content-Type': row.media_type,
        'Content-Length': String(object.size),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  }

  if (segments.length !== 2) return notFound();

  // GET /app/walkthroughs/<id>: a ready one, whose it is, and its events.
  if (method === 'GET') {
    const row = await getRow(env, app, id);
    if (!row || row.ready !== 1) return notFound();
    const object = await bucket.get(eventsKey(id));
    if (!object) return notFound();
    const events = JSON.parse(await object.text()) as WalkthroughEvents;
    return json({ walkthrough: rowToWalkthrough(row), owner: row.owner, events });
  }

  // PATCH /app/walkthroughs/<id>?owner= | ?item=: rename it, as its owner or for an Editor of its item.
  if (method === 'PATCH') {
    const row = await getRow(env, app, id);
    if (!row || row.ready !== 1) return notFound();
    if (!mayManage(row, owner, item)) return forbidden();
    const body = (await request.json().catch(() => null)) as { title?: unknown } | null;
    if (typeof body?.title !== 'string' || !body.title.trim()) return badRequest('invalid_title');
    const title = normaliseWalkthroughTitle(body.title);
    await env.MEDIA_DB.prepare('UPDATE walkthroughs SET title = ? WHERE id = ?')
      .bind(title, id)
      .run();
    return json({ walkthrough: rowToWalkthrough({ ...row, title }) });
  }

  // DELETE /app/walkthroughs/<id>?owner= | ?item=: its owner, or the app for an Editor of its item.
  if (method === 'DELETE') {
    const row = await getRow(env, app, id);
    if (!row) return ok();
    const byOwner = isId(owner) && row.owner === owner;
    const byItem = isId(item) && row.item === item;
    if (!byOwner && !byItem) return forbidden();
    await env.MEDIA_DB.prepare('DELETE FROM walkthroughs WHERE id = ?').bind(id).run();
    await deleteObjects(bucket, [id]);
    console.info('[media] walkthrough deleted', { app, id });
    return ok();
  }

  return notFound();
}

async function start(
  request: Request,
  env: Env,
  bucket: R2Bucket,
  app: MediaApp,
  owner: string,
): Promise<Response> {
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > WALKTHROUGH_START_MAX_BYTES) return refused(app, 413, { error: 'events_too_large' });
  if (!request.body) return refused(app, 400, { error: 'invalid_body' });
  let body: unknown;
  try {
    const bytes = await readCappedBody(
      request.body as ReadableStream<Uint8Array>,
      WALKTHROUGH_START_MAX_BYTES,
    );
    if (bytes === null) return refused(app, 413, { error: 'events_too_large' });
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return refused(app, 400, { error: 'invalid_body' });
  }
  // With Pro on the longest recording is the better of the recorder's tier and the item's owner's, and how many are
  // kept is the recorder's own tier's (walkthroughs.md "With Pro on"); with it off, the caps this service always had.
  const limits = await uploadLimits(env, request, owner);
  const maxMs = limits ? limits.walkthroughMaxMs : WALKTHROUGH_MAX_MS;
  const whose = limits ? { owner: limits.owner } : {};
  const whoseStore = limits ? { owner: limits.storageOwner } : {};
  const parsed = parseWalkthroughStart(body, maxMs);
  if (!parsed.ok) {
    const refusal = parsed.refusal.body;
    const sent = (body as { events?: { durationMs?: unknown } } | null)?.events?.durationMs;
    return refused(
      app,
      parsed.refusal.status,
      limits && refusal.error === 'too_long'
        ? { ...refusal, limit: maxMs, current: sent, ...whose }
        : refusal,
    );
  }
  const { start } = parsed;

  const onItem = await env.MEDIA_DB.prepare(
    'SELECT COUNT(*) AS count FROM walkthroughs WHERE app = ? AND item = ?',
  )
    .bind(app, start.item)
    .first<{ count: number }>();
  if ((onItem?.count ?? 0) >= WALKTHROUGHS_PER_ITEM_MAX) {
    return refused(app, 403, { error: 'item_full', limit: WALKTHROUGHS_PER_ITEM_MAX });
  }

  // Sealed again here: a hidden element stays out of what is stored, whoever sent the events.
  const events = JSON.stringify(sealWalkthroughEvents(start.events, maxMs));
  const eventsBytes = new TextEncoder().encode(events).byteLength;
  const caps: Caps = {
    max: limits ? limits.walkthroughsStored : parsePositiveCap(env.WALKTHROUGH_MAX_PER_OWNER),
    maxBytes: parsePositiveCap(env.WALKTHROUGH_MAX_BYTES_PER_OWNER),
  };
  const incoming = start.mediaBytes + eventsBytes;
  const full = async () => {
    const totals = await env.MEDIA_DB.prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(media_bytes + events_bytes), 0) AS bytes
         FROM walkthroughs WHERE owner = ?`,
    )
      .bind(owner)
      .first<{ count: number; bytes: number }>();
    const count = totals?.count ?? 0;
    const bytes = totals?.bytes ?? 0;
    if (caps.max !== null && count >= caps.max) {
      return refused(app, 403, {
        error: 'walkthroughs_full',
        reason: 'count',
        limit: caps.max,
        current: count,
        ...whoseStore,
      });
    }
    if (caps.maxBytes !== null && bytes + incoming > caps.maxBytes) {
      return refused(app, 403, {
        error: 'walkthroughs_full',
        reason: 'bytes',
        limit: caps.maxBytes,
        current: bytes,
        ...whoseStore,
      });
    }
    return null;
  };
  const before = await full();
  if (before) return before;

  const id = crypto.randomUUID();
  await bucket.put(eventsKey(id), events, {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: { owner, app },
  });
  const createdAt = Date.now();
  const row: Row = {
    id,
    owner,
    app,
    item: start.item,
    title: start.title,
    author: start.author,
    duration_ms: start.events.durationMs,
    media_type: start.mediaType,
    media_bytes: start.mediaBytes,
    events_bytes: eventsBytes,
    camera: start.events.camera ? 1 : 0,
    ready: 0,
    created_at: createdAt,
    screen: start.events.screen ? 1 : 0,
    share_code: null,
  };
  // Both caps again inside the statement, so starts racing each other can't together pass one.
  const inserted = await env.MEDIA_DB.prepare(
    `INSERT INTO walkthroughs (id, owner, app, item, title, author, duration_ms, media_type, media_bytes, events_bytes, camera, ready, created_at, screen)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, ?12, ?15
     WHERE (?13 IS NULL OR (SELECT COUNT(*) FROM walkthroughs WHERE owner = ?2) < ?13)
       AND (?14 IS NULL OR (SELECT COALESCE(SUM(media_bytes + events_bytes), 0) FROM walkthroughs WHERE owner = ?2) + ?9 + ?10 <= ?14)`,
  )
    .bind(
      id,
      owner,
      app,
      row.item,
      row.title,
      row.author,
      row.duration_ms,
      row.media_type,
      row.media_bytes,
      eventsBytes,
      row.camera,
      createdAt,
      caps.max,
      caps.maxBytes,
      row.screen,
    )
    .run();
  if (!inserted.meta.changes) {
    await bucket.delete(eventsKey(id));
    return (await full()) ?? refused(app, 409, { error: 'upload_conflict' });
  }
  console.info('[media] walkthrough started', { app, id });
  return json({ walkthrough: rowToWalkthrough(row) }, { status: 201 });
}

async function putMedia(
  request: Request,
  env: Env,
  bucket: R2Bucket,
  app: MediaApp,
  owner: string,
  id: string,
): Promise<Response> {
  const row = await getRow(env, app, id);
  if (!row) return notFound();
  if (row.owner !== owner) return forbidden();
  if (row.ready === 1) return refused(app, 409, { error: 'already_uploaded' });
  const type = walkthroughMediaType(request.headers.get('Content-Type'));
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (type !== row.media_type || length !== row.media_bytes || !request.body) {
    return refused(app, 400, { error: 'media_mismatch' });
  }
  const key = mediaKey(id);
  // The runtime holds a body with a declared length to that length, so R2 takes the stream as it arrives.
  await bucket.put(key, request.body, {
    httpMetadata: { contentType: row.media_type },
    customMetadata: { owner, app },
  });
  const head = await bucket.get(key, { range: { offset: 0, length: 16 } });
  const first = head ? new Uint8Array(await head.arrayBuffer()).slice(0, 16) : new Uint8Array();
  if (!head || head.size !== row.media_bytes) {
    await bucket.delete(key);
    return refused(app, 400, { error: 'media_mismatch' });
  }
  if (sniffWalkthroughContainer(first) !== containerOf(row.media_type)) {
    await bucket.delete(key);
    return refused(app, 415, { error: 'unsupported_type' });
  }
  await env.MEDIA_DB.prepare('UPDATE walkthroughs SET ready = 1 WHERE id = ?').bind(id).run();
  console.info('[media] walkthrough stored', { app, id, bytes: row.media_bytes });
  return json({ walkthrough: rowToWalkthrough({ ...row, ready: 1 }) });
}

/** An account deleted: every walkthrough it recorded, in every app. Answers how many went. */
export async function deleteOwnerWalkthroughs(
  env: Env,
  bucket: R2Bucket,
  owner: string,
): Promise<number> {
  const gone = await env.MEDIA_DB.prepare('DELETE FROM walkthroughs WHERE owner = ? RETURNING id')
    .bind(owner)
    .all<{ id: string }>();
  const ids = gone.results.map((r) => r.id);
  await deleteObjects(bucket, ids);
  return ids.length;
}

/** A guest signed up: their walkthroughs move to the account. */
export async function mergeOwnerWalkthroughs(env: Env, from: string, to: string): Promise<number> {
  const moved = await env.MEDIA_DB.prepare('UPDATE walkthroughs SET owner = ? WHERE owner = ?')
    .bind(to, from)
    .run();
  return moved.meta.changes ?? 0;
}

/** The daily sweep's first step: starts whose media never arrived, older than an hour. */
export async function sweepPendingWalkthroughs(env: Env, now = Date.now()): Promise<number> {
  if (!env.MEDIA) return 0;
  const gone = await env.MEDIA_DB.prepare(
    'DELETE FROM walkthroughs WHERE ready = 0 AND created_at < ? RETURNING id',
  )
    .bind(now - WALKTHROUGH_PENDING_MS)
    .all<{ id: string }>();
  const ids = gone.results.map((r) => r.id);
  await deleteObjects(env.MEDIA, ids);
  if (ids.length) console.info(`[media] sweep: deleted ${ids.length} pending walkthroughs`);
  return ids.length;
}

/**
 * The public door (no app key): a screen recording whose link is on, by its code. `GET /walkthroughs/shared/<code>` its
 * name and maker, `GET /walkthroughs/shared/<code>/media` its bytes, a byte range when asked so the video seeks. Never
 * cached: a link turned off stops at once.
 */
export async function handleSharedWalkthrough(
  request: Request,
  env: Env,
  bucket: R2Bucket,
  segments: readonly string[],
): Promise<Response> {
  const code = segments[0];
  if (request.method !== 'GET' || !isWalkthroughShareCode(code) || segments.length > 2)
    return notFound();
  if (segments.length === 2 && segments[1] !== 'media') return notFound();
  const row = await env.MEDIA_DB.prepare(
    'SELECT * FROM walkthroughs WHERE share_code = ? AND ready = 1 AND screen = 1',
  )
    .bind(code)
    .first<Row>();
  if (!row) return notFound();
  if (segments.length === 1) {
    const shared: WalkthroughShared = {
      title: row.title,
      author: row.author,
      app: row.app,
      durationMs: row.duration_ms,
      mediaType: row.media_type,
      createdAt: row.created_at,
    };
    return json(shared, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  const range = parseRange(request.headers.get('Range'));
  const object = await bucket.get(mediaKey(row.id), range ? { range } : {});
  if (!object) return notFound();
  const headers = new Headers({
    'Content-Type': row.media_type,
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  if (range && 'range' in object && object.range) {
    const r = object.range as { offset?: number; length?: number };
    const offset = r.offset ?? 0;
    const length = r.length ?? object.size - offset;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { headers });
}

// A single `bytes=a-b` or `bytes=a-` range, as a video element asks; anything else is the whole file.
export function parseRange(value: string | null): { offset: number; length?: number } | null {
  const m = /^bytes=(\d+)-(\d*)$/.exec(value ?? '');
  if (!m) return null;
  const offset = Number(m[1]);
  if (!m[2]) return { offset };
  const end = Number(m[2]);
  return end >= offset ? { offset, length: end - offset + 1 } : null;
}
