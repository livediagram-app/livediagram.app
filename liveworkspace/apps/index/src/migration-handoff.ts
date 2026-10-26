// The migration's handoff (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "The migration's handoff", docs/migration.md
// step 6): livediagram's api splits a browser's Local only document from the old livediagram.app and hands each
// part that belongs to another app here, for the person it names. The index makes the item for them, as
// `POST /items` would, then has that app write it through its migration door; if the app can't, the item goes
// again, so nothing is left pointing at an empty room.

import { APP_KINDS, TITLE_MAX, type App } from '@liveworkspace/index-client';
import type { HandoffRequest, MigrationRoomPayload } from '@liveworkspace/migration/contract';
import { callApp } from './app-calls';
import { handoffPersonOf, personalScope } from './auth';
import { isId } from './codec';
import { HANDOFF_APP_TIMEOUT_MS, HANDOFF_MAX_BYTES } from './config';
import { sendDriveSignals } from './drive';
import type { Env } from './env';
import { readName } from './folders';
import { badRequest, conflict, fail, forbidden, json, notFound, unauthorized } from './http';
import { insertItem } from './items';
import type { ItemRow } from './rows';

type HandoffApp = HandoffRequest['app'];
const HANDOFF_APPS: readonly HandoffApp[] = ['liveplanner', 'livedocuments', 'livedesign'];
const isHandoffApp = (value: unknown): value is HandoffApp =>
  (HANDOFF_APPS as readonly unknown[]).includes(value);

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// The body, read once against the cap: `too_large`, or null for one that isn't a JSON object.
async function readHandoffBody(
  request: Request,
): Promise<Record<string, unknown> | null | 'too_large'> {
  if (Number(request.headers.get('Content-Length') ?? '0') > HANDOFF_MAX_BYTES) return 'too_large';
  const bytes = await request.arrayBuffer().catch(() => null);
  if (!bytes) return null;
  if (bytes.byteLength > HANDOFF_MAX_BYTES) return 'too_large';
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

// POST /app/migration/handoff, with livediagram's key (checked by the caller, app-routes.ts).
export async function handleMigrationHandoff(
  request: Request,
  env: Env,
  app: App,
  waitUntil: (promise: Promise<unknown>) => void = (p) => void p,
): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  // Only livediagram's api splits old documents.
  if (app !== 'livediagram') return forbidden('wrong_app');
  const person = handoffPersonOf(request);
  if (!person) return unauthorized();
  // Before the body is read, so a flood costs no parsing.
  if (
    env.MIGRATION_LIMITER &&
    !(await env.MIGRATION_LIMITER.limit({ key: `handoff:${person}` })).success
  ) {
    return fail(429, 'rate_limited');
  }

  const body = await readHandoffBody(request);
  if (body === 'too_large') return fail(413, 'payload_too_large');
  if (!body) return badRequest();
  const target = body.app;
  if (!isHandoffApp(target)) return badRequest('invalid_app');
  const title = readName(body.title, TITLE_MAX);
  if (!title) return badRequest('invalid_title');
  const payload = body.payload;
  if (
    !isObject(payload) ||
    payload.v !== 1 ||
    payload.app !== target ||
    !isId(payload.id) ||
    !Array.isArray(payload.tabs)
  ) {
    return badRequest();
  }
  const id = payload.id;

  // Made as POST /items makes one: the person's, at the top of their own space, in no team.
  const now = Date.now();
  const row: ItemRow = {
    id,
    app: target,
    kind: APP_KINDS[target],
    owner_id: person,
    team_id: null,
    scope: personalScope(person),
    folder_id: null,
    title,
    source: 'import',
    intent: null,
    summary: '{}',
    created_at: now,
    updated_at: now,
    trashed_at: null,
    trash_reason: null,
  };
  try {
    await insertItem(env, row, { source: 'import' }, 'created');
  } catch (err) {
    if (String(err).includes('UNIQUE')) return conflict('item_exists');
    throw err;
  }

  // The item's owner and place are the index's: the app writes the room for the person, in no team, whatever the
  // payload said.
  const door: MigrationRoomPayload = {
    ...(payload as unknown as MigrationRoomPayload),
    ownerId: person,
    teamId: null,
  };
  const outcome = await callApp(
    env,
    target,
    'PUT',
    `/items/${encodeURIComponent(id)}/migration`,
    door,
    HANDOFF_APP_TIMEOUT_MS,
  );
  if (!outcome.ok) {
    // Its `created` event goes with it (ON DELETE CASCADE).
    await env.INDEX_DB.prepare('DELETE FROM items WHERE id = ? AND app = ?').bind(id, target).run();
    console.warn('[index] migration handoff not taken', { app: target, error: outcome.error });
    return fail(502, 'migration_failed');
  }
  // The person's own tree grew: their Drive mirror, if any, catches up (a guest has none).
  if (env.DRIVE) waitUntil(sendDriveSignals(env, [person]));
  console.log('[index] migration handoff', {
    app: target,
    person: person.startsWith('guest_') ? 'guest' : 'account',
  });
  return json({ id, app: target }, { status: 201 });
}
