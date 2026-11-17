// Walkthroughs at the service (liveworkspace/docs/specs/006-media/walkthroughs.md "The service's routes"): the table,
// its two objects in R2, and the routes an app's Worker calls with its key. A walkthrough answers only to its own app.

import {
  containerOf,
  MEDIA_ID_MAX,
  parseWalkthroughStart,
  sealWalkthroughEvents,
  sniffWalkthroughContainer,
  WALKTHROUGH_PENDING_MS,
  WALKTHROUGH_START_MAX_BYTES,
  WALKTHROUGHS_PER_ITEM_MAX,
  WALKTHROUGHS_PER_OWNER_LIST_MAX,
  walkthroughMediaType,
  type MediaApp,
  type Walkthrough,
  type WalkthroughEvents,
  type WalkthroughMediaType,
} from '@liveworkspace/media';
import { readCappedBody } from '@liveworkspace/api-kit/request-body';
import { parsePositiveCap, type Env } from './env';
import { badRequest, forbidden, json, notFound, ok } from './http';

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
      const { results } = await env.MEDIA_DB.prepare(
        `SELECT * FROM walkthroughs WHERE owner = ? AND app = ? AND ready = 1
          ORDER BY created_at DESC, id LIMIT ${WALKTHROUGHS_PER_OWNER_LIST_MAX}`,
      )
        .bind(owner, app)
        .all<Row>();
      return json({
        walkthroughs: results.map((row) => ({
          walkthrough: rowToWalkthrough(row),
          owner: row.owner,
        })),
      });
    }
    if (method === 'GET') {
      if (!isId(item)) return badRequest('invalid_item');
      const { results } = await env.MEDIA_DB.prepare(
        `SELECT * FROM walkthroughs WHERE app = ? AND item = ? AND ready = 1
          ORDER BY created_at DESC, id LIMIT ${WALKTHROUGHS_PER_ITEM_MAX}`,
      )
        .bind(app, item)
        .all<Row>();
      return json({
        walkthroughs: results.map((row) => ({
          walkthrough: rowToWalkthrough(row),
          owner: row.owner,
        })),
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
  const parsed = parseWalkthroughStart(body);
  if (!parsed.ok) return refused(app, parsed.refusal.status, parsed.refusal.body);
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
  const events = JSON.stringify(sealWalkthroughEvents(start.events));
  const eventsBytes = new TextEncoder().encode(events).byteLength;
  const caps: Caps = {
    max: parsePositiveCap(env.WALKTHROUGH_MAX_PER_OWNER),
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
      });
    }
    if (caps.maxBytes !== null && bytes + incoming > caps.maxBytes) {
      return refused(app, 403, {
        error: 'walkthroughs_full',
        reason: 'bytes',
        limit: caps.maxBytes,
        current: bytes,
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
  };
  // Both caps again inside the statement, so starts racing each other can't together pass one.
  const inserted = await env.MEDIA_DB.prepare(
    `INSERT INTO walkthroughs (id, owner, app, item, title, author, duration_ms, media_type, media_bytes, events_bytes, camera, ready, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, ?12
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
